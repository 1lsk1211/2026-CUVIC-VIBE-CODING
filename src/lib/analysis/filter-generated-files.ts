import type { FileChange } from "@/types/github";

const LOCK_FILES = new Set(["package-lock.json", "yarn.lock", "pnpm-lock.yaml"]);

const GENERATED_DIRECTORIES = new Set(["dist", "build", ".next", "node_modules"]);

const BINARY_EXTENSIONS = new Set([
  // 이미지
  "png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "svg", "avif", "tif", "tiff", "heic",
  // 폰트
  "woff", "woff2", "ttf", "otf", "eot",
  // 음성·영상
  "mp3", "wav", "ogg", "mp4", "mov", "avi", "webm",
  // 문서·압축·실행 파일
  "pdf", "zip", "gz", "tar", "7z", "rar", "exe", "dll", "so", "dylib", "bin", "class", "jar", "wasm",
]);

/** 경로가 집계에서 제외할 생성 파일이면 true를 반환한다. 위치와 대소문자는 구분하지 않는다. */
export function isGeneratedFile(path: string): boolean {
  const segments = path.replaceAll("\\", "/").toLowerCase().split("/").filter(Boolean);
  const fileName = segments.at(-1);
  if (!fileName) return false;

  if (LOCK_FILES.has(fileName)) return true;
  if (segments.slice(0, -1).some((segment) => GENERATED_DIRECTORIES.has(segment))) return true;
  if (fileName.endsWith(".min.js") || fileName.endsWith(".map")) return true;

  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex !== -1 && BINARY_EXTENSIONS.has(fileName.slice(dotIndex + 1));
}

export interface PartitionedFiles {
  countable: FileChange[];
  generated: FileChange[];
}

export function partitionGeneratedFiles(files: readonly FileChange[]): PartitionedFiles {
  const result: PartitionedFiles = { countable: [], generated: [] };
  for (const file of files) {
    (isGeneratedFile(file.path) ? result.generated : result.countable).push(file);
  }
  return result;
}
