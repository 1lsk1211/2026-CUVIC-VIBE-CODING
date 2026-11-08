import { describe, expect, it, vi } from "vitest";
import { fetchRepositoryActivity } from "./fetch-repository-activity";

const repo = { owner: "o", name: "r" };
const limits = { pullRequests: 500, issues: 500 };
const user = { __typename: "User", login: "a" };

function connection(nodes: unknown[], totalCount: number, endCursor: string | null) {
  return { totalCount, pageInfo: { hasNextPage: endCursor !== null, endCursor }, nodes };
}

function review(id: string, overrides: object = {}) {
  return {
    id: `PRR_${id}`,
    fullDatabaseId: `db-${id}`,
    url: `https://github.com/o/r/pull/1#${id}`,
    state: "APPROVED",
    submittedAt: "2026-01-02T00:00:00Z",
    author: user,
    ...overrides,
  };
}

function pullRequest(number: number, overrides: object = {}) {
  return {
    id: `PR_${number}`,
    number,
    url: `https://github.com/o/r/pull/${number}`,
    title: "pr",
    state: "MERGED",
    createdAt: "2026-01-01T00:00:00Z",
    mergedAt: "2026-01-03T00:00:00Z",
    closedAt: "2026-01-03T00:00:00Z",
    author: user,
    reviews: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] },
    ...overrides,
  };
}

function issue(number: number, overrides: object = {}) {
  return {
    number,
    url: `https://github.com/o/r/issues/${number}`,
    title: "issue",
    state: "OPEN",
    createdAt: "2026-01-01T00:00:00Z",
    closedAt: null,
    author: user,
    ...overrides,
  };
}

function page(pullRequests?: unknown, issues?: unknown, isPrivate = false) {
  return { repository: { isPrivate, pullRequests, issues } };
}

function client(...responses: unknown[]) {
  const graphql = vi.fn();
  responses.forEach((response) => graphql.mockResolvedValueOnce(response));
  return { graphql, octokit: { graphql } as never };
}

describe("fetchRepositoryActivity", () => {
  it("PR, 리뷰, 이슈를 근거 링크와 함께 변환한다", async () => {
    const { graphql, octokit } = client(
      page(
        connection(
          [
            pullRequest(1, {
              reviews: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: [review("r1")],
              },
            }),
          ],
          1,
          null,
        ),
        connection([issue(2)], 1, null),
      ),
    );

    const result = await fetchRepositoryActivity(octokit, repo, limits);

    expect(graphql).toHaveBeenCalledTimes(1);
    expect(result.totalPullRequests).toBe(1);
    expect(result.totalIssues).toBe(1);
    expect(result.pullRequests[0]).toMatchObject({
      number: 1,
      url: "https://github.com/o/r/pull/1",
      state: "MERGED",
      author: { login: "a", isBot: false },
    });
    expect(result.pullRequests[0].reviews).toEqual([
      {
        id: "db-r1",
        url: "https://github.com/o/r/pull/1#r1",
        state: "APPROVED",
        submittedAt: "2026-01-02T00:00:00Z",
        author: { login: "a", isBot: false },
      },
    ]);
    expect(result.issues[0]).toMatchObject({
      number: 2,
      url: "https://github.com/o/r/issues/2",
      author: { login: "a", isBot: false },
    });
  });

  it("탈퇴 계정은 null, 봇 계정은 isBot으로 구분한다", async () => {
    const { octokit } = client(
      page(
        connection([pullRequest(1, { author: null })], 1, null),
        connection(
          [issue(2, { author: { __typename: "Bot", login: "dependabot" } })],
          1,
          null,
        ),
      ),
    );

    const result = await fetchRepositoryActivity(octokit, repo, limits);

    expect(result.pullRequests[0].author).toBeNull();
    expect(result.issues[0].author).toEqual({ login: "dependabot", isBot: true });
  });

  it("제출하지 않은 PENDING 리뷰는 제외한다", async () => {
    const { octokit } = client(
      page(
        connection(
          [
            pullRequest(1, {
              reviews: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: [review("r1", { state: "PENDING", submittedAt: null }), review("r2")],
              },
            }),
          ],
          1,
          null,
        ),
        connection([], 0, null),
      ),
    );

    const { pullRequests } = await fetchRepositoryActivity(octokit, repo, limits);

    expect(pullRequests[0].reviews.map((item) => item.url)).toEqual([
      "https://github.com/o/r/pull/1#r2",
    ]);
  });

  it("리뷰의 숫자 ID가 없으면 노드 ID를 식별자로 쓴다", async () => {
    const { octokit } = client(
      page(
        connection(
          [
            pullRequest(1, {
              reviews: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: [review("r1", { fullDatabaseId: null })],
              },
            }),
          ],
          1,
          null,
        ),
        connection([], 0, null),
      ),
    );

    const { pullRequests } = await fetchRepositoryActivity(octokit, repo, limits);

    expect(pullRequests[0].reviews[0].id).toBe("PRR_r1");
  });

  it("끝나지 않은 쪽만 커서를 이어서 요청한다", async () => {
    const { graphql, octokit } = client(
      page(connection([pullRequest(1)], 2, "pr-1"), connection([issue(10)], 1, null)),
      page(connection([pullRequest(2)], 2, null)),
    );

    const result = await fetchRepositoryActivity(octokit, repo, limits);

    expect(result.pullRequests.map((item) => item.number)).toEqual([1, 2]);
    expect(result.issues.map((item) => item.number)).toEqual([10]);
    expect(graphql).toHaveBeenCalledTimes(2);
    expect(graphql.mock.calls[1][1]).toMatchObject({
      withPullRequests: true,
      pullRequestAfter: "pr-1",
      withIssues: false,
    });
  });

  it("limit에 도달하면 더 요청하지 않고 전체 개수는 유지한다", async () => {
    const { graphql, octokit } = client(
      page(connection([pullRequest(1)], 900, "pr-1"), connection([issue(2)], 800, "issue-1")),
    );

    const result = await fetchRepositoryActivity(octokit, repo, { pullRequests: 1, issues: 1 });

    expect(graphql).toHaveBeenCalledTimes(1);
    expect(graphql.mock.calls[0][1]).toMatchObject({ pullRequestFirst: 1, issueFirst: 1 });
    expect(result.pullRequests).toHaveLength(1);
    expect(result.totalPullRequests).toBe(900);
    expect(result.totalIssues).toBe(800);
  });

  it("리뷰가 한 페이지를 넘는 PR은 나머지 리뷰를 추가로 가져온다", async () => {
    const { graphql, octokit } = client(
      page(
        connection(
          [
            pullRequest(1, {
              reviews: {
                pageInfo: { hasNextPage: true, endCursor: "review-1" },
                nodes: [review("r1")],
              },
            }),
          ],
          1,
          null,
        ),
        connection([], 0, null),
      ),
      {
        node: {
          reviews: {
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: [review("r2")],
          },
        },
      },
    );

    const { pullRequests } = await fetchRepositoryActivity(octokit, repo, limits);

    expect(pullRequests[0].reviews).toHaveLength(2);
    expect(graphql.mock.calls[1][1]).toEqual({ id: "PR_1", after: "review-1" });
  });

  it("private 레포나 없는 레포는 not_found로 거부한다", async () => {
    const privateRepo = client(page(connection([], 0, null), connection([], 0, null), true));
    const missingRepo = client({ repository: null });

    await expect(fetchRepositoryActivity(privateRepo.octokit, repo, limits)).rejects.toMatchObject({
      kind: "not_found",
    });
    await expect(fetchRepositoryActivity(missingRepo.octokit, repo, limits)).rejects.toMatchObject({
      kind: "not_found",
    });
  });
});
