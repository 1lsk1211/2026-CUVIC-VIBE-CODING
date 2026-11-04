import { Octokit } from "octokit";
import { GitHubApiError } from "./errors";

const DO_NOT_RETRY_STATUSES = [400, 401, 403, 404, 410, 422, 429, 451];

/** 서버 전용. 토큰은 env에서만 읽고 로그나 응답에 포함하지 않는다. */
export function createGitHubClient(): Octokit {
  const auth = process.env.GITHUB_TOKEN;
  if (!auth) throw new GitHubApiError("config");

  return new Octokit({
    auth,
    // 기본 설정은 한도가 풀릴 때까지 요청을 붙잡아 둔다. 대기하지 않고 사용자에게 바로 안내한다.
    throttle: { enabled: false },
    retry: { doNotRetry: DO_NOT_RETRY_STATUSES },
  });
}
