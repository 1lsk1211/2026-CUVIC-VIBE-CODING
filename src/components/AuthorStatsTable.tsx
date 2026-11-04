"use client";

import { useState } from "react";
import {
  applyTeamMapping,
  mergeIntoMapping,
  parseTeamMapping,
  removeFromMapping,
  type TeamMapping,
} from "@/lib/analysis/apply-team-mapping";
import type { AnalyzeResponse, RepoRef } from "@/types/github";

const NUMERIC_COLUMNS = ["커밋 수", "추가", "삭제", "변경 라인", "PR", "리뷰", "이슈"];

const KIND_BADGES = { ai: "AI", bot: "BOT" };

const LINK_BUTTON = "text-blue-700 underline underline-offset-2 dark:text-blue-400";

function format(value: number): string {
  return value.toLocaleString("ko-KR");
}

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

export function AuthorStatsTable({ result }: { result: AnalyzeResponse }) {
  const { activity } = result;
  // 이 컴포넌트는 분석 결과를 받은 뒤 브라우저에서만 렌더링된다.
  const [mapping, setMapping] = useState<TeamMapping>(() => loadMapping(result.repo));
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());

  const rows = applyTeamMapping(result.authors, mapping);
  const selectableIds = new Set(rows.filter((row) => row.kind === "member").map((row) => row.id));
  const selected = [...selectedIds].filter((id) => selectableIds.has(id));

  function updateMapping(next: TeamMapping) {
    setMapping(next);
    saveMapping(result.repo, next);
    setSelectedIds(new Set());
  }

  function toggleSelected(id: string) {
    const next = new Set(selectedIds);
    if (!next.delete(id)) next.add(id);
    setSelectedIds(next);
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="text-sm leading-6 text-neutral-600 dark:text-neutral-400">
        <h2 className="text-base font-semibold text-foreground">
          {result.repo.owner}/{result.repo.name}
          {result.defaultBranch && (
            <span className="ml-2 font-normal text-neutral-500">{result.defaultBranch} 브랜치</span>
          )}
        </h2>
        <p>
          커밋 {format(result.analyzedCommits)}개 중 {format(result.countedCommits)}개를
          집계했습니다.
        </p>
        <p>
          제외: 머지 커밋 {format(result.mergeCommits)}개, 생성 파일만 바꿨거나 변경 파일이 없는
          커밋 {format(result.commitsWithoutCountableFiles)}개, 생성 파일 변경{" "}
          {format(result.excludedFileChanges)}건({format(result.excludedLines)}라인)
        </p>
        {result.truncated && (
          <p className="mt-2 rounded bg-amber-100 px-3 py-2 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            전체 커밋 {format(result.totalCommits)}개 중 최근 {format(result.analyzedCommits)}개만
            분석한 결과입니다.
          </p>
        )}
        <p className="mt-2">
          수집한 활동: PR {format(activity.collectedPullRequests)}개, 리뷰{" "}
          {format(activity.collectedReviews)}개, 이슈 {format(activity.collectedIssues)}개
        </p>
        {result.unattributedActivities > 0 && (
          <p>
            작성자 계정 정보가 없는 활동 {format(result.unattributedActivities)}건은 작성자별
            수치에 포함되지 않았습니다.
          </p>
        )}
        {(activity.totalPullRequests > activity.collectedPullRequests ||
          activity.totalIssues > activity.collectedIssues) && (
          <p className="mt-2 rounded bg-amber-100 px-3 py-2 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            전체 PR {format(activity.totalPullRequests)}개, 이슈 {format(activity.totalIssues)}개 중
            최근 항목만 수집한 결과입니다.
          </p>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">집계할 활동이 없습니다.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <button
              type="button"
              disabled={selected.length < 2}
              onClick={() => updateMapping(mergeIntoMapping(mapping, selected))}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 font-medium disabled:opacity-50 dark:border-neutral-700"
            >
              선택한 {format(selected.length)}명을 같은 팀원으로 묶기
            </button>
            <span className="text-xs text-neutral-500">
              묶음은 이 브라우저에만 저장되며, 다른 기기나 팀원에게 공유되지 않습니다.
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-100 dark:bg-neutral-900">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    작성자
                  </th>
                  {NUMERIC_COLUMNS.map((column) => (
                    <th key={column} scope="col" className="px-4 py-3 text-right font-medium whitespace-nowrap">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <th scope="row" className="min-w-56 px-4 py-3 font-normal">
                      <div className="flex items-center gap-2">
                        {row.kind === "member" && (
                          <input
                            type="checkbox"
                            aria-label={`${row.displayName} 선택`}
                            checked={selectedIds.has(row.id)}
                            onChange={() => toggleSelected(row.id)}
                          />
                        )}
                        <span>{row.displayName}</span>
                        {row.kind !== "member" && (
                          <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-xs font-medium dark:bg-neutral-800">
                            {KIND_BADGES[row.kind]}
                          </span>
                        )}
                        {!row.isLinked && row.kind === "member" && (
                          <span className="text-xs text-neutral-500">GitHub 계정 미연결</span>
                        )}
                      </div>
                      {row.aliases.length > 0 && (
                        <p className="mt-1 text-xs text-neutral-500">
                          함께 묶음: {row.aliases.join(", ")}{" "}
                          <button
                            type="button"
                            onClick={() => updateMapping(removeFromMapping(mapping, row.sourceIds[0]))}
                            className={LINK_BUTTON}
                          >
                            묶음 해제
                          </button>
                        </p>
                      )}
                      {row.possibleSameAs.map((other) => (
                        <p key={other.id} className="mt-1 text-xs text-neutral-500">
                          {other.displayName}와(과) 같은 사람일 가능성 있음{" "}
                          <button
                            type="button"
                            onClick={() => updateMapping(mergeIntoMapping(mapping, [row.id, other.id]))}
                            className={LINK_BUTTON}
                          >
                            묶기
                          </button>
                        </p>
                      ))}
                    </th>
                    <td className="px-4 py-3 text-right tabular-nums">{format(row.commits)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{format(row.additions)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{format(row.deletions)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{format(row.changedLines)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{format(row.pullRequests)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{format(row.reviews)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{format(row.issues)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="text-xs text-neutral-500">
        이 수치는 대화를 위한 활동 근거이며, 기여도를 판정하지 않습니다. 이름만 같은 작성자는
        자동으로 합치지 않습니다. 본인 PR에 남긴 리뷰는 리뷰 수에 포함하지 않습니다.
      </p>
    </section>
  );
}
