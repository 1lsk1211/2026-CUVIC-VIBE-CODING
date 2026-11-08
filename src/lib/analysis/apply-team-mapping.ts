import { z } from "zod";
import type { AccountKind, AuthorStats } from "@/types/github";

/** 직접 묶은 작성자 id 그룹 목록 */
export type TeamMapping = string[][];

export interface TeamRow extends Omit<AuthorStats, "possibleSameAs"> {
  sourceIds: string[];
  /** 묶음에 포함된 다른 작성자의 표시 이름 */
  aliases: string[];
  /** 이름이 같아 같은 사람일 가능성이 있는 다른 행 */
  possibleSameAs: { id: string; displayName: string }[];
}

const KIND_ORDER: Record<AccountKind, number> = { member: 0, ai: 1, bot: 2 };

const mappingSchema = z.array(z.array(z.string()));

/** 저장된 문자열을 읽는다. 형식이 맞지 않으면 빈 매핑을 반환한다. */
export function parseTeamMapping(raw: string | null): TeamMapping {
  if (!raw) return [];
  try {
    const parsed = mappingSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

/** 선택한 작성자를 한 그룹으로 묶는다. 이미 묶음에 속한 작성자가 있으면 그 묶음까지 합친다. */
export function mergeIntoMapping(mapping: TeamMapping, ids: readonly string[]): TeamMapping {
  const unique = new Set(ids);
  if (unique.size < 2) return mapping;

  const separate: TeamMapping = [];
  for (const group of mapping) {
    if (group.some((id) => unique.has(id))) {
      group.forEach((id) => unique.add(id));
    } else {
      separate.push(group);
    }
  }
  return [...separate, [...unique]];
}

/** id가 속한 묶음을 해제한다. */
export function removeFromMapping(mapping: TeamMapping, id: string): TeamMapping {
  return mapping.filter((group) => !group.includes(id));
}

function mergeAuthors(members: readonly AuthorStats[]): AuthorStats {
  const primary = members.find((author) => author.isLinked) ?? members[0];
  const total = (select: (author: AuthorStats) => number) =>
    members.reduce((sum, author) => sum + select(author), 0);
  const mergeIds = <T>(select: (author: AuthorStats) => readonly T[]) => [
    ...new Set(members.flatMap(select)),
  ];

  return {
    ...primary,
    commits: total((author) => author.commits),
    additions: total((author) => author.additions),
    deletions: total((author) => author.deletions),
    changedLines: total((author) => author.changedLines),
    pullRequests: total((author) => author.pullRequests),
    reviews: total((author) => author.reviews),
    issues: total((author) => author.issues),
    possibleSameAs: members.flatMap((author) => author.possibleSameAs),
    evidence: {
      commits: mergeIds((author) => author.evidence.commits),
      pullRequests: mergeIds((author) => author.evidence.pullRequests),
      reviews: mergeIds((author) => author.evidence.reviews),
      issues: mergeIds((author) => author.evidence.issues),
    },
  };
}

/**
 * 직접 묶은 매핑을 적용해 표시할 행을 만든다. 팀원만 묶을 수 있고, 현재 결과에 없는 id는 무시한다.
 * 팀원, AI, BOT 순서이고 같은 분류 안에서는 입력 순서를 유지한다.
 */
export function applyTeamMapping(
  authors: readonly AuthorStats[],
  mapping: TeamMapping,
): TeamRow[] {
  const authorById = new Map(authors.map((author) => [author.id, author]));
  const rowIdBySource = new Map<string, string>();
  const membersByRow = new Map<string, AuthorStats[]>();

  for (const group of mapping) {
    const members = [...new Set(group)]
      .map((id) => authorById.get(id))
      .filter((author): author is AuthorStats => author?.kind === "member")
      .filter((author) => !rowIdBySource.has(author.id));
    if (members.length < 2) continue;

    const rowId = (members.find((author) => author.isLinked) ?? members[0]).id;
    membersByRow.set(rowId, members);
    members.forEach((author) => rowIdBySource.set(author.id, rowId));
  }

  for (const author of authors) {
    if (rowIdBySource.has(author.id)) continue;
    rowIdBySource.set(author.id, author.id);
    membersByRow.set(author.id, [author]);
  }

  const displayNameByRow = new Map(
    [...membersByRow].map(([rowId, members]) => [rowId, mergeAuthors(members).displayName]),
  );

  const rows = [...membersByRow.entries()].map(([rowId, members]): TeamRow => {
    const merged = mergeAuthors(members);
    const relatedRowIds = new Set(
      merged.possibleSameAs.flatMap((id) => {
        const relatedRowId = rowIdBySource.get(id);
        return relatedRowId && relatedRowId !== rowId ? [relatedRowId] : [];
      }),
    );

    return {
      ...merged,
      id: rowId,
      sourceIds: members.map((author) => author.id),
      aliases: [
        ...new Set(
          members
            .map((author) => author.displayName)
            .filter((name) => name !== merged.displayName),
        ),
      ],
      possibleSameAs: [...relatedRowIds].map((id) => ({
        id,
        displayName: displayNameByRow.get(id) ?? "",
      })),
    };
  });

  return rows.sort(
    (a, b) =>
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      a.displayName.localeCompare(b.displayName, "ko") ||
      a.id.localeCompare(b.id),
  );
}
