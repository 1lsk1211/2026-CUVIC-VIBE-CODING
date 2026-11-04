export type GitHubErrorKind =
  | "config"
  | "auth"
  | "not_found"
  | "forbidden"
  | "rate_limited"
  | "unknown";

const MESSAGES: Record<GitHubErrorKind, string> = {
  config: "서버에 GITHUB_TOKEN이 설정되어 있지 않습니다.",
  auth: "서버의 GitHub 토큰이 유효하지 않습니다.",
  not_found: "레포를 찾을 수 없습니다. URL과 공개 여부를 확인해 주세요.",
  forbidden: "GitHub에서 이 레포에 대한 접근을 허용하지 않았습니다.",
  rate_limited: "GitHub API 요청 한도에 도달했습니다.",
  unknown: "GitHub API 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.",
};

export class GitHubApiError extends Error {
  constructor(
    readonly kind: GitHubErrorKind,
    readonly retryAt: Date | null = null,
  ) {
    super(MESSAGES[kind]);
    this.name = "GitHubApiError";
  }
}

type Headers = Record<string, string | number | undefined>;

/** retry-after(초)를 우선하고, 없으면 x-ratelimit-reset(epoch 초)으로 재시도 시각을 계산한다. */
export function getRetryAt(headers: Headers, now: Date): Date | null {
  const retryAfter = Number(headers["retry-after"]);
  if (headers["retry-after"] !== undefined && Number.isFinite(retryAfter)) {
    return new Date(now.getTime() + retryAfter * 1000);
  }
  const reset = Number(headers["x-ratelimit-reset"]);
  if (headers["x-ratelimit-reset"] !== undefined && Number.isFinite(reset)) {
    return new Date(reset * 1000);
  }
  return null;
}

interface OctokitLikeError {
  status?: number;
  message?: string;
  headers?: Headers;
  response?: { headers?: Headers };
  errors?: { type?: string }[];
}

/** Octokit의 REST·GraphQL 오류를 사용자에게 안내할 수 있는 오류로 변환한다. */
export function toGitHubApiError(error: unknown, now: Date = new Date()): GitHubApiError {
  if (error instanceof GitHubApiError) return error;
  if (typeof error !== "object" || error === null) return new GitHubApiError("unknown");

  const { status, message, headers, response, errors } = error as OctokitLikeError;
  const responseHeaders = response?.headers ?? headers ?? {};
  const rateLimited = () => new GitHubApiError("rate_limited", getRetryAt(responseHeaders, now));

  // GraphQL은 HTTP 200으로 응답하면서 errors에 원인을 담을 수 있다.
  const graphqlTypes = errors?.map((item) => item.type) ?? [];
  if (graphqlTypes.includes("RATE_LIMITED")) return rateLimited();
  if (graphqlTypes.includes("NOT_FOUND")) return new GitHubApiError("not_found");

  switch (status) {
    case 401:
      return new GitHubApiError("auth");
    case 404:
      return new GitHubApiError("not_found");
    case 429:
      return rateLimited();
    case 403:
      // 403은 권한 문제와 레이트 리밋 양쪽에 쓰이므로 헤더와 메시지로 구분한다.
      return responseHeaders["retry-after"] !== undefined ||
        String(responseHeaders["x-ratelimit-remaining"]) === "0" ||
        /rate limit/i.test(message ?? "")
        ? rateLimited()
        : new GitHubApiError("forbidden");
    default:
      return new GitHubApiError("unknown");
  }
}
