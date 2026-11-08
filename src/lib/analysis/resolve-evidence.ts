import type {
  AuthorEvidence,
  EvidenceCatalog,
  RepoRef,
  ReviewState,
} from "@/types/github";

export interface EvidenceItem<Id> {
  id: Id;
  url: string;
  title: string;
  date: string | null;
}

export interface ReviewEvidenceItem extends EvidenceItem<string> {
  pullNumber: number;
  state: ReviewState;
}

export interface ResolvedEvidence {
  commits: EvidenceItem<string>[];
  pullRequests: EvidenceItem<number>[];
  reviews: ReviewEvidenceItem[];
  issues: EvidenceItem<number>[];
}

/** 최신순으로 정렬하고 날짜가 없는 항목은 뒤로 보낸다. */
function byNewest<T extends { date: string | null }>(items: T[]): T[] {
  return items.sort((a, b) => {
    if (a.date === b.date) return 0;
    if (a.date === null) return 1;
    if (b.date === null) return -1;
    return Date.parse(b.date) - Date.parse(a.date);
  });
}

/** 근거 ID에 URL, 제목, 날짜를 붙인다. */
export function resolveEvidence(
  evidence: AuthorEvidence,
  catalog: EvidenceCatalog,
  { owner, name }: RepoRef,
): ResolvedEvidence {
  const base = `https://github.com/${owner}/${name}`;

  return {
    commits: byNewest(
      evidence.commits.map((id) => ({ ...catalog.commits[id], id, url: `${base}/commit/${id}` })),
    ),
    pullRequests: byNewest(
      evidence.pullRequests.map((id) => ({
        ...catalog.pullRequests[id],
        id,
        url: `${base}/pull/${id}`,
      })),
    ),
    reviews: byNewest(
      evidence.reviews.map((id) => {
        const { pullNumber, state, date } = catalog.reviews[id];
        const pullUrl = `${base}/pull/${pullNumber}`;
        return {
          id,
          pullNumber,
          state,
          date,
          title: catalog.pullRequests[pullNumber].title,
          // 숫자 ID가 없는 리뷰는 위치를 특정할 수 없어 PR 페이지로 연결한다.
          url: /^\d+$/.test(id) ? `${pullUrl}#pullrequestreview-${id}` : pullUrl,
        };
      }),
    ),
    issues: byNewest(
      evidence.issues.map((id) => ({ ...catalog.issues[id], id, url: `${base}/issues/${id}` })),
    ),
  };
}
