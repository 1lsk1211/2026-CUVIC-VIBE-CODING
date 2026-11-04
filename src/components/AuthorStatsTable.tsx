import type { AnalyzeResponse } from "@/types/github";

const NUMERIC_COLUMNS = ["커밋 수", "추가", "삭제", "변경 라인"];

function format(value: number): string {
  return value.toLocaleString("ko-KR");
}

export function AuthorStatsTable({ result }: { result: AnalyzeResponse }) {
  const { activity } = result;

  return (
    <section className="flex flex-col gap-4">
      <div className="text-sm leading-6 text-neutral-600 dark:text-neutral-400">
        <h2 className="text-base font-semibold text-foreground">
          {result.repo.owner}/{result.repo.name}
          {result.defaultBranch && (
            <span className="ml-2 font-normal text-neutral-500">{result.defaultBranch} 브랜치</span>
          )}
        </h2>
        <p>
          커밋 {format(result.analyzedCommits)}개 중 {format(result.countedCommits)}개를
          집계했습니다.
        </p>
        <p>
          제외: 머지 커밋 {format(result.mergeCommits)}개, 생성 파일만 바꿨거나 변경 파일이 없는
          커밋 {format(result.commitsWithoutCountableFiles)}개, 생성 파일 변경{" "}
          {format(result.excludedFileChanges)}건({format(result.excludedLines)}라인)
        </p>
        {result.truncated && (
          <p className="mt-2 rounded bg-amber-100 px-3 py-2 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            전체 커밋 {format(result.totalCommits)}개 중 최근 {format(result.analyzedCommits)}개만
            분석한 결과입니다.
          </p>
        )}
        <p className="mt-2">
          수집한 활동: PR {format(activity.collectedPullRequests)}개, 리뷰{" "}
          {format(activity.collectedReviews)}개, 이슈 {format(activity.collectedIssues)}개
        </p>
        {(activity.totalPullRequests > activity.collectedPullRequests ||
          activity.totalIssues > activity.collectedIssues) && (
          <p className="mt-2 rounded bg-amber-100 px-3 py-2 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            전체 PR {format(activity.totalPullRequests)}개, 이슈 {format(activity.totalIssues)}개 중
            최근 항목만 수집한 결과입니다.
          </p>
        )}
      </div>

      {result.authors.length === 0 ? (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">집계할 커밋이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-100 dark:bg-neutral-900">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  작성자
                </th>
                {NUMERIC_COLUMNS.map((column) => (
                  <th key={column} scope="col" className="px-4 py-3 text-right font-medium whitespace-nowrap">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {result.authors.map((author) => (
                <tr key={author.id}>
                  <th scope="row" className="px-4 py-3 font-normal">
                    {author.displayName}
                    {!author.isLinked && (
                      <span className="ml-2 text-xs text-neutral-500">GitHub 계정 미연결</span>
                    )}
                  </th>
                  <td className="px-4 py-3 text-right tabular-nums">{format(author.commits)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{format(author.additions)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{format(author.deletions)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{format(author.changedLines)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-neutral-500">
        이 수치는 대화를 위한 활동 근거이며, 기여도를 판정하지 않습니다. 작성자 매핑 전이라 한
        사람이 여러 행으로 나뉠 수 있습니다.
      </p>
    </section>
  );
}
