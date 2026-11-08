import { describe, expect, it } from "vitest";
import type { AuthorEvidence, EvidenceCatalog } from "@/types/github";
import { resolveEvidence } from "./resolve-evidence";

const repo = { owner: "o", name: "r" };

const catalog: EvidenceCatalog = {
  commits: {
    old: { title: "이전 커밋", date: "2026-01-01T00:00:00Z" },
    new: { title: "최근 커밋", date: "2026-02-01T00:00:00Z" },
  },
  pullRequests: { 1: { title: "PR 제목", date: "2026-01-01T00:00:00Z" } },
  reviews: {
    "123": { pullNumber: 1, state: "APPROVED", date: "2026-01-02T00:00:00Z" },
    PRR_node: { pullNumber: 1, state: "COMMENTED", date: null },
  },
  issues: { 2: { title: "이슈 제목", date: "2026-01-03T00:00:00Z" } },
};

function evidence(overrides: Partial<AuthorEvidence>): AuthorEvidence {
  return { commits: [], pullRequests: [], reviews: [], issues: [], ...overrides };
}

describe("resolveEvidence", () => {
  it("커밋, PR, 이슈에 URL과 제목, 날짜를 붙인다", () => {
    const result = resolveEvidence(
      evidence({ commits: ["old"], pullRequests: [1], issues: [2] }),
      catalog,
      repo,
    );

    expect(result.commits).toEqual([
      {
        id: "old",
        url: "https://github.com/o/r/commit/old",
        title: "이전 커밋",
        date: "2026-01-01T00:00:00Z",
      },
    ]);
    expect(result.pullRequests).toEqual([
      {
        id: 1,
        url: "https://github.com/o/r/pull/1",
        title: "PR 제목",
        date: "2026-01-01T00:00:00Z",
      },
    ]);
    expect(result.issues).toEqual([
      {
        id: 2,
        url: "https://github.com/o/r/issues/2",
        title: "이슈 제목",
        date: "2026-01-03T00:00:00Z",
      },
    ]);
  });

  it("리뷰에 PR 제목을 붙이고 숫자 ID로 리뷰 위치까지 연결한다", () => {
    const { reviews } = resolveEvidence(evidence({ reviews: ["123"] }), catalog, repo);

    expect(reviews).toEqual([
      {
        id: "123",
        pullNumber: 1,
        state: "APPROVED",
        date: "2026-01-02T00:00:00Z",
        title: "PR 제목",
        url: "https://github.com/o/r/pull/1#pullrequestreview-123",
      },
    ]);
  });

  it("숫자 ID가 없는 리뷰는 PR 페이지로 연결한다", () => {
    const { reviews } = resolveEvidence(evidence({ reviews: ["PRR_node"] }), catalog, repo);

    expect(reviews[0].url).toBe("https://github.com/o/r/pull/1");
  });

  it("최신순으로 정렬한다", () => {
    const { commits } = resolveEvidence(evidence({ commits: ["old", "new"] }), catalog, repo);

    expect(commits.map((item) => item.id)).toEqual(["new", "old"]);
  });

  it("날짜가 없는 항목은 뒤로 보낸다", () => {
    const { reviews } = resolveEvidence(
      evidence({ reviews: ["PRR_node", "123"] }),
      catalog,
      repo,
    );

    expect(reviews.map((item) => item.id)).toEqual(["123", "PRR_node"]);
  });
});
