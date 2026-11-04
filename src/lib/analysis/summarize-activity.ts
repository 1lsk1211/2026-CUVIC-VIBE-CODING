import type { ActivitySummary, RepositoryActivity } from "@/types/github";

/** 수집한 PR·리뷰·이슈의 건수를 계산한다. 작성자별 집계는 포함하지 않는다. */
export function summarizeActivity(activity: RepositoryActivity): ActivitySummary {
  return {
    collectedPullRequests: activity.pullRequests.length,
    totalPullRequests: activity.totalPullRequests,
    collectedReviews: activity.pullRequests.reduce(
      (total, pullRequest) => total + pullRequest.reviews.length,
      0,
    ),
    collectedIssues: activity.issues.length,
    totalIssues: activity.totalIssues,
  };
}
