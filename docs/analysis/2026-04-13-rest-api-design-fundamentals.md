---
subject: REST API 설계 기초 — 리소스/URL · 상태 코드 · DTO 경계 (PaintLater 백엔드 실전)
post_slug: rest-api-design-fundamentals
post_path: content/posts/rest-api-design-fundamentals.mdx
analyzed_at: 2026-04-13
analyzer: oh-my-claudecode:architect (Opus, READ-ONLY) + oh-my-claudecode:researcher
status: 포스트 반영 완료
---

> → `content/posts/rest-api-design-fundamentals.mdx` 에 반영됨 (2026-04-13)

# REST API 설계 기초 — PaintLater 코드 정밀 분석 + 외부 레퍼런스 디제스트

**분석일**: 2026-04-13
**분석 범위 (한 포스트)**: `miniature` 도메인 컨트롤러 + DTO + 공통 응답/예외/보안 인프라
**외부 레퍼런스 스코프**: RFC 9110 / 9457 / 5789 / 3986 / 8288, Google·Stripe·GitHub API 가이드, Fowler·Fielding, Jakarta Validation, MapStruct

---

## PART A. 코드 정밀 분석 (저장소 내부 근거)

### A.1 분석 대상 경로 (절대 경로)

- 컨트롤러: `/Users/burns/Works/projects/miniature-backlog/miniature-backlog-api/src/main/java/com/rlaqjant/miniature_backlog_api/miniature/controller/{MiniatureController.java, PublicMiniatureController.java, GalleryController.java}`
- 백로그아이템: `.../backlogitem/controller/BacklogItemController.java`, `.../backlogitem/dto/{BacklogItemResponse.java, BacklogItemUpdateRequest.java}`
- 미니어처 DTO: `.../miniature/dto/` (16개 파일)
- 공통 인프라:
  - `.../common/dto/ApiResponse.java`
  - `.../common/exception/{GlobalExceptionHandler.java, ErrorCode.java, BusinessException.java}`
  - `.../config/SecurityConfig.java`
  - `.../config/RateLimitFilter.java`

### A.2 기술 스택 / 버전 (build.gradle 직접 확인)

- Spring Boot `4.0.1` (build.gradle:3)
- Java toolchain `17` (build.gradle:13)
- `spring-boot-starter-web`, `spring-boot-starter-validation` (build.gradle:19, 36)
- `spring-boot-starter-security` (build.gradle:25)
- jjwt `0.13.0` (build.gradle:28-30)
- Bucket4j `8.10.1` (build.gradle:59)

---

### A.3 주제 1 — REST 리소스 & URL 설계

#### A.3.1 엔드포인트 전수 표

**MiniatureController** (base `/miniatures`, `MiniatureController.java:26`)

| Method | Path | 핸들러 | 반환 타입 | 라인 |
|---|---|---|---|---|
| GET | `/miniatures` | `getMyMiniatures` | `ApiResponse<?>` (List 또는 Page) | 50-80 |
| GET | `/miniatures/summary` | `getMiniatureSummary` | `ApiResponse<MiniatureSummaryResponse>` | 87-95 |
| POST | `/miniatures` | `createMiniature` | `ApiResponse<MiniatureDetailResponse>`, 201 | 101-111 |
| GET | `/miniatures/{id}` | `getMiniatureDetail` | `ApiResponse<MiniatureDetailResponse>` | 117-125 |
| PATCH | `/miniatures/{id}` | `updateMiniature` | `ApiResponse<MiniatureDetailResponse>` | 131-140 |
| DELETE | `/miniatures/{id}` | `deleteMiniature` | `ApiResponse<Void>` (200) | 146-153 |
| POST | `/miniatures/{id}/duplicate` | `duplicateMiniature` | `ApiResponse<MiniatureDetailResponse>`, 201 | 159-170 |
| DELETE | `/miniatures/bulk-delete` | `bulkDelete` | `ApiResponse<Void>` | 176-183 |
| PATCH | `/miniatures/bulk-visibility` | `bulkUpdateVisibility` | `ApiResponse<Void>` | 189-197 |
| PATCH | `/miniatures/bulk-current-step` | `bulkUpdateCurrentStep` | `ApiResponse<Void>` | 203-210 |
| PATCH | `/miniatures/bulk-update-category` | `bulkUpdateCategory` | `ApiResponse<BulkUpdateCategoryResponse>` | 216-223 |
| GET | `/miniatures/completed` | `getCompletedMiniatures` | `ApiResponse<List<CompletedMiniatureResponse>>` | 232-239 |
| PATCH | `/miniatures/{id}/current-step` | `updateCurrentStep` | `ApiResponse<MiniatureResponse>` | 245-254 |

**PublicMiniatureController** (base `/public/miniatures`, `PublicMiniatureController.java:24`)

| Method | Path | 핸들러 | 반환 타입 | 라인 |
|---|---|---|---|---|
| GET | `/public/miniatures` | `getPublicMiniatures` | `ApiResponse<PublicMiniaturePageResponse>` | 37-57 |
| GET | `/public/miniatures/{id}` | `getPublicMiniatureDetail` | `ApiResponse<PublicMiniatureDetailResponse>` | 64-74 |
| GET | `/public/miniatures/{id}/progress-logs` | `getPublicProgressLogs` | `ApiResponse<ProgressLogPageResponse>` | 80-89 |

**GalleryController** (base `/public/miniatures`, `GalleryController.java:23`)

| Method | Path | 핸들러 | 반환 타입 | 라인 |
|---|---|---|---|---|
| GET | `/public/miniatures/ranking` | `getMiniatureRanking` | `ApiResponse<List<GalleryRankingResponse>>` | 35-46 |

> `PublicMiniatureController` 와 `GalleryController` 가 동일 base path 를 공유하지만(`/public/miniatures`), 한쪽은 `/{id}`·`/{id}/progress-logs`, 다른 쪽은 `/ranking` 리터럴이라 경로 충돌 없음.

**BacklogItemController** (base `/backlog-items`, `BacklogItemController.java:18`)

| Method | Path | 핸들러 | 반환 타입 | 라인 |
|---|---|---|---|---|
| PATCH | `/backlog-items/{id}` | `updateStatus` | `ApiResponse<BacklogItemResponse>` | 28-37 |

#### A.3.2 명명 규칙 (코드에서 관찰된 것)

- **복수형 명사**: `/miniatures`, `/backlog-items`, `/public/miniatures`, `/miniatures/completed` (`MiniatureController.java:26`, `BacklogItemController.java:18`, `PublicMiniatureController.java:24`)
- **kebab-case**: 두 단어 이상 경로는 전부 하이픈. `/backlog-items`, `/bulk-delete`, `/bulk-visibility`, `/bulk-current-step`, `/bulk-update-category`, `/current-step`, `/progress-logs` (`MiniatureController.java:176, 189, 203, 216, 245`; `PublicMiniatureController.java:80`)
- **경로 변수**: 숫자 ID 하나 (`@PathVariable Long id`, 예: `MiniatureController.java:120`)
- **쿼리 파라미터**: 필터/정렬/페이징 전용. `page`, `size`, `status`, `currentStep`, `sort`, `direction`, `title`, `isPublic`, `category`, `subcategory` (`MiniatureController.java:53-64`), public 측은 `author`, `period`, `completed`, `mine` (`PublicMiniatureController.java:39-50`)
- **불규칙 지점**: 벌크 엔드포인트 이름이 완전히 일관되지 않음. `bulk-delete` / `bulk-visibility` / `bulk-current-step` 은 `bulk-<속성>` 형식인데 `bulk-update-category` 만 `bulk-update-<속성>` 형태 (`MiniatureController.java:176, 189, 203, 216`).

#### A.3.3 public vs 인증 경로 분리 — `SecurityConfig.java:75-86`

`authorizeHttpRequests` 블록이 전체 경로 정책의 단일 소스다.

```
.requestMatchers("/auth/nickname").authenticated()   // 77
.requestMatchers("/health").permitAll()              // 79
.requestMatchers("/auth/**").permitAll()             // 80
.requestMatchers("/public/**").permitAll()           // 81
.requestMatchers("/admin/**").hasRole("ADMIN")       // 83
.anyRequest().authenticated()                         // 85
```

**URL prefix 가 곧 인증 정책이다.** `/public/**` permitAll → `PublicMiniatureController` 의 base 가 `/public/miniatures`. `MiniatureController` 는 `/miniatures` 로 두어 기본 authenticated 경로에 속하게 된다. 동일 엔티티라도 "공개 조회" 와 "내 백로그 CRUD" 를 컨트롤러 단위로 분리한 것이 핵심 설계 결정.

**옵셔널 인증**: `PublicMiniatureController` 는 permitAll 이지만, 토큰이 붙어 있으면 `@AuthenticationPrincipal CustomUserDetails userDetails` 가 주입되어 `userDetails != null ? userDetails.getUserId() : null` 로 로그인 여부를 분기한다 (`PublicMiniatureController.java:51-53, 67-70`). JWT 필터는 통과시키되 permitAll 덕에 익명 거부는 일어나지 않음.

Rate limit 필터와 JWT 필터는 `SecurityConfig.java:89-91` 에서 `UsernamePasswordAuthenticationFilter` 앞에 체인된다.

#### A.3.4 서브 리소스 / 액션 엔드포인트 사례

- **순수 서브 리소스**: `GET /public/miniatures/{id}/progress-logs` (`PublicMiniatureController.java:80`)
- **하위 속성 업데이트**: `PATCH /miniatures/{id}/current-step` (`MiniatureController.java:245`) — `MiniatureStepUpdateRequest.currentStep` 하나만 받는 DTO (`MiniatureStepUpdateRequest.java:14`)
- **액션 엔드포인트 (RPC-ish)**:
  - `POST /miniatures/{id}/duplicate` (`MiniatureController.java:159`) — 201 반환
  - `DELETE /miniatures/bulk-delete` / `PATCH /miniatures/bulk-visibility` / `PATCH /miniatures/bulk-current-step` / `PATCH /miniatures/bulk-update-category` (`MiniatureController.java:176, 189, 203, 216`)
  - `GET /miniatures/completed` (`MiniatureController.java:232`) — `?status=DONE` 쿼리로 대체 가능하지만 갤러리 연결용 특정 유스케이스로 별도 엔드포인트화
  - `GET /public/miniatures/ranking` (`GalleryController.java:35`)

#### A.3.5 코드에서 읽어낸 설계 의도

1. **URL prefix = 인증 정책** (`SecurityConfig.java:81`). 같은 엔티티도 컨트롤러/DTO 를 별도로 둔다 (`MiniatureDetailResponse` vs `PublicMiniatureDetailResponse`).
2. **단건 수정은 PATCH + 부분 업데이트**: `MiniatureUpdateRequest` 가 `descriptionPresent`, `projectIdPresent`, `categoryPresent`, `subcategoryPresent` 플래그를 들고 다닌다 (`MiniatureUpdateRequest.java:29-92`). PUT 은 등장하지 않음.
3. **벌크 작업은 명시적 엔드포인트**. 클라이언트가 "여러 개 동시 처리" 의도를 실수로 숨기지 못하게 함.
4. **하위 호환 로드**: `getMyMiniatures` 는 `page`/`size` 가 모두 null 이면 레거시 `List` 를, 아니면 `MiniaturePageResponse` 를 돌려주는 런타임 분기 (`MiniatureController.java:67-79`). 반환 타입이 `ApiResponse<?>` 인 유일한 이유.

---

### A.4 주제 2 — HTTP 상태 코드 & 에러 응답

#### A.4.1 전역 예외 핸들러 맵핑 — `GlobalExceptionHandler.java`

`@RestControllerAdvice` (파일:22).

| 예외 | HttpStatus | ErrorCode | 라인 |
|---|---|---|---|
| `BusinessException` | `errorCode.getHttpStatus()` (동적) | `e.getErrorCode()` | 28-40 |
| `MethodArgumentNotValidException` | 400 BAD_REQUEST | `INVALID_INPUT_VALUE` | 45-60 |
| `ConstraintViolationException` | 400 BAD_REQUEST | `INVALID_INPUT_VALUE` | 65-80 |
| `MissingServletRequestParameterException` | 400 BAD_REQUEST | `INVALID_INPUT_VALUE` | 85-98 |
| `HttpMessageNotReadableException` | 400 BAD_REQUEST | `INVALID_INPUT_VALUE` | 103-113 |
| `HttpRequestMethodNotSupportedException` | 405 METHOD_NOT_ALLOWED | `METHOD_NOT_ALLOWED` | 118-128 |
| `NoHandlerFoundException` | 404 NOT_FOUND | `RESOURCE_NOT_FOUND` | 133-143 |
| `Exception` (포괄) | 500 INTERNAL_SERVER_ERROR | `INTERNAL_SERVER_ERROR` | 148-158 |

**핵심**: `BusinessException` 만이 ErrorCode 에 미리 선언된 HttpStatus 를 그대로 반환한다 (`GlobalExceptionHandler.java:39`). 새로운 404/403/409 가 필요할 때 핸들러를 수정하는 대신 `ErrorCode` enum 에 항목을 추가하면 된다.

#### A.4.2 에러 응답 바디 — `ApiResponse.java`

`common/dto/ApiResponse.java` 가 유일한 응답 봉투 (파일:16).

필드 (파일:18-22):

```
boolean success
String message
T data
ErrorDetail error
Instant timestamp
```

`ErrorDetail` 내부 구조 (`ApiResponse.java:92-96`):

```
String code
String message
String detail
```

`@JsonInclude(JsonInclude.Include.NON_NULL)` (파일:15, 91) — 성공 응답에는 `error` 누락, 실패 응답에는 `message`/`data` 누락.

**실제 예시 — 미니어처 404**:

```json
{
  "success": false,
  "error": {
    "code": "E4000",
    "message": "미니어처를 찾을 수 없습니다."
  },
  "timestamp": "2026-04-13T12:34:56.789Z"
}
```

**validation 실패 예시** (`GlobalExceptionHandler.java:46-60`):

```json
{
  "success": false,
  "error": {
    "code": "E1001",
    "message": "입력값이 올바르지 않습니다.",
    "detail": "title: 제목은 필수입니다., points: 포인트는 0 이상이어야 합니다."
  },
  "timestamp": "2026-04-13T12:34:56.789Z"
}
```

**RFC 7807/9457 Problem Details 는 따르지 않는다.** `type`/`title`/`status`/`instance` 필드 없음, 대신 `success` 플래그 + 도메인 `code` 문자열을 쓴 자체 포맷.

**중복 지점**: `SecurityConfig.java:64-71` 의 `accessDeniedHandler` 는 `ApiResponse` 유틸을 우회하고 JSON 문자열을 손으로 짜 넣는다. 스키마는 동일하지만 소스가 두 곳으로 분산됨.

#### A.4.3 `ErrorCode` enum 발췌 (`common/exception/ErrorCode.java`)

| 접두사 | 범주 | 대표 예시 (라인) |
|---|---|---|
| E1xxx | 공통 | `INTERNAL_SERVER_ERROR` E1000 500 (15), `INVALID_INPUT_VALUE` E1001 400 (16), `METHOD_NOT_ALLOWED` E1002 405 (17), `RESOURCE_NOT_FOUND` E1003 404 (18) |
| E2xxx | 인증/인가 | `UNAUTHORIZED` E2000 401 (21), `ACCESS_DENIED` E2001 403 (22), `INVALID_TOKEN` E2002 401 (23), `EXPIRED_TOKEN` E2003 401 (24), `RATE_LIMIT_EXCEEDED` E2005 429 (26) |
| E3xxx | 사용자 | `USER_NOT_FOUND` E3000 404 (32), `DUPLICATE_EMAIL` E3001 409 (33), `DUPLICATE_NICKNAME` E3006 409 (38) |
| E4xxx | 미니어처 | `MINIATURE_NOT_FOUND` E4000 404 (42), `MINIATURE_ACCESS_DENIED` E4001 403 (43), `MINIATURE_LINKED_TO_GALLERY` E4002 400 (44) |
| E5xxx | 백로그 아이템 | `BACKLOG_ITEM_NOT_FOUND` E5000 404 (47) |
| E6xxx | 진행 로그 | `PROGRESS_LOG_NOT_FOUND` E6000 404 (50), `PROGRESS_LOG_ACCESS_DENIED` E6001 403 (51) |
| E7xxx | 이미지 | `IMAGE_NOT_FOUND` E7000 404 (54), `IMAGE_UPLOAD_FAILED` E7001 500 (55) |
| E9xxx | 프로젝트 | `PROJECT_NOT_FOUND` E9000 404 (61), `PROJECT_ACCESS_DENIED` E9001 403 (62) |

**핵심 설계 원칙**: "1 ErrorCode = (code 문자열, 메시지, HttpStatus) 3-튜플" (`ErrorCode.java:12-14, 193-195`). HttpStatus 가 enum 자체에 박혀 있어 `BusinessException` 만 던지면 핸들러가 자동으로 올바른 상태 코드를 고른다.

**리소스 없음 ≠ 접근 거부**: 같은 도메인 안에서 `_NOT_FOUND` 는 404, `_ACCESS_DENIED` 는 403 으로 일관 분리 (E4000 vs E4001, E9000 vs E9001, E6000 vs E6001).

#### A.4.4 컨트롤러의 성공 상태 코드 반환 방식

세 가지 패턴이 공존:

**GET 200 OK** — `ResponseEntity.ok(...)` (`MiniatureController.java:124`)
```java
return ResponseEntity.ok(ApiResponse.success(response));
```

**POST 201 Created** — 명시적 `.status(HttpStatus.CREATED)` (`MiniatureController.java:108-110`)
```java
return ResponseEntity
        .status(HttpStatus.CREATED)
        .body(ApiResponse.success("백로그가 생성되었습니다.", response));
```
`@ResponseStatus` 애노테이션은 쓰지 않음.

**DELETE 200 OK — 204 No Content 가 아니다** (`MiniatureController.java:146-153`)
```java
@DeleteMapping("/{id}")
public ResponseEntity<ApiResponse<Void>> deleteMiniature(...) {
    miniatureService.deleteMiniature(id, userDetails.getUserId());
    return ResponseEntity.ok(ApiResponse.success());
}
```

**이유 (추정)**: `ApiResponse<Void>` 봉투 일관성을 우선. 204 는 본문을 못 실으므로 봉투 일관성과 트레이드오프. → **확인 필요**: 코드에 명시적 주석은 없음, 이는 추론.

#### A.4.5 검증 실패 / Rate limit

**검증 실패 경로**: `@Valid @RequestBody MiniatureCreateRequest` (`MiniatureController.java:104`) → Spring 이 `MethodArgumentNotValidException` 투척 → `GlobalExceptionHandler.java:46-60` 이 400 + `E1001` 로 매핑, 각 필드 에러 메시지를 `detail` 에 `"field: message, field2: message2"` 로 이어붙임 (파일:47-49). `@Validated` 의 쿼리 파라미터 실패는 `ConstraintViolationException` 경로 (파일:65-80) 로 같은 형태 응답. 예: `PublicMiniatureController.java:39-41` 의 `@Min(0)`, `@Max(100)`.

**Rate limit** — `RateLimitFilter.java` 는 POST 에만 적용 (파일:51), `findConfig(path)` non-null 경로만 소비. 버킷 고갈 시 (파일:68-78):

```java
response.setStatus(429);
response.setContentType("application/json");
response.getWriter().write(
    "{\"success\":false,\"error\":{\"code\":\"E2005\",\"message\":\"요청이 너무 많습니다. 잠시 후 다시 시도해주세요.\"},\"timestamp\":\"" + timestamp + "\"}"
);
```

적용 경로 (`RateLimitFilter.java:36-42`): `/auth/login`, `/auth/register`, `/ai-paintings`, `/images/presign`, `/public/ota/updates`. **`/miniatures/**` 에는 rate limit 이 걸리지 않는다** — 의도인지 누락인지 코드만으로는 단정 불가 (확인 필요).

---

### A.5 주제 3 — DTO 경계 설계

#### A.5.1 DTO 전수 표

**`miniature/dto/`**

| 이름 | 역할 | 주요 필드 | 검증 |
|---|---|---|---|
| `MiniatureCreateRequest` | Request (POST) | `title`, `description`, `projectId`, `points`, `category`, `subcategory` (파일:19-35) | `@NotBlank`, `@Size(max=200/1000/30/100)`, `@Min(0)` (파일:17-34) |
| `MiniatureUpdateRequest` | Request (PATCH) | 위 + `isPublic`, `thumbnailImageId` | `@Size`, `@Min(0)` + 수동 `*Present` 플래그 4개 (파일:29-92) |
| `MiniatureDuplicateRequest` | Request (POST /duplicate) | `title` | `@NotBlank`, `@Size(max=200)` (파일:16-18) |
| `MiniatureStepUpdateRequest` | Request | `currentStep` | `@NotBlank` (파일:14) |
| `MiniatureBulkDeleteRequest` | Request | `ids: List<Long>` | `@NotEmpty` (파일:17) |
| `MiniatureBulkVisibilityRequest` | Request | `ids`, `isPublic` | `@NotEmpty`, `@NotNull` (파일:18, 21) |
| `MiniatureBulkCurrentStepRequest` | Request | `ids`, `currentStep` | `@NotEmpty`, `@NotBlank` (파일:18, 21) |
| `MiniatureBulkCategoryRequest` | Request | `ids`, `category`, `subcategory` | `@NotEmpty`, `@NotBlank`, `@Size(max=30/100)` (파일:20-28) |
| `MiniatureResponse` | Response (목록용) | id, title, isPublic, progress, currentStep, thumbnails, projectId/name, points, category/subcategory, createdAt, updatedAt (파일:17-32) | — |
| `MiniatureDetailResponse` | Response (단건) | 위 + description, `List<BacklogItemResponse> backlogItems`, `List<LinkedGalleryPost>` (파일:19-34) | — |
| `MiniatureSummaryResponse` | Response (대시보드) | totalCount, totalPoints, statusCounts, pointsByStage, countsByStage, categoryCounts, subcategoryCounts (파일:16-24) | — |
| `MiniaturePageResponse` | Response (페이지 래퍼) | `content: List<MiniatureResponse>` + 페이지 메타 (파일:17-23) | — |
| `PublicMiniatureResponse` | Response (공개 목록) | `MiniatureResponse` + userNickname/Avatar, likeCount, liked, viewCount, commentCount (파일:17-35) | — |
| `PublicMiniatureDetailResponse` | Response (공개 상세) | 위 + description, userRank, userPaintingExperience, backlogItems, linkedGalleryPosts, `isOwner` (파일:20-42) | — |
| `PublicMiniaturePageResponse` | Response (공개 페이지 래퍼) | `content: List<PublicMiniatureResponse>` + 페이지 메타 (파일:17-23) | — |
| `GalleryRankingResponse` | Response (랭킹) | rank, miniatureId, userId, title, thumbnailUrl, userNickname/Avatar, likeCount, commentCount, viewCount (파일:14-23) | — |

**`backlogitem/dto/`**

| 이름 | 역할 | 주요 필드 | 검증 |
|---|---|---|---|
| `BacklogItemResponse` | Response | id, stepName, status, orderIndex, progress (파일:16-20) | — |
| `BacklogItemUpdateRequest` | Request (PATCH) | `status: BacklogItemStatus` | `@NotNull` (파일:16-17) |

추가로 `MiniatureController.java:226` 에 인라인 `record BulkUpdateCategoryResponse(int updated)` — 단일 숫자를 명시적 객체로 감싸기 위한 mini-DTO.

#### A.5.2 명명 규칙

- `*Request` = 요청 본문 DTO
- `*Response` = 응답 DTO
- 역할 수식은 prefix/suffix: `Detail`, `Summary`, `Page`, `Public`, `Bulk*`
- `*Dto` 접미사 **사용 안 함**
- **목록용 vs 상세용 명확 분리**: `MiniatureResponse` 는 description/backlogItems 없음, `MiniatureDetailResponse` 만 포함 (`MiniatureResponse.java:17-32` vs `MiniatureDetailResponse.java:19-34`)

#### A.5.3 엔티티 직접 노출 여부 검증

네 컨트롤러 모든 핸들러 반환 타입 조사:

| 컨트롤러 | 총 핸들러 | 엔티티 직접 반환 |
|---|---|---|
| MiniatureController | 13 | 0 |
| PublicMiniatureController | 3 | 0 |
| GalleryController | 1 | 0 |
| BacklogItemController | 1 | 0 |

JPA `@Entity` 인 `Miniature`, `BacklogItem` 이 컨트롤러 반환 경로에 등장하는 지점 **없음**. 모든 응답은 `*Response` DTO → `ApiResponse<T>` 봉투.

#### A.5.4 엔티티 → DTO 변환 패턴

**정적 팩토리 `of(...)` / `from(...)` 수동 변환**. MapStruct/ModelMapper 미사용.

예시 — `MiniatureDetailResponse.of(...)` (`MiniatureDetailResponse.java:47-73`):

```java
public static MiniatureDetailResponse of(
        Miniature miniature,
        int progress,
        List<BacklogItemResponse> backlogItems,
        String projectName,
        String thumbnailUrl,
        List<LinkedGalleryPost> linkedGalleryPosts
) {
    return MiniatureDetailResponse.builder()
            .id(miniature.getId())
            .title(miniature.getTitle())
            .description(miniature.getDescription())
            .isPublic(miniature.getIsPublic())
            .progress(progress)
            .backlogItems(backlogItems)
            .projectId(miniature.getProjectId())
            .projectName(projectName)
            // ...
            .linkedGalleryPosts(linkedGalleryPosts)
            .build();
}
```

**관찰**:
1. 엔티티에서 "직접 꺼낼 수 있는 값" 만 `miniature.getX()` 로 가져온다.
2. **엔티티가 모르는 계산값** (진행률, projectName, thumbnailUrl, backlogItems, linkedGalleryPosts) 은 **서비스 레이어가 별도 인자로 넘긴다**. DTO 는 JPA 연관 탐색을 하지 않음 — 지연 로딩 직렬화 위험 차단.
3. 같은 패턴이 `MiniatureResponse.of(miniature, progress, currentStep, thumbnailUrl, projectName)` (`MiniatureResponse.java:37-39`), `PublicMiniatureResponse.of(...)` (`PublicMiniatureResponse.java:57-92`), `PublicMiniatureDetailResponse.of(...)` (`PublicMiniatureDetailResponse.java:44-82`), `BacklogItemResponse.from(backlogItem)` (`BacklogItemResponse.java:22-29`) 에 반복.
4. `from()` = 엔티티 1개, `of()` = 복수 인자 — 암묵적 관례.

#### A.5.5 페이지네이션 응답 형태

**Spring Data `Page<>` 직접 노출 안 함.** 커스텀 `*PageResponse` 로 평탄화.

`MiniaturePageResponse.from(Page<MiniatureResponse> page)` (`MiniaturePageResponse.java:25-35`):
```java
return MiniaturePageResponse.builder()
        .content(page.getContent())
        .page(page.getNumber())
        .size(page.getSize())
        .totalElements(page.getTotalElements())
        .totalPages(page.getTotalPages())
        .hasNext(page.hasNext())
        .hasPrevious(page.hasPrevious())
        .build();
```

- 필드: `content`, `page`, `size`, `totalElements`, `totalPages`, `hasNext`, `hasPrevious`
- Spring 내부의 `pageable`, `sort`, `first`, `last`, `empty`, `numberOfElements` 는 노출 안 됨
- 제네릭 `PageResponse<T>` **없음** — 각 응답 타입마다 별도 클래스 (`PublicMiniaturePageResponse.java:25-35` 가 거의 복사본)
- 단순 리스트는 `List<MiniatureResponse>` 를 `ApiResponse` 에 그대로 실어 보냄 (`MiniatureController.java:70`)

#### A.5.6 중첩 DTO 그래프

```
MiniatureDetailResponse                          (MiniatureDetailResponse.java:17)
├── backlogItems: List<BacklogItemResponse>      (파일:24)
├── linkedGalleryPosts: List<LinkedGalleryPost>  (파일:34) → 내부 정적 클래스 (파일:42-45)
└── (기타 스칼라)

PublicMiniatureDetailResponse                    (PublicMiniatureDetailResponse.java:18)
├── backlogItems: List<BacklogItemResponse>      (파일:33)
├── linkedGalleryPosts: List<MiniatureDetailResponse.LinkedGalleryPost>  (파일:39) — 재사용
└── (공개 뷰 전용 필드)
```

**특이점**:
1. `MiniatureDetailResponse.LinkedGalleryPost` 내부 정적 클래스를 `PublicMiniatureDetailResponse` 가 그대로 재사용 — 드문 커플링.
2. `BacklogItemResponse` 는 세 DTO에서 공유되며, `progress` 필드는 "상태 변경 응답" 에서만 채워지는 선택적 필드 (`BacklogItemResponse.java:20`). 동일 DTO 가 문맥에 따라 부분 채움.
3. 중첩 깊이 최대 2 단계. 재귀/순환 없음.

---

### A.6 확인 필요 영역 (1차 분석 시점)

1. **서비스 레이어의 예외 투척 지점** → **A.7 에서 확인 완료**
2. **`JwtAuthenticationEntryPoint` 의 응답 포맷** → **A.7 에서 확인 완료**
3. **다른 도메인 컨트롤러와의 일관성**. 30여 개 컨트롤러가 같은 규약을 따르는지 샘플링 안 함. (포스트 범위 밖 — 유지)
4. **엔티티 자체 구조**. `Miniature`, `BacklogItem` 필드 가시성/연관 설정. (포스트 범위 밖 — 유지)
5. **RateLimitFilter 에 `/miniatures/**` 부재** → **A.7 에서 재평가**
6. **DELETE 가 200 을 반환하는 의도** → 여전히 주석 없음, 추론 유지

---

### A.7 2차 정밀 분석 (후속 보강)

#### A.7.1 서비스 레이어 `BusinessException` 투척 지점 (grep 결과)

미니어처/백로그 도메인에서 `throw new BusinessException(...)` 이 등장하는 모든 위치:

| 파일:라인 | ErrorCode | HTTP | 조건 |
|---|---|---|---|
| `MiniatureService.java:425` | `MINIATURE_NOT_FOUND` (E4000) | 404 | `findById(...).orElseThrow(...)` |
| `MiniatureService.java:430` | `MINIATURE_LINKED_TO_GALLERY` (E4002) | **400** | 비공개 전환 요청 시 갤러리에 연결되어 있으면 거부 |
| `MiniatureService.java:581` | `MINIATURE_ACCESS_DENIED` (E4001) | 403 | `validateOwnership()` — 소유자 ID 불일치 |
| `MiniatureDeletionService.java:270` | `MINIATURE_ACCESS_DENIED` (E4001) | 403 | 삭제 시 소유권 검증 |
| `MiniatureKanbanService.java:131` | `MINIATURE_LINKED_TO_GALLERY` (E4002) | **400** | 벌크 비공개 전환 시 갤러리 연결 검사 |
| `MiniatureKanbanService.java:176` | `MINIATURE_ACCESS_DENIED` (E4001) | 403 | 칸반 조작 시 소유권 검증 |
| `BacklogItemService.java:122` | `MINIATURE_ACCESS_DENIED` (E4001) | 403 | 백로그 아이템 수정 시 **미니어처** 소유권 검증 |

**핵심 관찰**:

1. **`orElseThrow()` + ErrorCode 패턴이 일관**. `MiniatureService.java:424-425` 예시:
   ```java
   Miniature miniature = miniatureRepository.findById(miniatureId)
           .orElseThrow(() -> new BusinessException(ErrorCode.MINIATURE_NOT_FOUND));
   ```
   `findById().orElseThrow()` 가 사실상 표준 관용구. 서비스 레이어가 자체적으로 404 를 결정하지 않고, ErrorCode enum 에 위임.

2. **`validateOwnership()` 메서드가 각 서비스에 복제되어 있다** — `MiniatureService`, `MiniatureDeletionService`, `MiniatureKanbanService` 에 사실상 동일한 private 메서드 (`:577-583`, `:266-272`, `:172-178`). 공통 유틸로 추출되어 있지 않음. 트레이드오프: 복사 코드의 냄새 vs 서비스 단위 독립성.

3. **에러 코드 재사용의 경계 위반**. `BacklogItemService.java:115-124` 의 `validateOwnership(miniatureId, userId)` 는 백로그 아이템 조작 실패인데 `MINIATURE_ACCESS_DENIED` (E4001) 을 던진다. `ErrorCode.java` 에 `BACKLOG_ITEM_ACCESS_DENIED` 는 없다 (`BACKLOG_ITEM_NOT_FOUND` E5000 만 존재, 라인 47). → **도메인 경계를 넘는 에러 코드 재사용**. 포스트에서 "에러 코드 taxonomy 를 키울 때 경계를 어디까지 끊을 것인가" 의 실전 예로 쓸 수 있음.

4. **409 Conflict 가 아닌 400 Bad Request**. `MINIATURE_LINKED_TO_GALLERY` 는 "현재 리소스 상태와 요청이 충돌" 하는 전형적인 409 Conflict 상황이지만 (RFC 9110 §15.5.10), PaintLater 는 400 으로 매핑했다 (`ErrorCode.java:44`). → 포스트에서 "왜 409 가 맞고, 400 도 실무에서는 흔한가" 를 RFC 표준 vs 실무 타협 예시로 다룰 수 있음.

5. **silent skip vs loud throw 혼용**. `MiniatureKanbanService.bulkUpdateVisibility` (`:118-140`) 는 소유하지 않은 ID 를 `.filter(...).toList()` 로 **조용히 제거** (:121-124) 하지만, 갤러리 연결 검사는 예외로 **시끄럽게 거부** (:129-132). 부분 성공과 원자적 실패의 혼합 — 같은 핸들러 안에서 두 가지 실패 스타일이 공존한다. 에러 응답 설계에서 자주 간과되는 지점.

#### A.7.2 `JwtAuthenticationEntryPoint.java` 전문 (`security/handler/JwtAuthenticationEntryPoint.java:23-48`)

```java
@Override
public void commence(HttpServletRequest request,
                     HttpServletResponse response,
                     AuthenticationException authException) throws IOException, ServletException {
    log.debug("인증 실패: {}", authException.getMessage());
    ErrorCode errorCode = ErrorCode.UNAUTHORIZED;

    response.setStatus(errorCode.getHttpStatus().value());          // :34
    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
    response.setCharacterEncoding(StandardCharsets.UTF_8.name());

    String timestamp = Instant.now().toString();
    String jsonResponse = String.format(
            "{\"success\":false,\"error\":{\"code\":\"%s\",\"message\":\"%s\"},\"timestamp\":\"%s\"}",
            errorCode.getCode(),
            errorCode.getMessage(),
            timestamp
    );
    response.getWriter().write(jsonResponse);                       // :46
}
```

**결론**:
- 401 응답 스키마는 `ApiResponse` 와 **필드 레벨에서 일치** (`success`, `error.code`, `error.message`, `timestamp`).
- `errorCode.getHttpStatus().value()` 로 상태 코드를 enum 에서 읽어오는 것은 `BusinessException` 경로와 동일한 규약.
- 그러나 **JSON 본문은 `String.format` 으로 수동 조립**. Jackson `ObjectMapper` 를 쓰지 않음. 이유: Security 필터 체인은 Spring MVC 컨트롤러 컨텍스트 밖이라 `@RestControllerAdvice` 가 잡지 못하기 때문 (컨트롤러에 도달하기 전 필터에서 인증 거부 발생).
- **봉투 생성 코드 중복이 총 3곳**:
  1. `ApiResponse.java` (정식 유틸)
  2. `JwtAuthenticationEntryPoint.java:39-44` (수동 String.format)
  3. `SecurityConfig.java:64-71` (accessDeniedHandler, 수동 조립)
  4. `RateLimitFilter.java:74-76` (수동 문자열 리터럴)
  → 실질적으로 **3 개의 수동 조립 경로**가 봉투 스키마에 대한 암묵적 의존을 가진다. 포스트에서 "전역 핸들러가 못 잡는 레이어(Security 필터, 서블릿 필터)의 에러 응답 일관성" 이라는 실전 문제로 다룰 수 있음.

#### A.7.3 `RateLimitFilter.java` 전문 재평가

1차 분석에서 확인 못 한 부분:
- **`Retry-After` 헤더 없음** (`RateLimitFilter.java:70-76`). 429 응답에 헤더가 붙지 않는다. RFC 9110 §10.2.3 권고와 어긋나며, 클라이언트가 재시도 시점을 추측해야 함.
- **`RateLimit-Limit` / `RateLimit-Remaining` / `RateLimit-Reset` 헤더도 없음** (IETF draft-ietf-httpapi-ratelimit-headers).
- **에러 코드 `E2005` 가 문자열 리터럴로 하드코딩** (파일:75). `ErrorCode.RATE_LIMIT_EXCEEDED.getCode()` 를 쓰지 않는다. enum 을 rename 하면 끊어지는 잠재적 결합.
- **`response.setStatus(429)` 역시 매직 넘버**. `HttpStatus.TOO_MANY_REQUESTS.value()` 가 아님.
- **`/miniatures/**` 부재**: `RATE_LIMITS` Map 에 등록된 경로는 `/auth/login`, `/auth/register`, `/ai-paintings`, `/images/presign`, `/public/ota/updates` 뿐 (`:36-42`). POST 미니어처 생성 엔드포인트는 rate limit 을 받지 않는다. 인증된 사용자만 접근 가능하다는 점을 고려하면 의도된 선택일 가능성이 높으나, 계정 탈취 후 스팸 방지 관점에서는 노출된 공백.
- **POST 만 적용** (`:50-54`). PATCH/DELETE 벌크 엔드포인트는 rate limit 대상 아님.
- **버킷 키 = `IP:path`** (`:63`). 동일 IP 의 서로 다른 사용자가 로그인 버킷을 공유 → NAT/회사 네트워크에서 거짓 양성 가능. 사용자 ID 기반이 아님.
- **10분마다 lazy cleanup** (`:117-126`). 메모리 누수 방지 장치는 존재.

포스트에서 **"실전 rate limiting 의 구멍"** 을 부록으로 다룰 수 있는 구체적 근거.

#### A.7.4 RFC 9110 섹션 번호 교차 검증 (2026-04-13 WebFetch)

PART B 의 RFC 9110 섹션 번호를 RFC Editor (`rfc-editor.org/rfc/rfc9110.html`) 에서 직접 확인. 전부 일치:

| 주제 | 섹션 | 검증 |
|---|---|---|
| Safe Methods | §9.2.1 | ✅ |
| Idempotent Methods | §9.2.2 | ✅ |
| PUT | §9.3.4 | ✅ |
| Location 헤더 | §10.2.2 | ✅ |
| Retry-After 헤더 | §10.2.3 | ✅ |
| 200 OK | §15.3.1 | ✅ |
| 201 Created | §15.3.2 | ✅ |
| 204 No Content | §15.3.5 | ✅ |
| 400 Bad Request | §15.5.1 | ✅ |
| 401 Unauthorized | §15.5.2 | ✅ |
| 403 Forbidden | §15.5.4 | ✅ |
| 404 Not Found | §15.5.5 | ✅ |
| 409 Conflict | §15.5.10 | ✅ |
| 410 Gone | §15.5.11 | ✅ |
| 422 Unprocessable Content | §15.5.21 | ✅ |

PART B 의 상태 코드 섹션은 포스트 본문에서 그대로 인용해도 무방.

#### A.7.5 2차 분석이 추가로 제안하는 포스트 논점

1. **"서비스 레이어가 상태 코드를 모른다"** — `BusinessException(ErrorCode.X)` 만 던지면 HTTP 매핑은 enum 이 책임. 이는 **관심사 분리**의 실제 예. (A.7.1 의 7개 투척 지점이 전부 동일 패턴)
2. **에러 코드 재사용과 도메인 경계** — `BacklogItemService` 가 `MINIATURE_ACCESS_DENIED` 를 빌려 쓰는 사례는 "에러 taxonomy 를 얼마나 세분화할 것인가" 의 실전 트레이드오프.
3. **409 vs 400** — `MINIATURE_LINKED_TO_GALLERY` 는 RFC 기준으로는 409 지만 400. 표준 준수와 실무의 균형.
4. **필터 레이어의 응답 포맷 중복** — `@RestControllerAdvice` 가 못 잡는 지점이 3곳. 수동 JSON 조립의 취약성.
5. **Rate limit 헤더 부재** — `Retry-After` 같은 표준 헤더를 붙이지 않은 구현의 구체적 비용.
6. **silent skip vs loud throw 혼합** (bulkUpdateVisibility) — 같은 핸들러 안에 두 실패 스타일이 공존하는 것은 의도적 설계인가, 누락인가.

---

## PART B. 외부 레퍼런스 디제스트 (포스트 보강용 지식)

> PaintLater 저장소 외부의 표준/가이드 자료. 포스트에서 "왜 이 규약이 옳은가 / 어디에서 어긋나는가" 를 설명할 때 근거로 사용한다.

### B.1 리소스 & URL 설계

#### B.1.1 Richardson Maturity Model
- Level 0: POX 스왐프 (단일 URI/POST, SOAP 등)
- Level 1: 리소스별 URI 분리, 메서드는 여전히 무분별
- Level 2: HTTP 메서드 의미 준수 (GET/POST/PUT/DELETE), 상태 코드도 의미대로. **실무 "REST" 의 대부분이 여기**
- Level 3: HATEOAS — 응답에 다음 액션 링크 포함. Fielding 이 요구한 진정한 REST
- 출처: Martin Fowler, "Richardson Maturity Model" (2010)

#### B.1.2 리소스 명명
- **동사 금지, 명사 사용**: HTTP 메서드가 동사 역할
- **복수형**: Google API Design Guide 권고
- **kebab-case**: URI 대소문자 구분 문제 + 언더스코어 가독성 이슈. Google API Design Guide 권고
- 출처: Google Cloud API Design Guide "Resource Names"; Microsoft REST API Guidelines

#### B.1.3 Path vs Query Parameter (RFC 3986)
- Path (§3.3): 계층적, 특정 리소스 식별
- Query (§3.4): 비계층적, 필터/정렬/페이지네이션

#### B.1.4 중첩 리소스 안티패턴
- 깊이 1~2 는 OK, 3 이상은 부모 컨텍스트 결합 → 재사용성 저하
- 해결: 최상위 분리 + 쿼리 파라미터로 관계 표현

#### B.1.5 Safe & Idempotent (RFC 9110 §9.2.1-9.2.2)
| 메서드 | Safe | Idempotent |
|---|---|---|
| GET / HEAD / OPTIONS | ✓ | ✓ |
| PUT / DELETE | ✗ | ✓ |
| POST / PATCH | ✗ | ✗ |

- POST 재시도 안전성을 위해 Idempotency-Key 패턴 (Stripe 등)

#### B.1.6 PUT vs PATCH
- PUT (RFC 9110 §9.3.4): 전체 교체, idempotent
- PATCH (RFC 5789): 부분 수정, idempotent 여부는 patch 형식에 의존
- JSON Merge Patch (RFC 7396) / JSON Patch (RFC 6902)

#### B.1.7 Action Endpoint (RPC-ish) 허용
- `POST /orders/{id}/cancel` 패턴
- Google API Design Guide 는 "Custom Methods" 로 공식 인정, `:` 구분자 제안 (`POST /orders/{id}:cancel`)
- Stripe 는 `/v1/payment_intents/{id}/cancel` 실제 사용

#### B.1.8 페이지네이션
- **Offset/Limit**: 단순하지만 phantom read, 대용량 OFFSET 성능 저하
- **Cursor 기반**: Facebook/Twitter/Stripe. 강건, 성능 유리
- **Link 헤더 (RFC 8288)**: `rel="next"`. GitHub REST API 방식

#### B.1.9 버전 관리
- URL path (`/v1/`): 명시적, 탐색/캐싱 용이. 업계 표준
- Accept 헤더 (`application/vnd.example.v2+json`): URI 깔끔, 테스트 불편
- 쿼리 파라미터: 단순, 캐싱 복잡
- **Fielding 본인은 URL path 방식 반대** ("REST APIs must be hypertext-driven", 2008) — 실무는 대부분 무시

### B.2 상태 코드 & 에러 응답

#### B.2.1 5 클래스 (RFC 9110 §15)
1xx 정보 / 2xx 성공 / 3xx 리다이렉트 / 4xx 클라이언트 / 5xx 서버

#### B.2.2 자주 혼용되는 코드
- **200 vs 201 vs 204**: 201 은 `Location` 헤더 필수 (RFC 9110 §10.2.2), 204 는 본문 금지
- **400 vs 422**: 400 = 문법 오류, 422 = 의미론적 처리 불가 (비즈니스 규칙)
- **401 vs 403**: 401 = 미인증 (WWW-Authenticate 헤더), 403 = 인증됐으나 권한 없음
- **404 vs 410**: 410 = 영구 삭제 명시
- **409 Conflict**: 중복, 낙관적 잠금, 상태 충돌
- **429 Too Many Requests** (RFC 6585): `Retry-After` 권장

#### B.2.3 RFC 9457 Problem Details (2023, RFC 7807 대체)
- Content-Type: `application/problem+json`
- 필드: `type` (URI), `title`, `status`, `detail`, `instance`
- 확장 필드 자유
- 예: `errors` 배열로 validation 실패 표현

#### B.2.4 Stripe 스타일 에러 계층
- `type` (카테고리) / `code` (구체) / `message` (human)
- 기계 판독 + 사람 판독 분리

#### B.2.5 Rate Limit 헤더
- `Retry-After` (RFC 9110 §10.2.3)
- `RateLimit-Limit` / `RateLimit-Remaining` / `RateLimit-Reset` (IETF 초안)
- GitHub/Stripe/Twitter 는 `X-RateLimit-*` 유사 패턴 사용 중

#### B.2.6 보안 관점 401 vs 403 vs 404
- 리소스 존재 여부 노출 위험
- GitHub 의 비공개 저장소는 권한 없으면 404 반환
- OWASP API Security Top 10 2023 "API3:2023" 참고

### B.3 DTO 경계 설계

#### B.3.1 엔티티 직접 노출 금지
1. Lazy loading → `LazyInitializationException` 또는 N+1
2. 양방향 연관 → 순환 참조 → StackOverflow
3. 내부 필드 노출 (`version`, 감사 필드)
4. API-스키마 결합 → 리팩토링 경직
- 출처: Thorben Janssen, Vlad Mihalcea

#### B.3.2 Request/Response DTO 분리
- `id` 필드 처리, 검증 애노테이션 오염, 계산 필드, 버전별 진화 차이
- 하나의 공유 DTO 는 안티패턴

#### B.3.3 CQRS-lite at the boundary
- Martin Fowler "CQRS" (2011)
- 쓰기 경로와 읽기 경로 DTO 완전 분리
- 읽기 DTO ↔ DB 프로젝션 1:1 → 성능 최적화

#### B.3.4 Jakarta Validation 3.0 (JSR 380)
- `@NotNull` (null 불허, 빈 문자열 OK)
- `@NotBlank` (문자열, 공백도 불허)
- `@NotEmpty` (컬렉션/문자열, 빈 불허)
- `@Size(min, max)`, `@Min`, `@Max`
- `@Email`, `@Pattern`
- `@Valid` (중첩 cascade), `@Validated` (그룹 기반, Spring)
- Spring Boot `spring-boot-starter-validation` → Hibernate Validator

#### B.3.5 Sanitization vs Validation
- 별개 관심사. OWASP Input Validation Cheat Sheet

#### B.3.6 매핑 전략
- **수작업 정적 팩토리**: 컴파일 안전, 보일러플레이트
- **MapStruct**: 어노테이션 프로세서, 컴파일 타임 코드 생성, 리플렉션 無 → 수작업 수준 성능. 업계 표준
- **ModelMapper**: 런타임 리플렉션, 설정 간단하지만 성능/타입 안전성 열세

#### B.3.7 API 진화
- **Additive (비파괴)**: 선택 필드 추가, 새 엔드포인트, 응답에 새 값 추가 (클라이언트는 모르는 필드 무시 — Postel's Law)
- **Breaking**: 필드 이름/타입 변경, 필수 요청 필드 추가, 상태 코드 변경
- Stripe: 파괴적 변경 = 새 버전 (`/v2`) + 최소 1년 기존 버전 지원
- GitHub: Accept 헤더 버전 지정

#### B.3.8 Over-fetching & Sparse Fieldsets
- `GET /products?fields=id,name,price`
- JSON:API 스펙 공식 지원
- GraphQL 이 근본 해결, REST 는 쿼리 파라미터로 완화

#### B.3.9 페이지네이션 Envelope
- **Spring Data `Page<T>` 기본 직렬화**: 내부 `PageImpl` 의 장황한 필드가 그대로 계약이 됨 → 계약-구현 결합. 안티패턴에 가깝다
- **커스텀 envelope**: `data` + `meta` + `links` (JSON:API)
- **Link 헤더 전용**: 본문 단순, 클라이언트 파싱 필요 (GitHub)

### B.4 핵심 인용 출처

- RFC 9110 (HTTP Semantics, 2022)
- RFC 9457 (Problem Details, 2023) ← RFC 7807 (2016) 대체
- RFC 5789 (PATCH), RFC 7396 (JSON Merge Patch), RFC 6902 (JSON Patch)
- RFC 3986 (URI), RFC 8288 (Web Linking), RFC 6585 (추가 상태 코드)
- Google Cloud API Design Guide / Microsoft REST API Guidelines
- Stripe API Reference / Versioning / Errors
- GitHub REST API Docs
- Martin Fowler "Richardson Maturity Model" (2010), "CQRS" (2011)
- Roy Fielding "REST APIs must be hypertext-driven" (2008)
- Jakarta Validation 3.0 / Hibernate Validator
- MapStruct Reference Guide
- JSON:API Specification
- OWASP Input Validation / API Security Top 10 (2023)
- Thorben Janssen / Vlad Mihalcea (JPA 엔티티 직렬화 위험)

> **주의**: 외부 레퍼런스는 researcher agent 의 훈련 데이터 기반으로 작성됨. 포스트 발행 전 RFC 섹션 번호(특히 RFC 9110 §15.x) 를 RFC editor 에서 직접 교차 검증할 것.

---

## PART C. 블로그 포스트 구조 초안

### 기본 정보
- **가제**: "실전 REST API 설계 기초 — 리소스, 상태 코드, DTO 경계를 코드로 배우기"
- **slug**: `rest-api-design-fundamentals`
- **예상 분량**: 3,000~4,000 단어
- **시리즈 후보**: "PaintLater 백엔드 설계 노트" (신규 시리즈, 1편)

### 구성 (문제 → 분석 → 해결 → 교훈)

#### 1. 문제 상황 (Intro)
- Spring Boot 기본값만 써도 REST API 는 동작한다. 그러나 장수하는 API 는 "일관된 URL", "예측 가능한 상태 코드", "안전한 DTO 경계" 라는 세 규약을 요구한다.
- 프레임워크가 자동으로 해주지 않는 세 가지를 PaintLater 백엔드가 어떻게 규약으로 박아넣었는지, 그리고 정석(RFC/업계 표준) 과 일치하는 지점과 타협한 지점을 함께 본다.

#### 2. 주제 1 — 리소스 & URL 설계
2.1 **Richardson Maturity Model** 소개 → PaintLater 는 Level 2 (외부 근거: Fowler)
2.2 **명명 규칙 (복수형 + kebab-case)** 의 근거 (RFC 3986, Google API Guide) → PaintLater 코드 예시 (`/miniatures`, `/backlog-items`, `/bulk-visibility`)
2.3 **Path vs Query 분리** (RFC 3986 §3.3-3.4) → `MiniatureController:53-64` 의 쿼리 파라미터 예시
2.4 **URL prefix 를 인증 경계로 쓴다** (PaintLater 의 고유 결정) → `SecurityConfig.java:75-86` 인용 + `PublicMiniatureController` 가 왜 별도 컨트롤러인지
2.5 **PATCH 부분 업데이트와 `*Present` 플래그** — RFC 7396 JSON Merge Patch 의 "null 로 지움" 시맨틱을 대신하는 저장소만의 해결책
2.6 **Action Endpoint 의 허용 범위** (Google Custom Methods, Stripe `/cancel`) → PaintLater 의 `/duplicate`, `/bulk-*`, `/completed` 해석

#### 3. 주제 2 — 상태 코드 & 에러 응답
3.1 **RFC 9110 의 5 클래스** 간단 복습
3.2 **ErrorCode enum 을 단일 소스로** — `ErrorCode.java` 구조 + `BusinessException` → `GlobalExceptionHandler.java:28-40` 의 `errorCode.getHttpStatus()` 위임
3.3 **자주 혼동되는 코드** — 404 vs 403 구분 (E4000 vs E4001 실제 예), 400 vs 422 (PaintLater 는 400 으로 통일, RFC 에서는 422 도 가능)
3.4 **RFC 9457 Problem Details 와 PaintLater 의 자체 봉투 비교** — `ApiResponse` 스키마가 RFC 7807/9457 를 따르지 않는 이유와 트레이드오프
3.5 **성공 상태 코드 반환 패턴** — POST 201 (Location 헤더 논의), DELETE 에서 204 대신 200 을 선택한 트레이드오프 논의 (RFC 권고 vs 봉투 일관성)
3.6 **검증 실패** — `@Valid` → `MethodArgumentNotValidException` → 400 + E1001 흐름
3.7 **Rate limit** — `RateLimitFilter` 의 429 + `Retry-After` 헤더 부재 (포스트에서 "개선 여지" 로 언급)

#### 4. 주제 3 — DTO 경계 설계
4.1 **엔티티를 절대 노출하지 않는다** — 이유 4가지 (외부 근거: Janssen/Mihalcea) → PaintLater 의 모든 핸들러 반환 타입 전수 검증 결과
4.2 **Request / Response DTO 분리 원칙** — 공유 DTO 안티패턴
4.3 **`of(...)` 정적 팩토리 패턴** — `MiniatureDetailResponse.of(...)` 전문 인용 → "서비스가 계산값을 인자로 넘긴다" 라는 규약이 왜 지연 로딩 사고를 원천 차단하는지
4.4 **MapStruct 를 쓰지 않은 선택의 트레이드오프** — 수작업 팩토리의 장단점
4.5 **목록 vs 상세 DTO 분리** — `MiniatureResponse` vs `MiniatureDetailResponse`, over-fetching 관점 (JSON:API Sparse Fieldsets 언급)
4.6 **페이지네이션 봉투** — Spring Data `Page<T>` 를 노출하지 않고 `*PageResponse` 로 평탄화한 이유

#### 5. 교훈
- "REST Level 3" 같은 형식 준수보다 **팀이 읽기 편한 규약을 코드에 반복 각인**하는 것이 장기적으로 더 중요하다.
- **ErrorCode enum + ApiResponse** 두 파일만 잘 관리하면 프론트·모바일·문서화가 같은 언어를 쓴다 (프론트 분석에서 본 `E2003` → 토큰 만료 분기도 이 규약의 산물).
- **DTO `of()` 에 계산값을 강제로 인자로 받는 제약**이 사실상 린터 역할을 한다.
- 정석과의 타협 지점(DELETE 200, PATCH `*Present` 플래그, `PageResponse` 복붙)에는 **이유를 설명할 수 있느냐** 가 설계 성숙도의 척도다.
- 개선 여지: RFC 9457 Problem Details 로 마이그레이션 시 프론트 어댑터가 필요한 이유, `Retry-After` 헤더 추가, `PageResponse<T>` 제네릭화.

### 포스트 작성 시 인용 규칙
- 코드 인용은 본 분석 문서의 파일:라인에 **있는 것만** 사용
- "확인 필요" 영역 (A.6) 은 포스트에 쓰지 않음 — 필요하면 추가 분석 수행
- 외부 레퍼런스(PART B)는 각주 또는 문단 말미 괄호 인용으로 달기

---

## 부록. 분석 수행 이력
- 2026-04-13 `oh-my-claudecode:architect` (Opus, READ-ONLY): 저장소 정밀 분석 — PART A
- 2026-04-13 `oh-my-claudecode:researcher`: 외부 레퍼런스 디제스트 — PART B
  - WebFetch 권한 거부로 RFC 원문 실시간 확인 불가. 훈련 데이터 기반 작성 → 발행 전 섹션 번호 교차 검증 필요
