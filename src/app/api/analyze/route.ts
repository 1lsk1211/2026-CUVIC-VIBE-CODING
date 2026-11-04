import { z } from "zod";
import { aggregateByAuthor } from "@/lib/analysis/aggregate-by-author";
import { summarizeActivity } from "@/lib/analysis/summarize-activity";
import { createGitHubClient } from "@/lib/github/client";
import { type GitHubErrorKind, toGitHubApiError } from "@/lib/github/errors";
import { fetchCommitDetails } from "@/lib/github/fetch-commit-details";
import { fetchCommits } from "@/lib/github/fetch-commits";
import { fetchRepositoryActivity } from "@/lib/github/fetch-repository-activity";
import { parseRepoUrl } from "@/lib/github/parse-repo-url";
import type { AnalyzeErrorResponse, AnalyzeResponse } from "@/types/github";

const requestSchema = z.object({ repoUrl: z.string().max(300) });

const STATUS_BY_KIND: Record<GitHubErrorKind, number> = {
  config: 500,
  auth: 500,
  not_found: 404,
  forbidden: 403,
  rate_limited: 429,
  unknown: 502,
};

function errorResponse(status: number, body: AnalyzeErrorResponse) {
  return Response.json(body, { status });
}

export async function POST(request: Request) {
  const body = requestSchema.safeParse(await request.json().catch(() => null));
  const repo = body.success ? parseRepoUrl(body.data.repoUrl) : null;
  if (!repo) {
    return errorResponse(400, {
      error: "GitHub 레포 URL을 입력해 주세요. 예: https://github.com/owner/repo",
    });
  }

  try {
    const octokit = createGitHubClient();
    const { defaultBranch, totalCommits, commits } = await fetchCommits(octokit, repo);
    // 요청 수가 많은 커밋 상세보다 먼저 수집해, 실패하면 빠르게 안내한다.
    const activity = await fetchRepositoryActivity(octokit, repo);
    const withFiles = await fetchCommitDetails(octokit, repo, commits);

    const response: AnalyzeResponse = {
      ...aggregateByAuthor(withFiles),
      repo,
      defaultBranch,
      analyzedCommits: commits.length,
      totalCommits,
      truncated: totalCommits > commits.length,
      activity: summarizeActivity(activity),
    };
    return Response.json(response);
  } catch (error) {
    const apiError = toGitHubApiError(error);
    // 원본 오류 객체에는 요청 헤더가 들어 있을 수 있어 종류만 기록한다.
    console.error(`[analyze] GitHub 요청 실패: ${apiError.kind}`);
    return errorResponse(STATUS_BY_KIND[apiError.kind], {
      error: apiError.message,
      ...(apiError.retryAt && { retryAt: apiError.retryAt.toISOString() }),
    });
  }
}
