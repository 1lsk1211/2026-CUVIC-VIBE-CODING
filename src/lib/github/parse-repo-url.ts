import type { RepoRef } from "@/types/github";

const OWNER_PATTERN = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i;
const REPO_PATTERN = /^[\w.-]{1,100}$/;

/** GitHub 레포 URL에서 owner와 레포 이름을 추출한다. 형식이 맞지 않으면 null을 반환한다. */
export function parseRepoUrl(input: string): RepoRef | null {
  const trimmed = input.trim();
  const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password || url.port) return null;
  if (url.hostname !== "github.com" && url.hostname !== "www.github.com") return null;

  const [owner, rawName] = url.pathname.split("/").filter(Boolean);
  if (!owner || !rawName) return null;

  const name = rawName.replace(/\.git$/i, "");
  if (!OWNER_PATTERN.test(owner) || !REPO_PATTERN.test(name)) return null;
  if (name === "." || name === "..") return null;

  return { owner, name };
}
