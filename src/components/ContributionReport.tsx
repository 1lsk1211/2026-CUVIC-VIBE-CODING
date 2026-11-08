"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { getTruncatedScopes, type TruncatedScope } from "@/lib/analysis/analysis-scope";
import {
  applyTeamMapping,
  parseTeamMapping,
  type TeamMapping,
} from "@/lib/analysis/apply-team-mapping";
import { scoreTeamRows } from "@/lib/analysis/score-axes";
import type { AnalyzeResponse, RepoRef } from "@/types/github";
import { AuthorStatsTable } from "./AuthorStatsTable";
import { EvidencePanel } from "./EvidencePanel";
import {
  type CompareEntry,
  EVIDENCE_LABELS,
  type EvidenceSelection,
  formatNumber,
  MAX_COMPARE,
} from "./report-shared";

// 분석 결과가 나온 뒤에만 차트 라이브러리를 불러온다.
const RadarCards = dynamic(() => import("./RadarCards").then((module) => module.RadarCards), {
  ssr: false,
  loading: () => (
    <p role="status" className="text-sm text-neutral-600 dark:text-neutral-400">
      차트를 불러오는 중입니다.
    </p>
  ),
});

function getStorageKey({ owner, name }: RepoRef): string {
  return `team-mapping:${owner}/${name}`.toLowerCase();
}

// 비공개 창 등에서는 저장소를 쓸 수 없으므로, 그때는 저장 없이 화면에서만 적용한다.
function loadMapping(repo: RepoRef): TeamMapping {
  try {
    return parseTeamMapping(localStorage.getItem(getStorageKey(repo)));
  } catch {
    return [];
  }
}

function saveMapping(repo: RepoRef, mapping: TeamMapping): void {
  try {
    localStorage.setItem(getStorageKey(repo), JSON.stringify(mapping));
  } catch {
    // 저장에 실패해도 현재 화면의 묶음은 유지한다.
  }
}

function describeTruncation(scopes: readonly TruncatedScope[]): string {
  const parts = scopes.map(
    ({ kind, collected, total }) =>
      `${EVIDENCE_LABELS[kind]} 전체 ${formatNumber(total)}개 중 최근 ${formatNumber(collected)}개`,
  );
  return `분석 범위 한도로 일부만 포함했습니다: ${parts.join(", ")}. 차트와 근거 모두 이 범위를 기준으로 합니다.`;
}

export function ContributionReport({ result }: { result: AnalyzeResponse }) {
  const { activity } = result;
  // 이 컴포넌트는 분석 결과를 받은 뒤 브라우저에서만 렌더링된다.
  const [mapping, setMapping] = useState<TeamMapping>(() => loadMapping(result.repo));
  const [compare, setCompare] = useState<readonly CompareEntry[]>([]);
  const [selection, setSelection] = useState<EvidenceSelection | null>(null);

  const rows = useMemo(() => applyTeamMapping(result.authors, mapping), [result.authors, mapping]);
  const scores = useMemo(() => scoreTeamRows(rows), [rows]);
  const scopes = getTruncatedScopes(result);

  // 묶기로 사라진 행은 선택에서 자동으로 빠진다.
  const activeCompare = compare.filter((entry) => scores.some((member) => member.id === entry.id));
  const selectedRows = selection ? rows.filter((row) => selection.rowIds.includes(row.id)) : [];
  const activeSelection = selectedRows.length > 0 ? selection : null;

  function updateMapping(next: TeamMapping) {
    setMapping(next);
    saveMapping(result.repo, next);
  }

  function toggleCompare(id: string) {
    if (activeCompare.some((entry) => entry.id === id)) {
      setCompare(activeCompare.filter((entry) => entry.id !== id));
      return;
    }
    if (activeCompare.length >= MAX_COMPARE) return;

    const usedSlots = new Set(activeCompare.map((entry) => entry.slot));
    const slot = Array.from({ length: MAX_COMPARE }, (_, index) => index).find(
      (candidate) => !usedSlots.has(candidate),
    );
    if (slot !== undefined) setCompare([...activeCompare, { id, slot }]);
  }

  function select(next: EvidenceSelection) {
    const isSame =
      activeSelection?.axisId === next.axisId &&
      activeSelection.rowIds.join() === next.rowIds.join();
    setSelection(isSame ? null : next);
  }

  const selectMember = (id: string) => select({ rowIds: [id], axisId: null });
  const selectAxis = (rowIds: string[], axisId: string) => select({ rowIds, axisId });

  return (
    <section className="flex flex-col gap-6">
      <div className="text-sm leading-6 text-neutral-600 dark:text-neutral-400">
        <h2 className="text-base font-semibold text-foreground">
          {result.repo.owner}/{result.repo.name}
          {result.defaultBranch && (
            <span className="ml-2 font-normal text-neutral-500">{result.defaultBranch} 브랜치</span>
          )}
        </h2>
        <p>
          커밋 {formatNumber(result.analyzedCommits)}개 중 {formatNumber(result.countedCommits)}개를
          집계했습니다.
        </p>
        <p>
          제외: 머지 커밋 {formatNumber(result.mergeCommits)}개, 생성 파일만 바꿨거나 변경 파일이
          없는 커밋 {formatNumber(result.commitsWithoutCountableFiles)}개, 생성 파일 변경{" "}
          {formatNumber(result.excludedFileChanges)}건({formatNumber(result.excludedLines)}라인)
        </p>
        <p className="mt-2">
          수집한 활동: PR {formatNumber(activity.collectedPullRequests)}개, 리뷰{" "}
          {formatNumber(activity.collectedReviews)}개, 이슈 {formatNumber(activity.collectedIssues)}
          개
        </p>
        {result.unattributedActivities > 0 && (
          <p>
            작성자 계정 정보가 없는 활동 {formatNumber(result.unattributedActivities)}건은 작성자별
            수치에 포함되지 않았습니다.
          </p>
        )}
        {scopes.length > 0 && (
          <p className="mt-2 rounded bg-amber-100 px-3 py-2 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            {describeTruncation(scopes)}
          </p>
        )}
        <p className="mt-2">
          GitHub에 기록된 활동만 반영합니다. 회의, 설계 논의 등은 아직 포함되지 않습니다.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">집계할 활동이 없습니다.</p>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">팀원별 활동</h2>
            {scores.length === 0 ? (
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                차트로 비교할 팀원 활동이 없습니다.
              </p>
            ) : (
              <RadarCards
                members={scores}
                compare={activeCompare}
                selection={activeSelection}
                onToggleCompare={toggleCompare}
                onSelectMember={selectMember}
                onSelectAxis={selectAxis}
              />
            )}
          </div>

          {activeSelection && (
            <EvidencePanel
              rows={selectedRows}
              axisId={activeSelection.axisId}
              scores={scores}
              catalog={result.evidenceCatalog}
              repo={result.repo}
              scopes={scopes}
              onClose={() => setSelection(null)}
            />
          )}

          <AuthorStatsTable
            rows={rows}
            mapping={mapping}
            onMappingChange={updateMapping}
            selectedRowId={
              activeSelection?.axisId === null && activeSelection.rowIds.length === 1
                ? activeSelection.rowIds[0]
                : null
            }
            onSelectRow={selectMember}
          />
        </>
      )}
    </section>
  );
}
