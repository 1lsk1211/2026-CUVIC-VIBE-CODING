"use client";

import { useState } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { EVEN_SHARE_SCORE, type MemberScores } from "@/lib/analysis/score-axes";
import {
  type CompareEntry,
  describeRaw,
  describeShare,
  type EvidenceSelection,
  MAX_COMPARE,
  seriesColor,
} from "./report-shared";

const INITIAL_CARDS = 12;
const NEUTRAL_COLOR = "var(--chart-neutral)";
const BUTTON_ACTIVE = "bg-neutral-100 dark:bg-neutral-800";

interface ChartSeries {
  member: MemberScores;
  color: string;
}

function AxisTooltip({
  active,
  axisId,
  series,
}: {
  active?: boolean;
  axisId?: string;
  series: readonly ChartSeries[];
}) {
  if (!active || !axisId) return null;

  return (
    <div className="rounded-lg border border-neutral-200 bg-background px-3 py-2 text-xs shadow-sm dark:border-neutral-700">
      {series.map(({ member, color }) => {
        const axis = member.axes.find((item) => item.axisId === axisId);
        if (!axis) return null;
        return (
          <p key={member.id} className="flex items-center gap-1.5 py-0.5">
            {series.length > 1 && (
              <span aria-hidden className="size-2 rounded-full" style={{ background: color }} />
            )}
            <span className="font-medium">{series.length > 1 ? member.displayName : axis.label}</span>
            <span className="text-neutral-600 dark:text-neutral-400">
              {describeShare(axis)} ({describeRaw(axis)})
            </span>
          </p>
        );
      })}
    </div>
  );
}

function TeamRadar({
  series,
  height,
  onSelectAxis,
}: {
  series: readonly ChartSeries[];
  height: number;
  onSelectAxis: (axisId: string) => void;
}) {
  const axes = series[0].member.axes;
  // 작성자 id에는 차트 라이브러리의 경로 표기와 겹치는 문자가 올 수 있어 순번을 키로 쓴다.
  const data = axes.map((axis, axisIndex) => ({
    axisId: axis.axisId,
    baseline: EVEN_SHARE_SCORE,
    ...Object.fromEntries(
      series.map(({ member }, index) => [`series${index}`, member.axes[axisIndex].score]),
    ),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} outerRadius="68%">
        <PolarGrid stroke="var(--chart-grid)" />
        <PolarRadiusAxis domain={[0, 100]} tickCount={5} tick={false} axisLine={false} />
        <PolarAngleAxis
          dataKey="axisId"
          tick={({ x, y, textAnchor, payload }) => {
            const axisId = String(payload.value);
            return (
              <text
                x={x}
                y={y}
                textAnchor={textAnchor}
                dominantBaseline="central"
                onClick={() => onSelectAxis(axisId)}
                className="cursor-pointer fill-neutral-700 text-xs hover:underline dark:fill-neutral-300"
              >
                {axes.find((axis) => axis.axisId === axisId)?.label}
              </text>
            );
          }}
        />
        <Radar
          dataKey="baseline"
          stroke="var(--chart-baseline)"
          strokeDasharray="4 3"
          strokeWidth={1}
          fill="none"
          isAnimationActive={false}
        />
        {series.map(({ member, color }, index) => (
          <Radar
            key={member.id}
            name={member.displayName}
            dataKey={`series${index}`}
            stroke={color}
            strokeWidth={2}
            fill={color}
            fillOpacity={0.15}
            dot={{ r: 3, fill: color, stroke: "var(--background)", strokeWidth: 1 }}
            isAnimationActive={false}
          />
        ))}
        <Tooltip
          cursor={false}
          isAnimationActive={false}
          content={({ active, payload }) => (
            <AxisTooltip active={active} axisId={payload?.[0]?.payload?.axisId} series={series} />
          )}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

function OverlayChart({
  series,
  selection,
  onSelectAxis,
}: {
  series: readonly ChartSeries[];
  selection: EvidenceSelection | null;
  onSelectAxis: (rowIds: string[], axisId: string) => void;
}) {
  const rowIds = series.map(({ member }) => member.id);
  const isSelected = (axisId: string) =>
    selection?.axisId === axisId && selection.rowIds.join() === rowIds.join();

  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {series.map(({ member, color }) => (
          <li key={member.id} className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-full" style={{ background: color }} />
            {member.displayName}
          </li>
        ))}
      </ul>
      <TeamRadar
        series={series}
        height={320}
        onSelectAxis={(axisId) => onSelectAxis(rowIds, axisId)}
      />
      <ul className="mt-2 flex flex-col gap-1 text-sm">
        {series[0].member.axes.map((axis) => (
          <li key={axis.axisId}>
            <button
              type="button"
              aria-pressed={isSelected(axis.axisId)}
              onClick={() => onSelectAxis(rowIds, axis.axisId)}
              className={`w-full rounded px-2 py-1 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                isSelected(axis.axisId) ? BUTTON_ACTIVE : ""
              }`}
            >
              <span className="font-medium">{axis.label}</span>
              <span className="ml-2 text-xs text-neutral-600 dark:text-neutral-400">
                {series
                  .map(({ member }) => {
                    const item = member.axes.find((other) => other.axisId === axis.axisId);
                    return item ? `${member.displayName}: ${describeShare(item)}` : "";
                  })
                  .join(" / ")}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RadarCards({
  members,
  compare,
  selection,
  onToggleCompare,
  onSelectMember,
  onSelectAxis,
}: {
  members: readonly MemberScores[];
  compare: readonly CompareEntry[];
  selection: EvidenceSelection | null;
  onToggleCompare: (id: string) => void;
  onSelectMember: (id: string) => void;
  onSelectAxis: (rowIds: string[], axisId: string) => void;
}) {
  const [visibleCards, setVisibleCards] = useState(INITIAL_CARDS);

  const slotById = new Map(compare.map((entry) => [entry.id, entry.slot]));
  const overlaySeries = members.flatMap((member) => {
    const slot = slotById.get(member.id);
    return slot === undefined ? [] : [{ member, color: seriesColor(slot) }];
  });
  const axisNotes = members[0].axes.filter((axis) => axis.raw.length > 1);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 text-xs text-neutral-600 dark:text-neutral-400">
        <p>점선은 팀원 수로 똑같이 나눈 몫이고, 바깥쪽 끝은 그 2배 이상입니다.</p>
        {axisNotes.map((axis) => (
          <p key={axis.axisId}>
            {axis.label} 축은 {axis.raw.map((metric) => metric.label).join(", ")} 비중의 평균입니다.
          </p>
        ))}
        <p role="status">
          겹쳐 보기 {compare.length}/{MAX_COMPARE}명
          {compare.length < 2 && " · 카드에서 2명 이상 선택하면 한 차트에 겹쳐 볼 수 있습니다."}
        </p>
      </div>

      {overlaySeries.length >= 2 && (
        <OverlayChart series={overlaySeries} selection={selection} onSelectAxis={onSelectAxis} />
      )}

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {members.slice(0, visibleCards).map((member) => {
          const slot = slotById.get(member.id);
          const isCompared = slot !== undefined;
          const isMemberSelected =
            selection?.axisId === null && selection.rowIds.join() === member.id;
          const isAxisSelected = (axisId: string) =>
            selection?.axisId === axisId && selection.rowIds.join() === member.id;

          return (
            <li
              key={member.id}
              className="flex min-w-0 flex-col rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"
            >
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  aria-pressed={isMemberSelected}
                  aria-label={`${member.displayName} 전체 근거 보기`}
                  onClick={() => onSelectMember(member.id)}
                  className={`min-w-0 truncate rounded px-1 text-left font-medium hover:underline ${
                    isMemberSelected ? BUTTON_ACTIVE : ""
                  }`}
                >
                  {member.displayName}
                </button>
                <label className="flex shrink-0 items-center gap-1 text-xs text-neutral-600 dark:text-neutral-400">
                  <input
                    type="checkbox"
                    aria-label={`${member.displayName} 겹쳐 보기`}
                    checked={isCompared}
                    disabled={!isCompared && compare.length >= MAX_COMPARE}
                    onChange={() => onToggleCompare(member.id)}
                  />
                  겹쳐 보기
                </label>
              </div>

              <TeamRadar
                series={[{ member, color: isCompared ? seriesColor(slot) : NEUTRAL_COLOR }]}
                height={200}
                onSelectAxis={(axisId) => onSelectAxis([member.id], axisId)}
              />

              <ul className="flex flex-col gap-0.5 text-sm">
                {member.axes.map((axis) => (
                  <li key={axis.axisId}>
                    <button
                      type="button"
                      aria-pressed={isAxisSelected(axis.axisId)}
                      onClick={() => onSelectAxis([member.id], axis.axisId)}
                      className={`w-full rounded px-2 py-1 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                        isAxisSelected(axis.axisId) ? BUTTON_ACTIVE : ""
                      }`}
                    >
                      <span className="flex flex-wrap justify-between gap-x-2">
                        <span className="font-medium">{axis.label}</span>
                        <span className="text-neutral-600 dark:text-neutral-400">
                          {describeShare(axis)}
                        </span>
                      </span>
                      <span className="block text-xs text-neutral-500">{describeRaw(axis)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>

      {members.length > visibleCards && (
        <button
          type="button"
          onClick={() => setVisibleCards(visibleCards + INITIAL_CARDS)}
          className="self-start rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium dark:border-neutral-700"
        >
          카드 더 보기 ({members.length - visibleCards}명 남음)
        </button>
      )}
    </div>
  );
}
