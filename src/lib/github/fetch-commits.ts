import type { Octokit } from "octokit";
import type { CommitSummary, RepoRef } from "@/types/github";
import { GitHubApiError } from "./errors";

export const MAX_COMMITS = 500;
const PAGE_SIZE = 100;

const COMMITS_QUERY = /* GraphQL */ `
  query ($owner: String!, $name: String!, $first: Int!, $after: String) {
    repository(owner: $owner, name: $name) {
      isPrivate
      defaultBranchRef {
        name
        target {
          ... on Commit {
            history(first: $first, after: $after) {
              totalCount
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                oid
                url
                messageHeadline
                committedDate
                parents {
                  totalCount
                }
                author {
                  name
                  email
                  user {
                    login
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

interface CommitNode {
  oid: string;
  url: string;
  messageHeadline: string;
  committedDate: string;
  parents: { totalCount: number };
  author: {
    name: string | null;
    email: string | null;
    user: { login: string } | null;
  } | null;
}

interface CommitsQueryResult {
  repository: {
    isPrivate: boolean;
    defaultBranchRef: {
      name: string;
      target: {
        history: {
          totalCount: number;
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: CommitNode[];
        };
      };
    } | null;
  } | null;
}

export interface CommitList {
  defaultBranch: string | null;
  totalCommits: number;
  commits: CommitSummary[];
}

function toCommitSummary(node: CommitNode): CommitSummary {
  return {
    sha: node.oid,
    url: node.url,
    message: node.messageHeadline,
    committedAt: node.committedDate,
    parentCount: node.parents.totalCount,
    author: {
      login: node.author?.user?.login ?? null,
      name: node.author?.name ?? null,
      email: node.author?.email ?? null,
    },
  };
}

/** 기본 브랜치의 최근 커밋을 최대 limit개까지 최신순으로 가져온다. */
export async function fetchCommits(
  octokit: Pick<Octokit, "graphql">,
  repo: RepoRef,
  limit: number = MAX_COMMITS,
): Promise<CommitList> {
  const commits: CommitSummary[] = [];
  let totalCommits = 0;
  let after: string | null = null;

  while (true) {
    const result: CommitsQueryResult = await octokit.graphql<CommitsQueryResult>(COMMITS_QUERY, {
      owner: repo.owner,
      name: repo.name,
      first: Math.min(PAGE_SIZE, limit - commits.length),
      after,
    });

    // 토큰 권한으로 읽을 수 있어도 MVP는 공개 레포만 분석한다. 존재 여부도 알리지 않는다.
    if (!result.repository || result.repository.isPrivate) {
      throw new GitHubApiError("not_found");
    }

    const branch = result.repository.defaultBranchRef;
    if (!branch) return { defaultBranch: null, totalCommits: 0, commits: [] };

    const { totalCount, pageInfo, nodes } = branch.target.history;
    totalCommits = totalCount;
    commits.push(...nodes.map(toCommitSummary));

    if (!pageInfo.hasNextPage || commits.length >= limit) {
      return { defaultBranch: branch.name, totalCommits, commits };
    }
    after = pageInfo.endCursor;
  }
}
