import type { Metadata } from "next";
import Image from "next/image";
import { Bungee } from "next/font/google";
import { ExternalLink } from "lucide-react";

const bungee = Bungee({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "소개",
  description: "PaintLater 서비스 소개와 기술 스택",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight mb-6">소개</h1>
      <div className="prose prose-zinc dark:prose-invert max-w-none">
        <p>
          이 블로그는{" "}
          <a
            href="https://paintlater.org"
            target="_blank"
            rel="noopener noreferrer"
          >
            PaintLater
          </a>{" "}
          (미니어처·모형 작업 기록 관리 서비스)를 개발하면서 겪은 기술적 문제
          해결 과정을 기록하고 공유하기 위한 공간입니다. 실제 프로덕션 코드와
          운영 환경에서 마주친 문제, 해결 과정, 그리고 그 과정에서 얻은 교훈을
          다룹니다.
        </p>

        <a
          href="https://paintlater.org"
          target="_blank"
          rel="noopener noreferrer"
          className="not-prose group my-10 flex flex-col items-center gap-6 rounded-2xl border border-border bg-muted/30 p-8 no-underline transition-all hover:-translate-y-0.5 hover:border-foreground/40 hover:bg-muted/50 hover:shadow-lg sm:flex-row sm:gap-8 sm:p-10"
          aria-label="PaintLater 서비스 바로가기"
        >
          <Image
            src="/images/paintlater-mascot.png"
            alt=""
            width={200}
            height={200}
            priority
            className="h-24 w-24 shrink-0 sm:h-28 sm:w-28 dark:invert"
          />
          <div className="flex flex-1 flex-col items-center gap-2 sm:items-start">
            <div
              className={`${bungee.className} text-4xl leading-none tracking-tight sm:text-5xl`}
              aria-label="PaintLater"
            >
              <span className="text-foreground">PAINT</span>
              <span className="text-[#ff8400]">LATER</span>
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground group-hover:text-foreground">
              paintlater.org
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </div>
            <div className="text-xs text-muted-foreground">
              미니어처·모형 작업 기록 관리 플랫폼
            </div>
          </div>
        </a>

        <h2>PaintLater 서비스</h2>
        <p>
          PaintLater는 <strong>미니어처·모형 작업 기록 관리</strong>를 위한
          올인원 플랫폼입니다. &quot;언젠가는 만들고 칠해야지&quot; 하며 쌓여가는
          미니어처·프라모델·피규어 백로그(paint later)를 실제로 해소해 나갈
          수 있도록, 프로젝트 관리부터 작품 공유, 색상 설계, 페인트 재고
          관리까지 모형 제작의 전 과정을 한곳에서 다룹니다. 워해머 같은
          테이블탑 미니어처뿐만 아니라 건프라·피규어·디오라마 등 모든 모형
          작업을 대상으로 합니다. 웹과 iOS/Android 네이티브 앱을 동시에
          지원하며, 한국어·영어·일본어·중국어 4개 언어로 제공됩니다.
        </p>

        <h3>프로젝트 대시보드</h3>
        <p>
          작업 중인 모형을 프로젝트 단위로 묶어 백로그·진행 중·완성의 상태로
          관리합니다. 각 미니어처마다 시간별 진행 로그를 사진과 함께 기록할
          수 있고, 누적 작업 시간 통계를 통해 작업 패턴을 되돌아볼 수
          있습니다. 캘린더 뷰는 작업 일정과 외부 이벤트(대회·행사)를 한 화면에
          겹쳐 보여줘, 출품 마감 같은 목표를 중심으로 작업을 계획할 수 있게
          해줍니다.
        </p>

        <h3>갤러리 & 커뮤니티</h3>
        <p>
          완성작을 사용자 갤러리에 업로드하고 태그·기법·브랜드 등으로 필터링해
          다른 모델러들의 작품을 탐색할 수 있습니다. 좋아요와 댓글, 이모지
          반응으로 교류하며, 주간/월간 랭킹을 통해 주목받는 작품을 확인합니다.
          누적 작품 수, 인기작 획득 수 등 다양한 조건을 충족하면 자동으로
          수여되는 배지 시스템이 있어, 꾸준한 작업을 시각적으로 보상합니다.
          커뮤니티 게시판에서는 질문·후기·튜토리얼을 자유롭게 공유할 수
          있습니다.
        </p>

        <h3>AI 리컬러 & 가이드</h3>
        <p>
          완성작 레퍼런스 이미지나 원하는 색감의 사진을 업로드하면, AI가
          원본을 분석해 핵심 색상을 추출하고 이를 쉐도우/미드톤/하이라이트의
          트라이어드로 분리해 실제 도색 가이드를 생성합니다. 사용자가 보유한
          페인트를 우선적으로 활용하도록 매칭하며, 부족한 색은 혼합 레시피
          형태로 제안해줍니다. 결과물은 스크랩북에 저장하고 공개 공유 링크로
          다른 사용자에게 전달할 수 있습니다.
        </p>

        <h3>페인트 관리 & 차트</h3>
        <p>
          시타델·바예호·AK 인터랙티브 등 주요 브랜드의 페인트 라이브러리를
          기반으로 내 보유 목록과 위시리스트를 관리합니다. 바코드 스캔으로
          빠르게 등록할 수 있고, 한 브랜드의 색을 다른 브랜드의 가장 가까운
          색으로 변환하는 기능을 제공합니다. 모든 색상 거리 계산은 CIEDE2000
          (Delta-E 2000) 알고리즘을 기반으로 해, 사람 눈이 실제로 느끼는 색차에
          최대한 가깝게 매칭합니다.
        </p>

        <h3>레시피 & 팔레트</h3>
        <p>
          자주 사용하는 색상 조합을 레시피로 저장해 여러 미니어처에 재사용할
          수 있습니다. 각 레시피는 단계별 페인트 구성과 혼합 비율을 기록해
          두고, 나중에 동일한 색감을 재현할 때 참고할 수 있습니다.
        </p>

        <h3>행사 & 이벤트</h3>
        <p>
          국내외 미니어처 대회·박람회·공모전 일정을 통합 캘린더로 제공하고,
          사용자가 직접 행사를 제보할 수 있습니다. 특정 이벤트에 작품을
          출품하는 챌린지 기능을 통해 정해진 기간 내 완성작을 경쟁 방식으로
          공유할 수 있습니다.
        </p>

        <h3>크로스 플랫폼</h3>
        <p>
          동일한 코드베이스에서 웹(SSR)과 iOS/Android 네이티브 앱을 함께
          빌드합니다. 모바일 앱에서는 카메라 직접 촬영, FCM 푸시 알림, OAuth
          딥링크, 앱 배지 카운트, Live Update 기반 무중단 업데이트 등 네이티브
          기능을 활용하며, 웹과 앱 간에 계정과 데이터가 완전히 동기화됩니다.
        </p>

        <h2>프론트엔드 기술 스택</h2>
        <ul>
          <li>
            <strong>프레임워크</strong>: React 19 + React Router v7 (SSR)
          </li>
          <li>
            <strong>언어 / 번들러</strong>: TypeScript 5.9, Vite 7
          </li>
          <li>
            <strong>상태 관리</strong>: Zustand, TanStack Query
          </li>
          <li>
            <strong>스타일</strong>: Tailwind CSS v4, shadcn/ui, Radix UI
          </li>
          <li>
            <strong>국제화</strong>: i18next (ko / en / ja / zh)
          </li>
          <li>
            <strong>네이티브 래퍼</strong>: Capacitor 8 (iOS / Android),
            @capacitor/app, /browser, /camera, Firebase Messaging(FCM),
            Capgo Live Update
          </li>
          <li>
            <strong>배포</strong>: Cloudflare Pages (Pages Functions + SSR)
          </li>
        </ul>

        <h2>백엔드 기술 스택</h2>
        <ul>
          <li>
            <strong>프레임워크</strong>: Spring Boot 4 + Java 17
          </li>
          <li>
            <strong>영속성</strong>: Spring Data JPA, PostgreSQL
          </li>
          <li>
            <strong>인증</strong>: Spring Security, JWT (jjwt), OAuth 2.0
            (Google / Apple / Kakao), Refresh Token
          </li>
          <li>
            <strong>캐시 / 레이트 리밋</strong>: Redis, Bucket4j, 일일
            사용량 제한기
          </li>
          <li>
            <strong>스토리지</strong>: Cloudflare R2 (AWS S3 SDK, 프리사인
            URL 기반 업로드)
          </li>
          <li>
            <strong>이미지 처리</strong>: metadata-extractor (EXIF),
            TwelveMonkeys WebP
          </li>
          <li>
            <strong>알림 / 푸시</strong>: Firebase Admin SDK (FCM)
          </li>
          <li>
            <strong>AI 통합</strong>: OpenAI GPT 기반 리컬러 플래너
            (색상 추출 → 트라이어드 설계 → 페인트 매칭), 자체 CIEDE2000
            색상 매칭 알고리즘
          </li>
          <li>
            <strong>보안</strong>: jsoup 기반 HTML sanitize, 통합
            RateLimitFilter
          </li>
        </ul>

        <h2>이 블로그 자체</h2>
        <ul>
          <li>Next.js 16 (App Router, React Server Components)</li>
          <li>MDX (next-mdx-remote) + Shiki 코드 하이라이팅</li>
          <li>Tailwind CSS v4 + shadcn/ui</li>
          <li>Vercel 배포 (ISR + Edge)</li>
          <li>Upstash Redis 조회수, giscus 댓글, Vercel Analytics</li>
        </ul>

        <h2>연락</h2>
        <p>
          서비스 관련 문의는{" "}
          <a
            href="https://paintlater.org"
            target="_blank"
            rel="noopener noreferrer"
          >
            paintlater.org
          </a>
          를 방문해주세요. 블로그 포스트에 대한 의견은 각 포스트 하단 댓글로
          남겨주시면 됩니다.
        </p>
      </div>
    </div>
  );
}
