"use client";

import { useEffect, useRef, useState } from "react";
import type { TruncatedScope } from "@/lib/analysis/analysis-scope";
import type { TeamRow } from "@/lib/analysis/apply-team-mapping";
import { type ResolvedEvidence, resolveEvidence } from "@/lib/analysis/resolve-evidence";
import type { AxisScore, EvidenceKind, MemberScores } from "@/lib/analysis/score-axes";
import type { EvidenceCatalog, RepoRef, ReviewState } from "@/types/github";
import { describeRaw, describeShare, EVIDENCE_LABELS, formatNumber } from "./report-shared";

const PAGE_SIZE = 20;
const ALL_KINDS: EvidenceKind[] = ["commits", "pullRequests", "reviews", "issues"];

const REVIEW_STATE_LABELS: Record<ReviewState, string> = {
  APPROVED: "승인",
  CHANGES_REQUESTED: "변경 요청",
  COMMENTED: "코멘트",
  DISMISSED: "철회됨",
};

interface ListItem {
  key: string;
  url: string;
  title: string;
  date: string | null;
  meta: string;
}

function toListItems(resolved: ResolvedEvidence, kind: EvidenceKind): ListItem[] {
  switch (kind) {
    case "commits":
      return resolved.commits.map((item) => ({
        ...item,
        key: item.id,
        meta: item.id.slice(0, 7),
      }));
    case "pullRequests":
      return resolved.pullRequests.map((item) => ({
        ...item,
        key: String(item.id),
        meta: `#${item.id}`,
      }));
    case "issues":
      return resolved.issues.map((item) => ({
        ...item,
        key: String(item.id),
        meta: `#${item.id}`,
      }));
    case "reviews":
      return resolved.reviews.map((item) => ({
        ...item,
        key: item.id,
        meta: `PR #${item.pullNumber} · ${REVIEW_STATE_LABELS[item.state]}`,
      }));
  }
}

function describeScope(kind: EvidenceKind, scopes: readonly TruncatedScope[]): string | null {
  if (kind === "reviews") {
    return scopes.some((scope) => scope.kind === "pullRequests")
      ? "분석 범위 한도로 수집된 PR에 달린 리뷰만 포함합니다."
      : null;
  }
  const scope = scopes.find((item) => item.kind === kind);
  return scope
    ? `분석 범위 한도로 전체 ${formatNumber(scope.total)}개 중 최근 ${formatNumber(scope.collected)}개 범위만 포함합니다.`
    : null;
}

function EvidenceSection({
  heading,
  emptyLabel,
  scopeNote,
  items,
}: {
  heading: string;
  emptyLabel: string;
  scopeNote: string | null;
  items: readonly ListItem[];
}) {
  const [visible, setVisible] = useState(PAGE_SIZE);

  return (
    <div>
      <h4 className="text-sm font-medium">
        {heading} ({formatNumber(items.length)}건)
      </h4>
      {scopeNote && <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">{scopeNote}</p>}
      {items.length === 0 ? (
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          수집 범위에서 확인된 {emptyLabel} 없음
        </p>
      ) : (
        <ul className="mt-1 divide-y divide-neutral-100 text-sm dark:divide-neutral-800">
          {items.slice(0, visible).map((item) => (
            <li key={item.key} className="flex flex-wrap items-baseline gap-x-2 py-1.5">
              <time className="text-xs whitespace-nowrap text-neutral-500 tabular-nums">
                {item.date ? new Date(item.date).toLocaleDateString("ko-KR") : "날짜 없음"}
              </time>
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 break-words text-blue-700 underline-offset-2 hover:underline dark:text-blue-400"
              >
                {item.title}
                <span className="sr-only"> (새 탭에서 열림)</span>
              </a>
              <span className="text-xs text-neutral-500">{item.meta}</span>
            </li>
          ))}
        </ul>
      )}
      {items.length > visible && (
        <button
          type="button"
          onClick={() => setVisible(visible + PAGE_SIZE)}
          className="mt-1 text-sm text-blue-700 underline underline-offset-2 dark:text-blue-400"
        >
          {PAGE_SIZE}개 더 보기 ({formatNumber(items.length - visible)}개 남음)
        </button>
      )}
    </div>
  );
}

function RowEvidence({
  row,
  axis,
  catalog,
  repo,
  scopes,
}: {
  row: TeamRow;
  axis: AxisScore | null;
  catalog: EvidenceCatalog;
  repo: RepoRef;
  scopes: readonly TruncatedScope[];
}) {
  const resolved = resolveEvidence(row.evidence, catalog, repo);
  const kinds = axis?.evidenceKinds ?? ALL_KINDS;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="font-medium">
          {row.displayName} · {axis ? `${axis.label} 근거` : "전체 근거"}
        </h3>
        {axis && (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {describeRaw(axis)} · {describeShare(axis)}
          </p>
        )}
      </div>
      {kinds.map((kind) => {
        // 변경 라인처럼 같은 목록을 근거로 쓰는 지표도 제목에 함께 밝힌다.
        const metricLabels = axis?.raw
          .filter((metric) => metric.evidence === kind)
          .map((metric) => metric.label);
        return (
          <EvidenceSection
            key={`${row.id}:${axis?.axisId ?? "all"}:${kind}`}
            heading={metricLabels?.join(" · ") ?? EVIDENCE_LABELS[kind]}
            emptyLabel={EVIDENCE_LABELS[kind]}
            scopeNote={describeScope(kind, scopes)}
            items={toListItems(resolved, kind)}
          />
        );
      })}
    </div>
  );
}

export function EvidencePanel({
  rows,
  axisId,
  scores,
  catalog,
  repo,
  scopes,
  onClose,
}: {
  rows: readonly TeamRow[];
  axisId: string | null;
  scores: readonly MemberScores[];
  catalog: EvidenceCatalog;
  repo: RepoRef;
  scopes: readonly TruncatedScope[];
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const selectionKey = `${rows.map((row) => row.id).join()}|${axisId}`;

  // 표에서 이름을 눌렀을 때도 패널이 보이도록 한다.
  useEffect(() => {
    panelRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectionKey]);

  const axisOf = (row: TeamRow) =>
    scores
      .find((member) => member.id === row.id)
      ?.axes.find((axis) => axis.axisId === axisId) ?? null;

  return (
    <section
      ref={panelRef}
      aria-label="수치의 근거"
      className="rounded-lg border border-neutral-300 p-4 dark:border-neutral-700"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">수치의 근거</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-blue-700 underline underline-offset-2 dark:text-blue-400"
        >
          닫기
        </button>
      </div>
      <div className="mt-3 flex flex-col gap-6">
        {rows.map((row) => (
          <RowEvidence
            key={row.id}
            row={row}
            axis={axisOf(row)}
            catalog={catalog}
            repo={repo}
            scopes={scopes}
          />
        ))}
      </div>
    </section>
  );
}
