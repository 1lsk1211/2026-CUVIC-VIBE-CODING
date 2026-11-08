import type { AxisScore, EvidenceKind } from "@/lib/analysis/score-axes";

export const MAX_COMPARE = 3;

export const EVIDENCE_LABELS: Record<EvidenceKind, string> = {
  commits: "커밋",
  pullRequests: "PR",
  reviews: "리뷰",
  issues: "이슈",
};

/** 겹쳐 보기에 고른 팀원. 색 슬롯은 다른 팀원을 해제해도 바뀌지 않는다. */
export interface CompareEntry {
  id: string;
  slot: number;
}

/** 근거 패널에 펼친 대상. axisId가 null이면 전체 근거를 보여준다. */
export interface EvidenceSelection {
  rowIds: string[];
  axisId: string | null;
}

export function formatNumber(value: number): string {
  return value.toLocaleString("ko-KR");
}

export function seriesColor(slot: number): string {
  return `var(--chart-series-${slot + 1})`;
}

/** 수치를 평가하는 표현 없이 비중만 서술한다. */
export function describeShare({ raw, share }: AxisScore): string {
  if (raw.every((metric) => metric.value === 0)) return "수집 범위에서 확인된 기록 없음";
  return share === 0 ? "팀 내 비중 1% 미만" : `팀 내 비중 ${share}%`;
}

export function describeRaw({ raw }: AxisScore): string {
  return raw.map((metric) => `${metric.label} ${formatNumber(metric.value)}`).join(" · ");
}
