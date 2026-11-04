import type {
  AggregationResult,
  AuthorStats,
  CommitAuthor,
  CommitWithFiles,
} from "@/types/github";
import { partitionGeneratedFiles } from "./filter-generated-files";

const UNKNOWN_AUTHOR_NAME = "이름 없음";

/** login을 우선하고, 없으면 이메일 → git 이름 순으로 작성자를 구분한다. */
function getGroupKey(author: CommitAuthor): string {
  if (author.login) return `login:${author.login.toLowerCase()}`;
  const email = author.email?.trim().toLowerCase();
  if (email) return `email:${email}`;
  const name = author.name?.trim();
  return name ? `name:${name}` : "unknown";
}

function getDisplayName(author: CommitAuthor): string {
  return author.login ?? (author.name?.trim() || UNKNOWN_AUTHOR_NAME);
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function aggregateByAuthor(commits: readonly CommitWithFiles[]): AggregationResult {
  const groups = new Map<string, Omit<AuthorStats, "id" | "changedLines">>();
  let countedCommits = 0;
  let mergeCommits = 0;
  let commitsWithoutCountableFiles = 0;
  let excludedFileChanges = 0;
  let excludedLines = 0;

  for (const commit of commits) {
    // 머지 커밋의 변경은 원본 커밋에 이미 포함되어 있어 이중 집계를 피한다.
    if (commit.parentCount > 1) {
      mergeCommits += 1;
      continue;
    }

    const { countable, generated } = partitionGeneratedFiles(commit.files);
    excludedFileChanges += generated.length;
    excludedLines += sum(generated.map((file) => file.additions + file.deletions));

    if (countable.length === 0) {
      commitsWithoutCountableFiles += 1;
      continue;
    }

    countedCommits += 1;
    const key = getGroupKey(commit.author);
    const group = groups.get(key) ?? {
      displayName: getDisplayName(commit.author),
      isLinked: commit.author.login !== null,
      commits: 0,
      additions: 0,
      deletions: 0,
    };
    group.commits += 1;
    group.additions += sum(countable.map((file) => file.additions));
    group.deletions += sum(countable.map((file) => file.deletions));
    groups.set(key, group);
  }

  // 순위처럼 보이지 않도록 수치가 아니라 이름순으로 정렬한다.
  const sorted = [...groups.entries()].sort(
    ([keyA, a], [keyB, b]) =>
      a.displayName.localeCompare(b.displayName, "ko") || keyA.localeCompare(keyB),
  );

  // 그룹 키에는 이메일이 들어갈 수 있으므로 응답용 id로 쓰지 않는다.
  let unlinkedIndex = 0;
  const authors = sorted.map(([, group]): AuthorStats => ({
    ...group,
    id: group.isLinked ? `login:${group.displayName}` : `unlinked:${++unlinkedIndex}`,
    changedLines: group.additions + group.deletions,
  }));

  return {
    authors,
    countedCommits,
    mergeCommits,
    commitsWithoutCountableFiles,
    excludedFileChanges,
    excludedLines,
  };
}
