"use client";

import { type FormEvent, useState } from "react";
import type { AnalyzeErrorResponse, AnalyzeResponse } from "@/types/github";
import { AuthorStatsTable } from "./AuthorStatsTable";

function describeError(body: AnalyzeErrorResponse): string {
  if (!body.retryAt) return body.error;
  const time = new Date(body.retryAt).toLocaleTimeString("ko-KR");
  return `${body.error} ${time} 이후 다시 시도해 주세요.`;
}

export function RepoForm() {
  const [repoUrl, setRepoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl }),
      });
      const body: unknown = await response.json();
      if (response.ok) {
        setResult(body as AnalyzeResponse);
      } else {
        setError(describeError(body as AnalyzeErrorResponse));
      }
    } catch {
      setError("서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="repo-url" className="sr-only">
          공개 GitHub 레포 URL
        </label>
        <input
          id="repo-url"
          type="text"
          required
          value={repoUrl}
          onChange={(event) => setRepoUrl(event.target.value)}
          placeholder="https://github.com/owner/repo"
          className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-transparent px-4 py-2 dark:border-neutral-700"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-foreground px-5 py-2 font-medium text-background disabled:opacity-50"
        >
          {loading ? "분석 중…" : "분석"}
        </button>
      </form>

      {loading && (
        <p role="status" className="text-sm text-neutral-600 dark:text-neutral-400">
          커밋별 파일 내역을 가져오고 있습니다. 커밋이 많으면 시간이 걸릴 수 있습니다.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-red-100 px-4 py-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}
      {result && <AuthorStatsTable result={result} />}
    </div>
  );
}
