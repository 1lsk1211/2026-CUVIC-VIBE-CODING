import { describe, expect, it } from "vitest";
import { getTruncatedScopes } from "./analysis-scope";

function input(commits: [number, number], pullRequests: [number, number], issues: [number, number]) {
  return {
    analyzedCommits: commits[0],
    totalCommits: commits[1],
    activity: {
      collectedPullRequests: pullRequests[0],
      totalPullRequests: pullRequests[1],
      collectedReviews: 0,
      collectedIssues: issues[0],
      totalIssues: issues[1],
    },
  };
}

describe("getTruncatedScopes", () => {
  it("모두 수집했으면 빈 배열을 반환한다", () => {
    expect(getTruncatedScopes(input([10, 10], [3, 3], [0, 0]))).toEqual([]);
  });

  it("한도로 잘린 항목만 수집 수와 전체 수를 함께 반환한다", () => {
    expect(getTruncatedScopes(input([500, 1240], [3, 3], [500, 699]))).toEqual([
      { kind: "commits", collected: 500, total: 1240 },
      { kind: "issues", collected: 500, total: 699 },
    ]);
  });

  it("PR이 잘린 경우도 반환한다", () => {
    expect(getTruncatedScopes(input([1, 1], [500, 501], [0, 0]))).toEqual([
      { kind: "pullRequests", collected: 500, total: 501 },
    ]);
  });
});
