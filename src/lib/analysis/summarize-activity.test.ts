import { describe, expect, it } from "vitest";
import type { IssueActivity, PullRequestActivity, PullRequestReview } from "@/types/github";
import { summarizeActivity } from "./summarize-activity";

function pullRequest(reviewCount: number): PullRequestActivity {
  const review: PullRequestReview = {
    url: "https://github.com/o/r/pull/1#r",
    state: "COMMENTED",
    submittedAt: "2026-01-02T00:00:00Z",
    author: null,
  };
  return {
    number: 1,
    url: "https://github.com/o/r/pull/1",
    title: "pr",
    state: "OPEN",
    createdAt: "2026-01-01T00:00:00Z",
    mergedAt: null,
    closedAt: null,
    author: null,
    reviews: Array.from({ length: reviewCount }, () => review),
  };
}

const issue: IssueActivity = {
  number: 2,
  url: "https://github.com/o/r/issues/2",
  title: "issue",
  state: "OPEN",
  createdAt: "2026-01-01T00:00:00Z",
  closedAt: null,
  author: null,
};

describe("summarizeActivity", () => {
  it("수집 건수와 전체 건수를 구분해 계산한다", () => {
    expect(
      summarizeActivity({
        pullRequests: [pullRequest(2), pullRequest(0), pullRequest(1)],
        totalPullRequests: 10,
        issues: [issue],
        totalIssues: 4,
      }),
    ).toEqual({
      collectedPullRequests: 3,
      totalPullRequests: 10,
      collectedReviews: 3,
      collectedIssues: 1,
      totalIssues: 4,
    });
  });

  it("활동이 없으면 모두 0이다", () => {
    expect(
      summarizeActivity({ pullRequests: [], totalPullRequests: 0, issues: [], totalIssues: 0 }),
    ).toEqual({
      collectedPullRequests: 0,
      totalPullRequests: 0,
      collectedReviews: 0,
      collectedIssues: 0,
      totalIssues: 0,
    });
  });
});
