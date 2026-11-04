import type { AccountKind } from "@/types/github";

// GitHub에서 일반 사용자처럼 보이는 계정도 있어 봇 여부와 별개로 목록으로 구분한다.
const AI_LOGINS = new Set([
  "claude",
  "codex",
  "copilot",
  "copilot-pull-request-reviewer",
  "copilot-swe-agent",
  "cursoragent",
  "devin-ai-integration",
]);
const AI_EMAILS = new Set(["cursoragent@cursor.com", "noreply@anthropic.com"]);

const BOT_SUFFIX = "[bot]";

export interface AccountInfo {
  login?: string | null;
  name?: string | null;
  email?: string | null;
  isBot?: boolean;
}

/** 로그인 뒤의 [bot]을 떼어 낸다. GraphQL과 커밋 이메일의 표기 차이를 맞추는 데 쓴다. */
export function stripBotSuffix(login: string): string {
  return login.endsWith(BOT_SUFFIX) ? login.slice(0, -BOT_SUFFIX.length) : login;
}

/**
 * 계정을 팀원, AI, 봇으로 분류한다. AI 봇 계정은 AI로 본다.
 * "Claude"라는 사람이 있을 수 있으므로 이름만으로는 AI로 분류하지 않는다.
 */
export function classifyAccount({ login, name, email, isBot }: AccountInfo): AccountKind {
  const normalizedLogin = login?.trim().toLowerCase() ?? "";
  const normalizedEmail = email?.trim().toLowerCase() ?? "";
  const normalizedName = name?.trim().toLowerCase() ?? "";

  if (AI_LOGINS.has(stripBotSuffix(normalizedLogin)) || AI_EMAILS.has(normalizedEmail)) {
    return "ai";
  }
  if (
    isBot ||
    normalizedLogin.endsWith(BOT_SUFFIX) ||
    normalizedName.endsWith(BOT_SUFFIX) ||
    normalizedEmail.includes(`${BOT_SUFFIX}@`)
  ) {
    return "bot";
  }
  return "member";
}
