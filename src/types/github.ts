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

export interface AuthorStats {
  /** 화면 구분용 식별자. 이메일을 담지 않는다. */
  id: string;
  displayName: string;
  /** GitHub 계정과 연결된 작성자인지 여부 */
  isLinked: boolean;
  commits: number;
  additions: number;
  deletions: number;
  changedLines: number;
}

export interface AggregationResult {
  authors: AuthorStats[];
  countedCommits: number;
  mergeCommits: number;
  /** 생성 파일만 바꿨거나 변경 파일이 없는 커밋 수 */
  commitsWithoutCountableFiles: number;
  excludedFileChanges: number;
  excludedLines: number;
}

export interface AnalyzeResponse extends AggregationResult {
  repo: RepoRef;
  defaultBranch: string | null;
  analyzedCommits: number;
  totalCommits: number;
  truncated: boolean;
}

export interface AnalyzeErrorResponse {
  error: string;
  /** 레이트 리밋 해제 예상 시각 (ISO 8601) */
  retryAt?: string;
}
