# PaintLater 기술 블로그 - 프로젝트 아웃라인

## 프로젝트 개요

PaintLater 서비스를 개발하면서 겪은 기술적 문제 해결 과정을 공유하는 기술 블로그.
포트폴리오와 연동되어 기술적 깊이를 보여주는 역할.

### 참고 저장소

- **프론트엔드**: https://github.com/rlaqjant/miniature-backlog-web (React 19 + Vite + TypeScript)
- **백엔드**: https://github.com/rlaqjant/miniature-backlog-api (Spring Boot + Java)

블로그 포스트 작성 시 위 저장소의 실제 코드를 참고하여 코드 예시와 설명을 작성합니다.

---

## 기술 스택

### Next.js + MDX

| 항목 | 선택 | 이유 |
|------|------|------|
| 프레임워크 | **Next.js 15 (App Router)** | React 생태계 표준, 새로운 프레임워크 학습 기회 |
| 콘텐츠 | **MDX (next-mdx-remote)** | Markdown + React 컴포넌트 혼용 (코드 블록, 다이어그램 등) |
| 스타일 | **Tailwind CSS v4** | 기존 PaintLater와 동일 스택, 학습 비용 제로 |
| UI | **shadcn/ui** | 기존 PaintLater와 동일, 다크 모드 기본 지원 |
| 배포 | **Vercel** | Next.js 공식 플랫폼, 무료 티어, ISR/Edge 최적화 |
| 코드 하이라이팅 | **Shiki (rehype-pretty-code)** | VS Code 테마 호환, 파일명·라인 하이라이트 지원 |
| 검색 | **Fuse.js** | 클라이언트 사이드 퍼지 검색, 서버 불필요 |

### 왜 Next.js인가

- PaintLater는 React Router v7로 구축했으므로, Next.js를 경험하면 React 메타 프레임워크 양대 축을 모두 다루게 됨
- App Router + RSC(React Server Components) 학습 기회
- 이직 시 Next.js 경험이 포트폴리오에서 플러스
- Vercel 배포로 ISR(Incremental Static Regeneration), Edge Functions 등 새로운 배포 전략 경험
- shadcn/ui를 그대로 사용 가능하여 UI 구축 비용 최소화

---

## 디렉토리 구조

```
paintlater_blog/
├── next.config.mjs            # Next.js 설정
├── tailwind.config.ts         # Tailwind 설정
├── tsconfig.json
├── package.json
│
├── public/
│   ├── favicon.svg
│   └── images/
│       └── posts/             # 포스트 이미지
│
├── content/
│   └── posts/                 # 블로그 콘텐츠 (MDX)
│       ├── jwt-token-queue-pattern.mdx
│       ├── delta-e-paint-matching.mdx
│       └── capacitor-oauth-deeplink.mdx
│
├── src/
│   ├── app/
│   │   ├── layout.tsx         # 루트 레이아웃 (nav, footer, 테마)
│   │   ├── page.tsx           # 메인 (최신 포스트 목록)
│   │   ├── posts/
│   │   │   └── [slug]/
│   │   │       └── page.tsx   # 포스트 상세 (MDX 렌더링)
│   │   ├── tags/
│   │   │   └── [tag]/
│   │   │       └── page.tsx   # 태그별 포스트 필터
│   │   ├── series/
│   │   │   └── [series]/
│   │   │       └── page.tsx   # 시리즈별 포스트 모음
│   │   ├── about/
│   │   │   └── page.tsx       # 소개 (PaintLater 프로젝트 링크)
│   │   └── feed.xml/
│   │       └── route.ts       # RSS 피드 (Route Handler)
│   │
│   ├── components/
│   │   ├── ui/                # shadcn/ui 프리미티브
│   │   ├── PostCard.tsx       # 포스트 목록 카드
│   │   ├── TagList.tsx        # 태그 칩 목록
│   │   ├── SeriesNav.tsx      # 시리즈 네비게이션
│   │   ├── TableOfContents.tsx  # 포스트 TOC (사이드바)
│   │   ├── CodeBlock.tsx      # 커스텀 코드 블록 (파일명 표시)
│   │   ├── ThemeToggle.tsx    # 다크 모드 토글
│   │   └── mdx/               # MDX 내 사용 인터랙티브 컴포넌트
│   │       ├── DeltaEDemo.tsx   # Delta-E 색상 거리 시각화
│   │       └── TokenFlowDiagram.tsx # JWT 갱신 흐름 다이어그램
│   │
│   ├── lib/
│   │   ├── posts.ts           # MDX 파일 읽기, 파싱, 정렬 유틸
│   │   ├── mdx.ts             # MDX 컴파일 설정 (rehype/remark 플러그인)
│   │   └── utils.ts           # cn() 유틸리티
│   │
│   └── styles/
│       └── globals.css        # Tailwind + 코드 블록 테마 + 타이포그래피
│
├── .env.local                 # 환경 변수 (필요시)
└── velite.config.ts           # (선택) Velite 콘텐츠 빌더 설정
```

---

## 콘텐츠 관리

### MDX 파싱 방식

파일 시스템 기반으로 `content/posts/` 디렉토리의 MDX 파일을 읽어서 처리합니다.

```typescript
// src/lib/posts.ts
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

export interface PostMeta {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  updatedAt?: string;
  tags: string[];
  series?: string;
  seriesOrder?: number;
  draft: boolean;
  thumbnail?: string;
}

export function getAllPosts(): PostMeta[] {
  // content/posts/*.mdx 파일을 읽어 frontmatter 파싱, 날짜순 정렬
}

export function getPostBySlug(slug: string): { meta: PostMeta; content: string } {
  // 특정 포스트의 frontmatter + MDX 본문 반환
}
```

### 포스트 예시 (frontmatter)

```mdx
---
title: "JWT 토큰 갱신 대기열 패턴 - 멀티탭 환경에서의 경합 해결"
description: "동시 요청 시 토큰 갱신이 중복 발생하는 문제를 대기열 패턴으로 해결한 과정"
publishedAt: "2026-04-20"
tags: ["JWT", "인증", "React", "Axios"]
series: "PaintLater 인증 여정"
seriesOrder: 1
draft: false
---

## 문제 상황
...
```

---

## 핵심 기능

### MVP (1차)

- [ ] 포스트 목록 (메인 페이지, 페이지네이션)
- [ ] 포스트 상세 (MDX 렌더링 + Shiki 코드 하이라이팅)
- [ ] 태그 필터링
- [ ] 시리즈 네비게이션 (이전/다음 포스트)
- [ ] 반응형 레이아웃 (모바일/데스크톱)
- [ ] 다크 모드 (next-themes + shadcn)
- [ ] RSS 피드 (Route Handler)
- [ ] SEO (generateMetadata, sitemap.xml, robots.txt)
- [x] Vercel 배포 (https://paintlater-blog.vercel.app)

### 2차

- [x] 포스트 검색 (Fuse.js 클라이언트 검색)
- [x] 포스트 TOC (Intersection Observer 스크롤 추적)
- [x] OG 이미지 자동 생성 (next/og)
- [x] 조회수 표시 (Upstash Redis + Vercel Analytics)
- [x] 댓글 (giscus - GitHub Discussions 기반)

### 3차

- [ ] 인터랙티브 데모 컴포넌트
  - Delta-E 색상 거리 시각화
  - JWT 갱신 흐름 다이어그램
- [ ] 다국어 (ko/en, next-intl)
- [ ] 뉴스레터 구독

---

## 포스트 작성 플로우

```
1. content/posts/에 .mdx 파일 생성
2. frontmatter 작성 (title, tags, series 등)
3. MDX로 본문 작성 (코드 블록, 이미지, React 컴포넌트)
4. npm run dev로 로컬 확인
5. main 브랜치 push → Vercel 자동 배포
```

---

## 개발 명령어

```bash
npx create-next-app@latest .  # 프로젝트 초기화
npm run dev                   # 개발 서버 (http://localhost:3000)
npm run build                 # 프로덕션 빌드
npm run start                 # 빌드 결과 실행
```

---

## 블로그 포스트 로드맵

### 시리즈 A: PaintLater 인증 여정
1. JWT 토큰 갱신 대기열 패턴 (멀티탭, 선제적 갱신)
2. Capacitor 네이티브 앱 OAuth 딥링크 통합
3. Apple OAuth 크로스 사이트 제약 해결

### 시리즈 B: AI + 도메인 알고리즘
1. 다단계 AI 코칭 파이프라인 설계
2. Delta-E 색상 매칭으로 실제 페인트 추천하기

### 단독 포스트
- Bucket4j + Redis 이중 Rate Limiting
- React Router v7 SSR 실전 가이드
