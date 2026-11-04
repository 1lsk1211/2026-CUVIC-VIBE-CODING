import { RepoForm } from "@/components/RepoForm";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">팀플 기여도 리포터</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          공개 GitHub 레포의 커밋을 생성 파일을 제외하고 작성자별로 정리합니다.
        </p>
      </header>
      <RepoForm />
    </main>
  );
}
