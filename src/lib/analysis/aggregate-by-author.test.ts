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
        commits: 2,
        additions: 21,
        deletions: 7,
        changedLines: 28,
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

  it("이메일이 달라도 login이 없으면 매핑 전까지 별도 행으로 둔다", () => {
    const result = aggregateByAuthor([
      commit({ login: null, name: "민수", email: "a@example.com" }, [source]),
      commit({ login: null, name: "민수", email: "b@example.com" }, [source]),
    ]);

    expect(result.authors.map((author) => author.id)).toEqual(["unlinked:1", "unlinked:2"]);
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
    });
  });
});
