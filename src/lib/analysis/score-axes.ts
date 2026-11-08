import type { TeamRow } from "./apply-team-mapping";

type NumericKey<T> = { [K in keyof T]: T[K] extends number ? K : never }[keyof T];

export type ScoreMetricKey = NumericKey<TeamRow>;

export interface ScoreMetric {
  key: ScoreMetricKey;
  weight: number;
}

export interface ScoreAxis {
  id: string;
  label: string;
  metrics: readonly ScoreMetric[];
}

/** 축을 추가할 때는 이 배열만 고친다. */
export const SCORE_AXES: readonly ScoreAxis[] = [
  {
    id: "code",
    label: "코드",
    metrics: [
      { key: "commits", weight: 1 },
      { key: "changedLines", weight: 1 },
      { key: "pullRequests", weight: 1 },
    ],
  },
  { id: "review", label: "리뷰", metrics: [{ key: "reviews", weight: 1 }] },
  { id: "planning", label: "이슈·기획", metrics: [{ key: "issues", weight: 1 }] },
];

export interface AxisScore {
  axisId: string;
  label: string;
  /** 0~100. 50은 팀원 수로 똑같이 나눈 몫, 100은 그 2배 이상이다. */
  score: number;
  /** 팀 합계에서 차지하는 비중(%) */
  share: number;
  /** 점수의 바탕이 된 원래 수치 */
  raw: Partial<Record<ScoreMetricKey, number>>;
}

export interface MemberScores {
  id: string;
  displayName: string;
  axes: AxisScore[];
}

/**
 * 팀원별 축 점수를 계산한다. AI와 BOT은 인원수와 합계에 넣지 않는다.
 * 순위처럼 보이지 않도록 입력 순서를 유지하고 종합 점수는 만들지 않는다.
 */
export function scoreTeamRows(
  rows: readonly TeamRow[],
  axes: readonly ScoreAxis[] = SCORE_AXES,
): MemberScores[] {
  const members = rows.filter((row) => row.kind === "member");

  const axisShares = axes.map((axis) => {
    // 팀 전체가 0인 지표는 나눌 수 없으므로 빼고 남은 지표끼리 평균을 낸다.
    const metrics = axis.metrics.flatMap((metric) => {
      const total = members.reduce((sum, member) => sum + member[metric.key], 0);
      return total > 0 && metric.weight > 0 ? [{ ...metric, total }] : [];
    });
    const totalWeight = metrics.reduce((sum, metric) => sum + metric.weight, 0);

    return (member: TeamRow) =>
      totalWeight === 0
        ? 0
        : metrics.reduce(
            (sum, { key, weight, total }) => sum + (weight * member[key]) / total,
            0,
          ) / totalWeight;
  });

  return members.map((member) => ({
    id: member.id,
    displayName: member.displayName,
    axes: axes.map((axis, index) => {
      const share = axisShares[index](member) * 100;
      return {
        axisId: axis.id,
        label: axis.label,
        score: Math.round(Math.min((share * members.length) / 2, 100)),
        share: Math.round(share),
        raw: Object.fromEntries(axis.metrics.map(({ key }) => [key, member[key]])),
      };
    }),
  }));
}
