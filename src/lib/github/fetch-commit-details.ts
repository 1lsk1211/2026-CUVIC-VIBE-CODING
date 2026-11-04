import type { Octokit } from "octokit";
import type { CommitSummary, CommitWithFiles, FileChange, RepoRef } from "@/types/github";

export const DETAIL_CONCURRENCY = 5;

/** 입력 순서를 유지하며 동시 실행 수를 제한한다. 하나가 실패하면 새 작업을 시작하지 않는다. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  let failed = false;

  async function worker(): Promise<void> {
    while (!failed && nextIndex < items.length) {
      const index = nextIndex++;
      try {
        results[index] = await task(items[index]);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function fetchCommitFiles(
  octokit: Pick<Octokit, "request">,
  repo: RepoRef,
  sha: string,
): Promise<FileChange[]> {
  const files: FileChange[] = [];

  // 파일이 많은 커밋은 files가 나뉘어 오므로 Link 헤더를 따라간다.
  for (let page = 1; ; page += 1) {
    const response = await octokit.request("GET /repos/{owner}/{repo}/commits/{ref}", {
      owner: repo.owner,
      repo: repo.name,
      ref: sha,
      page,
    });

    for (const file of response.data.files ?? []) {
      files.push({
        path: file.filename,
        additions: file.additions,
        deletions: file.deletions,
      });
    }

    if (!response.headers.link?.includes('rel="next"')) return files;
  }
}

/** 커밋별 파일 변경 내역을 붙인다. 머지 커밋은 집계하지 않으므로 요청하지 않는다. */
export function fetchCommitDetails(
  octokit: Pick<Octokit, "request">,
  repo: RepoRef,
  commits: readonly CommitSummary[],
): Promise<CommitWithFiles[]> {
  return mapWithConcurrency(commits, DETAIL_CONCURRENCY, async (commit) => ({
    ...commit,
    files: commit.parentCount > 1 ? [] : await fetchCommitFiles(octokit, repo, commit.sha),
  }));
}
