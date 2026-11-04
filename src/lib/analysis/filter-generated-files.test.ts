import { describe, expect, it } from "vitest";
import { isGeneratedFile, partitionGeneratedFiles } from "./filter-generated-files";

describe("isGeneratedFile", () => {
  it.each([
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "frontend/package-lock.json",
    "dist/index.js",
    "apps/web/dist/a.js",
    "build/output.css",
    ".next/server/page.js",
    "packages/a/node_modules/b/index.js",
    "public/vendor.min.js",
    "src/app.js.map",
    "styles/app.css.map",
    "assets/logo.png",
    "LOGO.PNG",
    "fonts/Pretendard.woff2",
    "docs/slides.pdf",
    "windows\\dist\\a.js",
  ])("제외: %s", (path) => {
    expect(isGeneratedFile(path)).toBe(true);
  });

  it.each([
    "src/app/page.tsx",
    "distribution/a.js",
    "src/rebuild.ts",
    "src/dist.ts",
    "builder/index.ts",
    "my-package-lock.json",
    "src/minify.js",
    "src/map.ts",
    "README.md",
    "Makefile",
    "tools/build",
    "",
  ])("유지: '%s'", (path) => {
    expect(isGeneratedFile(path)).toBe(false);
  });

  it("규칙의 build/ 패턴대로 소스 트리 안의 build 폴더도 제외한다", () => {
    expect(isGeneratedFile("src/build/config.ts")).toBe(true);
  });
});

describe("partitionGeneratedFiles", () => {
  it("입력 순서를 유지한 채 집계 대상과 생성 파일로 나눈다", () => {
    const a = { path: "src/a.ts", additions: 1, deletions: 2 };
    const lock = { path: "package-lock.json", additions: 100, deletions: 50 };
    const b = { path: "src/b.ts", additions: 3, deletions: 4 };

    expect(partitionGeneratedFiles([a, lock, b])).toEqual({
      countable: [a, b],
      generated: [lock],
    });
  });

  it("빈 입력을 처리한다", () => {
    expect(partitionGeneratedFiles([])).toEqual({ countable: [], generated: [] });
  });
});
