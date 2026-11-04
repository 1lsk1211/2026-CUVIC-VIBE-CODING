import { describe, expect, it } from "vitest";
import type { CommitAuthor } from "@/types/github";
import { createAuthorResolver, parseNoreplyLogin } from "./resolve-author";

function author(login: string | null, email: string | null, name: string | null = null): CommitAuthor {
  return { login, email, name };
}

describe("parseNoreplyLogin", () => {
  it("숫자 ID가 있거나 없는 noreply 이메일에서 로그인을 읽는다", () => {
    expect(parseNoreplyLogin("145344696+alice@users.noreply.github.com")).toBe("alice");
    expect(parseNoreplyLogin("alice@users.noreply.github.com")).toBe("alice");
    expect(parseNoreplyLogin("49699333+dependabot[bot]@users.noreply.github.com")).toBe(
      "dependabot[bot]",
    );
  });

  it("다른 형식의 이메일이나 null은 null을 반환한다", () => {
    expect(parseNoreplyLogin("alice@example.com")).toBeNull();
    expect(parseNoreplyLogin(null)).toBeNull();
  });
});

describe("createAuthorResolver", () => {
  it("대소문자가 달라도 같은 로그인은 같은 키다", () => {
    const resolve = createAuthorResolver([]);
    expect(resolve(author("Alice", null)).key).toBe(resolve(author("alice", null)).key);
  });

  it("noreply 이메일은 해당 로그인과 같은 키다", () => {
    const resolve = createAuthorResolver([]);
    expect(resolve(author(null, "1+alice@users.noreply.github.com"))).toEqual({
      key: "login:alice",
      login: "alice",
    });
  });

  it("다른 커밋에서 로그인과 연결된 이메일은 그 로그인으로 통합한다", () => {
    const authors = [author("alice", "a@example.com"), author(null, "A@Example.com", "앨리스")];
    const resolve = createAuthorResolver(authors);

    expect(resolve(authors[1])).toEqual({ key: "login:alice", login: "alice" });
  });

  it("같은 이메일을 여러 로그인이 쓰면 이메일만으로 연결하지 않는다", () => {
    const authors = [
      author("alice", "shared@example.com"),
      author("bob", "shared@example.com"),
      author(null, "shared@example.com"),
    ];
    const resolve = createAuthorResolver(authors);

    expect(resolve(authors[0]).key).toBe("login:alice");
    expect(resolve(authors[1]).key).toBe("login:bob");
    expect(resolve(authors[2])).toEqual({ key: "email:shared@example.com", login: null });
  });

  it("이름이 같아도 이메일이 다르면 합치지 않는다", () => {
    const resolve = createAuthorResolver([]);
    expect(resolve(author(null, "a@example.com", "민수")).key).not.toBe(
      resolve(author(null, "b@example.com", "민수")).key,
    );
  });

  it("봇 로그인은 [bot] 표기와 관계없이 같은 키다", () => {
    const resolve = createAuthorResolver([]);
    expect(resolve(author("dependabot", null)).key).toBe(
      resolve(author(null, "1+dependabot[bot]@users.noreply.github.com")).key,
    );
  });

  it("이메일 없이 이름만 있거나 둘 다 없어도 처리한다", () => {
    const resolve = createAuthorResolver([]);
    expect(resolve(author(null, null, "민수")).key).toBe("name:민수");
    expect(resolve(author(null, null)).key).toBe("unknown");
  });
});
