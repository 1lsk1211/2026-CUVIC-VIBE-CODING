import { describe, expect, it, vi } from "vitest";
import { fetchCommits } from "./fetch-commits";

const repo = { owner: "o", name: "r" };

function node(oid: string, author: unknown = { name: "A", email: "a@x.com", user: { login: "a" } }) {
  return {
    oid,
    url: `https://github.com/o/r/commit/${oid}`,
    messageHeadline: "msg",
    committedDate: "2026-01-01T00:00:00Z",
    parents: { totalCount: 1 },
    author,
  };
}

function page(nodes: unknown[], totalCount: number, endCursor: string | null, isPrivate = false) {
  return {
    repository: {
      isPrivate,
      defaultBranchRef: {
        name: "main",
        target: {
          history: {
            totalCount,
            pageInfo: { hasNextPage: endCursor !== null, endCursor },
            nodes,
          },
        },
      },
    },
  };
}

function client(...responses: unknown[]) {
  const graphql = vi.fn();
  responses.forEach((response) => graphql.mockResolvedValueOnce(response));
  return { graphql, octokit: { graphql } as never };
}

describe("fetchCommits", () => {
  it("다음 페이지 커서를 따라가며 모두 수집한다", async () => {
    const { graphql, octokit } = client(
      page([node("1")], 2, "cursor-1"),
      page([node("2")], 2, null),
    );

    const result = await fetchCommits(octokit, repo);

    expect(result.commits.map((commit) => commit.sha)).toEqual(["1", "2"]);
    expect(result.totalCommits).toBe(2);
    expect(result.defaultBranch).toBe("main");
    expect(graphql.mock.calls[1][1]).toMatchObject({ after: "cursor-1" });
  });

  it("limit에 도달하면 더 요청하지 않고 전체 개수는 유지한다", async () => {
    const { graphql, octokit } = client(page([node("1"), node("2")], 900, "cursor-1"));

    const result = await fetchCommits(octokit, repo, 2);

    expect(graphql).toHaveBeenCalledTimes(1);
    expect(graphql.mock.calls[0][1]).toMatchObject({ first: 2 });
    expect(result.commits).toHaveLength(2);
    expect(result.totalCommits).toBe(900);
  });

  it("작성자 user나 author가 null이어도 처리한다", async () => {
    const { octokit } = client(
      page([node("1", { name: "민수", email: "m@x.com", user: null }), node("2", null)], 2, null),
    );

    const { commits } = await fetchCommits(octokit, repo);

    expect(commits[0].author).toEqual({ login: null, name: "민수", email: "m@x.com" });
    expect(commits[1].author).toEqual({ login: null, name: null, email: null });
  });

  it("private 레포는 not_found로 거부한다", async () => {
    const { octokit } = client(page([node("1")], 1, null, true));

    await expect(fetchCommits(octokit, repo)).rejects.toMatchObject({ kind: "not_found" });
  });

  it("커밋이 없는 빈 레포를 처리한다", async () => {
    const { octokit } = client({ repository: { isPrivate: false, defaultBranchRef: null } });

    await expect(fetchCommits(octokit, repo)).resolves.toEqual({
      defaultBranch: null,
      totalCommits: 0,
      commits: [],
    });
  });
});
