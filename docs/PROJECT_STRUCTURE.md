# PaintLater 프로젝트 구조 (2026-04-13 분석)

> 본 문서는 `oh-my-claudecode:architect` 에이전트(Opus, READ-ONLY)가
> `miniature-backlog-web`, `miniature-backlog-api` 두 저장소의 실제 소스를
> 정밀 분석한 결과입니다. 블로그 포스트 작성 시 "시맨틱 지도"로 참조합니다.
>
> 버전/라인 번호는 분석 시점 기준이며, 추후 업데이트될 수 있습니다.

## 작업공간 개요

`/Users/burns/Works/projects/miniature-backlog/` 워크스페이스는 두 개의 독립 저장소로 구성된다.

- **miniature-backlog-web** — React Router v7 기반의 프론트엔드. 웹(SSR on Cloudflare Pages)과 Capacitor 기반 iOS/Android 앱 양쪽을 동일 코드베이스에서 빌드한다.
- **miniature-backlog-api** — Spring Boot 4.0.1 기반의 백엔드 REST API. JWT 인증, JPA+PostgreSQL, Redis, Cloudflare R2, Firebase(FCM), OpenAI 기반 AI 코칭을 처리한다.

### 기존 문서 대비 stale 경고

- 워크스페이스 루트의 `PROJECT_STRUCTURE.md`는 **요약문 수준**이며, 내용은 대체로 올바르나 피처 목록이 최신 상태를 모두 반영하지는 않는다 (예: `aigallery`, `event`, `eventbanner`, `paintconversion`, `paintmatch`, `paintwishlist`, `ota`, `knowledge`, `recipe`, `aiguide`, `aipainting`, `barcode` 등 누락).
- 워크스페이스 루트 문서는 백엔드를 "Spring Boot 4 + JPA + Security + Redis + R2"로 기술하고 있는데, `build.gradle`에서 실제로 확인된 버전은 **Spring Boot 4.0.1 / Java 17** (`miniature-backlog-api/build.gradle:3`, `:13`)이다.
- 각 저장소의 `doc/PROJECT_STRUCTURE.md` 및 `doc/API_ENDPOINT_INDEX.md`는 본 분석에서 직접 비교하지 않았다. 문서와 충돌하는 부분은 본문에서 명시한다.

---

## miniature-backlog-web (프론트엔드)

### 기술 스택 (package.json 기반 확인값)

| 항목 | 값 |
|---|---|
| UI 프레임워크 | React 19.2.0, React DOM 19.2.0 |
| 라우터/메타프레임워크 | react-router 7.12.0, @react-router/dev 7.13.0, @react-router/cloudflare 7.13.0 |
| 번들러 | Vite 7.2.4 (`vite.config.ts`) |
| 타입 | TypeScript 5.9.3 |
| 스타일 | Tailwind CSS 4.1.18 (@tailwindcss/vite 4.1.18), radix-ui, shadcn, tw-animate-css |
| 상태관리 | Zustand 5.0.10, @tanstack/react-query 5.90.21 |
| 네트워크 | axios 1.15.0 |
| 국제화 | i18next 25.8.5, react-i18next 16.5.4, i18next-browser-languagedetector |
| 네이티브 래퍼 | Capacitor 8.2.0 (core/cli/android/ios), @capacitor/app, /browser, /camera, /keyboard, /preferences, /splash-screen, /status-bar, @capacitor-firebase/messaging 8.1.0, @capgo/capacitor-updater 8.43.11, @capawesome/capacitor-badge 8.0.1 |
| 푸시/Firebase | firebase 12.10.0 |
| 기타 | framer-motion 12.34, gsap 3.14, lenis 1.3, embla-carousel, fullcalendar 6.1.20, @tiptap/react 3.20+ (rich text), @dnd-kit, @zxing/browser(바코드 웹 폴백), html2canvas-pro, react-easy-crop, vaul |
| 빌드 타겟 | SSR 웹 빌드(기본) / SPA Capacitor 빌드(`CAPACITOR_BUILD=true`) |
| 테스트 | @playwright/test 1.58.2 |
| 배포 | Cloudflare Pages Functions (`functions/`, `wrangler.toml`) |

**SSR / SPA 분기 포인트**

- `react-router.config.ts:7` — `ssr: process.env.CAPACITOR_BUILD !== 'true'`. Capacitor 빌드 시에만 SPA 모드.
- `react-router.config.ts:10` — `routeDiscovery: { mode: "initial" }`. `/__manifest` 엔드포인트가 Cloudflare Pages에서 동작하지 않아 전체 manifest를 HTML에 임베드하는 선택.
- `vite.config.ts:12-127` — 커스텀 `stripServerExports` Vite 플러그인. Capacitor 빌드 시 `loader`/`action`/`HydrateFallback` export를 AST 스캐닝 없이 정규식+괄호 추적으로 제거한다. `root.tsx`만 `HydrateFallback`을 유지한다.
- `vite.config.ts:136-151` — `manualChunks`로 `vendor-react / vendor-ui / vendor-i18n / vendor-state` 4분할.

### 디렉토리 구조 (실제)

```
miniature-backlog-web/
├─ android/                 (Capacitor Android 네이티브)
├─ ios/                     (Capacitor iOS 네이티브)
├─ functions/               (Cloudflare Pages Functions)
├─ public/
├─ scripts/
├─ doc/                     (내부 문서, stale 가능)
├─ react-router.config.ts
├─ vite.config.ts
├─ capacitor.config.ts
├─ wrangler.toml
├─ playwright.config.ts
└─ src/
   ├─ assets/
   ├─ components/
   ├─ constants/
   ├─ data/
   ├─ hooks/                (70+ 훅, useXxx 패턴)
   ├─ i18n/
   ├─ lib/                  (queryClient, utils, progressColors)
   ├─ locales/              (en/ko/ja/zh JSON)
   ├─ pages/                (feature 단위 페이지 폴더)
   ├─ routes/               (layout + guard 라우트)
   ├─ services/
   │  ├─ api/              (feature별 *.api.ts)
   │  └─ pushNotification.ts
   ├─ stores/               (Zustand 스토어)
   ├─ types/
   ├─ utils/
   ├─ entry.client.tsx
   ├─ entry.server.tsx
   ├─ root.tsx
   └─ routes.ts
```

### 핵심 모듈

아래 각 feature는 `pages/<Feature>/` + `services/api/<feature>.api.ts` + (선택)`stores/` + (선택)`hooks/use<Feature>.ts` 조합으로 구성된다. 확인된 매칭만 정리한다.

| Feature | 페이지 위치 | API 서비스 파일 | 관련 훅 |
|---|---|---|---|
| Home | `src/pages/Home/HomePage.tsx` | `src/services/api/home.api.ts` | `useHome.ts` |
| Auth (로그인/로그아웃/OAuth 콜백) | `src/pages/Auth/LoginPage.tsx`, `AuthCallbackPage.tsx`, `ProfileSetupPage.tsx` | `src/services/api/auth.api.ts` | `useAuth.ts`, `useAuthHydration.ts`, `useNicknameCheck.ts` |
| Dashboard (프로젝트/워크스페이스/캘린더/도색시간) | `src/pages/Dashboard/` | `src/services/api/project.api.ts`, `calendar.api.ts`, `sidebar.api.ts` | `useDashboardMiniatures.ts`, `useDashboardStats.ts`, `useDashboardSearchParams.ts`, `useCalendarEvents.ts`, `usePaintTimeStats.ts` |
| Miniatures / Detail | `src/pages/Detail/MiniatureDetailPage.tsx` | `src/services/api/miniature.api.ts` | `useMiniatures.ts`, `useMiniatureDetail.ts`, `useMiniatureSummary.ts`, `useMiniatureComputedData.ts` |
| Gallery (사용자 갤러리) | `src/pages/Gallery/*` | `src/services/api/gallery.api.ts` | `useGallery.ts`, `useGalleryDetail.ts`, `useGalleryFilterOptions.ts`, `useGallerySearch.ts`, `useGalleryRanking.ts`, `useGalleryAiCoaching.ts` |
| AI Gallery (AI 도색 피드) | `src/pages/AiGallery/*` | `src/services/api/aiGallery.api.ts` | `useAiGallery.ts`, `useAiGalleryDetail.ts`, `useAiGalleryRanking.ts` |
| Community (게시판) | `src/pages/Community/*` | `src/services/api/community.api.ts`, `comment.api.ts` | `useCommunity.ts`, `useCommunityBoards.ts`, `useCommunityDetail.ts`, `useCommunityRanking.ts`, `useBoardRanking.ts`, `useComments.ts` |
| Board (공개 보드) | `src/pages/Board/*` | — (community.api 일부 재사용) | `usePublicBoard.ts`, `usePublicMiniatureDetail.ts` |
| Recolor / AI Painting | `src/pages/Recolor/AiPaintingPage.tsx`, `ScrapbookPage.tsx`, `SharedRecolorPage.tsx`, `SharedGuidePage.tsx`, `EmptyGuidePanel.tsx` | `src/services/api/recolor.api.ts`, `aiPainting.api.ts`, `aiGuide.api.ts` | `useRecolor.ts`, `useAiPainting.ts`, `useAiGuide.ts`, `useScrapbook.ts`, `useScrapCommon.ts`, `useScrapList.ts` |
| AI Coaching | (Gallery 상세 내부 패널) | `src/services/api/aiCoaching.api.ts` | `useAiCoaching.ts`, `useAiCoachingTrend.ts`, `useGalleryAiCoaching.ts` |
| My Paints / PaintChart | `src/pages/MyPaints/MyPaintsPage.tsx`, `BarcodeScanPage.tsx`, `src/pages/PaintChart/PaintChartPage.tsx`, `PaintConversionModal.tsx` | `src/services/api/userPaint.api.ts`, `paintWishlist.api.ts`, `paintConversion.api.ts`, `paintMatch.api.ts`, `palette.api.ts`, `barcode.api.ts` | `useUserPaints.ts`, `useBarcodeScan.ts`, `usePaintChartOwnership.ts`, `usePalettes.ts` |
| Recipes | `src/pages/Recipe/MyRecipesPage.tsx`, `RecipeFormPage.tsx` | `src/services/api/recipe.api.ts` | `useRecipes.ts` |
| Ranking | `src/pages/Ranking/RankingPage.tsx` | `src/services/api/ranking.api.ts` | `useRanking.ts`, `useMyRank.ts` |
| Notification | `src/pages/Notification/NotificationPage.tsx` | `src/services/api/notification.api.ts`, `launchNotification.api.ts` | `useNotifications.ts`, `useUnreadCount.ts`, `usePushNotifications.ts`, `useNotifyOnComplete.ts` |
| MyPage / Profile / Blocked Users | `src/pages/MyPage/*`, `src/pages/Profile/PublicProfilePage.tsx` | `src/services/api/user.api.ts`, `profile.api.ts`, `block.api.ts` | `useFloatingProfileTabs.ts` |
| Event (행사/챌린지) | `src/pages/Event/EventCalendarPage.tsx`, `EventSubmitPage.tsx`, `EventChallengePage.tsx` | `src/services/api/expo.api.ts`, `eventBanner.api.ts`, `eventChallenge.api.ts` | `useExpo.ts`, `useEventChallenge.ts` |
| Image Gallery | `src/pages/ImageGallery/ImageGalleryPage.tsx` | `src/services/api/image.api.ts` | — |
| Progress Logs | (Detail 내부) | `src/services/api/progressLog.api.ts` | `useProgressLogs.ts`, `useProgressLogDraft.ts`, `useOneStepDraft.ts` |
| Admin | `src/pages/Admin/AdminPage.tsx` | `src/services/api/admin.api.ts` | — |
| Legal / App-launch / Onboarding / NotFound / Maintenance | 각 동명 폴더 | `appSetting.api.ts`, `launchNotification.api.ts` | — |
| Share (report, share 페이지) | (Recolor 내 shared 페이지) | `src/services/api/share.api.ts`, `report.api.ts` | — |
| Badge | (사이드바/훅 내부) | `src/services/api/badge.api.ts` | `useBadges.ts`, `useBadgeEarnedCheck.ts`, `useSidebarBadges.ts` |
| 기타 | — | `backlogItem.api.ts`, `categoryPreset.api.ts`, `like.api.ts`, `statistics.api.ts` | `useToggleLike.ts`, `useOptimisticMutation.ts`, `useScrapCommon.ts`, `useUgcTermsGuard.ts` |

**Zustand 스토어** (`src/stores/`):

- `authStore.ts` — 사용자/인증/네이티브 토큰
- `boardVisitStore.ts`, `navigationStore.ts`, `notificationStore.ts`, `paintWishlistStore.ts`, `projectStore.ts`, `themeStore.ts`, `timerStore.ts`, `uiStore.ts`

**라우트 레이아웃/가드** (`src/routes/`): `AdminRoute.tsx`, `ProtectedRoute.tsx`, `GuestRoute.tsx`, `auth-layout.tsx`, `dashboard-layout.tsx`, `fullscreen-auth-layout.tsx`, `redirect-community.tsx`, `redirect-login.tsx`, `redirect-paints.tsx`, `sitemap.tsx`. 실제 라우트 트리는 `src/routes.ts` 참조.

### 주목할 패턴 (블로그 글감 후보 — 실제 좌표)

#### JWT 토큰 갱신

- **파일**: `src/services/api/client.ts`
- **선제적 갱신 타이머**: `client.ts:57` (`PROACTIVE_REFRESH_BUFFER_MS = 5 * 60 * 1000`), `scheduleProactiveRefresh()` `client.ts:99-119`, `clearRefreshTimer()` `:121`
- **visibilitychange 기반 타이머 보정**: `client.ts:132-154` — 백그라운드에서 setTimeout이 throttle되는 이슈를 탭 복귀 시 경과시간 계산으로 보완
- **반응적(401) 갱신 + 실패 큐**: `client.ts:197-216`, `failedQueue`, `processQueue()`
- **E2002/E2003 분기 처리 및 refresh 요청 자기 큐잉 데드락 방지**: `client.ts:290-320`
- **멀티탭 경합 복구 (refresh 실패 후 150ms 대기 → 원 요청 1회 재시도)**: `client.ts:339-354`
- **네이티브(Capacitor) vs 웹 토큰 이중화** (쿠키 vs body): `client.ts:180-193` (요청), `client.ts:327-337` (응답 저장)
- **강제 로그아웃 가드(중복 호출 방지)**: `client.ts:67-86`
- 참고: 멀티탭 BroadcastChannel/storage 이벤트 기반 동기화는 `src/` 내 grep으로 미발견. 즉 멀티탭 경합은 "refresh 실패 → E2002 → 150ms 대기 후 재시도" 휴리스틱으로만 처리된다 (글감 포인트).

#### OAuth / 딥링크

- **딥링크 수신**: `src/components/native/DeepLinkListener.tsx`
  - `paintlater://auth/callback` 스킴 파싱: `DeepLinkListener.tsx:9-23`
  - `App.addListener('appUrlOpen')`: `:45-48`
  - cold-start 대응 `App.getLaunchUrl()`: `:51-54`
  - `resume` 시 놓친 딥링크 재확인: `:57-63`
  - 인앱 브라우저(@capacitor/browser) 자동 닫기: `:17`
- **OAuth 콜백 페이지**: `src/pages/Auth/AuthCallbackPage.tsx` (라우트 `routes.ts:48`)
- **로그인 페이지 / 닉네임 설정**: `src/pages/Auth/LoginPage.tsx`, `ProfileSetupPage.tsx`
- **authStore 네이티브 토큰 관리**: `src/stores/authStore.ts:17-20, 27-29`

#### AI 코칭 파이프라인 호출 (프론트)

- API 래퍼: `src/services/api/aiCoaching.api.ts`
- 훅: `src/hooks/useAiCoaching.ts`, `useAiCoachingTrend.ts`, `useGalleryAiCoaching.ts`
- 폴링: `src/hooks/usePolling.ts`, `useNotifyOnComplete.ts` (상태 전이 알림)
- 사일런트 URL 패턴으로 `/ai-coaching`이 등록되어 토스트 중복 방지: `client.ts:36`

#### Delta-E / 색상 매칭 (프론트)

- 유틸: `src/utils/colorDistance.ts`
- 레시피 변환: `src/utils/recipeConverter.ts`
- PaintChart 변환 모달: `src/pages/PaintChart/PaintConversionModal.tsx`
- Recolor 가이드 패널: `src/pages/Recolor/EmptyGuidePanel.tsx`
- 타입: `src/types/paintMatch.types.ts`, `paintConversion.types.ts`, `aiGuide.types.ts`

#### Rate Limiting 프론트 처리

- 서버 측 429 응답(`E2005`)을 별도로 특수 처리하는 코드는 `client.ts`에서 확인되지 않는다. 일반 에러 토스트 경로(`client.ts:281-287`)로 흐른다.
- 확인 필요 항목: 특정 뮤테이션 훅에서 429를 추가 핸들링하는지는 별도 grep 필요.

#### React Router v7 SSR 설정

- `react-router.config.ts` 전체 (12줄)
- `routeDiscovery.mode = "initial"` — Cloudflare Pages에서 `/__manifest` 미지원 이슈 회피 (`:9-10`)
- Capacitor SPA 빌드 시 서버 전용 export 제거 플러그인: `vite.config.ts:12-127`
- `entry.server.tsx`, `entry.client.tsx`, `root.tsx` 가 표준 v7 구조
- 벤더 청크 분할: `vite.config.ts:140-147`

#### 멀티탭 / BroadcastChannel / storage event

- **미발견**. `BroadcastChannel`, `storage` 이벤트, `addEventListener('storage',…)` 참조가 `src/`에 존재하지 않음. 멀티탭 동기화는 (a) 각 탭의 visibilitychange 기반 선제 갱신(`client.ts:132`), (b) refresh 실패 시 150ms 재시도(`client.ts:346`) 두 가지 휴리스틱으로만 커버된다 — **글감 후보 "의도적으로 하지 않은 것"**.

---

## miniature-backlog-api (백엔드)

### 기술 스택 (build.gradle 기반 확인값)

| 항목 | 값 |
|---|---|
| 프레임워크 | Spring Boot 4.0.1 (`build.gradle:3`) |
| 의존성 관리 | io.spring.dependency-management 1.1.7 |
| 언어 | Java 17 toolchain (`build.gradle:13`) |
| 웹 | spring-boot-starter-web, spring-boot-starter-validation |
| 영속성 | spring-boot-starter-data-jpa, postgresql driver(runtime) |
| 보안 | spring-boot-starter-security, jjwt 0.13.0 (api/impl/jackson) |
| 캐시/Redis | spring-boot-starter-data-redis, spring-boot-starter-cache |
| Rate Limit | bucket4j-core 8.10.1 (`build.gradle:62`) |
| OAuth | google-api-client 2.7.0 (Google ID 토큰 검증). Apple/Kakao는 직접 구현 |
| 스토리지 | AWS SDK S3 (BOM 2.25.0) — Cloudflare R2 호환 |
| 이미지 | metadata-extractor 2.19.0 (EXIF), imageio-webp 3.12.0 (TwelveMonkeys) |
| HTML 보안 | jsoup 1.18.1 (Community 리치 텍스트 sanitize) |
| 푸시 | firebase-admin 9.4.3 (FCM) |
| 기타 | Lombok, Spring Boot test (H2 runtime) |
| 빌드 툴 | Gradle (`build.gradle`, Groovy DSL — Kotlin DSL 아님) |
| 컨테이너화 | `Dockerfile`, `docker-compose.yml`, `docker-compose.local.yml`, `nginx/` |

### 디렉토리 구조 (feature 단위, 실제)

베이스 패키지: `com.rlaqjant.miniature_backlog_api` (`src/main/java/com/rlaqjant/miniature_backlog_api/`)

루트 피처 디렉토리 목록:

```
admin, aicoaching, aigallery, aiguide, aipainting, appsetting, auth, backlogitem,
badge, barcode, block, calendar, categorypreset, comment, common, community, config,
devicetoken, event, eventbanner, expo, gallery, health, home, image, knowledge,
launchnotification, like, miniature, notification, ota, paintconversion, paintmatch,
paintrequest, paintwishlist, palette, profile, progresslog, project, ranking, reaction,
recipe, recolor, report, security, statistics, user, userpaint
```

메인 클래스: `MiniatureBacklogApiApplication.java`

각 피처는 기본적으로 `controller / service / repository / domain / dto` 서브 패키지를 가진다. 일부 피처는 `dto`/`controller`/`service`만 존재(예: `paintmatch`, `home`, `health`, `statistics`).

**`common/`**: `dto`, `exception`, `service` (`DailyUsageLimiter`, `ViewCountService`), `util` (`ColorDistanceUtil`, `ClientIpUtils`, 등)

**`config/`** (설정 모음):

- `AsyncConfig.java` — @EnableAsync / ThreadPoolTaskExecutor
- `CorsConfig.java`
- `FirebaseConfig.java` — FCM 초기화
- `MessageSourceConfig.java` — i18n 메시지
- `R2Config.java` — S3/R2 client
- `RateLimitFilter.java` — Bucket4j 필터
- `RedisCacheConfig.java`
- `SecurityConfig.java`

**`security/`**:

- `jwt/JwtTokenProvider.java`, `jwt/JwtAuthenticationFilter.java`, `jwt/JwtCookieUtil.java`, `jwt/RefreshToken.java`, `jwt/RefreshTokenRepository.java`, `jwt/RefreshTokenService.java`
- `oauth/GoogleOAuthService.java`, `oauth/AppleOAuthService.java`, `oauth/KakaoOAuthService.java`
- `userdetails/CustomUserDetails.java`, `CustomUserDetailsService.java`
- `handler/JwtAuthenticationEntryPoint.java`

### 핵심 모듈 (feature별)

코드에서 존재 확인된 것만 기록한다. 주요 엔드포인트는 `grep` 결과 기반 최소 셋.

#### auth (`auth/`)
- `controller/AuthController.java` @ `/auth` (`AuthController.java:42`)
  - `POST /auth/register` (`:79`)
  - `GET  /auth/check-nickname` (`:93`)
  - `POST /auth/login` (`:105`)
  - `GET  /auth/google/login` (`:131`)
  - `GET  /auth/kakao/login` (`:148`)
  - `GET  /auth/oauth2/callback/google` (`:163`)
  - `GET  /auth/oauth2/callback/kakao` (`:179`)
  - `GET  /auth/apple/login` (`:197`)
  - `GET  /auth/oauth2/callback/apple` (`:215`)
  - `PATCH /auth/nickname` (`:287`)
  - `POST /auth/refresh` (`:301`)
  - `POST /auth/logout` (`:340`)
- `service/AuthService.java`
- `security/oauth/AppleOAuthService.java`, `GoogleOAuthService.java`, `KakaoOAuthService.java`

#### gallery (`gallery/`)
- `controller/GalleryPostController.java` @ `/gallery`
  - `GET /gallery/my`, `POST /gallery`, `PATCH /gallery/{id}`, `DELETE /gallery/{id}`
  - `POST /gallery/{id}/like`, `POST /gallery/{id}/comments`, `PATCH|DELETE /gallery/{galleryId}/comments/{commentId}`
  - `POST /gallery/{galleryId}/comments/{commentId}/reactions`
  - `GET /gallery/completed-miniatures`
- `controller/PublicGalleryController.java` @ `/public/gallery`
  - `GET /public/gallery`, `/public/gallery/{id}`, `/public/gallery/ranking`, `/public/gallery/{id}/comments`
- `service/GalleryPostService.java`, `service/GalleryCommentService.java`
- `domain/`, `dto/`, `repository/` 표준 구조

#### aigallery (`aigallery/`)
- `service/AiGalleryPostService.java`, `service/AiGalleryCommentService.java`
- `controller/`, `domain/`, `dto/`, `repository/`

#### community (`community/`)
- `controller/`, `service/`, `domain/`, `dto/`, `repository/`, `util/` (rich-text sanitize 등 — jsoup 사용 추정)

#### comment (`comment/`) — 범용 댓글
- `controller/`, `service/`, `domain/`, `dto/`, `repository/`

#### recolor (`recolor/`) — AI 도색 생성 파이프라인
- `controller/RecolorJobController.java` @ `/recolor-jobs`
  - `GET /recolor-jobs`, `GET /recolor-jobs/usage`, `POST /recolor-jobs/presign`, `POST /recolor-jobs`, `GET /recolor-jobs/{jobId}`, `DELETE /recolor-jobs/{jobId}`, `POST /recolor-jobs/{jobId}/retry`
- `controller/RecolorScrapController.java` @ `/recolor-scraps`
- `controller/PublicRecolorController.java` @ `/public/recolor-jobs/{jobId}`
- `service/RecolorJobService.java` — 잡 생성/조회/재시도
- `service/RecolorAsyncWorker.java` — 비동기 워커
- `service/RecolorJobTimeoutScheduler.java` — 타임아웃 감시 스케줄러
- `service/RecolorPlannerClient.java`, `service/PlannerValidator.java` — 외부 LLM(플래너) 호출
- `service/RecolorPaintMatcher.java` — Delta-E 트라이어드 매칭 (아래 별도 절 참조)
- `service/PaintCatalogService.java`, `service/RecolorScrapService.java`

#### aicoaching (`aicoaching/`)
- `controller/`, `domain/`, `dto/`, `repository/`
- `service/AiCoachingService.java` — 요청 생성/조회/공개토글/추이
- `service/AiCoachingAsyncWorker.java` — 비동기 실행
- `service/AiCoachingTimeoutScheduler.java`
- `service/OpenAiCoachingClient.java` — 모델 기본값 `gpt-4o` (`OpenAiCoachingClient.java:31`, `@Value("${openai.coaching-model:gpt-4o}")`)

#### aipainting / aiguide
- `aipainting/service/AiPaintingService.java` (Rate limit 대상 `/ai-paintings`)
- `aiguide/service/AiGuideService.java` (Delta-E 사용)

#### notification (`notification/`)
- `service/NotificationService.java`
- `service/PushNotificationSender.java` — Firebase Admin SDK(FCM) 기반
- 연관: `devicetoken/` (FCM 토큰 등록), `launchnotification/` (출시 알림)

#### badge (`badge/`)
- `service/BadgeService.java` — 뱃지 조회/대표 설정
- `service/BadgeAwardService.java` — 수여 로직
- `service/BadgeProgressCalculator.java` — 조건 진행률 계산
- `service/BestWorkScheduler.java` — 인기작 집계 스케줄러
- `service/BadgeDataInitializer.java` — 정의 시드
- `domain/BadgeDefinition.java`, `UserBadge.java`, `UserBestWorkCount.java`, `UserPopularPostCount.java`, `BestWorkPost.java`
- `controller/BadgeController.java`
- DTO: `NewBadgeResponse`, `UserBadgeResponse`, `PublicBadgeResponse`, `BadgeSummaryResponse`, `FeaturedBadgeRequest`

#### paint 계열
- `paintconversion/` — 동일 색상 타 브랜드 변환 (`PaintConversionService.java`, CIEDE2000 테스트 존재: `src/test/java/.../PaintConversionServiceCiede2000Test.java`)
- `paintmatch/` — `service/PaintMatchService.java` + `dto/PaintMatchResponse.java`
- `userpaint/`, `paintwishlist/`, `paintrequest/`, `palette/`, `categorypreset/`, `barcode/`, `knowledge/`
- `recipe/` — 레시피 도메인

#### 기타 피처
- `miniature/`, `project/`, `progresslog/`, `backlogitem/`, `calendar/`, `home/`, `statistics/`, `ranking/`, `profile/`, `user/`, `block/`, `report/`, `reaction/`, `like/`, `image/` (R2 프리사인), `ota/` (OTA 번들 업데이트), `event/`, `eventbanner/`, `expo/` (행사 캘린더), `appsetting/`, `admin/`, `health/`

### 주목할 패턴 (블로그 글감 후보 — 실제 좌표)

#### JWT 필터 / Provider

- **필터**: `security/jwt/JwtAuthenticationFilter.java`
  - 쿠키 우선, Authorization Bearer 후순위 추출: `JwtAuthenticationFilter.java:87-101`
  - Claims에 `userId` 포함 여부로 DB 조회 생략(신규)/DB 조회(레거시) 분기: `:55-67` — **JWT claim 캐싱으로 DB round-trip 제거**
- **Provider**: `security/jwt/JwtTokenProvider.java` (jjwt 0.13.0)
- **쿠키 유틸**: `security/jwt/JwtCookieUtil.java`
- **Refresh 토큰**: `security/jwt/RefreshToken.java`, `RefreshTokenRepository.java`, `RefreshTokenService.java`
- **SecurityConfig**: `config/SecurityConfig.java`
  - Stateless 세션: `SecurityConfig.java:58-59`
  - `/auth/nickname`을 `/auth/**`보다 먼저 `authenticated()`로 등록 (순서 트릭): `:77-80`
  - `/health`, `/auth/**`, `/public/**` permitAll, `/admin/**` ROLE_ADMIN: `:79-83`
  - HSTS, frameDeny, referrerPolicy: `:47-55`
  - RateLimitFilter → JwtAuthenticationFilter 순으로 `UsernamePasswordAuthenticationFilter` 앞에 삽입: `:88-91`
  - RateLimitFilter의 서블릿 자동 등록 비활성화 (Security 체인 안에서만 돌도록): `:110-115` — **CORS 헤더 포함 상태로 필터가 동작하게 하는 의도**

#### OAuth 처리 (Apple, Google, Kakao)

- **Google**: ID 토큰 검증은 `google-api-client 2.7.0` (`build.gradle:47`) + `security/oauth/GoogleOAuthService.java`
  - 라우트: `AuthController.java:131` (`/auth/google/login`), `:163` (`/auth/oauth2/callback/google`)
- **Kakao**: `security/oauth/KakaoOAuthService.java` (직접 HTTP 구현)
  - 라우트: `AuthController.java:148`, `:179`
- **Apple**: `security/oauth/AppleOAuthService.java` (직접 구현, JWK 검증 추정)
  - 라우트: `AuthController.java:197`, `:215`

#### Bucket4j + Rate Limiting

- **파일**: `config/RateLimitFilter.java` (147줄 전체가 핵심)
  - 엔드포인트별 정책: `RateLimitFilter.java:36-42`
    - `/auth/login`: 10/분
    - `/auth/register`: 5/분
    - `/ai-paintings`: 10/분
    - `/images/presign`: 30/분
    - `/public/ota/updates`: 3/분
  - POST 전용: `:51-54`
  - Key = `IP + ":" + 경로`: `:63`
  - `ConcurrentHashMap<String, BucketEntry>` 로컬 저장: `:31` — **Redis 공유 버킷 아님. 단일 노드 가정** (글감 포인트: "Redis는 있지만 Bucket4j는 로컬이다")
  - `@Scheduled(fixedRate = 600_000)` 10분마다 오래된 버킷 정리: `:117-126`
  - 429 응답 코드 `E2005`: `:75`
  - 서블릿 자동 등록 off (CORS 헤더 처리 위해 SecurityChain 내부에서만): `config/SecurityConfig.java:110-115`
- **Redis 기반 일일 사용량 제한은 별도**: `common/service/DailyUsageLimiter.java` (AI 코칭/리컬러 등에서 사용)

#### AI 코칭 파이프라인 (멀티스텝)

- **엔트리**: `aicoaching/service/AiCoachingService.java:requestCoaching()` (`:61`)
  1. 소유권 검증 `:63`, 이미지 존재 검증 `:66`
  2. 활성 작업 중복 방어 (PENDING/RUNNING 거부, COMPLETED/FAILED 재시작 허용) `:68-76`
  3. Redis 원자적 INCR 일일 한도 `DailyUsageLimiter.tryConsume()` `:78-82`
  4. DB 최종 체크 (Redis 장애 safety net) + 실패 시 `rollback()` `:85-90`
  5. PENDING 엔티티 저장 `:93-98`
  6. **트랜잭션 커밋 후 비동기 워커 실행 (`TransactionSynchronization.afterCommit`)** `:103-110` — 레이스 컨디션 방지 패턴 (글감 후보: "왜 @Async만 걸면 안 되는가")
- **비동기 워커**: `aicoaching/service/AiCoachingAsyncWorker.java`
- **타임아웃 감시**: `aicoaching/service/AiCoachingTimeoutScheduler.java`
- **LLM 클라이언트**: `aicoaching/service/OpenAiCoachingClient.java`
  - 모델: `@Value("${openai.coaching-model:gpt-4o}")` (`:31`)
- **사용량 조회(Redis→DB fallback)**: `AiCoachingService.java:118-134`
- **추이 분석(JSON 파싱 포함)**: `AiCoachingService.java:177-236`

유사 패턴(리컬러)도 동일 구조: `recolor/service/RecolorJobService.java` → `RecolorAsyncWorker.java` + `RecolorJobTimeoutScheduler.java` + `RecolorPlannerClient.java` + `PlannerValidator.java`.

#### Delta-E / 색상 매칭 알고리즘

- **핵심 유틸**: `common/util/ColorDistanceUtil.java`
  - `deltaE(hex1, hex2)`: `ColorDistanceUtil.java:22-33`
  - `ciede2000(L1,a1,b1,L2,a2,b2)` — Sharma 2005 논문 기준 완전 구현 (`:38-113`)
    - a' 축 보정 및 G 계산: `:40-50`
    - ΔL'/ΔC'/ΔH' 계산: `:60-74`
    - 가중치 SL/SC/SH + T 함수: `:91-100`
    - 파란색 영역 회전 보정 RT (dtheta): `:102-106`
  - `hexToRgb()` `:115-129`, `rgbToLab()` (sRGB→XYZ→LAB, D65) `:131-156`
- **사용처**:
  - `recolor/service/RecolorPaintMatcher.java` — Vision 결과 palette를 shadow/midtone/highlight 트라이어드로 변환
    - RECOLOR 허용 타입: `standard`만 (`RecolorPaintMatcher.java:28`)
    - 글로벌 제외 타입: `medium, varnish, primer, spray` (`:30`)
    - 보유 페인트 우선 임계값 OWNED_PREFER_THRESHOLD = 5.0 (`:32`)
    - 쉐도우/하이라이트 다양성 WIDE_DELTA_E = 25.0 (`:34`)
    - 카탈로그 매칭 최대 50후보 (`:36`)
    - 최소 luminance 차이 0.02 (`:38`)
    - `matchTriad()` + `buildMixRecipes()` 흐름: `:71-78`
  - `paintconversion/service/PaintConversionService.java` — 브랜드 간 근사 매칭 (테스트 존재)
  - `aiguide/service/AiGuideService.java`
  - `paintmatch/service/PaintMatchService.java`
  - `recolor/service/PaintCatalogService.java`

#### 배지 / 알림 이벤트 시스템

- **배지 수여**: `badge/service/BadgeAwardService.java` — 이벤트 기반 수여(이벤트 타입은 코드 확인 필요)
- **진행률**: `badge/service/BadgeProgressCalculator.java`
- **인기작 집계**: `badge/service/BestWorkScheduler.java` (@Scheduled)
- **뱃지 정의 시드**: `badge/service/BadgeDataInitializer.java`
- **푸시**: `notification/service/PushNotificationSender.java` + `config/FirebaseConfig.java` (firebase-admin 9.4.3)
- **프론트 뱃지 체크 트리거**: `services/api/client.ts:245-250` — POST 성공 시 1.5초 후 `window.dispatchEvent(new Event('badge:check'))` 디스패치 (순환 참조 회피용 이벤트 브로커). 제외 URL: `client.ts:13-24`

#### R2 / S3 프리사인 & 이미지 파이프라인

- `config/R2Config.java` — S3Client(R2 호환)
- `image/service/ImageService.java` — 프리사인 URL 발급
- EXIF 회전 보정: `metadata-extractor 2.19.0` (`build.gradle:53`)
- WebP 읽기: `twelvemonkeys.imageio:imageio-webp` (`build.gradle:56`)

---

## 저장소 간 매핑

| 기능 | 프론트 (services/api/*.ts) | 프론트 페이지/훅 | 백엔드 컨트롤러 | 백엔드 서비스 |
|---|---|---|---|---|
| 인증/OAuth | `auth.api.ts` | `pages/Auth/LoginPage.tsx`, `AuthCallbackPage.tsx`, `useAuth.ts` | `auth/controller/AuthController.java` @`/auth` | `auth/service/AuthService.java`, `security/oauth/*OAuthService.java` |
| 토큰 갱신 | `client.ts` (인터셉터) | — | `AuthController.java:301` `/auth/refresh` | `security/jwt/RefreshTokenService.java` |
| 갤러리 | `gallery.api.ts` | `pages/Gallery/*`, `useGallery*.ts` | `gallery/controller/GalleryPostController.java` @`/gallery`, `PublicGalleryController.java` @`/public/gallery` | `gallery/service/GalleryPostService.java`, `GalleryCommentService.java` |
| AI 갤러리 | `aiGallery.api.ts` | `pages/AiGallery/*` | `aigallery/controller/*` | `aigallery/service/AiGalleryPostService.java` |
| 커뮤니티 게시판 | `community.api.ts`, `comment.api.ts` | `pages/Community/*`, `useCommunity*.ts` | `community/controller/*`, `comment/controller/*` | `community/service/*` |
| 리컬러(AI 도색 생성) | `recolor.api.ts`, `aiPainting.api.ts`, `aiGuide.api.ts` | `pages/Recolor/*`, `useRecolor.ts`, `useAiPainting.ts`, `useAiGuide.ts` | `recolor/controller/RecolorJobController.java` @`/recolor-jobs`, `RecolorScrapController.java` @`/recolor-scraps`, `PublicRecolorController.java` @`/public/recolor-jobs` | `RecolorJobService`, `RecolorAsyncWorker`, `RecolorPlannerClient`, `RecolorPaintMatcher` |
| AI 코칭 | `aiCoaching.api.ts` | `useAiCoaching.ts`, `useGalleryAiCoaching.ts`, `useAiCoachingTrend.ts` | `aicoaching/controller/*` | `AiCoachingService`, `AiCoachingAsyncWorker`, `OpenAiCoachingClient`, `AiCoachingTimeoutScheduler` |
| 미니어처/대시보드 | `project.api.ts`, `miniature.api.ts`, `progressLog.api.ts`, `calendar.api.ts`, `sidebar.api.ts`, `backlogItem.api.ts` | `pages/Dashboard/*`, `pages/Detail/*` | `project/`, `miniature/`, `progresslog/`, `calendar/`, `backlogitem/` controllers | 각 `*Service.java` |
| 페인트 차트/변환/매칭 | `userPaint.api.ts`, `paintWishlist.api.ts`, `paintConversion.api.ts`, `paintMatch.api.ts`, `palette.api.ts`, `categoryPreset.api.ts`, `barcode.api.ts` | `pages/MyPaints/*`, `pages/PaintChart/*`, `useUserPaints.ts`, `useBarcodeScan.ts` | `userpaint/`, `paintwishlist/`, `paintconversion/`, `paintmatch/`, `palette/`, `categorypreset/`, `barcode/` | 각 `*Service.java` |
| 레시피 | `recipe.api.ts` | `pages/Recipe/*`, `useRecipes.ts` | `recipe/controller/*` | `recipe/service/*` |
| 랭킹 | `ranking.api.ts` | `pages/Ranking/*`, `useRanking.ts` | `ranking/controller/*` | `ranking/service/*` |
| 알림/푸시 | `notification.api.ts`, `launchNotification.api.ts`, `services/pushNotification.ts` | `pages/Notification/*`, `usePushNotifications.ts`, `useNotifications.ts` | `notification/`, `launchnotification/`, `devicetoken/` | `NotificationService`, `PushNotificationSender` |
| 뱃지 | `badge.api.ts` | `useBadges.ts`, `useBadgeEarnedCheck.ts`, `useSidebarBadges.ts` | `badge/controller/BadgeController.java` | `BadgeService`, `BadgeAwardService`, `BadgeProgressCalculator`, `BestWorkScheduler` |
| 프로필/마이페이지/차단 | `user.api.ts`, `profile.api.ts`, `block.api.ts` | `pages/MyPage/*`, `pages/Profile/*` | `user/`, `profile/`, `block/` | 각 `*Service.java` |
| 행사(엑스포)/이벤트 | `expo.api.ts`, `eventBanner.api.ts`, `eventChallenge.api.ts` | `pages/Event/*`, `useExpo.ts`, `useEventChallenge.ts` | `expo/`, `event/`, `eventbanner/` | 각 `*Service.java` |
| 이미지 업로드(R2 프리사인) | `image.api.ts` | (`pages/ImageGallery/*` 조회용) | `image/controller/*` | `image/service/ImageService.java` |
| 공유/신고 | `share.api.ts`, `report.api.ts` | `pages/Recolor/SharedRecolorPage.tsx` 등 | `recolor/controller/PublicRecolorController.java`, `report/controller/*` | — |
| 관리자 | `admin.api.ts` | `pages/Admin/AdminPage.tsx` | `admin/controller/*` | `admin/service/*` |
| OTA 업데이트 | (Capacitor `@capgo/capacitor-updater`) | `utils/nativeInit.ts` | `public/ota/updates` (Rate limit 대상) | `ota/service/OtaBundleService.java` |
| 홈/통계 | `home.api.ts`, `statistics.api.ts` | `pages/Home/*`, `useHome.ts`, `useDashboardStats.ts` | `home/controller/*`, `statistics/controller/*` | 동명 서비스 |
| 리액션/좋아요 | `like.api.ts`, (reaction은 gallery/comment에 통합) | `useToggleLike.ts` | `like/controller/*`, `reaction/` | 동명 서비스 |
| 앱 설정 | `appSetting.api.ts` | — | `appsetting/controller/*` | `appsetting/service/AppSettingService.java` (AI 코칭 한도 등 키-값 저장) |

---

## 알려지지 않은 영역 (확인 필요)

1. **doc/PROJECT_STRUCTURE.md와의 충돌 여부**: 본 분석에서는 두 저장소의 `doc/*.md` 본문을 직접 열어 비교하지 않았다. 워크스페이스 루트 문서는 요약만 포함하며 피처 목록이 최신 코드에 비해 적게 나열되어 있음은 확인했다.
2. **RefreshToken 저장소 백엔드가 Redis인지 JPA인지**: `RefreshTokenRepository.java` 내부 구현은 본 분석에서 열지 않음. 파일명 자체는 JPA 레포지토리 관례를 따르지만, Redis 조합일 가능성도 있으므로 해당 파일 확인 필요.
3. **멀티탭 토큰 갱신 경합**: 프론트는 BroadcastChannel/storage 이벤트를 쓰지 않는다는 사실은 확인됐다. 그러나 **"150ms 재시도"가 실제로 어떤 시나리오를 커버하는지**는 E2E 시나리오 문서가 없으면 재현 테스트 필요.
4. **Bucket4j는 로컬 메모리 버킷**: `RateLimitFilter.java:31`의 `ConcurrentHashMap` 로컬 저장소로, **다중 인스턴스 배포 시 per-pod 제한**이 된다. `build.gradle`에 `bucket4j-redis`는 없음(확인됨). 프로덕션이 단일 컨테이너인지 다중 노드인지는 `docker-compose.yml` / 인프라 문서 확인 필요.
5. **OpenAiCoachingClient의 실제 호출 프로토콜**: `gpt-4o`가 기본값인 점은 확인했으나, Function Calling / JSON mode / Streaming 여부는 파일 본문 추가 확인 필요 (본 분석에서는 헤더 3줄만 열어봄).
6. **KakaoOAuthService, AppleOAuthService 구현 세부**: 존재는 확인했으나 JWK 검증/nonce 처리 등 내부 로직은 확인하지 않음.
7. **Community HTML sanitize (jsoup)**: `build.gradle:43`에 jsoup 1.18.1이 있으며 `community/util/`에 util 패키지가 있으나 정확한 클래스/정책은 본 분석에서 확인하지 않음.
8. **프론트 Rate Limit(429) 특수 처리**: `client.ts` 내에는 429 전용 분기가 보이지 않는다. 개별 뮤테이션 훅(`useAiPainting.ts` 등)에서 추가 처리하는지는 확인 필요.
9. **프론트 `functions/` (Cloudflare Pages Functions)**: 존재하나 내부 파일은 열지 않음. 서버 측 프록시/edge 로직이 있을 가능성.
10. **Recipe / Knowledge / PaintRequest**: 디렉토리 존재는 확인했으나 컨트롤러 엔드포인트/엔티티는 확인하지 않음.
