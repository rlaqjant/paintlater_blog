import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "소개",
  description: "PaintLater Blog와 프로젝트 저장소 소개",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight mb-6">소개</h1>
      <div className="prose prose-zinc dark:prose-invert max-w-none">
        <p>
          PaintLater 서비스를 개발하면서 겪은 기술적 문제 해결 과정을
          공유하는 블로그입니다.
        </p>
        <h2>프로젝트 저장소</h2>
        <ul>
          <li>
            프론트엔드:{" "}
            <a
              href="https://github.com/rlaqjant/miniature-backlog-web"
              target="_blank"
              rel="noopener noreferrer"
            >
              miniature-backlog-web
            </a>{" "}
            (React 19 + Vite + TypeScript)
          </li>
          <li>
            백엔드:{" "}
            <a
              href="https://github.com/rlaqjant/miniature-backlog-api"
              target="_blank"
              rel="noopener noreferrer"
            >
              miniature-backlog-api
            </a>{" "}
            (Spring Boot + Java)
          </li>
        </ul>
      </div>
    </div>
  );
}
