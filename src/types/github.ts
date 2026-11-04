export interface RepoRef {
  owner: string;
  name: string;
}

export interface CommitAuthor {
  /** GitHub 계정과 연결되지 않은 커밋은 null이다. */
  login: string | null;
  name: string | null;
  email: string | null;
}

export interface CommitSummary {
  sha: string;
  url: string;
  message: string;
  committedAt: string;
  parentCount: number;
  author: CommitAuthor;
}

export interface FileChange {
  /** 이름이 바뀐 파일은 변경 후 경로다. */
  path: string;
  additions: number;
  deletions: number;
}

export interface CommitWithFiles extends CommitSummary {
  files: FileChange[];
}

export type AccountKind = "member" | "ai" | "bot";

export interface AuthorStats {
  /** 다시 분석해도 유지되는 식별자. 이메일 원문을 담지 않는다. */
  id: string;
  displayName: string;
  /** GitHub 계정과 연결된 작성자인지 여부 */
  isLinked: boolean;
  kind: AccountKind;
  commits: number;
  additions: number;
  deletions: number;
  changedLines: number;
  pullRequests: number;
  /** 본인 PR에 남긴 리뷰는 제외한 수 */
  reviews: number;
  issues: number;
  /** 이름이 같아 같은 사람일 가능성이 있는 작성자의 id. 자동으로 합치지 않는다. */
  possibleSameAs: string[];
}

export interface AggregationResult {
  authors: AuthorStats[];
  countedCommits: number;
  mergeCommits: number;
  /** 생성 파일만 바꿨거나 변경 파일이 없는 커밋 수 */
  commitsWithoutCountableFiles: number;
  excludedFileChanges: number;
  excludedLines: number;
  /** 작성자 계정 정보가 없어 작성자별 수치에 넣지 못한 PR·리뷰·이슈 수 */
  unattributedActivities: number;
}

export interface ActivityAuthor {
  login: string;
  isBot: boolean;
}

export type ReviewState = "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED";

export interface PullRequestReview {
  url: string;
  state: ReviewState;
  submittedAt: string | null;
  /** 탈퇴 등으로 계정 정보가 없으면 null이다. */
  author: ActivityAuthor | null;
}

export interface PullRequestActivity {
  number: number;
  url: string;
  title: string;
  state: "OPEN" | "CLOSED" | "MERGED";
  createdAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  /** 탈퇴 등으로 계정 정보가 없으면 null이다. */
  author: ActivityAuthor | null;
  reviews: PullRequestReview[];
}

export interface IssueActivity {
  number: number;
  url: string;
  title: string;
  state: "OPEN" | "CLOSED";
  createdAt: string;
  closedAt: string | null;
  /** 탈퇴 등으로 계정 정보가 없으면 null이다. */
  author: ActivityAuthor | null;
}

export interface RepositoryActivity {
  pullRequests: PullRequestActivity[];
  totalPullRequests: number;
  issues: IssueActivity[];
  totalIssues: number;
}

export interface ActivitySummary {
  collectedPullRequests: number;
  totalPullRequests: number;
  collectedReviews: number;
  collectedIssues: number;
  totalIssues: number;
}

export interface AnalyzeResponse extends AggregationResult {
  repo: RepoRef;
  defaultBranch: string | null;
  analyzedCommits: number;
  totalCommits: number;
  truncated: boolean;
  activity: ActivitySummary;
}

export interface AnalyzeErrorResponse {
  error: string;
  /** 레이트 리밋 해제 예상 시각 (ISO 8601) */
  retryAt?: string;
}
