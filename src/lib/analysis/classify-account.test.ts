import { describe, expect, it } from "vitest";
import { classifyAccount } from "./classify-account";

describe("classifyAccount", () => {
  it("일반 계정은 팀원으로 분류한다", () => {
    expect(classifyAccount({ login: "alice", name: "Alice", email: "a@example.com" })).toBe(
      "member",
    );
  });

  it.each([
    [{ login: "claude" }],
    [{ login: "Copilot" }],
    [{ login: "copilot-swe-agent[bot]", isBot: true }],
    [{ login: "copilot-pull-request-reviewer", isBot: true }],
    [{ login: null, name: "Claude", email: "noreply@anthropic.com" }],
  ])("AI 계정은 AI로 분류한다: %j", (account) => {
    expect(classifyAccount(account)).toBe("ai");
  });

  it.each([
    [{ login: "renovate", isBot: true }],
    [{ login: "dependabot[bot]" }],
    [{ login: null, name: "github-actions[bot]" }],
    [{ login: null, email: "49699333+dependabot[bot]@users.noreply.github.com" }],
  ])("봇 계정은 BOT으로 분류한다: %j", (account) => {
    expect(classifyAccount(account)).toBe("bot");
  });

  it("이름만 Claude인 사람은 AI로 분류하지 않는다", () => {
    expect(classifyAccount({ login: null, name: "Claude", email: "claude@example.com" })).toBe(
      "member",
    );
  });
});
