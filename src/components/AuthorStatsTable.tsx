"use client";

import { useState } from "react";
import {
  mergeIntoMapping,
  removeFromMapping,
  type TeamMapping,
  type TeamRow,
} from "@/lib/analysis/apply-team-mapping";
import { formatNumber as format } from "./report-shared";

const NUMERIC_COLUMNS = ["커밋 수", "추가", "삭제", "변경 라인", "PR", "리뷰", "이슈"];

const KIND_BADGES = { ai: "AI", bot: "BOT" };

const LINK_BUTTON = "text-blue-700 underline underline-offset-2 dark:text-blue-400";

export function AuthorStatsTable({
  rows,
  mapping,
  onMappingChange,
  selectedRowId,
  onSelectRow,
}: {
  rows: readonly TeamRow[];
  mapping: TeamMapping;
  onMappingChange: (next: TeamMapping) => void;
  selectedRowId: string | null;
  onSelectRow: (id: string) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());

  const members = rows.filter((row) => row.kind === "member");
  const others = rows.filter((row) => row.kind !== "member");
  const selectableIds = new Set(members.map((row) => row.id));
  const selected = [...selectedIds].filter((id) => selectableIds.has(id));

  function updateMapping(next: TeamMapping) {
    onMappingChange(next);
    setSelectedIds(new Set());
  }

  function toggleSelected(id: string) {
    const next = new Set(selectedIds);
    if (!next.delete(id)) next.add(id);
    setSelectedIds(next);
  }

  function renderRow(row: TeamRow) {
    return (
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
            <button
              type="button"
              aria-pressed={selectedRowId === row.id}
              aria-label={`${row.displayName} 전체 근거 보기`}
              onClick={() => onSelectRow(row.id)}
              className={`rounded px-1 text-left hover:underline ${
                selectedRowId === row.id ? "bg-neutral-100 dark:bg-neutral-800" : ""
              }`}
            >
              {row.displayName}
            </button>
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
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-semibold">수치 표</h2>
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
                <th
                  key={column}
                  scope="col"
                  className="px-4 py-3 text-right font-medium whitespace-nowrap"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {members.map(renderRow)}
            {others.length > 0 && (
              <tr className="bg-neutral-50 dark:bg-neutral-900/50">
                <th
                  scope="colgroup"
                  colSpan={NUMERIC_COLUMNS.length + 1}
                  className="px-4 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-400"
                >
                  AI·BOT (차트 비교 제외)
                </th>
              </tr>
            )}
            {others.map(renderRow)}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-neutral-500">
        이 수치는 대화를 위한 활동 근거이며, 기여도를 판정하지 않습니다. 이름만 같은 작성자는
        자동으로 합치지 않습니다. 본인 PR에 남긴 리뷰는 리뷰 수에 포함하지 않습니다.
      </p>
    </div>
  );
}
