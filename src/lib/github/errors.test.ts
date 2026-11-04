import { describe, expect, it } from "vitest";
import { GitHubApiError, toGitHubApiError } from "./errors";

const now = new Date("2026-01-01T00:00:00Z");

function restError(status: number, headers = {}, message = "error") {
  return { status, message, response: { headers } };
}

describe("toGitHubApiError", () => {
  it.each([
    [401, "auth"],
    [404, "not_found"],
    [500, "unknown"],
  ])("HTTP %i → %s", (status, kind) => {
    expect(toGitHubApiError(restError(status), now).kind).toBe(kind);
  });

  it("429는 retry-after로 재시도 시각을 계산한다", () => {
    const error = toGitHubApiError(restError(429, { "retry-after": "60" }), now);

    expect(error.kind).toBe("rate_limited");
    expect(error.retryAt?.toISOString()).toBe("2026-01-01T00:01:00.000Z");
  });

  it("403에 남은 요청이 0이면 x-ratelimit-reset 시각을 쓴다", () => {
    const reset = String(Date.parse("2026-01-01T01:00:00Z") / 1000);
    const error = toGitHubApiError(
      restError(403, { "x-ratelimit-remaining": "0", "x-ratelimit-reset": reset }),
      now,
    );

    expect(error.kind).toBe("rate_limited");
    expect(error.retryAt?.toISOString()).toBe("2026-01-01T01:00:00.000Z");
  });

  it("헤더 없는 secondary rate limit 403을 메시지로 구분한다", () => {
    const error = toGitHubApiError(
      restError(403, {}, "You have exceeded a secondary rate limit"),
      now,
    );

    expect(error.kind).toBe("rate_limited");
    expect(error.retryAt).toBeNull();
  });

  it("레이트 리밋이 아닌 403은 권한 오류로 처리한다", () => {
    const error = toGitHubApiError(
      restError(403, { "x-ratelimit-remaining": "4999" }, "Forbidden"),
      now,
    );

    expect(error.kind).toBe("forbidden");
  });

  it("GraphQL errors의 NOT_FOUND와 RATE_LIMITED를 구분한다", () => {
    expect(toGitHubApiError({ errors: [{ type: "NOT_FOUND" }] }, now).kind).toBe("not_found");

    const limited = toGitHubApiError(
      { errors: [{ type: "RATE_LIMITED" }], headers: { "retry-after": "30" } },
      now,
    );
    expect(limited.kind).toBe("rate_limited");
    expect(limited.retryAt?.toISOString()).toBe("2026-01-01T00:00:30.000Z");
  });

  it("이미 변환된 오류는 그대로 반환한다", () => {
    const original = new GitHubApiError("config");

    expect(toGitHubApiError(original, now)).toBe(original);
  });

  it("알 수 없는 값도 원문을 노출하지 않고 처리한다", () => {
    const error = toGitHubApiError(new Error("secret detail"), now);

    expect(error.kind).toBe("unknown");
    expect(error.message).not.toContain("secret detail");
    expect(toGitHubApiError("boom", now).kind).toBe("unknown");
  });
});
