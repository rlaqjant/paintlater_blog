# 리컬러 파이프라인 정밀 분석 — AI를 믿지 않기 위한 설계 (2026-04-13)

> 대상 블로그 포스트: `content/posts/recolor-llm-defenses.mdx` (작성 예정)
> 1편 참조: `2026-04-13-delta-e-color-distance.md` (Delta-E 수학적 기반)
> ⚠️ **2차 정정/보강**: `2026-04-13-recolor-llm-defenses-followup.md` — 본 문서의 일부 해석(특히 "이상 지점 1"의 폴링 관찰 부분)과 "확인 필요" 항목들이 2차 분석에서 정정/확정되었다. 블로그 본문 작성 시 반드시 followup 문서를 우선 참조할 것.

## 1. 분석 대상 파일 목록

저장소 루트는 `/Users/burns/Works/projects/miniature-backlog/miniature-backlog-api`. 라인 번호는 본 분석 시점 기준.

**컨트롤러**
- `src/main/java/com/rlaqjant/miniature_backlog_api/recolor/controller/RecolorJobController.java:1-115` — `/recolor-jobs` 7개 엔드포인트 (GET 목록 35-41, GET usage 46-52, POST presign 57-65, POST 생성 70-78, GET 상세 83-90, DELETE 95-102, POST retry 107-114).
- `src/main/java/com/rlaqjant/miniature_backlog_api/recolor/controller/PublicRecolorController.java:1-34` — 공개 게이트 (GET `/public/recolor-jobs/{jobId}`).
- `src/main/java/com/rlaqjant/miniature_backlog_api/recolor/controller/RecolorScrapController.java:1-78` — 스크랩 CRUD (분석 범위 외 — 본 글 핵심 아님).

**오케스트레이션 / 워커**
- `recolor/service/RecolorJobService.java:38-295` — 잡 생성/조회/삭제/재시도/사용량/cleanup. 핵심: `createJob` 82-134, `retryJob` 228-266, `getPublicJobDetail` 174-197.
- `recolor/service/RecolorAsyncWorker.java:39-216` — 비동기 파이프라인 본체. `execute` 75-186.
- `recolor/service/RecolorJobTimeoutScheduler.java:25-59` — 5분 주기 hang 복구 안전망.

**LLM / 검증 / 매칭**
- `recolor/service/RecolorPlannerClient.java:23-251` — OpenAI Chat Completions 호출. `plan` 56-88, `analyzeResultImage` 142-181, `sanitizeUserInput` 230-243, 상수 245-250.
- `recolor/service/PlannerValidator.java:22-228` — JSON 스키마/hex 검증, 폴백, Vision 병합, 이미지 프롬프트 빌드.
- `recolor/service/RecolorPaintMatcher.java:25-361` — Delta-E 트라이어드 매칭. 상수 28-38, `matchTriad` 100-177, `pickBest` 213-227, `buildMixRecipes` 253-298, `hexToLuminance` 340-352.
- `recolor/service/PaintCatalogService.java:25-238` — `allBrands.json` 로딩 (361 페인트 가정 — 실제 수치는 런타임 로그). HSL 36-버킷 샘플링.
- `paintconversion/service/PaintConversionService.java:423-503` — `matchByHex` 오버로드 두 종. RecolorPaintMatcher가 사용하는 시그니처는 438-475 (configurable Delta-E 임계값).

**입력 방어**
- `image/service/ImageService.java:46-533` — Presign 발급 100-133, prefix 화이트리스트 56, ObjectKey 패턴 49-67, 소유권 검증 `validateObjectKeyWithPrefix` 436-454.
- `common/service/DailyUsageLimiter.java:19-91` — Redis INCR 기반 일일 한도. `tryConsume` 27-43, `rollback` 49-60, `getUsedCount` 66-75.
- `config/AsyncConfig.java:19-62` — `ThreadPoolTaskExecutor` (core 4, max 20, queue 100, CallerRunsPolicy).

**도메인 / DTO**
- `recolor/domain/RecolorJob.java:23-126` — 엔티티 + 상태 전이 메서드 `markRunning` 83, `markDone` 90, `markFailed` 100, `resetForRetry` 111, `markDeleted` 123.
- `recolor/domain/RecolorJobStatus.java:6-11` — `PENDING / RUNNING / DONE / FAILED`.
- `recolor/dto/RecolorJobCreateRequest.java:14-22` — `originalImageKey` NotBlank, `colorRequest` NotBlank + Size(max=500).
- `recolor/dto/RecolorJobDetailResponse.java:20-69` — `@JsonRawValue`로 `planner`/`recommendations` JSON 그대로 노출.
- `recolor/repository/RecolorJobRepository.java:22-74` — `markRunningIfPending` 32-34 (조건부 UPDATE), `countValidJobsAfter` 43-45 (FAILED 제외), `findStuckJobs` 49-51, `existsByUserIdAndStatusIn` 56.

**프론트엔드 (보조)**
- `miniature-backlog-web/src/services/api/recolor.api.ts:11-75` — REST 클라이언트.
- `miniature-backlog-web/src/hooks/useRecolor.ts:14-184` — 폴링/제출 훅. 상수 `MAX_POLL_COUNT = 60` (3초×60 = 3분, 10).

## 2. 기술 스택 / 버전

`miniature-backlog-api/build.gradle`에서 직접 확인:

| 항목 | 값 | 라인 |
|---|---|---|
| Spring Boot | 4.0.1 | 3 |
| Java toolchain | 17 | 13 |
| jjwt-api | 0.13.0 | 32 |
| AWS SDK BOM | 2.25.0 (S3) | 49-50 |
| metadata-extractor | 2.19.0 | 53 |
| imageio-webp | 3.12.0 | 56 |
| firebase-admin | 9.4.3 | 59 |
| bucket4j-core | 8.10.1 | 62 |
| spring-boot-starter-data-redis | (BOM) | 65 |

**확인 필요**: build.gradle에 `openai-java` SDK 의존성이 없다. `RecolorPlannerClient`는 `RestClient`로 직접 OpenAI HTTP API를 호출 (`RecolorPlannerClient.java:42-46`). LLM 모델은 `@Value("${openai.planner-model:gpt-4o}")` 기본값 `gpt-4o`, vision은 `gpt-4o-mini`, 이미지는 `gpt-image-1` (`RecolorAsyncWorker.java:55-56`). application.yml 실제 오버라이드 값은 본 분석에서 열지 않음 — 확인 필요.

## 3. 파이프라인 단계 지도 (정상 케이스)

| # | 단계 | 위치 (file:line) | 전이 |
|---|---|---|---|
| 1 | 클라이언트가 presign 요청 | `RecolorJobController.java:57-65` | → `RecolorJobService.presignForUpload` 54-56 → `ImageService.generatePresignedUrl` 103-133 |
| 2 | 클라이언트가 R2에 직접 PUT | (브라우저) | objectKey 보유 |
| 3 | POST `/recolor-jobs` | `RecolorJobController.java:70-78` | → `RecolorJobService.createJob` 82 |
| 4 | 활성 잡 중복 체크 | `RecolorJobService.java:85-88` | PENDING/RUNNING 있으면 거부 |
| 5 | objectKey 검증 (형식+소유권) | `RecolorJobService.java:90` → `ImageService.validateObjectKeyWithPrefix` 436-454 | |
| 6 | 일일 한도 (Redis INCR) | `RecolorJobService.java:93-97` → `DailyUsageLimiter.tryConsume` 27-43 | |
| 7 | DB safety net 한도 | `RecolorJobService.java:100-104` → `RecolorJobRepository.countValidJobsAfter` 43-45 | Redis 장애 백업 |
| 8 | PENDING으로 DB 저장 | `RecolorJobService.java:107-114` | |
| 9 | 오래된 잡 cleanup | `RecolorJobService.java:120` → `cleanupOldJobs` 272-294 | MAX_HISTORY_SIZE=10 |
| 10 | `afterCommit` 디스패치 등록 | `RecolorJobService.java:124-129` | 트랜잭션 커밋 후 비동기 호출 |
| 11 | `RecolorAsyncWorker.execute` (커밋 후) | `RecolorAsyncWorker.java:75-77` | `@Async @Transactional` |
| 12 | PENDING→RUNNING 조건부 UPDATE | `RecolorAsyncWorker.java:81-85` → `RecolorJobRepository.markRunningIfPending` 32-34 | 멱등 |
| 13 | R2 다운로드 | `RecolorAsyncWorker.java:98` → `downloadFromR2` 188-199 | |
| 14 | EXIF + 리사이즈 ≤ 4096 | `RecolorAsyncWorker.java:102-103` (`MAX_IMAGE_DIMENSION` 41) | |
| 15 | 사용자 보유 페인트 조회 | `RecolorAsyncWorker.java:106-110` | Java 측만 사용 (LLM에 미전달) |
| 16 | LLM Planner 호출 | `RecolorAsyncWorker.java:113` → `RecolorPlannerClient.plan` 56-88 | gpt-4o, json_object, temp 0.3 |
| 17 | Planner JSON 검증/보정 | `RecolorAsyncWorker.java:116` → `PlannerValidator.validateAndFix` 34-62 | hex 정규식, 폴백 |
| 18 | 중간 저장 (planner만) | `RecolorAsyncWorker.java:119-120` | `markDone(null, plannerJson, null)` ⚠️ 의미적으로 이상 |
| 19 | 이미지 프롬프트 빌드 | `RecolorAsyncWorker.java:123` → `PlannerValidator.buildImagePrompt` 124-176 | RECOLOR-ONLY 제약 텍스트 |
| 20 | OpenAI Image Edit | `RecolorAsyncWorker.java:126` → `OpenAiImageClient.generatePaintedImage` (열지 않음) | gpt-image-1 |
| 21 | 결과 이미지 원본 크기 복원 | `RecolorAsyncWorker.java:129` | |
| 22 | Vision 분석 (palette 추출) | `RecolorAsyncWorker.java:132-138` → `RecolorPlannerClient.analyzeResultImage` 142-181 | gpt-4o-mini, low detail |
| 23 | Vision palette를 Planner에 병합 | `RecolorAsyncWorker.java:134` → `PlannerValidator.mergeVisionPalette` 74-99 | palette만 교체 후 재검증 |
| 24 | Java Delta-E 매칭 | `RecolorAsyncWorker.java:141-144` → `RecolorPaintMatcher.matchPaintsFromPalette` 51-90 | |
| 25 | recommendations 병합 | `RecolorAsyncWorker.java:147-156` | plannerJson 안에 paints/mix_recipes 주입 |
| 26 | R2 결과 업로드 | `RecolorAsyncWorker.java:159-160` → `uploadToR2` 201-208 | |
| 27 | DONE 전이 + save | `RecolorAsyncWorker.java:163-164` | |
| 28 | 뱃지 트리거 (DONE 이후) | `RecolorAsyncWorker.java:168-169` | |
| 폴 | 클라이언트 폴링 (3초×60) | `useRecolor.ts:56-90` (`usePolling`), `MAX_POLL_COUNT=60` 10 | |
| 안전망 | 5분 주기 timeout 스캐너 | `RecolorJobTimeoutScheduler.java:35-58` | TIMEOUT_MINUTES=10 |

## 4. 각 단계 상세 — "이 단계는 어떤 실패를 막는가"

### 4.1 입력 방어 (프리사인, 업로드, 이미지 검증, 일일 한도)

**①코드**
- presign 발급 시 prefix 화이트리스트 검증: `ImageService.java:56` `ALLOWED_PURPOSES = Set.of("users","gallery","avatars","recolor-jobs",...)`. createJob 단계는 `RECOLOR_PREFIX = "recolor-jobs"` 고정 (`RecolorJobService.java:40`).
- objectKey 정규식: `ImageService.java:62-66` 사전 컴파일 — `^recolor-jobs/\d+/[a-f0-9-]{36}\.(png|jpg|jpeg|gif|webp)$`.
- 소유권 검증: `ImageService.java:436-454` — objectKey의 userId 부분과 인증된 userId 동일성 강제. 불일치 시 `ACCESS_DENIED`.
- DTO 검증: `RecolorJobCreateRequest.java:16-21` — `@NotBlank`, `colorRequest` `@Size(max=500)`.
- 한도: `RecolorJobService.java:93-97` Redis 1차, `100-104` DB 2차.

**②실패 유형**
- 다른 사용자 이미지 키 도용, 경로 traversal 시도, 비-이미지 확장자, 빈 colorRequest, 500자 초과 colorRequest, 일일 한도 초과.

**③방어 방식**
- 정규식으로 형식, 비교로 소유권, JSR-303으로 본문 길이/필수, Redis INCR로 원자적 카운팅 + DB 백업으로 Redis 장애 누수 차단.

> 주의: 이미지 **바이트 단위 검증**(MIME magic number, 픽셀 디코딩, 파일 사이즈 상한)은 presign 단계에 없다. content-type만 정규화되어 R2에 업로드된다. 실제 디코딩은 워커의 `ImageResizeUtil.resizeImage`(`RecolorAsyncWorker.java:102`)가 처음 수행하며, 디코딩 실패 시 예외 → FAILED 전이로 흡수된다 (확인 필요: ImageResizeUtil 내부 안전성).

### 4.2 중복 잡 방어 (PENDING/RUNNING 거부)

**①코드** `RecolorJobService.java:85-88`
```java
if (recolorJobRepository.existsByUserIdAndStatusIn(userId,
        List.of(RecolorJobStatus.PENDING, RecolorJobStatus.RUNNING))) {
    throw new BusinessException(ErrorCode.RECOLOR_ACTIVE_JOB_EXISTS);
}
```
재시도도 동일하게 막는다 (`RecolorJobService.java:238-241`).

**②실패 유형** 사용자가 더블 클릭/탭 전환 후 재요청 → 중복 비용 발생, 폴링 jobId 혼란.

**③방어 방식** 한 사용자당 활성 잡 1개 강제. 단, **이는 race condition에 완전 안전하지 않다**: 두 요청이 거의 동시에 들어오면 둘 다 existsBy 체크를 통과할 수 있다. DB 유니크 제약은 코드에 보이지 않는다 — `RecolorJob.java:15-18`의 인덱스는 user_id, status에 대한 단순 인덱스일 뿐이다. 추가 방어선은 `markRunningIfPending`(아래 4.11)이 워커 진입 시 중복을 흡수.

### 4.3 트랜잭션 경계 분리 (afterCommit 디스패치)

**①코드** `RecolorJobService.java:122-129`
```java
TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
    @Override
    public void afterCommit() {
        recolorAsyncWorker.execute(jobId);
    }
});
```
주석 122행: "비동기 파이프라인은 트랜잭션 커밋 후 실행 (레이스 컨디션 방지)". 동일 패턴이 retry에도 (`RecolorJobService.java:254-261`).

**②실패 유형**
- `@Async`만 쓸 경우, 워커 스레드가 `findById(jobId)`를 호출하는 시점에 부모 트랜잭션이 아직 커밋되지 않아 row가 보이지 않을 수 있다. 또한 부모 트랜잭션이 롤백되면 워커가 유령 잡을 처리한다.
- afterCommit으로 미루면 양쪽 race가 닫힌다.

**③방어 방식** 커밋된 row만 워커가 본다. 부모 트랜잭션 롤백 시 워커는 호출조차 되지 않는다.

> 주석에 "왜 @Async만으로는 안 되는가"가 명시적으로 적혀 있지는 않지만, 122행 주석이 그 의도를 함의한다.

### 4.4 LLM 호출 (프롬프트, 출력 형식 강제, 타임아웃)

**①코드** `RecolorPlannerClient.java:30-47`
- 모델: `${openai.planner-model:gpt-4o}` (기본값) — 30-32.
- 클라이언트: `RestClient` + `SimpleClientHttpRequestFactory`, **connectTimeout 10s, readTimeout 60s** (38-40).
- 호출: `temperature 0.3`, `response_format = {"type":"json_object"}` (61-69) — JSON mode 강제.
- system prompt 91-122: hex 6자리 강제, 카테고리 금지, IP/상표어 차단 명시, "Do NOT recommend specific paints. Paint matching is handled separately." (104).
- user prompt: `sanitizeUserInput` (230-243) 거친 텍스트만 — 마크다운 헤더 제거, "ignore previous instructions" 패턴 [FILTERED] 치환 (247-250), 500자 컷 (245).
- 재시도 로직: **없음** (84-87 catch에서 RuntimeException 전파만).
- 응답 파싱: `choices[0].message.content`만 추출, JSON 검증은 다음 단계에 위임 (78-79).

**②실패 유형**
- LLM이 자유 텍스트 반환 → JSON 파싱 실패. 그러나 OpenAI json_object 모드가 1차 방어.
- 프롬프트 인젝션 ("ignore previous").
- 트레이드마크/IP명 노출.
- 60초 초과 hang.

**③방어 방식**
- 출력 형식: API 레벨 json_object 강제 + Java 레벨 `PlannerValidator` 후처리.
- 인젝션: 정규식 기반 sanitize.
- IP: system prompt에서 명시 + sanitize는 IP 자체는 거르지 않음 (IP 차단은 system prompt + image_prompt_vars 정의에 의존 — 강제력 약함).
- 타임아웃: HTTP read 60s. 재시도 없으므로 60s 초과 시 즉시 RuntimeException → FAILED.

### 4.5 구조 검증 (PlannerValidator) — 핵심 방어선

**①코드** `PlannerValidator.java:34-62`, 178-199.

검증 규칙:
1. 응답이 JSON object인가 (37-40). 아니면 `buildFallbackJson()` 폴백.
2. `palette` 필드 존재 여부 (44-46). 누락이면 `DEFAULT_PALETTE` 주입.
3. palette가 array인 경우 → `validatePaletteArray` 178-187. 각 항목의 `hex`를 정규식 `^#[0-9a-fA-F]{6}$`(24)로 검사. **불통과 항목은 배열에서 제거**(`palette.remove(i)`).
4. palette가 object(구 형식)인 경우 → `validatePaletteHex` 189-198. 잘못된 hex는 `#808080`으로 **자동 보정**.
5. 그 외 형식 (string, number 등)이면 폴백 (52-54).
6. 어떤 예외든 catch → `buildFallbackJson` (58-61).

**무엇이 검증되지 않는가** — 코드에 없는 것은 명시:
- palette 항목 수 (3~8 강제 system prompt에 있지만 Validator는 검사하지 않음).
- `area` 필드 존재 검증 없음 (없으면 RecolorPaintMatcher가 사용하지 않을 뿐 거부 안 함).
- `normalized_request`, `strategy`, `image_prompt_vars`, `confidence`, `warnings` — 검증 안 함.
- 색상 다양성, 휘도 분포 — 검증 안 함 (이는 RecolorPaintMatcher가 흡수).
- 트라이어드 다양성 — Validator 단계에서는 무관 (Vision 후 매칭 시 강제).

**검증 실패 시 예외 타입**: **예외를 던지지 않는다**. 항상 `String`을 반환하며, 실패 시 폴백 JSON으로 대체 → 파이프라인은 계속 진행. 재시도를 트리거하지 않는다.

**②실패 유형** ① hex 6자리가 아닌 hex8/hex3, ② palette가 객체일 때 잘못된 값, ③ 응답이 아예 JSON이 아님, ④ palette 누락.

**③방어 방식** 1·2·3·4 모두 **소거 또는 기본값 주입으로 흡수**. 즉 "검증 실패가 곧 잡 실패"가 아니라, "기본값으로 대체"라는 lenient 정책.

### 4.6 도메인 필터링 (카탈로그 타입 화이트리스트/블랙리스트)

**①코드** `RecolorPaintMatcher.java:28-30`
```java
private static final Set<String> RECOLOR_ALLOWED_TYPES = Set.of("standard");
private static final Set<String> GLOBALLY_EXCLUDED_TYPES = Set.of("medium", "varnish", "primer", "spray");
```
이 두 집합이 `paintConversionService.matchByHex(targetHex, 50, ALLOWED, EXCLUDED, 25.0)` (101-102)로 전달되어 카탈로그 측에서 적용된다 (`PaintConversionService.java:444-453`).

**②실패 유형** LLM이 spray 캔, varnish, primer, medium(혼합 미디엄) 같은 비-도료를 추천하는 환각.

**③방어 방식** **LLM은 페인트를 추천하지 않는다** (system prompt 104, "Paint matching is handled separately"). LLM은 hex만 뱉고, **카탈로그 검색 자체에서 type을 필터링**해 비-도료가 후보에 들어올 가능성을 원천 차단. allow/deny 이중 필터.

### 4.7 수학적 재정렬 (Delta-E 매칭으로 실제 페인트 교체)

**①코드** `RecolorPaintMatcher.matchPaintsFromPalette` 51-90, `matchTriad` 100-177.

흐름:
1. Vision-병합된 palette 배열 순회 (64).
2. 각 hex가 정규식 `^#[0-9a-fA-F]{6}$` 통과해야 함 (66-68) — 통과 못하면 **건너뜀**(continue). Validator가 이미 거른 후 한번 더 강제.
3. `matchByHex(hex, CATALOG_MATCH_MAX=50, RECOLOR_ALLOWED_TYPES, GLOBALLY_EXCLUDED_TYPES, WIDE_DELTA_E=25.0)` (101-102).
4. 결과 없으면 빈 후보 그룹 (108-112).
5. `pickBest`로 anchor 선택 (117) — Delta-E 최소 후보. 단 보유 페인트가 ΔE ≤ 5.0이면 우선 (`pickBest` 213-227).
6. anchor의 luminance 기준 darker/lighter 후보 분리 (122-123, `filterByLuminance` 184-194).
7. 트라이어드 구성 (4.9 참조).

**②실패 유형** LLM이 정확하지 않은 hex를 던지면 카탈로그에 그 hex가 그대로 존재할 일이 거의 없다. 결과적으로 사용자에게 표시되는 "추천 페인트"는 LLM 출력이 아닌 카탈로그 실재 상품이어야 한다.

**③방어 방식** **LLM 출력 hex는 "검색 키"로만 사용되고, 사용자 응답에는 카탈로그 실제 페인트의 hex/name/brand로 교체**된다 (`buildCandidateNode` 232-246). 즉 LLM의 환각이 사용자 화면에 도달할 경로가 차단된다.

### 4.8 혼합 레시피 변환 (단색 실패 폴백)

**①코드** `buildMixRecipes` 253-298.

규칙:
- 사용자 보유 페인트가 0개면 빈 배열 반환 (255).
- midtone candidate를 paintGroup에서 찾음 (258-266).
- 보유 페인트 중 가장 어두운/밝은 것을 luminance 비교로 픽 (269-285).
- **Shadow mix 생성 조건**: `darkestLum < 0.1` (288). 충분히 어두운 보유 페인트가 있을 때만.
- **Highlight mix 생성 조건**: `lightestLum > 0.8` (293).
- 비율은 **하드코딩 0.7 / 0.3** (`buildMixRecipeNode` 318, 330).
- notes는 단순 텍스트 ("Shadow: midtone + paint"), `estimated_error: "low"`도 하드코딩 (335).

**②실패 유형** 카탈로그에서 충분히 어두운/밝은 페인트가 없거나 사용자가 보유하지 못한 경우 트라이어드의 shadow/highlight 슬롯이 약해지는 문제.

**③방어 방식** **사용자가 이미 가지고 있는 페인트로 shadow/highlight를 직접 만들 수 있는 레시피를 추가 생성**해 카탈로그에 의존하지 않는 폴백 경로 제공. 단, 카탈로그 트라이어드를 대체하는 것이 아니라 **추가 정보**(`mix_recipes` 별도 필드)로 노출.

> 비율(0.7:0.3)과 임계값(0.1, 0.8)이 어떻게 도출되었는지에 대한 코드 내 근거는 없다 — "확인 필요" (실험적/경험적 추정 가능성).

### 4.9 트라이어드 다양성 강제 (WIDE_DELTA_E, 최소 luminance 차)

**①코드** `RecolorPaintMatcher.java:34, 38, 122-168, 184-194`.

상수:
- `WIDE_DELTA_E = 25.0` (34) — `matchByHex`에 전달되어 카탈로그 검색 폭을 매우 넓게 잡는다. 이는 "어둡고 가까운 후보 + 밝고 가까운 후보"를 동시에 잡기 위함.
- `MIN_LUMINANCE_DIFF = 0.02` (38) — `filterByLuminance` 188-191에서 anchor 휘도와 후보 휘도가 적어도 0.02 떨어져야 darker/lighter로 인정.
- `CATALOG_MATCH_MAX = 50` (36) — 한 hex당 최대 50개 후보.

트라이어드 시프트 로직 (127-168):
- **양쪽 다 있을 때**(127): anchor=midtone, shadow=가장 가까운 darker, highlight=darker 추가 제외 후 lighter 최선.
- **darker 없음**(137): "anchor를 shadow로 내림" — anchor가 가장 어두운 색이라는 뜻. midtone=lighter 중 최선, highlight=midtone보다 더 밝은 후보.
- **lighter 없음**(153): 대칭으로 anchor를 highlight로 올리고 darker 측에서 midtone/shadow 채움.
- **모든 후보 부족 시**(149-151, 165-167): midtone=anchor, highlight/shadow=anchor (즉 동일 색 3개로 채움 — degenerate 케이스).
- 폴백: `pickFallbackByLuminance` 199-208 — 최소 휘도 차도 만족 못 하는 경우, 단순 정렬 후 가장 어두운/밝은 미사용 후보를 강제로 픽.

**②실패 유형** LLM/Vision이 서로 너무 비슷한 3색을 뱉거나, 카탈로그에 해당 hex 주변 색이 한쪽에만 몰려 있는 경우 → "shadow=midtone=highlight"가 되는 시각적 무용함.

**③방어 방식** ΔE 25라는 매우 넓은 검색 범위 + 휘도 기준 분류 + 시프트 로직(끝 색은 anchor를 끝으로 보내고 같은 방향에서 두 슬롯을 채움) + degenerate fallback. 결과적으로 "트라이어드는 항상 3개 슬롯이 채워짐"을 보장하지만, **모두 같은 색일 가능성도 코드상 존재**(149-151).

`match_type` 결정 (171): midtone의 ΔE < 5.0이면 `"direct"`, 아니면 `"catalog"`. 즉 사용자에게 "정확히 일치 vs 근사"를 알려준다.

### 4.10 보유 페인트 우선 로직 (OWNED_PREFER_THRESHOLD)

**①코드** `RecolorPaintMatcher.java:32, 213-227`.

```java
private static final double OWNED_PREFER_THRESHOLD = 5.0; // 32

private CatalogMatch pickBest(List<CatalogMatch> group, Set<Long> userCatalogPaintIds) {
    if (group == null || group.isEmpty()) return null;
    CatalogMatch best = group.get(0); // ΔE 최소 (이미 정렬됨)
    if (!userCatalogPaintIds.contains(best.paintId())) {
        for (CatalogMatch m : group) {
            if (userCatalogPaintIds.contains(m.paintId()) && m.deltaE() <= OWNED_PREFER_THRESHOLD) {
                return m;
            }
        }
    }
    return best;
}
```

**②실패 유형** 가장 가까운 카탈로그 페인트가 사용자가 보유하지 않은 브랜드일 때, 사용자는 "매번 새 페인트를 사야 함" 경험을 한다.

**③방어 방식** "ΔE 5.0 이내라면 보유 페인트를 우선" — 즉 정확도가 5.0 이내면 사용자 경험(보유 자산 활용) > 수학적 최적. 5.0 초과면 정확도 우선.

> ΔE 5.0의 출처는 코드 내 주석으로만 존재하며, 일반적으로 ΔE 5는 "구분되지만 비슷한" 정도의 지각 차이로 알려져 있다 — 1편 분석 문서에서 별도 검토 가능.

### 4.11 비동기 워커 예외 처리 / 상태 전이

**①코드** `RecolorAsyncWorker.execute` 75-186.

상태 전이:
1. 진입 시 `markRunningIfPending` (81-85) — UPDATE 1 row가 아니면 이미 다른 워커가 처리 중이거나 완료 → return.
2. 정상 흐름이면 13단계까지 진행 후 `markDone(resultImageKey, plannerJson, recommendationJson)` (163).
3. 예외 발생 시 (171-185): `markFailed(errorCode, errorMessage, plannerJson, recommendationJson)` (180), `dailyUsageLimiter.rollback("recolor", userId)` (184).
4. errorCode 분기 (`determineErrorCode` 210-215): plannerJson이 null이면 `RECOLOR_PLANNER_FAILED`, 아니면 `RECOLOR_IMAGE_FAILED` — 즉 LLM 호출 전 실패와 후 실패 구분.
5. 트랜잭션: `@Transactional` (76) — 메서드 전체가 한 트랜잭션. 예외 발생 시 일반적으로 롤백되지만, catch 안에서 `recolorJobRepository.save(job)`을 다시 호출하므로 FAILED 상태가 유지될 수 있다.

> ⚠️ 이상 지점 1: `RecolorAsyncWorker.java:119` — 중간 저장에서 `job.markDone(null, plannerJson, null)`을 호출. **이 시점에는 도색이 안 끝났는데 status가 DONE으로 전이됨**. 이후 8-12 단계가 모두 같은 트랜잭션 안에서 실행되고 `saveAndFlush`가 호출(120)되므로, 만약 이후 OpenAI Image API 호출이 실패하면 catch로 들어가 `markFailed` (180)로 다시 전이된다. 즉 잠깐 DONE 상태가 DB에 보일 가능성. 클라이언트 폴링이 그 사이에 잡히면 "DONE 상태에 result_image_key=null"인 상태를 볼 수 있다 (DTO `RecolorJobDetailResponse.from`은 결과키 null이면 resultImageUrl=null로 응답 — 47-67). **이는 의도된 디자인이라기보다 의도하지 않은 윈도우일 가능성. 확인 필요**.

> ⚠️ 이상 지점 2: `markRunningIfPending`(`RecolorJobRepository.java:32-34`) 후에 `findById`로 다시 로드(`RecolorAsyncWorker.java:87`)하지만, JPA 1차 캐시/`@Transactional` 경계로 이미 영속성 컨텍스트에 있는 row와 native UPDATE의 결과가 불일치할 가능성 — `markRunning` Java 메서드는 호출되지 않으므로 status 필드가 PENDING으로 메모리에 남을 수 있다. 다만 이후 `markDone`/`markFailed`로 덮어쓰기 때문에 실질적 부작용은 없는 것으로 보임.

**②실패 유형**
- 두 워커 동시 실행 (afterCommit 디스패치는 1회지만 timeout scheduler가 hang 잡을 처리할 때 동시성).
- 파이프라인 도중 어느 단계든 예외.
- Vision 분석 실패만 단독으로 (132-138): warn 로그만 남기고 진행 — 잡 실패가 아님.

**③방어 방식**
- `markRunningIfPending` 조건부 UPDATE로 멱등성.
- catch all + 명시적 markFailed + Redis 롤백.
- Vision은 try-catch 내부에서 best-effort.

### 4.12 타임아웃 스케줄러 (hang 복구)

**①코드** `RecolorJobTimeoutScheduler.java:25-58`.

- `@Scheduled(fixedRate = 300_000)` — 5분 주기 (35).
- `TIMEOUT_MINUTES = 10` (27) — `updated_at`이 10분 이상 경과한 PENDING/RUNNING 잡을 hang으로 간주.
- `findStuckJobs(cutoff)` (`RecolorJobRepository.java:49-51`) — `updated_at < cutoff` 조건.
- 처리: `markFailed(RECOLOR_JOB_TIMEOUT.code, ..., plannerJson, recommendationJson)` (46-51), Redis rollback (53), `saveAll` (57).
- 주석 18-21: "HTTP 타임아웃(RestClient)이 주 방어선이며, 이 스케줄러는 서버 재시작 등 예외 상황에 대비한 안전망 역할".

**②실패 유형** 워커 스레드가 죽거나, 서버 재시작 중 비동기 작업이 사라지거나, OpenAI API hang이 read timeout(60s)을 우회하는 경우.

**③방어 방식** 최대 10분 후에는 반드시 FAILED로 전이 + 사용량 환불. 즉 사용자는 영원히 기다리지 않는다 (UI 폴링 한도는 3분 — `useRecolor.ts:10`).

### 4.13 재시도 엔드포인트

**①코드** `RecolorJobController.java:107-114`, `RecolorJobService.java:228-266`.

- 소유권 검증 (230-231).
- 상태가 FAILED가 아니면 거부 (233-235) — `RECOLOR_JOB_NOT_FAILED`.
- 활성 잡 중복 체크 (237-241) — 동일한 4.2 방어.
- **사용량 1회 추가 소모** (243-247) — Redis tryConsume. 주석 243: "재시도도 사용량 1회 소모 (실패 시 비동기 워커에서 롤백)".
- `job.resetForRetry()` (249) → 모든 결과/에러 필드 null화 (`RecolorJob.java:111-118`).
- afterCommit 디스패치 (254-261) — 신규 생성과 동일 패턴.

**②실패 유형** FAILED 잡을 재실행, 재실행 도중 다른 잡과 충돌, 사용량 추적 누락.

**③방어 방식** FAILED만 허용, 활성 중복 차단, 사용량 정상 차감 + 실패 시 워커가 환불 (`RecolorAsyncWorker.java:184`).

### 4.14 공개 게이트 (PublicRecolorController)

**①코드** `PublicRecolorController.java:18-34`, `RecolorJobService.getPublicJobDetail` 174-197.

- 인증 없음 (`/public/recolor-jobs/{jobId}`).
- 삭제된 잡: AI 갤러리 공유 여부에 따라 410 Gone 또는 통과 (179-184).
- DONE이 아니면 404 (187-189).
- presign 대신 `generatePublicUrl(..., "detail")` 사용 (191-194) — Worker/CDN 경로 (`ImageService.java:301-318`).

**②실패 유형** 미완료 잡 노출, 삭제된 사적 잡 노출, presign URL이 외부에 새는 것.

**③방어 방식** 상태 + 삭제 + 갤러리 공유 3중 게이트, presign이 아닌 공개 CDN URL.

## 5. 주요 상수 / 매직넘버 표

| 상수 | 값 | 위치 | 의미 |
|---|---|---|---|
| `RECOLOR_PREFIX` | `"recolor-jobs"` | `RecolorJobService.java:40` | R2 prefix |
| `MAX_HISTORY_SIZE` | `10` | `RecolorJobService.java:41` | 비스크랩 잡 보존 개수 |
| `AI_PAINTING_DAILY_LIMIT` (default) | `5` | `RecolorJobService.java:62, 93, 244` | 일일 한도 (AppSetting로 오버라이드) |
| `MAX_IMAGE_DIMENSION` | `4096` | `RecolorAsyncWorker.java:41` | 리사이즈 상한 |
| connectTimeout | `10s` | `RecolorPlannerClient.java:39` | OpenAI HTTP |
| readTimeout | `60s` | `RecolorPlannerClient.java:40` | OpenAI HTTP |
| `temperature` | `0.3` | `RecolorPlannerClient.java:67, 160` | LLM 결정성 |
| `MAX_COLOR_REQUEST_LENGTH` | `500` | `RecolorPlannerClient.java:245` | 입력 컷 |
| `RECOLOR_ALLOWED_TYPES` | `{"standard"}` | `RecolorPaintMatcher.java:28` | 카탈로그 화이트리스트 |
| `GLOBALLY_EXCLUDED_TYPES` | `{"medium","varnish","primer","spray"}` | `RecolorPaintMatcher.java:30` | 카탈로그 블랙리스트 |
| `OWNED_PREFER_THRESHOLD` | `5.0` | `RecolorPaintMatcher.java:32` | 보유 페인트 우선 ΔE 컷 |
| `WIDE_DELTA_E` | `25.0` | `RecolorPaintMatcher.java:34` | 트라이어드 검색 폭 |
| `CATALOG_MATCH_MAX` | `50` | `RecolorPaintMatcher.java:36` | 후보 풀 크기 |
| `MIN_LUMINANCE_DIFF` | `0.02` | `RecolorPaintMatcher.java:38` | shadow/highlight 분리 한계 |
| Mix shadow 임계 | `darkestLum < 0.1` | `RecolorPaintMatcher.java:288` | 보유 페인트 어두움 |
| Mix highlight 임계 | `lightestLum > 0.8` | `RecolorPaintMatcher.java:293` | 보유 페인트 밝음 |
| Mix 비율 | `0.7 / 0.3` | `RecolorPaintMatcher.java:318, 330` | 하드코딩 |
| confidence 변환 | `1 - ΔE/50` | `RecolorPaintMatcher.java:243` | 0~1 신뢰도 |
| `match_type direct` 컷 | ΔE `< 5.0` | `RecolorPaintMatcher.java:171` | direct vs catalog |
| `TIMEOUT_MINUTES` | `10` | `RecolorJobTimeoutScheduler.java:27` | hang 컷 |
| Scheduler period | `300_000ms` (5분) | `RecolorJobTimeoutScheduler.java:35` | |
| `MAX_POLL_COUNT` (FE) | `60` (3분) | `useRecolor.ts:10` | |
| 폴링 interval (FE) | `3000ms` | `useRecolor.ts:58` | |
| `corePoolSize` | `4` | `AsyncConfig.java:40` | |
| `maxPoolSize` | `20` | `AsyncConfig.java:43` | |
| `queueCapacity` | `100` | `AsyncConfig.java:46` | |
| 종료 대기 | `60s` | `AsyncConfig.java:58` | |

## 6. 실패 케이스별 추적

| 케이스 | 어디서 멈추는가 |
|---|---|
| LLM이 hex가 아닌 문자열 반환 | `PlannerValidator.validateAndFix` 178-187 — 해당 항목이 palette에서 **제거**. palette가 비면 다음 단계로 진행하지만 빈 palette → `RecolorPaintMatcher.matchPaintsFromPalette`가 빈 paints/mix_recipes 반환 (358-360). 잡은 DONE으로 끝나지만 추천이 비어 있다. |
| LLM이 3색 중 2색만 반환 | Validator는 개수 검증 안 함 (4.5). 그대로 통과 → 매칭 단계도 통과 (각 hex 독립 처리). 잡은 정상 DONE. |
| LLM이 hex는 맞는데 너무 유사한 3색 | Validator/매처는 색상 간 다양성 검증 안 함. **단**, 매처는 각 hex별 독립 트라이어드를 만들기 때문에 "팔레트 자체의 다양성"은 손대지 않음. 트라이어드 내부 다양성은 4.9에서 강제. |
| LLM이 varnish 계열 추천 | 그럴 수 없다. LLM은 페인트를 추천하지 않으며 (system prompt 104), 매칭은 type 필터로 varnish 차단 (`RecolorPaintMatcher.java:30`, `PaintConversionService.java:444-453`). |
| LLM 응답 60s 초과 hang | `SimpleClientHttpRequestFactory.readTimeout=60s` → SocketTimeoutException → `plan()` catch → RuntimeException → 워커 catch → `markFailed(RECOLOR_PLANNER_FAILED)` (172-180), Redis 롤백. |
| Image generation API 실패 | 워커 catch → `markFailed(RECOLOR_IMAGE_FAILED)` (`determineErrorCode` 210-215, `plannerJson != null`이므로). plannerJson은 보존됨 (180). |
| Vision API 실패 | 단독 try-catch (132-138). warn 로그만 남기고 기존 planner palette 유지. 잡은 DONE 가능. |
| DB 저장 후 워커가 죽음 | 5분 주기 `RecolorJobTimeoutScheduler`가 10분 후 FAILED 처리 (`RECOLOR_JOB_TIMEOUT`) + Redis 롤백. |
| 사용자가 잡 생성 중 재요청 | `RecolorJobService.java:85-88` `existsByUserIdAndStatusIn` → `RECOLOR_ACTIVE_JOB_EXISTS` 차단. **race window**: 두 요청이 같은 ms에 들어오면 둘 다 통과 가능 — DB 유니크 제약 없음. 다만 워커 진입 시 `markRunningIfPending`이 한 쪽만 처리. 한 쪽은 DB 잡만 남고 워커 미수행 → 10분 후 timeout. **확인 필요**: 응답에 jobId가 둘 모두 발급되어 사용자가 둘 다 폴링하면 한 쪽은 영원한 PENDING(10분 후 FAILED). |
| 사용자가 동일 objectKey로 두 잡 생성 | 다른 사용자의 objectKey면 prefix 검증으로 차단. 자기 자신의 키는 막히지 않음 — 같은 원본 이미지로 잡 두 개 가능. **확인 필요**. |
| Validator 폴백이 트리거되어 `#808080`만 매칭 | 매처는 `#808080`에 대해 정상 동작. 회색 트라이어드가 사용자에게 노출되어 "AI가 색을 못 골랐다"는 신호가 됨. |
| 보유 페인트 0개 + 카탈로그 후보 0개 | matchTriad 108-112 빈 candidates 반환. paintGroup.candidates 빈 배열로 사용자에게 노출. |

## 7. 설계 의도 / 트레이드오프 (코드로 읽히는 범위)

### 7.1 왜 단일 LLM 호출 + 후처리가 아닌 검증자 분리인가
코드상 LLM 응답을 그대로 사용하지 않는 이유는 명백히 **출력 도메인 분리**다. system prompt 104는 "Do NOT recommend specific paints. Paint matching is handled separately"라고 명시한다. 즉 LLM의 책임은 "사용자 색상 의도 → hex 팔레트"로 좁혀지고, "hex → 실제 페인트 SKU"는 결정론적 Java 엔진이 담당한다. 이로 인해:
- LLM이 환각으로 만들어낸 페인트명/브랜드가 사용자에게 도달하지 않는다.
- 페인트 카탈로그가 갱신되어도 LLM 재학습이 불필요하다 (allBrands.json만 교체).
- 사용자 보유 페인트 정보가 LLM 컨텍스트에 들어가지 않는다 → 토큰 비용 절감 + 프롬프트 인젝션 표면 축소.

### 7.2 왜 afterCommit 패턴인가
경합 시나리오:
- @Async 단독 사용 시 워커가 부모 트랜잭션 커밋 전에 `findById`를 호출하면 row not found.
- 부모가 롤백되어도 워커는 이미 호출되어 OpenAI 비용을 소모.
- afterCommit으로 "DB에 확실히 존재하는 잡만" 처리 보장.

코드 122행 주석 "비동기 파이프라인은 트랜잭션 커밋 후 실행 (레이스 컨디션 방지)"이 이 의도를 직접 명시.

### 7.3 왜 Delta-E가 "LLM 출력 후"에 들어가는가
대안은 두 가지: (a) LLM에 카탈로그를 통째로 주고 직접 페인트를 고르게 한다, (b) LLM은 hex만 만들고 Java가 매칭한다. 코드는 (b)를 선택했다. 그 이유로 코드에서 읽히는 단서:
- 카탈로그 크기 (`PaintCatalogService` HSL 36-버킷 샘플링이 존재) → 전체를 LLM에 넣으면 토큰이 폭발한다.
- LLM의 색상 비교는 결정론적이지 않고 hex 6자리 정확성도 보장되지 않는다.
- ΔE는 CIE 표준이라 결과가 재현 가능하다.

### 7.4 lenient 검증의 트레이드오프
PlannerValidator는 검증 실패를 **재시도/거부**가 아니라 **소거/폴백**으로 처리한다. 장점은 사용자가 항상 어떤 결과든 받는다는 것. 단점은 사일런트 품질 저하 — palette가 부분 제거되거나 폴백 회색만 들어가도 잡은 DONE으로 표시된다. UI는 `match_type`(direct/catalog) 또는 `confidence`로 이를 노출할 수 있지만 코드에서는 이 신호가 사용자에게 어떻게 전달되는지 본 분석에선 미확인.

### 7.5 사용량 카운팅의 이중화
Redis INCR이 1차, DB countValidJobsAfter가 2차. Redis 장애 시 DB로 폴백, 실패 시 rollback. 이는 "비싼 OpenAI 호출 비용" 통제가 핵심 비즈니스 제약임을 시사한다 (`RecolorJobService.java:84` 주석 "모든 검증을 Redis 증가 전에 수행 (카운터 누수 방지)").

## 8. 확인 필요 영역

1. `application.yml`의 `openai.planner-model`, `openai.vision-model`, `openai.image-model`, `openai.api-key`, `cloudflare.r2.*`, `app.image.*` 실제 값 — 본 분석에서는 default만 확인.
2. `OpenAiImageClient.generatePaintedImage` 내부 — 이미지 편집 API 호출, 타임아웃, 재시도 로직 (열지 않음).
3. `ImageResizeUtil.resizeImage` 내부 — 잘못된 이미지/악성 페이로드/zip-bomb류 방어 여부 (열지 않음).
4. `PaintConversionService.matchByHex` 외 메서드, 카탈로그 사이즈 (`brandPaintsById` 구성), 전체 페인트 개수 — 본 분석은 시그니처 423-475만 확인.
5. `RecolorAsyncWorker.java:119`의 "중간 markDone(null, ...)"이 의도된 디자인인지, 사용자에게 보이는 윈도우가 실제로 있는지 — 확인 필요.
6. 동일 ms에 두 createJob이 들어왔을 때 DB 유니크 제약/락이 없는 race 가능성 — 운영상 빈도 미상.
7. `confidence`/`match_type`이 프론트엔드 어디에서 어떻게 시각화되는지 — `AiPaintingPage.tsx`/관련 컴포넌트 미열람.
8. Mix 비율 0.7:0.3, 휘도 임계값 0.1/0.8, OWNED_PREFER 5.0, WIDE_DELTA_E 25, MIN_LUMINANCE_DIFF 0.02의 도출 근거 — 코드/주석에 없음. 1편(Delta-E 분석)과 별도 자료 필요.
9. 프롬프트 인젝션 정규식이 한국어 우회 패턴까지 잡는지 — 영어 패턴만 정의 (`RecolorPlannerClient.java:247-250`).
10. ErrorCode.RECOLOR_* 정의 위치와 HTTP 상태 매핑 — 본 분석에서 미확인.

## 9. 블로그 포스트 2편 구조 초안

1. **도입 — AI는 거짓말한다**
   - 문제 정의: LLM은 hex를 잘못 만들고 존재하지 않는 페인트명을 만들어 낸다.
   - PaintLater의 가설: "LLM 출력은 검증되어야 할 입력이지, 답이 아니다."

2. **전체 그림 — Defense in Depth 한 장 그림**
   - 입력 → presign/한도 → DB+afterCommit → 워커 → LLM → Validator → Image API → Vision → Delta-E 매칭 → 응답.
   - 각 단계가 어떤 실패를 흡수하는지 한 줄씩 매핑 (4번 섹션 압축).

3. **단계별 해부 (3개 핵심)**
   - **PlannerValidator**: hex 정규식 + 폴백. lenient의 의도와 트레이드오프.
   - **타입 화이트리스트**: LLM이 페인트를 추천하지 못하게 막은 이유. system prompt + Java 측 이중 차단.
   - **Delta-E 트라이어드**: WIDE_DELTA_E 25, 휘도 분리, 트라이어드 시프트, OWNED_PREFER. "LLM의 hex는 검색 키일 뿐"이라는 핵심 메시지.

4. **트랜잭션과 비동기의 함정**
   - afterCommit 패턴 — `@Async`만 쓰면 발생하는 두 가지 race를 짧게.
   - Timeout scheduler — "주 방어선은 HTTP 타임아웃, 나는 안전망"이라는 코드 주석 인용.

5. **실패 케이스 투어** (6번 표 발췌, 4~6개 케이스)
   - LLM이 잘못된 hex → 항목 제거.
   - LLM이 60초 hang → HTTP timeout → markFailed → Redis 롤백.
   - 워커 자체가 죽음 → 10분 후 scheduler가 정리.
   - Vision 실패는 잡 실패가 아니다 (best-effort).

6. **교훈**
   - "AI를 모듈로 쓸 때, AI의 출력 도메인을 의도적으로 좁혀라."
   - "검증자는 거부하지 않고 흡수할 수도 있다 — 단 그 사일런트 다운그레이드를 사용자에게 신호로 알려야 한다(`match_type`, `confidence`)."
   - "비싼 외부 호출은 트랜잭션 커밋 이후에만 이뤄지도록."
   - "결정론적 후처리 단계가 있는 한, LLM의 환각은 사용자 화면까지 도달하지 못한다."
