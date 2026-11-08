import { describe, expect, it } from "vitest";
import type { AuthorStats } from "@/types/github";
import { applyTeamMapping, type TeamRow } from "./apply-team-mapping";
import { type ScoreAxis, type ScoreMetric, scoreTeamRows } from "./score-axes";

const EVIDENCE = { commits: [], pullRequests: [], reviews: [], issues: [] };

function stats(id: string, overrides: Partial<AuthorStats> = {}): AuthorStats {
  return {
    id,
    displayName: id,
    isLinked: true,
    kind: "member",
    commits: 0,
    additions: 0,
    deletions: 0,
    changedLines: 0,
    pullRequests: 0,
    reviews: 0,
    issues: 0,
    possibleSameAs: [],
    evidence: EVIDENCE,
    ...overrides,
  };
}

function row(id: string, overrides: Partial<AuthorStats> = {}): TeamRow {
  return { ...stats(id, overrides), sourceIds: [id], aliases: [], possibleSameAs: [] };
}

function metric(key: ScoreMetric["key"], weight = 1): ScoreMetric {
  return { key, label: key, weight, evidence: "commits" };
}

function reviewers(...counts: number[]): TeamRow[] {
  return counts.map((reviews, index) => row(`m${index}`, { reviews }));
}

function axisOf(rows: readonly TeamRow[], axisId: string, axes?: readonly ScoreAxis[]) {
  return scoreTeamRows(rows, axes).map(
    (member) => member.axes.find((axis) => axis.axisId === axisId)!,
  );
}

describe("scoreTeamRows", () => {
  it("균등 몫을 50으로 정규화하고 2배 이상은 100으로 제한한다", () => {
    const axes = axisOf(reviewers(12, 6, 2, 0), "review");

    expect(axes.map((axis) => axis.score)).toEqual([100, 60, 20, 0]);
    expect(axes.map((axis) => axis.share)).toEqual([60, 30, 10, 0]);
  });

  it("활동이 똑같으면 모두 50이다", () => {
    expect(axisOf(reviewers(5, 5, 5, 5), "review").map((axis) => axis.score)).toEqual([
      50, 50, 50, 50,
    ]);
  });

  it("팀원이 한 명이면 비중은 100, 점수는 50이다", () => {
    expect(axisOf(reviewers(3), "review")[0]).toMatchObject({ score: 50, share: 100 });
  });

  it("점수와 비중을 정수로 반올림한다", () => {
    const axes = axisOf(reviewers(1, 1, 1), "review");

    expect(axes.map((axis) => axis.share)).toEqual([33, 33, 33]);
    expect(axes.map((axis) => axis.score)).toEqual([50, 50, 50]);
  });

  it("코드 축은 커밋, 변경 라인, PR의 비중을 1:1:1로 평균한다", () => {
    const axes = axisOf(
      [
        row("a", { commits: 3, changedLines: 90, pullRequests: 3 }),
        row("b", { commits: 1, changedLines: 10, pullRequests: 1 }),
      ],
      "code",
    );

    // a: (75 + 90 + 75) / 3 = 80, b: (25 + 10 + 25) / 3 = 20
    expect(axes.map((axis) => axis.share)).toEqual([80, 20]);
  });

  it("원래 수치를 축의 지표별로 함께 반환한다", () => {
    const [code, review, planning] = scoreTeamRows([
      row("a", { commits: 4, changedLines: 120, pullRequests: 2, reviews: 7, issues: 1 }),
    ])[0].axes;

    const values = (axis: typeof code) => axis.raw.map(({ key, value }) => [key, value]);
    expect(values(code)).toEqual([
      ["commits", 4],
      ["changedLines", 120],
      ["pullRequests", 2],
    ]);
    expect(values(review)).toEqual([["reviews", 7]]);
    expect(values(planning)).toEqual([["issues", 1]]);
  });

  it("지표별 근거 종류와 축의 근거 종류를 중복 없이 반환한다", () => {
    const [code, review, planning] = scoreTeamRows([row("a")])[0].axes;

    expect(code.raw.map((item) => item.evidence)).toEqual(["commits", "commits", "pullRequests"]);
    expect(code.evidenceKinds).toEqual(["commits", "pullRequests"]);
    expect(review.evidenceKinds).toEqual(["reviews"]);
    expect(planning.evidenceKinds).toEqual(["issues"]);
  });

  it("AI와 BOT은 결과, 인원수, 팀 합계에서 제외한다", () => {
    const rows = [
      row("a", { reviews: 3 }),
      row("b", { reviews: 1 }),
      row("claude", { kind: "ai", reviews: 100 }),
      row("dependabot", { kind: "bot", reviews: 100 }),
    ];

    const axes = axisOf(rows, "review");

    expect(scoreTeamRows(rows).map((member) => member.id)).toEqual(["a", "b"]);
    expect(axes.map((axis) => axis.share)).toEqual([75, 25]);
    expect(axes.map((axis) => axis.score)).toEqual([75, 25]);
  });

  it("팀 전체가 0인 축은 NaN이 아니라 0이다", () => {
    const axes = axisOf(reviewers(0, 0), "review");

    const zeroAxis = {
      axisId: "review",
      label: "리뷰",
      score: 0,
      share: 0,
      raw: [{ key: "reviews", label: "리뷰", value: 0, evidence: "reviews" }],
      evidenceKinds: ["reviews"],
    };
    expect(axes).toEqual([zeroAxis, zeroAxis]);
  });

  it("축 안에서 팀 전체가 0인 지표는 빼고 가중치를 재배분한다", () => {
    const axes = axisOf(
      [row("a", { commits: 3, changedLines: 30 }), row("b", { commits: 1, changedLines: 10 })],
      "code",
    );

    expect(axes.map((axis) => axis.share)).toEqual([75, 25]);
    expect(axes[0].raw.find((item) => item.key === "pullRequests")?.value).toBe(0);
  });

  it("합계가 있어도 가중치가 0인 지표만 있는 축은 0이다", () => {
    const axes: ScoreAxis[] = [{ id: "x", label: "X", metrics: [metric("commits", 0)] }];

    expect(axisOf([row("a", { commits: 3 })], "x", axes)[0]).toMatchObject({ score: 0, share: 0 });
  });

  it("지표 가중치를 설정대로 반영한다", () => {
    const axes: ScoreAxis[] = [
      {
        id: "x",
        label: "X",
        metrics: [metric("commits", 3), metric("issues")],
      },
    ];

    const result = axisOf(
      [row("a", { commits: 2 }), row("b", { issues: 2 })],
      "x",
      axes,
    );

    expect(result.map((axis) => axis.share)).toEqual([75, 25]);
  });

  it("축 설정을 추가하면 계산 로직 변경 없이 결과에 포함된다", () => {
    const axes: ScoreAxis[] = [
      { id: "review", label: "리뷰", metrics: [metric("reviews")] },
      { id: "meeting", label: "회의", metrics: [metric("deletions")] },
    ];

    const [member] = scoreTeamRows([row("a", { reviews: 1, deletions: 2 })], axes);

    expect(member.axes.map((axis) => axis.axisId)).toEqual(["review", "meeting"]);
    expect(member.axes[1].raw.map(({ key, value }) => [key, value])).toEqual([["deletions", 2]]);
  });

  it("팀원 묶기가 적용된 행을 기준으로 인원수와 비중을 계산한다", () => {
    const authors = [
      stats("a", { reviews: 2 }),
      stats("a-laptop", { reviews: 2, isLinked: false }),
      stats("b", { reviews: 4 }),
    ];

    const axes = axisOf(applyTeamMapping(authors, [["a", "a-laptop"]]), "review");

    expect(axes.map((axis) => axis.share)).toEqual([50, 50]);
    expect(axes.map((axis) => axis.score)).toEqual([50, 50]);
  });

  it("입력 순서를 유지하고 순위나 종합 점수를 만들지 않는다", () => {
    const result = scoreTeamRows([row("low", { reviews: 1 }), row("high", { reviews: 9 })]);

    expect(result.map((member) => member.id)).toEqual(["low", "high"]);
    expect(Object.keys(result[0]).sort()).toEqual(["axes", "displayName", "id"]);
    expect(Object.keys(result[0].axes[0]).sort()).toEqual([
      "axisId",
      "evidenceKinds",
      "label",
      "raw",
      "score",
      "share",
    ]);
  });

  it("팀원이 없으면 빈 배열을 반환한다", () => {
    expect(scoreTeamRows([])).toEqual([]);
    expect(scoreTeamRows([row("bot", { kind: "bot", reviews: 1 })])).toEqual([]);
  });
});
