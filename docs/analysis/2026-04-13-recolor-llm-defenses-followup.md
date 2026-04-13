# 리컬러 파이프라인 2차 정밀 분석 — 1차 "확인 필요" 항목 검증 (2026-04-13)

> 1차 분석: `2026-04-13-recolor-llm-defenses.md`
> 대상 블로그 포스트: `content/posts/recolor-llm-defenses.mdx` (작성 예정)
> 이 문서는 1차 분석의 "이상 지점"과 "확인 필요" 항목을 재검증한 결과이며, **1차 분석의 해석 중 일부를 정정**한다.

## A. RecolorAsyncWorker.execute 재검증

### A.1 119행 근처 실제 코드 인용

`recolor/service/RecolorAsyncWorker.java:115-121`

```java
// 5. 검증/보정 (palette, hex 유효성만)
plannerJson = plannerValidator.validateAndFix(rawPlannerJson);

// 6. 중간 저장 (planner 결과, recommendations는 아직 없음)
job.markDone(null, plannerJson, null);
recolorJobRepository.saveAndFlush(job);
```

119행의 호출은 확실히 `markDone(null, plannerJson, null)`이다. 별도의 중간 저장 전용 메서드(`updatePlannerJson`, `updateIntermediateState` 등)는 `RecolorJob.java`에 존재하지 않는다. `RecolorJob.java:80-125`에 존재하는 상태 전이 메서드는 `markRunning`, `markDone`, `markFailed`, `resetForRetry`, `markDeleted` 다섯 개뿐.

### A.2 RecolorJob.markDone 메서드 정의

`recolor/domain/RecolorJob.java:87-95`

```java
/**
 * DONE 상태로 전이
 */
public void markDone(String resultImageKey, String plannerJson, String recommendationJson) {
    this.status = RecolorJobStatus.DONE;
    this.resultImageKey = resultImageKey;
    this.plannerJson = plannerJson;
    this.recommendationJson = recommendationJson;
}
```

첫 줄이 `this.status = RecolorJobStatus.DONE;` — 이 메서드를 호출하는 순간 인메모리 엔티티의 status는 DONE으로 바뀐다. 그리고 `RecolorAsyncWorker.java:120`의 `recolorJobRepository.saveAndFlush(job)`가 즉시 DB flush를 강제한다.

### A.3 결론 (단정문)

**이상 지점 1은 "실재하지만 1차 분석의 해석은 부분 정정이 필요하다".**

정확한 사실관계:
1. `RecolorAsyncWorker.execute`는 `@Async @Transactional` (`RecolorAsyncWorker.java:75-77`) — 메서드 전체가 한 트랜잭션.
2. `saveAndFlush`는 Hibernate 세션을 DB에 flush하지만, **트랜잭션 커밋은 메서드가 리턴해야 발생**한다.
3. PostgreSQL의 기본 격리 수준 `READ_COMMITTED`에서는 **다른 세션(폴링 API)이 커밋 전 flush 결과를 볼 수 없다**. 즉 실시간 폴링에 `status=DONE, resultImageUrl=null`이 노출되지는 **않는다**.
4. 그러나 **엔티티 상태 머신 관점의 오용**은 실재한다 — "DONE"이 파이프라인 완료가 아닌 중간 저장 목적으로 호출되고 있다.
5. **크래시/워커 강제 종료 시 DB에 `DONE+result_image_key=NULL`이 커밋될 리스크는 열려있다**. 정상 경로에서는 뒤이은 catch 블록(`RecolorAsyncWorker.java:171-185`)이 `markFailed`로 덮어쓰지만, JVM OOM/SIGKILL 등에는 catch조차 돌지 않는다.

권장 수정: `RecolorJob`에 `updatePlannerIntermediate(plannerJson)` 같은 상태 전이 없는 메서드 추가, 또는 중간 저장 자체 제거.

## B. RecolorPlannerClient system prompt 원문

### B.1 plan() system prompt

위치: `RecolorPlannerClient.java:90-123`, `private String buildSystemPrompt()` 메서드의 텍스트 블록 리터럴. 상수 아님, 치환 포인트 없음.

원문 (`RecolorPlannerClient.java:91~122`):

```
You are a miniature painting color planner AI. Your job is to analyze the user's color request and determine the optimal color palette for any type of miniature (armored, animal, robot, civilian clothing, etc.).

COLOR SELECTION:
- Analyze the user's color request and determine 3-8 distinct colors needed.
- Return each color with a hex value and brief area description.
- Do NOT use fixed categories like primary/secondary/leather/metal/accent.
- Derive colors dynamically from the user's actual request and the miniature's surfaces.

IMPORTANT RULES:
1. All hex values must be valid 6-digit hex codes (e.g., "#FF0000").
2. DO NOT pass IP/franchise/trademark terms to image_prompt_vars. Only preserve color/material intent.
3. If uncertain about a part name interpretation, add it to warnings.
4. Do NOT recommend specific paints. Only provide hex colors and areas. Paint matching is handled separately.

Respond with a JSON object containing these fields:
{
  "normalized_request": "interpreted color request in standard terms",
  "strategy": "single_subject",
  "palette": [
    { "hex": "#RRGGBB", "area": "brief surface description" }
  ],
  "image_prompt_vars": {
    "USER_COLOR_TEXT": "original user request",
    "USER_COLOR_TEXT_SANITIZED": "sanitized request without IP/trademark terms",
    "TARGET_COLOR_HEX": "#RRGGBB",
    "SURFACE_MAPPING_RULES": "brief description of how part names map to surfaces"
  },
  "confidence": 0.85,
  "warnings": []
}
```

호출 설정 (`RecolorPlannerClient.java:61-69`):
- `model` = `@Value("${openai.planner-model:gpt-4o}")` 기본 `gpt-4o`
- `temperature` = `0.3`
- `response_format` = `{"type":"json_object"}`

user prompt (`buildUserPrompt`, `RecolorPlannerClient.java:125-133`):
```
## User Color Request
%s

Analyze the color request and provide a color palette as specified in the system prompt.
```

### B.2 analyzeResultImage() system prompt

위치: `RecolorPlannerClient.java:183-215`, `private String buildVisionSystemPrompt()`. plan() 과 **다른** 텍스트.

원문:

```
You are a miniature painting color analysis AI. Analyze the provided miniature image and extract all distinct colors used on the miniature itself.

ANALYSIS SCOPE:
- Only analyze the MINIATURE figure itself.
- IGNORE background, base/pedestal, desk surface, props, and any non-miniature elements.
- Focus on distinct color regions: armor plates, cloth, leather, skin, metal, gems, etc.

COLOR EXTRACTION:
- Extract 3-10 visually distinct colors from the miniature.
- Each color should have an accurate hex value and a brief area description.
- Group very similar shades as one color (e.g., don't list 5 slightly different reds).

POINT COLOR RECOMMENDATION:
- If the total extracted colors are FEWER THAN 5, recommend 2-3 additional "point" (accent) colors.
- Base recommendations on color theory: complementary colors, analogous accents, or split-complementary schemes.
- Point color area descriptions MUST start with "[포인트 추천]" prefix followed by a suggestion.
  Example: "[포인트 추천] 금색 트림 - 갑옷 장식에 포인트"
- If 5 or more colors are extracted, do NOT add point recommendations.

IMPORTANT RULES:
1. All hex values must be valid 6-digit hex codes (e.g., "#FF0000").
2. Do NOT recommend specific paints. Only provide hex colors and areas. Paint matching is handled separately.

Respond with a JSON object:
{
  "palette": [
    { "hex": "#RRGGBB", "area": "brief surface description or [포인트 추천] suggestion" }
  ]
}
```

호출 설정:
- `model` = `@Value("${openai.vision-model:gpt-4o-mini}")` 기본 `gpt-4o-mini`
- `temperature` = `0.3`
- `response_format` = `{"type":"json_object"}`
- image `detail` = `"low"` (`RecolorPlannerClient.java:156`)

⚠️ 특이점: Vision system prompt 내부에 **`"[포인트 추천]"` 한국어 리터럴이 하드코딩**되어 있다 (`RecolorPlannerClient.java:200-201`). 다른 로케일 사용자(en/ja/zh)에게 어떻게 처리되는지는 확인 필요.

### B.3 sanitize 및 인젝션 방어 정규식 전문

`RecolorPlannerClient.java:230-250`

```java
static String sanitizeUserInput(String input) {
    if (input == null || input.isBlank()) {
        return input;
    }
    // 마크다운 헤더 제거 (## 등으로 프롬프트 섹션 구조 조작 방지)
    String sanitized = MARKDOWN_HEADER_PATTERN.matcher(input).replaceAll("");
    // 프롬프트 인젝션 패턴 필터링
    sanitized = PROMPT_INJECTION_PATTERN.matcher(sanitized).replaceAll("[FILTERED]");
    // 길이 제한
    if (sanitized.length() > MAX_COLOR_REQUEST_LENGTH) {
        sanitized = sanitized.substring(0, MAX_COLOR_REQUEST_LENGTH);
    }
    return sanitized.trim();
}

private static final int MAX_COLOR_REQUEST_LENGTH = 500;
private static final Pattern MARKDOWN_HEADER_PATTERN = Pattern.compile("(?m)^#{1,6}\\s*");
private static final Pattern PROMPT_INJECTION_PATTERN = Pattern.compile(
    "(?i)(ignore|forget|disregard|override|bypass)\\s+(all|every|any|previous|prior|above|preceding)\\s+(instructions?|prompts?|rules?|constraints?|guidelines?)",
    Pattern.CASE_INSENSITIVE
);
```

⚠️ **언어 커버리지 한계**: 정규식이 `ignore/forget/disregard/override/bypass` 등 **영어 동사만** 매칭한다. 한국어 "모든 이전 지시를 무시하고", 일본어/중국어 우회 패턴은 그대로 통과한다.

⚠️ **주석/상수 불일치**: 주석에는 "200자 제한"이라고 쓰인 경우가 있으나 실제 상수는 500. 1차 분석은 500으로 정확히 기록됐다.

## C. 중복 잡 race window 재검증

### C.1 @Table / @Index / UniqueConstraint 확인

`RecolorJob.java:14-18`:

```java
@Entity
@Table(name = "recolor_jobs", indexes = {
        @Index(name = "idx_recolor_jobs_user_id", columnList = "user_id"),
        @Index(name = "idx_recolor_jobs_status", columnList = "status")
})
```

**`uniqueConstraints` 속성 없음. `@Index`에도 `unique = true` 없음.** (기본값 false). "user_id별 PENDING/RUNNING row 최대 1개"를 강제하는 DB 제약은 엔티티 레벨에 없다.

### C.2 DDL / migration 검색 결과

`src/main/resources/sql/` 디렉토리에 25개 DDL 파일이 있지만, **`recolor_jobs` 테이블을 CREATE하거나 제약을 추가하는 파일은 없다**. grep으로 `recolor_jobs` / unique 키워드 매치 없음. → 테이블은 **JPA/Hibernate DDL 자동 생성에 의존**.

확인 필요:
- `application.yml`의 `spring.jpa.hibernate.ddl-auto` 값
- 운영 DB에 수동으로 추가된 유니크 제약 (코드 밖 작업)

### C.3 @Transactional / isolation 설정

`RecolorJobService.java:83` `createJob`:
```java
@Transactional
public RecolorJobCreateResponse createJob(RecolorJobCreateRequest request, Long userId) {
```

`isolation` 지정 없음 → 기본값 → PostgreSQL `READ_COMMITTED`. 직렬화 가능 격리 아님. `RecolorJobRepository`에 `@Lock`, `PESSIMISTIC_WRITE` 등 락 힌트 없음. `existsByUserIdAndStatusIn`은 일반 SELECT.

### C.4 결론 (단정문)

**DB 유니크 제약 없음 + 락 없음 + READ_COMMITTED → race window는 이론상 열려있다.**

시나리오:
- T1, T2 두 요청이 거의 동시에 도착
- 둘 다 `existsByUserIdAndStatusIn` → false
- 둘 다 save 성공 → **PENDING row 2개 생성**
- 둘 다 afterCommit에서 워커 기동 → **2개 파이프라인 병렬 실행**

2차 방어선: 일일 사용량 카운터(`DailyUsageLimiter.tryConsume`, Redis INCR)는 원자적이지만 "하루 총량" 방어일 뿐 "동시 1건" 방어가 아니다. race window를 통과한 두 요청은 둘 다 OpenAI 비용을 발생시킨다 (하루 한도 이내라면).

권장 수정: PostgreSQL **partial unique index** — `CREATE UNIQUE INDEX ON recolor_jobs (user_id) WHERE status IN ('PENDING','RUNNING')`. JPA `@Table(uniqueConstraints=...)`는 DONE/FAILED row가 여러 개 쌓이므로 작동하지 않는다.

## D. PlannerValidator 재확인

### D.1 DEFAULT_PALETTE 실제 값

`PlannerValidator.java:221-227`:

```java
private static final String DEFAULT_PALETTE = """
        [
          { "hex": "#808080", "area": "main body" },
          { "hex": "#1B1B1B", "area": "secondary surfaces" },
          { "hex": "#9E9E9E", "area": "metallic parts" }
        ]
        """;
```

**3개 색, 모두 grayscale**. `#808080` (중간 회색), `#1B1B1B` (거의 검정), `#9E9E9E` (밝은 회색). 폴백이 트리거되면 사용자는 회색 트라이어드를 보게 된다.

### D.2 buildFallbackJson 반환 구조

`PlannerValidator.java:201-219`:

```java
private String buildFallbackJson() {
    return """
            {
              "normalized_request": "unknown",
              "strategy": "single_subject",
              "palette": [
                { "hex": "#808080", "area": "main body" },
                { "hex": "#1B1B1B", "area": "secondary surfaces" },
                { "hex": "#9E9E9E", "area": "metallic parts" }
              ],
              "image_prompt_vars": {
                "USER_COLOR_TEXT": "unknown",
                "TARGET_COLOR_HEX": "#808080"
              },
              "confidence": 0.0,
              "warnings": ["Planner failed, used fallback palette."]
            }
            """;
}
```

폴백 트리거 조건: (a) `root.isObject() == false`, (b) palette가 array도 object도 아닌 경우, (c) `JsonProcessingException` catch.

⚠️ 폴백은 `USER_COLOR_TEXT_SANITIZED` / `SURFACE_MAPPING_RULES` 필드를 **생략**한다. 현재는 `buildImagePrompt`가 이 필드를 참조하지 않아 문제 없지만, 향후 참조하게 되면 NPE 또는 빈 문자열 주입이 발생할 잠재 결함.

### D.3 public 메서드 목록 및 호출처

1. `validateAndFix(String plannerJson)` — 라인 34 — 호출: `RecolorAsyncWorker.java:116`, 자기 자신 `PlannerValidator.java:93` (재귀)
2. `mergeVisionPalette(String originalPlannerJson, String visionAnalysisJson)` — 라인 74 — 호출: `RecolorAsyncWorker.java:134`
3. `extractRecommendations(String plannerJson)` — 라인 104 — 호출: `RecolorAsyncWorker.java:156`
4. `buildImagePrompt(String plannerJson, String userColorRequest)` — 라인 124 — 호출: `RecolorAsyncWorker.java:123`

### D.4 mergeVisionPalette 실제 덮어쓰기 범위

`PlannerValidator.java:74-99`:

```java
public String mergeVisionPalette(String originalPlannerJson, String visionAnalysisJson) {
    try {
        JsonNode original = objectMapper.readTree(originalPlannerJson);
        JsonNode vision = objectMapper.readTree(visionAnalysisJson);

        if (!original.isObject() || !vision.isObject()) {
            log.warn("Vision 병합 실패: JSON 객체가 아님, 원본 유지");
            return originalPlannerJson;
        }

        ObjectNode merged = (ObjectNode) original;

        // Vision 결과에서 palette만 교체
        if (vision.has("palette") && vision.get("palette").isArray() && !vision.get("palette").isEmpty()) {
            merged.set("palette", vision.get("palette"));
        }

        // 병합 후 검증/보정 재실행
        String mergedJson = objectMapper.writeValueAsString(merged);
        return validateAndFix(mergedJson);
```

**`palette` 필드 하나만 덮어쓴다**. `normalized_request`, `strategy`, `image_prompt_vars`, `confidence`, `warnings`는 원본 보존. Vision palette가 **빈 배열이면 덮어쓰지 않음** — 원본 planner palette 유지 (graceful degradation).

### D.5 로깅 여부

`PlannerValidator.java`에 SLF4J `log.warn` / `log.error` 다수 (9개 지점):
- 라인 38, 45, 53 (palette 검증 실패)
- 라인 59 (최종 catch)
- 라인 80, 96 (Vision 병합 실패)
- 라인 116 (recommendations 추출 실패)
- 라인 168 (이미지 프롬프트 실패)
- 라인 183, 195 (항목 제거 / hex 보정)

**별도 메트릭(Prometheus counter 등) 없음** — 순수 로그. "Planner 검증 실패율" 대시보드가 필요하면 로그 수집기에서 문자열 매칭해야 한다.

## E. 프론트엔드 상태 전이 UX

### E.1 useRecolor 폴링 처리

`miniature-backlog-web/src/hooks/useRecolor.ts:56-90`

- 완료 판정: `isComplete: (detail) => detail.status === 'DONE' || detail.status === 'FAILED'` (라인 61)
- 폴링 주기: 3초
- 최대 횟수: `MAX_POLL_COUNT = 60` → 3분 타임아웃
- 연속 에러 허용: 3회

**중요**: `isComplete`는 `status`만 본다. `resultImageUrl` 존재 여부를 체크하지 않는다. 서버가 `{status: 'DONE', resultImageUrl: null}`을 반환하면 폴링이 즉시 종료된다.

### E.2 RecolorPage 상태별 렌더

결과 렌더 분기는 `AiPaintingPage.tsx`가 아니라 `RecolorPage.tsx:294-331`. `useRecolorPage.ts:74-76`의 파생값:

```ts
const isDoneWithResult = !!(job && job.status === 'DONE' && job.originalImageUrl && job.resultImageUrl)
const isProcessing = !!(job && (job.status === 'PENDING' || job.status === 'RUNNING'))
const isFailed = !!(job && job.status === 'FAILED')
```

**핵심 발견 — UI 빈틈**: `status='DONE' && resultImageUrl=null` 교차 상태가 오면:
- `isDoneWithResult` → false
- `isProcessing` → false (status가 PENDING/RUNNING 아님)
- `isFailed` → false

`RecolorPage.tsx:298-331`의 네 렌더 분기 (`!job`, `isProcessing`, `isFailed`, `isDoneWithResult`) 중 **어떤 것도 매치되지 않는다 → 빈 컨테이너**. 폴링은 이미 종료됐으므로 사용자는 **무한히 빈 패널을 본다** (새로고침 외 복구 수단 없음).

A 섹션의 결론대로 정상 경로에서는 이 교차 상태가 관찰되지 않지만, **워커 크래시 후 DB에 DONE+null이 커밋되는 예외 시나리오**에서는 이 UX 결함이 실재한다.

### E.3 match_type / confidence 노출 여부 — dead payload

TypeScript 타입(`recolor.types.ts:57,67`)에 `match_type?: 'direct' | 'mix' | 'catalog'`와 `candidates[].confidence: number` 정의 존재. i18n 리소스에도 `"matchType": {"direct":"내 페인트","mix":"조색 추천","catalog":"카탈로그"}` (ko.json:1380-1384, en/ja/zh 동일) 번역 준비됨.

**그러나 실제 렌더링에는 사용되지 않는다**. `src/pages/Recolor` 전체를 `match_type` / `matchType` / `\.confidence`로 grep한 결과:
- `EmptyResultPanel.tsx:34-60` — 빈 상태 일러스트용 **하드코딩 모킹 데이터** (실제 job과 무관한 데모 상수)
- 타입 정의 파일

`RecolorDetailView.tsx`, `ResultDetailPanel.tsx`에 match_type/confidence 참조 없음 (grep "No matches found"). `t('recolor.matchType...)` 키를 사용하는 코드 없음.

**결론**: 백엔드는 `match_type`과 `confidence`를 전송하고 있고, 프론트 타입/번역도 준비돼 있지만, **결과 상세 UI에 실제로 렌더되는 지점은 없다**. "데이터는 흐르지만 사용자는 보지 못하는" **dead payload** 상태. 백엔드가 준비한 설명가능성(explainability) 메타데이터가 UI로 이어지지 않음.

## 1차 분석 정정/보강 사항

### 정정 (1차가 틀렸거나 과장된 부분)

1. **[A]** "클라이언트 폴링이 중간 `DONE+null` 상태를 관찰한다"는 1차 서술은 **과장**. READ_COMMITTED 격리에서 다른 세션은 커밋 전 flush를 볼 수 없다. 올바른 서술: "정상 경로에서는 관찰되지 않지만, 엔티티 상태 머신이 오용되고 있어 크래시/OOM 시 DB에 `DONE+result_image_key=NULL`이 커밋될 리스크가 열려있다. 게다가 프론트엔드는 이 교차 상태를 처리할 분기가 없어 UI freeze가 발생한다."

2. **[E]** 1차 분석에서 "`match_type`/`confidence`가 UI에 노출될 것으로 추정"했다면 **틀렸다**. 타입/번역은 준비돼 있지만 실제 렌더링 바인딩이 없다. dead payload.

### 보강 (1차에 없었던 새 발견)

3. **[A]** `RecolorJob.java`에 상태 전이 없는 중간 저장 메서드는 **존재하지 않는다**. 권장 수정 — `updatePlannerIntermediate(plannerJson)` 추가.

4. **[B]** `PlannerValidator.buildImagePrompt`는 OpenAI Image Edit API에 전달되는 **별개의 RECOLOR-ONLY 프롬프트**를 만든다 (`PlannerValidator.java:124-176`). `RecolorPlannerClient`의 두 system prompt와는 별도.

5. **[B — 중요]** 프롬프트 인젝션 방어 정규식이 **영어 전용**. 한국어 "모든 이전 지시 무시" 류는 통과한다. 블로그에 언급 시 이 한계를 명시해야 함.

6. **[B]** Vision system prompt 안에 `"[포인트 추천]"` **한국어 리터럴이 하드코딩**되어 있음 (`RecolorPlannerClient.java:200-201`). 다른 로케일 처리는 확인 필요.

7. **[C]** DB 유니크 제약 부재 재확인 — 권장 수정은 **PostgreSQL partial unique index**. JPA `@UniqueConstraint`는 DONE/FAILED row가 쌓이므로 작동하지 않는다.

8. **[D]** `DEFAULT_PALETTE`와 `buildFallbackJson`의 palette가 **완전히 동일한 grayscale 3색**. 폴백이 트리거되면 사용자는 회색 트라이어드를 보게 되고, 이것이 "AI가 색을 못 골랐다"는 암묵적 신호가 된다.

9. **[D]** `buildFallbackJson`이 `USER_COLOR_TEXT_SANITIZED` / `SURFACE_MAPPING_RULES` 필드를 생략 — 현재는 버그 아니지만 잠재 결함.

10. **[D]** `mergeVisionPalette`는 Vision palette가 **빈 배열이면 덮어쓰지 않는다** — 원본 planner 보존. graceful degradation으로 평가할 만함.

11. **[E — 가장 중요한 UI 결함]** `useRecolor.ts`의 폴링 `isComplete` 판정(`status`만)과 `useRecolorPage.ts:74`의 `isDoneWithResult` 판정(`status + resultImageUrl`) 사이의 **기준 불일치**. 교차 상태가 관찰되면 폴링은 종료되고 UI는 어떤 패널도 렌더하지 않아 사용자가 **빈 화면 + 새로고침 외 복구 불가** 상태에 빠진다.

### 여전히 확인 필요

12. `application.yml` / `application-*.yml`의 `spring.jpa.hibernate.ddl-auto` 값. 운영 DB의 실제 `recolor_jobs` 스키마 덤프.
13. `OpenAiImageClient.generatePaintedImage` 내부 — 타임아웃/재시도 로직.
14. `ImageResizeUtil.resizeImage` 내부 — 악성 이미지 방어.
15. `ErrorCode.RECOLOR_*` 정의 위치와 HTTP 상태 매핑.
