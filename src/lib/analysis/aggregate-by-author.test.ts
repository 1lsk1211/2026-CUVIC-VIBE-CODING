import { describe, expect, it } from "vitest";
import type { CommitAuthor, CommitWithFiles, FileChange } from "@/types/github";
import { aggregateByAuthor } from "./aggregate-by-author";

const alice: CommitAuthor = { login: "alice", name: "Alice Kim", email: "a@example.com" };

function commit(
  author: CommitAuthor,
  files: FileChange[],
  parentCount = 1,
): CommitWithFiles {
  return {
    sha: "sha",
    url: "https://github.com/o/r/commit/sha",
    message: "msg",
    committedAt: "2026-01-01T00:00:00Z",
    parentCount,
    author,
    files,
  };
}

const source: FileChange = { path: "src/a.ts", additions: 10, deletions: 2 };
const lockFile: FileChange = { path: "package-lock.json", additions: 500, deletions: 100 };

describe("aggregateByAuthor", () => {
  it("작성자별 커밋 수와 라인 수를 합산한다", () => {
    const result = aggregateByAuthor([
      commit(alice, [source]),
      commit(alice, [{ path: "src/b.ts", additions: 1, deletions: 3 }, source]),
    ]);

    expect(result.authors).toEqual([
      {
        id: "login:alice",
        displayName: "alice",
        isLinked: true,
        kind: "member",
        commits: 2,
        additions: 21,
        deletions: 7,
        changedLines: 28,
        pullRequests: 0,
        reviews: 0,
        issues: 0,
        possibleSameAs: [],
      },
    ]);
    expect(result.countedCommits).toBe(2);
  });

  it("생성 파일의 라인은 제외하되 같은 커밋의 소스 변경은 집계한다", () => {
    const result = aggregateByAuthor([commit(alice, [source, lockFile])]);

    expect(result.authors[0]).toMatchObject({ commits: 1, additions: 10, deletions: 2 });
    expect(result.excludedFileChanges).toBe(1);
    expect(result.excludedLines).toBe(600);
  });

  it("생성 파일만 바꾼 커밋과 빈 커밋은 커밋 수에 넣지 않는다", () => {
    const result = aggregateByAuthor([commit(alice, [lockFile]), commit(alice, [])]);

    expect(result.authors).toEqual([]);
    expect(result.countedCommits).toBe(0);
    expect(result.commitsWithoutCountableFiles).toBe(2);
    expect(result.excludedLines).toBe(600);
  });

  it("머지 커밋은 파일 내역이 있어도 집계하지 않는다", () => {
    const result = aggregateByAuthor([commit(alice, [source], 2)]);

    expect(result.authors).toEqual([]);
    expect(result.mergeCommits).toBe(1);
    expect(result.commitsWithoutCountableFiles).toBe(0);
  });

  it("login이 다른 대소문자여도 같은 작성자로 합친다", () => {
    const result = aggregateByAuthor([
      commit(alice, [source]),
      commit({ ...alice, login: "Alice" }, [source]),
    ]);

    expect(result.authors).toHaveLength(1);
    expect(result.authors[0].commits).toBe(2);
  });

  it("login이 null이면 이메일로 묶고 이름을 표시한다", () => {
    const result = aggregateByAuthor([
      commit({ login: null, name: "민수", email: "Minsu@Example.com" }, [source]),
      commit({ login: null, name: "민수 노트북", email: "minsu@example.com" }, [source]),
    ]);

    expect(result.authors).toHaveLength(1);
    expect(result.authors[0]).toMatchObject({
      displayName: "민수",
      isLinked: false,
      commits: 2,
    });
  });

  it("이름만 같은 작성자는 합치지 않고 같은 사람일 가능성만 표시한다", () => {
    const result = aggregateByAuthor([
      commit({ login: null, name: "민수", email: "a@example.com" }, [source]),
      commit({ login: null, name: " 민수 ", email: "b@example.com" }, [source]),
      commit({ login: null, name: "지영", email: "c@example.com" }, [source]),
    ]);

    expect(result.authors).toHaveLength(3);
    const [first, second, third] = result.authors;
    expect(first.possibleSameAs).toEqual([second.id]);
    expect(second.possibleSameAs).toEqual([first.id]);
    expect(third.possibleSameAs).toEqual([]);
  });

  it("미연결 작성자의 이름이 다른 계정의 로그인과 같아도 가능성만 표시한다", () => {
    const result = aggregateByAuthor([
      commit(alice, [source]),
      commit({ login: null, name: "Alice", email: "other@example.com" }, [source]),
    ]);

    expect(result.authors).toHaveLength(2);
    expect(result.authors[0].possibleSameAs).toEqual([result.authors[1].id]);
  });

  it("미연결 작성자의 id는 다시 집계해도 같고 이메일 원문을 담지 않는다", () => {
    const commits = [commit({ login: null, name: "민수", email: "minsu@example.com" }, [source])];
    const [first] = aggregateByAuthor(commits).authors;
    const [second] = aggregateByAuthor(commits).authors;

    expect(first.id).toMatch(/^unlinked:[0-9a-f]{16}$/);
    expect(first.id).toBe(second.id);
  });

  it("noreply 이메일과 로그인과 연결된 이메일을 한 사람으로 통합한다", () => {
    const result = aggregateByAuthor([
      commit(alice, [source]),
      commit({ login: null, name: "A", email: "1+alice@users.noreply.github.com" }, [source]),
      commit({ login: null, name: "앨리스", email: "a@example.com" }, [source]),
    ]);

    expect(result.authors).toHaveLength(1);
    expect(result.authors[0]).toMatchObject({ id: "login:alice", isLinked: true, commits: 3 });
  });

  it("AI와 봇 계정을 분류하고 팀원과의 이름 일치 표시에서 제외한다", () => {
    const result = aggregateByAuthor([
      commit({ login: "claude", name: "Claude", email: "noreply@anthropic.com" }, [source]),
      commit({ login: null, name: "dependabot[bot]", email: null }, [source]),
      commit({ login: null, name: "Claude", email: "claude@example.com" }, [source]),
    ]);

    const byId = new Map(result.authors.map((author) => [author.displayName, author]));
    expect(byId.get("claude")).toMatchObject({ kind: "ai", possibleSameAs: [] });
    expect(byId.get("dependabot[bot]")).toMatchObject({ kind: "bot" });
    expect(byId.get("Claude")).toMatchObject({ kind: "member", possibleSameAs: [] });
  });

  it("PR·리뷰·이슈를 작성자별로 세고 활동만 있는 작성자도 포함한다", () => {
    const pullRequest = {
      number: 1,
      url: "https://github.com/o/r/pull/1",
      title: "pr",
      state: "MERGED" as const,
      createdAt: "2026-01-01T00:00:00Z",
      mergedAt: null,
      closedAt: null,
    };
    const review = {
      id: "1",
      url: "https://github.com/o/r/pull/1#r",
      state: "APPROVED" as const,
      submittedAt: "2026-01-02T00:00:00Z",
    };
    const aliceAccount = { login: "Alice", isBot: false };
    const bobAccount = { login: "bob", isBot: false };

    const result = aggregateByAuthor([commit(alice, [source])], {
      pullRequests: [
        {
          ...pullRequest,
          author: aliceAccount,
          reviews: [
            { ...review, author: bobAccount },
            { ...review, author: aliceAccount },
            { ...review, author: null },
          ],
        },
        { ...pullRequest, author: null, reviews: [] },
      ],
      totalPullRequests: 2,
      issues: [
        {
          number: 2,
          url: "https://github.com/o/r/issues/2",
          title: "issue",
          state: "OPEN",
          createdAt: "2026-01-01T00:00:00Z",
          closedAt: null,
          author: { login: "renovate", isBot: true },
        },
      ],
      totalIssues: 1,
    });

    expect(result.authors.map((author) => [author.displayName, author.kind])).toEqual([
      ["alice", "member"],
      ["bob", "member"],
      ["renovate", "bot"],
    ]);
    expect(result.authors[0]).toMatchObject({ commits: 1, pullRequests: 1, reviews: 0 });
    expect(result.authors[1]).toMatchObject({ commits: 0, reviews: 1 });
    expect(result.authors[2]).toMatchObject({ commits: 0, issues: 1 });
    expect(result.unattributedActivities).toBe(2);
  });

  it("이메일과 이름이 모두 없어도 처리한다", () => {
    const result = aggregateByAuthor([
      commit({ login: null, name: null, email: null }, [source]),
    ]);

    expect(result.authors[0]).toMatchObject({ displayName: "이름 없음", isLinked: false });
  });

  it("결과 어디에도 이메일을 포함하지 않는다", () => {
    const result = aggregateByAuthor([
      commit(alice, [source]),
      commit({ login: null, name: "민수", email: "minsu@example.com" }, [source]),
    ]);

    expect(JSON.stringify(result)).not.toContain("@example.com");
  });

  it("수치와 무관하게 이름순으로 정렬한다", () => {
    const result = aggregateByAuthor([
      commit({ login: "zed", name: null, email: null }, [lockFile, source, source, source]),
      commit(alice, [source]),
    ]);

    expect(result.authors.map((author) => author.displayName)).toEqual(["alice", "zed"]);
  });

  it("빈 입력을 처리한다", () => {
    expect(aggregateByAuthor([])).toEqual({
      authors: [],
      countedCommits: 0,
      mergeCommits: 0,
      commitsWithoutCountableFiles: 0,
      excludedFileChanges: 0,
      excludedLines: 0,
      unattributedActivities: 0,
    });
  });
});
