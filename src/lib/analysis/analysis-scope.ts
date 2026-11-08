import type { AnalyzeResponse } from "@/types/github";

export interface TruncatedScope {
  kind: "commits" | "pullRequests" | "issues";
  collected: number;
  total: number;
}

/** 분석 한도로 일부만 수집한 항목을 반환한다. 리뷰는 수집된 PR에 달린 것만 들어온다. */
export function getTruncatedScopes(
  result: Pick<AnalyzeResponse, "analyzedCommits" | "totalCommits" | "activity">,
): TruncatedScope[] {
  const { analyzedCommits, totalCommits, activity } = result;
  const scopes: TruncatedScope[] = [
    { kind: "commits", collected: analyzedCommits, total: totalCommits },
    {
      kind: "pullRequests",
      collected: activity.collectedPullRequests,
      total: activity.totalPullRequests,
    },
    { kind: "issues", collected: activity.collectedIssues, total: activity.totalIssues },
  ];
  return scopes.filter((scope) => scope.total > scope.collected);
}
