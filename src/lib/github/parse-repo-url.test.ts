import { describe, expect, it } from "vitest";
import { parseRepoUrl } from "./parse-repo-url";

const expected = { owner: "1lsk1211", name: "2026-CUVIC-VIBE-CODING" };

describe("parseRepoUrl", () => {
  it.each([
    "https://github.com/1lsk1211/2026-CUVIC-VIBE-CODING",
    "https://github.com/1lsk1211/2026-CUVIC-VIBE-CODING/",
    "https://github.com/1lsk1211/2026-CUVIC-VIBE-CODING.git",
    "https://www.github.com/1lsk1211/2026-CUVIC-VIBE-CODING",
    "http://github.com/1lsk1211/2026-CUVIC-VIBE-CODING",
    "github.com/1lsk1211/2026-CUVIC-VIBE-CODING",
    "  https://github.com/1lsk1211/2026-CUVIC-VIBE-CODING  ",
    "https://github.com/1lsk1211/2026-CUVIC-VIBE-CODING/tree/main",
    "https://github.com/1lsk1211/2026-CUVIC-VIBE-CODING?tab=readme",
  ])("허용: %s", (input) => {
    expect(parseRepoUrl(input)).toEqual(expected);
  });

  it.each([
    "",
    "not a url",
    "https://github.com",
    "https://github.com/only-owner",
    "https://gitlab.com/o/r",
    "https://evil-github.com/o/r",
    "https://github.com.evil.com/o/r",
    "https://user:secret@github.com/o/r",
    "https://github.com:8443/o/r",
    "ftp://github.com/o/r",
    "git@github.com:o/r.git",
    "https://github.com/-bad-/r",
    "https://github.com/o/..",
    "https://github.com/o/%2e%2e",
  ])("거부: '%s'", (input) => {
    expect(parseRepoUrl(input)).toBeNull();
  });
});
