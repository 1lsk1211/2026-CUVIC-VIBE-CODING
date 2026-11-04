import { createHash } from "node:crypto";
import type {
  AccountKind,
  ActivityAuthor,
  AggregationResult,
  AuthorStats,
  CommitWithFiles,
  RepositoryActivity,
} from "@/types/github";
import { classifyAccount } from "./classify-account";
import { partitionGeneratedFiles } from "./filter-generated-files";
import { createAuthorResolver, loginKey } from "./resolve-author";

const UNKNOWN_AUTHOR_NAME = "이름 없음";

const EMPTY_ACTIVITY: RepositoryActivity = {
  pullRequests: [],
  totalPullRequests: 0,
  issues: [],
  totalIssues: 0,
};

type AuthorGroup = Omit<AuthorStats, "id" | "changedLines" | "possibleSameAs">;

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/** 그룹 키에는 이메일이 들어갈 수 있어 해시로 바꾼다. 로컬에 저장한 매핑이 유지되도록 값은 고정이다. */
function toAuthorId(key: string): string {
  return key.startsWith("login:")
    ? key
    : `unlinked:${createHash("sha256").update(key).digest("hex").slice(0, 16)}`;
}

/** 비교할 이름을 정리한다. 빈 값이면 null이다. */
function normalizeName(name: string | null | undefined): string | null {
  return name?.trim().toLowerCase() || null;
}

export function aggregateByAuthor(
  commits: readonly CommitWithFiles[],
  activity: RepositoryActivity = EMPTY_ACTIVITY,
): AggregationResult {
  const resolve = createAuthorResolver(commits.map((commit) => commit.author));
  const groups = new Map<string, AuthorGroup>();
  const namesByKey = new Map<string, Set<string>>();
  const kindsByKey = new Map<string, AccountKind>();
  let countedCommits = 0;
  let mergeCommits = 0;
  let commitsWithoutCountableFiles = 0;
  let excludedFileChanges = 0;
  let excludedLines = 0;
  let unattributedActivities = 0;

  function addName(key: string, name: string | null | undefined): void {
    const normalized = normalizeName(name);
    if (!normalized) return;
    const names = namesByKey.get(key) ?? new Set<string>();
    names.add(normalized);
    namesByKey.set(key, names);
  }

  /** 한 그룹의 표기 중 하나라도 AI나 봇이면 그 분류를 유지한다. */
  function addKind(key: string, kind: AccountKind): void {
    if ((kindsByKey.get(key) ?? "member") === "member") kindsByKey.set(key, kind);
  }

  function getGroup(key: string, displayName: string, isLinked: boolean): AuthorGroup {
    const group = groups.get(key) ?? {
      displayName,
      isLinked,
      kind: "member",
      commits: 0,
      additions: 0,
      deletions: 0,
      pullRequests: 0,
      reviews: 0,
      issues: 0,
    };
    groups.set(key, group);
    return group;
  }

  // 집계에서 제외되는 커밋의 이름과 분류도 같은 사람을 판단하는 근거로 쓴다.
  for (const commit of commits) {
    const { key, login } = resolve(commit.author);
    addName(key, commit.author.name);
    addName(key, login);
    addKind(key, classifyAccount({ ...commit.author, login }));
  }

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
    const { key, login } = resolve(commit.author);
    const displayName = login ?? (commit.author.name?.trim() || UNKNOWN_AUTHOR_NAME);
    const group = getGroup(key, displayName, login !== null);
    group.commits += 1;
    group.additions += sum(countable.map((file) => file.additions));
    group.deletions += sum(countable.map((file) => file.deletions));
  }

  /** 계정 정보가 없는 활동은 null을 반환하고 따로 센다. */
  function getActivityGroup(author: ActivityAuthor | null): AuthorGroup | null {
    if (!author) {
      unattributedActivities += 1;
      return null;
    }
    const key = loginKey(author.login);
    addName(key, author.login);
    addKind(key, classifyAccount(author));
    return getGroup(key, author.login, true);
  }

  for (const pullRequest of activity.pullRequests) {
    const group = getActivityGroup(pullRequest.author);
    if (group) group.pullRequests += 1;

    for (const review of pullRequest.reviews) {
      const isSelfReview =
        review.author !== null &&
        pullRequest.author !== null &&
        loginKey(review.author.login) === loginKey(pullRequest.author.login);
      if (isSelfReview) continue;

      const reviewer = getActivityGroup(review.author);
      if (reviewer) reviewer.reviews += 1;
    }
  }

  for (const issue of activity.issues) {
    const group = getActivityGroup(issue.author);
    if (group) group.issues += 1;
  }

  // 순위처럼 보이지 않도록 수치가 아니라 이름순으로 정렬한다.
  const sorted = [...groups.entries()].sort(
    ([keyA, a], [keyB, b]) =>
      a.displayName.localeCompare(b.displayName, "ko") || keyA.localeCompare(keyB),
  );

  const isMember = (key: string) => (kindsByKey.get(key) ?? "member") === "member";
  const sharesName = (keyA: string, keyB: string) => {
    const names = namesByKey.get(keyB);
    return [...(namesByKey.get(keyA) ?? [])].some((name) => names?.has(name));
  };

  const authors = sorted.map(([key, group]): AuthorStats => ({
    ...group,
    id: toAuthorId(key),
    kind: kindsByKey.get(key) ?? "member",
    changedLines: group.additions + group.deletions,
    possibleSameAs: isMember(key)
      ? sorted
          .filter(([otherKey]) => otherKey !== key && isMember(otherKey) && sharesName(key, otherKey))
          .map(([otherKey]) => toAuthorId(otherKey))
      : [],
  }));

  return {
    authors,
    countedCommits,
    mergeCommits,
    commitsWithoutCountableFiles,
    excludedFileChanges,
    excludedLines,
    unattributedActivities,
  };
}
