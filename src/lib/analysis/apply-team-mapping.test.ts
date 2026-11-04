import { describe, expect, it } from "vitest";
import type { AuthorStats } from "@/types/github";
import {
  applyTeamMapping,
  mergeIntoMapping,
  parseTeamMapping,
  removeFromMapping,
} from "./apply-team-mapping";

function author(id: string, overrides: Partial<AuthorStats> = {}): AuthorStats {
  return {
    id,
    displayName: id,
    isLinked: false,
    kind: "member",
    commits: 1,
    additions: 10,
    deletions: 2,
    changedLines: 12,
    pullRequests: 1,
    reviews: 2,
    issues: 3,
    possibleSameAs: [],
    ...overrides,
  };
}

describe("applyTeamMapping", () => {
  it("묶은 작성자의 수치를 합치고 연결된 계정 이름을 대표로 표시한다", () => {
    const rows = applyTeamMapping(
      [author("a"), author("b", { isLinked: true, displayName: "bob" }), author("c")],
      [["a", "b"]],
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: "b",
      displayName: "bob",
      isLinked: true,
      sourceIds: ["a", "b"],
      aliases: ["a"],
      commits: 2,
      additions: 20,
      deletions: 4,
      changedLines: 24,
      pullRequests: 2,
      reviews: 4,
      issues: 6,
    });
    expect(rows[1]).toMatchObject({ id: "c", commits: 1, sourceIds: ["c"], aliases: [] });
  });

  it("같은 사람일 가능성은 행 단위로 표시하고 묶으면 사라진다", () => {
    const authors = [
      author("a", { possibleSameAs: ["b"] }),
      author("b", { possibleSameAs: ["a"] }),
    ];

    expect(applyTeamMapping(authors, [])[0].possibleSameAs).toEqual([
      { id: "b", displayName: "b" },
    ]);
    expect(applyTeamMapping(authors, [["a", "b"]])[0].possibleSameAs).toEqual([]);
  });

  it("AI와 봇은 묶지 않고 팀원 뒤에 AI, BOT 순서로 둔다", () => {
    const rows = applyTeamMapping(
      [
        author("a-bot", { kind: "bot" }),
        author("b-ai", { kind: "ai" }),
        author("z-member"),
      ],
      [["a-bot", "z-member"]],
    );

    expect(rows.map((row) => [row.id, row.sourceIds])).toEqual([
      ["z-member", ["z-member"]],
      ["b-ai", ["b-ai"]],
      ["a-bot", ["a-bot"]],
    ]);
  });

  it("현재 결과에 없는 id와 겹치는 id를 무시한다", () => {
    const rows = applyTeamMapping(
      [author("a"), author("b"), author("c")],
      [
        ["a", "gone"],
        ["b", "c"],
        ["c", "a"],
      ],
    );

    expect(rows.map((row) => row.sourceIds)).toEqual([["a"], ["b", "c"]]);
  });
});

describe("mergeIntoMapping", () => {
  it("겹치는 묶음을 합치고 다른 묶음은 유지한다", () => {
    expect(mergeIntoMapping([["a", "b"], ["x", "y"]], ["b", "c"])).toEqual([
      ["x", "y"],
      ["b", "c", "a"],
    ]);
  });

  it("두 명 미만이면 바꾸지 않는다", () => {
    const mapping = [["a", "b"]];
    expect(mergeIntoMapping(mapping, ["c"])).toBe(mapping);
    expect(mergeIntoMapping(mapping, ["c", "c"])).toBe(mapping);
  });
});

describe("removeFromMapping", () => {
  it("해당 id가 속한 묶음만 해제한다", () => {
    expect(removeFromMapping([["a", "b"], ["c", "d"]], "b")).toEqual([["c", "d"]]);
  });
});

describe("parseTeamMapping", () => {
  it("올바른 형식을 읽는다", () => {
    expect(parseTeamMapping('[["a","b"]]')).toEqual([["a", "b"]]);
  });

  it.each([[null], [""], ["{깨진 JSON"], ['{"a":1}'], ["[[1,2]]"]])(
    "저장값이 없거나 잘못되면 빈 매핑을 반환한다: %j",
    (raw) => {
      expect(parseTeamMapping(raw)).toEqual([]);
    },
  );
});
