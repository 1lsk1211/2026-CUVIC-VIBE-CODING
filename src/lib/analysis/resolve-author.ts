import type { CommitAuthor } from "@/types/github";
import { stripBotSuffix } from "./classify-account";

const NOREPLY_EMAIL = /^(?:\d+\+)?([^@]+)@users\.noreply\.github\.com$/;

export interface ResolvedAuthor {
  /** 같은 사람으로 확정할 수 있는 작성자는 같은 키를 갖는다. */
  key: string;
  login: string | null;
}

function normalizeEmail(email: string | null): string | null {
  return email?.trim().toLowerCase() || null;
}

export function loginKey(login: string): string {
  return `login:${stripBotSuffix(login.toLowerCase())}`;
}

/** GitHub noreply 이메일에서 로그인을 읽는다. 해당 형식이 아니면 null이다. */
export function parseNoreplyLogin(email: string | null): string | null {
  return email?.trim().match(NOREPLY_EMAIL)?.[1] ?? null;
}

function getLinkedLogin(author: CommitAuthor): string | null {
  return author.login ?? parseNoreplyLogin(author.email);
}

/**
 * 확실한 근거가 있는 작성자만 같은 사람으로 판단하는 함수를 만든다.
 * 우선순위: 로그인 → noreply 이메일 → 다른 커밋에서 로그인과 연결된 이메일 → 이메일 → 이름.
 * 이메일 하나를 여러 로그인이 쓰면 누구인지 알 수 없으므로 연결하지 않는다.
 */
export function createAuthorResolver(
  authors: readonly CommitAuthor[],
): (author: CommitAuthor) => ResolvedAuthor {
  const loginsByEmail = new Map<string, Map<string, string>>();
  for (const author of authors) {
    const email = normalizeEmail(author.email);
    const login = getLinkedLogin(author);
    if (!email || !login) continue;
    const logins = loginsByEmail.get(email) ?? new Map<string, string>();
    logins.set(loginKey(login), login);
    loginsByEmail.set(email, logins);
  }

  return (author) => {
    const login = getLinkedLogin(author);
    if (login) return { key: loginKey(login), login };

    const email = normalizeEmail(author.email);
    if (email) {
      const logins = loginsByEmail.get(email);
      if (logins?.size === 1) {
        const [[key, linkedLogin]] = logins;
        return { key, login: linkedLogin };
      }
      return { key: `email:${email}`, login: null };
    }

    const name = author.name?.trim();
    return { key: name ? `name:${name}` : "unknown", login: null };
  };
}
