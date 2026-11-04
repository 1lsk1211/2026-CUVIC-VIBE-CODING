import { describe, expect, it, vi } from "vitest";
import type { CommitSummary } from "@/types/github";
import { fetchCommitDetails, mapWithConcurrency } from "./fetch-commit-details";

const repo = { owner: "o", name: "r" };

function summary(sha: string, parentCount = 1): CommitSummary {
  return {
    sha,
    url: `https://github.com/o/r/commit/${sha}`,
    message: "msg",
    committedAt: "2026-01-01T00:00:00Z",
    parentCount,
    author: { login: "a", name: "A", email: null },
  };
}

function apiFile(filename: string) {
  return { filename, additions: 1, deletions: 2, changes: 3, status: "modified" };
}

describe("mapWithConcurrency", () => {
  it("동시 실행 수를 넘지 않고 입력 순서대로 반환한다", async () => {
    let running = 0;
    let peak = 0;

    const results = await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async (value) => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, (8 - value) % 3));
      running -= 1;
      return value * 10;
    });

    expect(peak).toBe(3);
    expect(results).toEqual([10, 20, 30, 40, 50, 60, 70]);
  });

  it("실패하면 reject하고 남은 작업을 시작하지 않는다", async () => {
    const task = vi.fn(async (value: number) => {
      if (value === 1) throw new Error("fail");
      return value;
    });

    await expect(mapWithConcurrency([1, 2, 3, 4], 1, task)).rejects.toThrow("fail");
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("빈 입력을 처리한다", async () => {
    await expect(mapWithConcurrency([], 5, async (value) => value)).resolves.toEqual([]);
  });
});

describe("fetchCommitDetails", () => {
  it("파일 내역을 변환해 붙인다", async () => {
    const request = vi.fn().mockResolvedValue({
      data: { files: [apiFile("src/a.ts")] },
      headers: {},
    });

    const [commit] = await fetchCommitDetails({ request } as never, repo, [summary("abc")]);

    expect(commit.files).toEqual([{ path: "src/a.ts", additions: 1, deletions: 2 }]);
    expect(request.mock.calls[0][1]).toMatchObject({ owner: "o", repo: "r", ref: "abc" });
  });

  it("Link 헤더에 다음 페이지가 있으면 이어서 가져온다", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        data: { files: [apiFile("a.ts")] },
        headers: { link: '<https://api.github.com/x?page=2>; rel="next"' },
      })
      .mockResolvedValueOnce({
        data: { files: [apiFile("b.ts")] },
        headers: { link: '<https://api.github.com/x?page=1>; rel="prev"' },
      });

    const [commit] = await fetchCommitDetails({ request } as never, repo, [summary("abc")]);

    expect(commit.files.map((file) => file.path)).toEqual(["a.ts", "b.ts"]);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1][1]).toMatchObject({ page: 2 });
  });

  it("머지 커밋은 상세를 요청하지 않는다", async () => {
    const request = vi.fn();

    const [commit] = await fetchCommitDetails({ request } as never, repo, [summary("merge", 2)]);

    expect(request).not.toHaveBeenCalled();
    expect(commit.files).toEqual([]);
  });

  it("files가 없는 응답을 처리한다", async () => {
    const request = vi.fn().mockResolvedValue({ data: {}, headers: {} });

    const [commit] = await fetchCommitDetails({ request } as never, repo, [summary("abc")]);

    expect(commit.files).toEqual([]);
  });
});
