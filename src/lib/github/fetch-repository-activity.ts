import type { Octokit } from "octokit";
import type {
  ActivityAuthor,
  IssueActivity,
  PullRequestActivity,
  PullRequestReview,
  RepoRef,
  RepositoryActivity,
  ReviewState,
} from "@/types/github";
import { GitHubApiError } from "./errors";

export const MAX_PULL_REQUESTS = 500;
export const MAX_ISSUES = 500;
const PULL_REQUEST_PAGE_SIZE = 50;
const ISSUE_PAGE_SIZE = 100;
const REVIEW_PAGE_SIZE = 100;

const REVIEW_FIELDS = /* GraphQL */ `
  pageInfo {
    hasNextPage
    endCursor
  }
  nodes {
    url
    state
    submittedAt
    author {
      __typename
      login
    }
  }
`;

// PR과 이슈를 한 요청으로 묶고, 어느 한쪽이 끝나면 남은 쪽만 이어서 요청한다.
const ACTIVITY_QUERY = /* GraphQL */ `
  query (
    $owner: String!
    $name: String!
    $withPullRequests: Boolean!
    $pullRequestFirst: Int!
    $pullRequestAfter: String
    $withIssues: Boolean!
    $issueFirst: Int!
    $issueAfter: String
  ) {
    repository(owner: $owner, name: $name) {
      isPrivate
      pullRequests(
        first: $pullRequestFirst
        after: $pullRequestAfter
        orderBy: { field: CREATED_AT, direction: DESC }
      ) @include(if: $withPullRequests) {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          number
          url
          title
          state
          createdAt
          mergedAt
          closedAt
          author {
            __typename
            login
          }
          reviews(first: ${REVIEW_PAGE_SIZE}) {
            ${REVIEW_FIELDS}
          }
        }
      }
      issues(
        first: $issueFirst
        after: $issueAfter
        orderBy: { field: CREATED_AT, direction: DESC }
      ) @include(if: $withIssues) {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          number
          url
          title
          state
          createdAt
          closedAt
          author {
            __typename
            login
          }
        }
      }
    }
  }
`;

const MORE_REVIEWS_QUERY = /* GraphQL */ `
  query ($id: ID!, $after: String!) {
    node(id: $id) {
      ... on PullRequest {
        reviews(first: ${REVIEW_PAGE_SIZE}, after: $after) {
          ${REVIEW_FIELDS}
        }
      }
    }
  }
`;

interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

interface AuthorNode {
  __typename: string;
  login: string;
}

interface ReviewNode {
  url: string;
  state: ReviewState | "PENDING";
  submittedAt: string | null;
  author: AuthorNode | null;
}

interface ReviewConnection {
  pageInfo: PageInfo;
  nodes: ReviewNode[];
}

interface PullRequestNode {
  id: string;
  number: number;
  url: string;
  title: string;
  state: PullRequestActivity["state"];
  createdAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  author: AuthorNode | null;
  reviews: ReviewConnection;
}

interface IssueNode {
  number: number;
  url: string;
  title: string;
  state: IssueActivity["state"];
  createdAt: string;
  closedAt: string | null;
  author: AuthorNode | null;
}

interface Connection<T> {
  totalCount: number;
  pageInfo: PageInfo;
  nodes: T[];
}

interface ActivityQueryResult {
  repository: {
    isPrivate: boolean;
    pullRequests?: Connection<PullRequestNode>;
    issues?: Connection<IssueNode>;
  } | null;
}

interface MoreReviewsQueryResult {
  node: { reviews: ReviewConnection } | null;
}

/** 탈퇴 등으로 계정 정보가 없으면 null이다. */
function toAuthor(node: AuthorNode | null): ActivityAuthor | null {
  return node && { login: node.login, isBot: node.__typename === "Bot" };
}

/** PENDING은 아직 제출하지 않은 리뷰이므로 활동으로 보지 않는다. */
function toReviews(nodes: readonly ReviewNode[]): PullRequestReview[] {
  return nodes.flatMap((node) =>
    node.state === "PENDING"
      ? []
      : [
          {
            url: node.url,
            state: node.state,
            submittedAt: node.submittedAt,
            author: toAuthor(node.author),
          },
        ],
  );
}

function toIssue(node: IssueNode): IssueActivity {
  return {
    number: node.number,
    url: node.url,
    title: node.title,
    state: node.state,
    createdAt: node.createdAt,
    closedAt: node.closedAt,
    author: toAuthor(node.author),
  };
}

/** 리뷰가 한 페이지를 넘는 PR만 추가로 요청한다. */
async function fetchAllReviews(
  octokit: Pick<Octokit, "graphql">,
  node: PullRequestNode,
): Promise<PullRequestReview[]> {
  const reviews = toReviews(node.reviews.nodes);
  let { hasNextPage, endCursor } = node.reviews.pageInfo;

  while (hasNextPage) {
    const result: MoreReviewsQueryResult = await octokit.graphql<MoreReviewsQueryResult>(
      MORE_REVIEWS_QUERY,
      { id: node.id, after: endCursor },
    );
    if (!result.node) break;
    reviews.push(...toReviews(result.node.reviews.nodes));
    ({ hasNextPage, endCursor } = result.node.reviews.pageInfo);
  }
  return reviews;
}

/** PR(리뷰 포함)과 이슈를 각각 최대 limit개까지 최신순으로 가져온다. */
export async function fetchRepositoryActivity(
  octokit: Pick<Octokit, "graphql">,
  repo: RepoRef,
  limits: { pullRequests: number; issues: number } = {
    pullRequests: MAX_PULL_REQUESTS,
    issues: MAX_ISSUES,
  },
): Promise<RepositoryActivity> {
  const pullRequestNodes: PullRequestNode[] = [];
  const issues: IssueActivity[] = [];
  let totalPullRequests = 0;
  let totalIssues = 0;
  let pullRequestAfter: string | null = null;
  let issueAfter: string | null = null;
  let withPullRequests = true;
  let withIssues = true;

  while (withPullRequests || withIssues) {
    const result: ActivityQueryResult = await octokit.graphql<ActivityQueryResult>(ACTIVITY_QUERY, {
      owner: repo.owner,
      name: repo.name,
      withPullRequests,
      pullRequestFirst: Math.min(
        PULL_REQUEST_PAGE_SIZE,
        Math.max(limits.pullRequests - pullRequestNodes.length, 1),
      ),
      pullRequestAfter,
      withIssues,
      issueFirst: Math.min(ISSUE_PAGE_SIZE, Math.max(limits.issues - issues.length, 1)),
      issueAfter,
    });
    const { repository } = result;

    // fetchCommits와 같은 기준으로, private 레포는 존재 여부도 알리지 않는다.
    if (!repository || repository.isPrivate) throw new GitHubApiError("not_found");

    if (repository.pullRequests) {
      const { totalCount, pageInfo, nodes } = repository.pullRequests;
      totalPullRequests = totalCount;
      pullRequestNodes.push(...nodes);
      pullRequestAfter = pageInfo.endCursor;
      withPullRequests = pageInfo.hasNextPage && pullRequestNodes.length < limits.pullRequests;
    }

    if (repository.issues) {
      const { totalCount, pageInfo, nodes } = repository.issues;
      totalIssues = totalCount;
      issues.push(...nodes.map(toIssue));
      issueAfter = pageInfo.endCursor;
      withIssues = pageInfo.hasNextPage && issues.length < limits.issues;
    }
  }

  const pullRequests: PullRequestActivity[] = [];
  for (const node of pullRequestNodes) {
    pullRequests.push({
      number: node.number,
      url: node.url,
      title: node.title,
      state: node.state,
      createdAt: node.createdAt,
      mergedAt: node.mergedAt,
      closedAt: node.closedAt,
      author: toAuthor(node.author),
      reviews: await fetchAllReviews(octokit, node),
    });
  }

  return { pullRequests, totalPullRequests, issues, totalIssues };
}
