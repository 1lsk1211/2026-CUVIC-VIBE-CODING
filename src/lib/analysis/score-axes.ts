import type { AuthorEvidence } from "@/types/github";
import type { TeamRow } from "./apply-team-mapping";

type NumericKey<T> = { [K in keyof T]: T[K] extends number ? K : never }[keyof T];

export type ScoreMetricKey = NumericKey<TeamRow>;

export type EvidenceKind = keyof AuthorEvidence;

/** 팀원 수로 똑같이 나눈 몫에 해당하는 점수 */
export const EVEN_SHARE_SCORE = 50;

export interface ScoreMetric {
  key: ScoreMetricKey;
  label: string;
  weight: number;
  /** 이 수치의 근거가 들어 있는 목록 */
  evidence: EvidenceKind;
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
      { key: "commits", label: "커밋", weight: 1, evidence: "commits" },
      { key: "changedLines", label: "변경 라인", weight: 1, evidence: "commits" },
      { key: "pullRequests", label: "PR", weight: 1, evidence: "pullRequests" },
    ],
  },
  {
    id: "review",
    label: "리뷰",
    metrics: [{ key: "reviews", label: "리뷰", weight: 1, evidence: "reviews" }],
  },
  {
    id: "planning",
    label: "이슈·기획",
    metrics: [{ key: "issues", label: "이슈", weight: 1, evidence: "issues" }],
  },
];

export interface RawMetric {
  key: ScoreMetricKey;
  label: string;
  value: number;
  evidence: EvidenceKind;
}

export interface AxisScore {
  axisId: string;
  label: string;
  /** 0~100. 50은 팀원 수로 똑같이 나눈 몫, 100은 그 2배 이상이다. */
  score: number;
  /** 팀 합계에서 차지하는 비중(%) */
  share: number;
  /** 점수의 바탕이 된 원래 수치 */
  raw: RawMetric[];
  /** 이 축의 근거가 들어 있는 목록. 중복 없음 */
  evidenceKinds: EvidenceKind[];
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
        score: Math.round(Math.min((share * members.length * EVEN_SHARE_SCORE) / 100, 100)),
        share: Math.round(share),
        raw: axis.metrics.map(({ key, label, evidence }) => ({
          key,
          label,
          value: member[key],
          evidence,
        })),
        evidenceKinds: [...new Set(axis.metrics.map((metric) => metric.evidence))],
      };
    }),
  }));
}
