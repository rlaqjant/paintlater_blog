# Delta-E & CIEDE2000 정밀 분석 (2026-04-13)

> 대상 블로그 포스트: `content/posts/delta-e-color-distance.mdx` (작성 예정)
> 이 문서는 포스트 1편 전용이며, 리컬러 파이프라인 상세는 `2026-04-13-recolor-llm-defenses.md` (예정) 에서 다룬다.

## 1. 분석 대상 파일 목록 (저장소 루트 기준)

백엔드 (`miniature-backlog-api`):

- `src/main/java/com/rlaqjant/miniature_backlog_api/common/util/ColorDistanceUtil.java` — 전체 (1~157)
- `src/main/java/com/rlaqjant/miniature_backlog_api/paintconversion/service/PaintConversionService.java` — 전체 (1~516), 특히 매칭 진입점 `findConversions` (55~132), Delta-E 임계값 사용처 `findSimilarColors` (186~207), 카탈로그 매칭 API `matchByHex` 3종 (423~503)
- `src/test/java/com/rlaqjant/miniature_backlog_api/paintconversion/service/PaintConversionServiceCiede2000Test.java` — 전체 (1~84)
- `src/main/java/com/rlaqjant/miniature_backlog_api/recolor/service/RecolorPaintMatcher.java` — 상수/호출 지점 (28~38, 71, 75, 100~102, 218~225, 243, 253) ※ 본 분석에서는 호출점만 확인, 트라이어드 로직 상세는 2편
- `src/main/java/com/rlaqjant/miniature_backlog_api/paintmatch/service/PaintMatchService.java` — 호출 지점 (3, 109~131, 153~167, 206~242)
- `src/main/java/com/rlaqjant/miniature_backlog_api/aiguide/service/AiGuideService.java` — 호출 지점 (166, 278~321)
- `src/main/java/com/rlaqjant/miniature_backlog_api/recolor/service/PaintCatalogService.java` — 호출 지점 (12, 158~183)
- `build.gradle` (1~86)

프론트엔드 (`miniature-backlog-web`):

- `src/utils/colorDistance.ts` — 전체 (1~166)

## 2. 기술 스택 / 버전

`miniature-backlog-api/build.gradle` 직접 확인값:

- Java toolchain 17 (`build.gradle:13`)
- Spring Boot 4.0.1 (`build.gradle:3`)
- Spring Dependency Management 1.1.7 (`build.gradle:4`)
- 테스트: `spring-boot-starter-test`, JUnit Jupiter `ParameterizedTest`/`CsvSource` (`PaintConversionServiceCiede2000Test.java:5~7`)

색상 거리와 관련된 외부 의존성은 `build.gradle` 에 없음 — CIEDE2000 은 `ColorDistanceUtil.java` 에서 순수 Java 표준 라이브러리(`Math`) 로 자체 구현되어 있다.

프론트엔드는 본 분석 범위에서 색거리 관련 `package.json` 의존성 확인을 하지 않았다 → "확인 필요".

## 3. CIEDE2000 구현 구조 (`ColorDistanceUtil.java`)

전체 엔트리 시그니처 (`ColorDistanceUtil.java:22~33`):

```java
public static double deltaE(String hex1, String hex2) {
    int[] rgb1 = hexToRgb(hex1);
    int[] rgb2 = hexToRgb(hex2);
    if (rgb1 == null || rgb2 == null) {
        return Double.POSITIVE_INFINITY;
    }
    double[] lab1 = rgbToLab(rgb1[0], rgb1[1], rgb1[2]);
    double[] lab2 = rgbToLab(rgb2[0], rgb2[1], rgb2[2]);
    return ciede2000(lab1[0], lab1[1], lab1[2], lab2[0], lab2[1], lab2[2]);
}
```

파싱 실패시 `POSITIVE_INFINITY` 반환 — 이후 `findSimilarColors` 등의 `de < MAX_DELTA_E_THRESHOLD` 비교에서 자동 탈락된다 (`PaintConversionService.java:190`).

CIEDE2000 본체는 `ColorDistanceUtil.java:38~113`. Sharma 2005 논문의 단계 구분에 대응하도록 소스에 직접 주석이 달려 있다.

### 3.1 Step 1 — G 보정, `C'`, `h'` 계산 (`ColorDistanceUtil.java:40~57`)

```java
double C1 = Math.sqrt(a1 * a1 + b1 * b1);
double C2 = Math.sqrt(a2 * a2 + b2 * b2);
double Cab_mean = (C1 + C2) / 2.0;

double Cab_mean_pow7 = Math.pow(Cab_mean, 7);
double twentyFive_pow7 = Math.pow(25, 7);
double G = 0.5 * (1 - Math.sqrt(Cab_mean_pow7 / (Cab_mean_pow7 + twentyFive_pow7)));

double a1p = a1 * (1 + G);
double a2p = a2 * (1 + G);

double C1p = Math.sqrt(a1p * a1p + b1 * b1);
double C2p = Math.sqrt(a2p * a2p + b2 * b2);

double h1p = Math.toDegrees(Math.atan2(b1, a1p));
if (h1p < 0) h1p += 360;
double h2p = Math.toDegrees(Math.atan2(b2, a2p));
if (h2p < 0) h2p += 360;
```

- `Cab_mean` = 두 색의 CIE76 chroma 평균 (`:42`).
- `G` 는 저채도 영역의 회색 감도 보정 항 (`:46`). `25^7` 상수는 Sharma 수식의 임계 채도(`25`) 를 7승으로 확장한 값이다.
- `a'` 는 `a` 축을 `(1 + G)` 배 하여 회색 주위에서 팽창시킨다 (`:48~49`).
- `h'` 는 `atan2(b, a')` 도 단위. 음수면 `+360` 으로 정규화한다 (`:54~57`).

### 3.2 Step 2 — ΔL', ΔC', ΔH' 계산 (`ColorDistanceUtil.java:60~74`)

```java
double dLp = L2 - L1;
double dCp = C2p - C1p;

double dhp;
if (C1p * C2p == 0) {
    dhp = 0;
} else if (Math.abs(h2p - h1p) <= 180) {
    dhp = h2p - h1p;
} else if (h2p - h1p > 180) {
    dhp = h2p - h1p - 360;
} else {
    dhp = h2p - h1p + 360;
}

double dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(Math.toRadians(dhp / 2));
```

- `dhp` 는 hue 차이를 `(-180, 180]` 구간으로 래핑 (`:66~72`). `C1p * C2p == 0` (회색) 케이스 보호 (`:64`).
- `dHp` 는 hue 차이의 "유클리드 선형화" — Sharma 수식 그대로 `2√(C1'C2') · sin(Δh'/2)` (`:74`).

### 3.3 Step 3 — 평균값, T, S_L/S_C/S_H, R_T 계산 (`ColorDistanceUtil.java:77~106`)

```java
double Lp_mean = (L1 + L2) / 2.0;
double Cp_mean = (C1p + C2p) / 2.0;

double hp_mean;
if (C1p * C2p == 0) {
    hp_mean = h1p + h2p;
} else if (Math.abs(h1p - h2p) <= 180) {
    hp_mean = (h1p + h2p) / 2.0;
} else if (h1p + h2p < 360) {
    hp_mean = (h1p + h2p + 360) / 2.0;
} else {
    hp_mean = (h1p + h2p - 360) / 2.0;
}

double T = 1
        - 0.17 * Math.cos(Math.toRadians(hp_mean - 30))
        + 0.24 * Math.cos(Math.toRadians(2 * hp_mean))
        + 0.32 * Math.cos(Math.toRadians(3 * hp_mean + 6))
        - 0.20 * Math.cos(Math.toRadians(4 * hp_mean - 63));

double Lp_mean_50sq = Math.pow(Lp_mean - 50, 2);
double SL = 1 + (0.015 * Lp_mean_50sq) / Math.sqrt(20 + Lp_mean_50sq);
double SC = 1 + 0.045 * Cp_mean;
double SH = 1 + 0.015 * Cp_mean * T;

// 색조 회전 보정 (파란색 영역)
double Cp_mean_pow7 = Math.pow(Cp_mean, 7);
double RC = 2 * Math.sqrt(Cp_mean_pow7 / (Cp_mean_pow7 + twentyFive_pow7));
double dtheta = 30 * Math.exp(-Math.pow((hp_mean - 275) / 25, 2));
double RT = -Math.sin(Math.toRadians(2 * dtheta)) * RC;
```

- `hp_mean` 은 원형 평균. 두 hue 합이 360° 를 넘나드는 경계를 케이스별로 처리한다 (`:81~89`).
- `T` (`:91~95`): hue 의존 가중치. 계수 `0.17, 0.24, 0.32, 0.20` 과 각도 오프셋 `30, 0, 6, -63` 은 Sharma 2005 그대로.
- `SL` (`:97~98`): 밝기 50 에서 가장 작고 양 끝에서 커지는 밝기 가중치.
- `SC = 1 + 0.045·C'mean` (`:99`), `SH = 1 + 0.015·C'mean·T` (`:100`).
- `RC` 는 고채도 보정 스케일(`:103~104`). 여기서도 `25^7` (미리 계산된 `twentyFive_pow7`) 재사용.
- `dtheta = 30 · exp(-((hp_mean - 275)/25)^2)` (`:105`). **275°** 가 "파란색 회전 중심"으로 논문과 동일하다.
- `RT = -sin(2·dtheta) · RC` (`:106`) — 파랑/보라 영역에서 ΔC'와 ΔH' 간 cross-term 회전 보정.

### 3.4 최종 공식 (`ColorDistanceUtil.java:108~112`)

```java
double dL = dLp / SL;
double dC = dCp / SC;
double dH = dHp / SH;

return Math.sqrt(dL * dL + dC * dC + dH * dH + RT * dC * dH);
```

Sharma 2005 의 정식: `ΔE00 = √( (ΔL'/SL)² + (ΔC'/SC)² + (ΔH'/SH)² + R_T·(ΔC'/SC)·(ΔH'/SH) )`. 구현은 kL=kC=kH=1 고정 (클래스 주석 `ColorDistanceUtil.java:36`).

## 4. 색 공간 변환 (sRGB → XYZ → LAB)

`hexToRgb` (`ColorDistanceUtil.java:115~129`): 정규식 `^#?[0-9a-fA-F]{6}$` (`:11`) 로 검증 후 2자리씩 16진수 파싱. 3자리 축약형(`#fff`), 알파 채널(`#rrggbbaa`) 은 지원하지 않는다. 예외 시 `null` 반환 → `deltaE` 에서 `POSITIVE_INFINITY`.

`rgbToLab` (`ColorDistanceUtil.java:131~156`):

```java
double rNorm = r / 255.0;
double gNorm = g / 255.0;
double bNorm = b / 255.0;

rNorm = rNorm > 0.04045 ? Math.pow((rNorm + 0.055) / 1.055, 2.4) : rNorm / 12.92;
gNorm = gNorm > 0.04045 ? Math.pow((gNorm + 0.055) / 1.055, 2.4) : gNorm / 12.92;
bNorm = bNorm > 0.04045 ? Math.pow((bNorm + 0.055) / 1.055, 2.4) : bNorm / 12.92;

double x = rNorm * 0.4124564 + gNorm * 0.3575761 + bNorm * 0.1804375;
double y = rNorm * 0.2126729 + gNorm * 0.7151522 + bNorm * 0.0721750;
double z = rNorm * 0.0193339 + gNorm * 0.1191920 + bNorm * 0.9503041;

double xn = x / 0.95047;
double yn = y / 1.00000;
double zn = z / 1.08883;

double fx = xn > 0.008856 ? Math.cbrt(xn) : (903.3 * xn + 16) / 116;
double fy = yn > 0.008856 ? Math.cbrt(yn) : (903.3 * yn + 16) / 116;
double fz = zn > 0.008856 ? Math.cbrt(zn) : (903.3 * zn + 16) / 116;

double l = 116 * fy - 16;
double a = 500 * (fx - fy);
double bLab = 200 * (fy - fz);
```

- **감마 보정** (`:136~138`): 표준 sRGB 역감마. 임계 `0.04045`, 오프셋 `0.055`, 스케일 `1.055`, 지수 `2.4`, 선형 영역 `/12.92` — IEC 61966-2-1 그대로.
- **sRGB → XYZ** (`:140~142`): D65 백색점 기준 sRGB 변환 행렬 (Lindbloom 의 사전 계산값과 소수 7자리까지 일치).
- **정규화** (`:144~146`): `Xn = 0.95047, Yn = 1.00000, Zn = 1.08883` → **D65 백색점**. 직접 값 확인.
- **LAB 변환** (`:148~154`): `f(t) = ∛t` (t > 0.008856) / `(903.3·t + 16)/116` (otherwise). 임계값 `0.008856` 와 상수 `903.3` 은 CIE 1976 LAB 정의.
- 최종: `L = 116·f(Y/Yn) - 16`, `a = 500·(f(X/Xn) - f(Y/Yn))`, `b = 200·(f(Y/Yn) - f(Z/Zn))`.

## 5. 주요 상수 / 매직넘버

| 상수 | 값 | 파일:라인 | 의미 |
|---|---|---|---|
| `HEX_PATTERN` | `^#?[0-9a-fA-F]{6}$` | `ColorDistanceUtil.java:11` | 6자리 hex 검증 |
| `twentyFive_pow7` | `Math.pow(25, 7)` | `ColorDistanceUtil.java:45` | Sharma G, R_C 의 임계 채도 25의 7승 |
| `G` 계수 | `0.5` | `ColorDistanceUtil.java:46` | a' 확장 보정 |
| `T` 계수 | `-0.17, +0.24, +0.32, -0.20` | `ColorDistanceUtil.java:92~95` | hue 의존 가중치 |
| `T` 각도 오프셋 | `-30, 0, +6, -63` (도) | `ColorDistanceUtil.java:92~95` | — |
| `SL` 계수 | `0.015`, `20` | `ColorDistanceUtil.java:98` | 밝기 가중치 |
| `SC` 계수 | `0.045` | `ColorDistanceUtil.java:99` | 채도 가중치 |
| `SH` 계수 | `0.015` | `ColorDistanceUtil.java:100` | hue 가중치 |
| `R_C` 계수 | `2` | `ColorDistanceUtil.java:104` | 고채도 스케일 |
| `dtheta` 중심 / 폭 | `275°`, `25°` | `ColorDistanceUtil.java:105` | 파랑 영역 회전 보정 |
| `dtheta` 최대 | `30°` | `ColorDistanceUtil.java:105` | — |
| sRGB 감마 임계 | `0.04045` | `ColorDistanceUtil.java:136~138` | — |
| sRGB 감마 지수 | `2.4`, 오프셋 `0.055`, 스케일 `1.055`, 선형 `12.92` | `ColorDistanceUtil.java:136~138` | — |
| sRGB → XYZ 행렬 | `0.4124564 ...` (D65) | `ColorDistanceUtil.java:140~142` | — |
| 백색점 | `Xn=0.95047, Yn=1.00000, Zn=1.08883` | `ColorDistanceUtil.java:144~146` | **D65** |
| LAB f(t) 임계 | `0.008856` | `ColorDistanceUtil.java:148~150` | CIE 1976 |
| LAB f(t) 선형부 | `903.3·t + 16)/116` | `ColorDistanceUtil.java:148~150` | — |
| `MAX_DELTA_E_THRESHOLD` | `10.0` | `PaintConversionService.java:33` | 페인트 변환에서 유사색 컷 |
| `MAX_DELTA_MATCHES_PER_BRAND` | `3` | `PaintConversionService.java:32` | 브랜드당 상한 |

## 6. 테스트로 검증되는 케이스

`PaintConversionServiceCiede2000Test.java` 요약:

- **검증 방식**: `@ParameterizedTest @CsvSource` 로 Lab1/Lab2/기대 ΔE00 7 컬럼을 받아 `ColorDistanceUtil.ciede2000(...)` 결과와 `assertEquals(expected, result, 0.0001)` 비교 (`:19, :21, :60~68`).
- **데이터셋**: Sharma 2005 논문 "The CIEDE2000 Color-Difference Formula: Implementation Notes, Supplementary Test Data, and Mathematical Observations" 의 공개 표준 검증셋. 클래스 주석에서 논문을 직접 인용 (`:11~16`).
- **케이스 수**: **34쌍** (`:22` `@DisplayName("Sharma 2005 논문 테스트 데이터셋 34쌍 검증")`, 실제 CSV 행도 34개: `:25~58`).
- **특이 구역 커버리지**:
  - 파란색/보라색 영역 (`L=50`, `b ≈ -82`) — R_T 회전 보정 경로: 6개 (`:25~30`)
  - 회색 주변 (C ≈ 0, `2.5 vs -2.5`) — `C1p·C2p == 0` 가드 및 hue 래핑 경로: 10개 이상 (`:31~40`)
  - 큰 색차(ΔE 19~32) — 정상 경로: 4개 (`:41~44`)
  - 저채도 유사색 (ΔE ≈ 1.0) — SL/SC/SH 가중치: 4개 (`:45~48`)
  - 실제 도료/패브릭 색상 추정 영역: 10개 (`:49~58`)
- **추가 회귀 테스트**:
  - `ciede2000_identicalColors_returnsZero` — 동일 색상 0 반환 (`:70~75`)
  - `ciede2000_symmetry` — `ΔE00(a,b) == ΔE00(b,a)` 대칭성 (`:77~83`)
- **허용 오차**: `TOLERANCE = 0.0001` (`:19`). Sharma 논문이 제시하는 유효 자릿수(소수 넷째 자리) 와 일치.

## 7. Delta-E 호출처 지도 (본 글 1편 기준 — 사용처만)

모든 백엔드 Delta-E 호출은 `ColorDistanceUtil.deltaE(hex1, hex2)` 또는 이를 래핑한 `PaintConversionService.matchByHex(...)` 를 경유한다.

1. **`PaintConversionService`** (`PaintConversionService.java`) — 카탈로그 변환 엔진
   - `findSimilarColors(...)`, 직접 `ColorDistanceUtil.deltaE(targetHex, candidate.hex)` 호출 (`:189`), 임계값 `MAX_DELTA_E_THRESHOLD = 10.0` (`:33, :190`)
   - `matchByHex(...)` 두 번째 오버로드에서 직접 호출 (`:454`)
   - `matchByHex(...)` 세 번째 오버로드(하위호환)에서 직접 호출 (`:489`)
   - 브랜드 전체 카탈로그 스캔 후 `deltaE` 오름차순 정렬 (`:194, :463, :498`)
2. **`RecolorPaintMatcher`** (`RecolorPaintMatcher.java`) — 리컬러 트라이어드 매칭
   - 상수: `OWNED_PREFER_THRESHOLD = 5.0` (`:32`), `WIDE_DELTA_E = 25.0` (`:34`), `CATALOG_MATCH_MAX = 50` (`:36`), `MIN_LUMINANCE_DIFF = 0.02` (`:38`)
   - 진입점 `matchPaintsFromPalette(...)` (`:51~90`) 이 palette 원소마다 `matchTriad(...)` (`:71, :100`) 와 `buildMixRecipes(...)` (`:75, :253`) 호출
   - `matchTriad` 내부에서 `paintConversionService.matchByHex(targetHex, CATALOG_MATCH_MAX, RECOLOR_ALLOWED_TYPES, GLOBALLY_EXCLUDED_TYPES, WIDE_DELTA_E)` 호출 (`:101~102`)
   - 보유 우선 선택 로직에서 `m.deltaE() <= OWNED_PREFER_THRESHOLD` 분기 (`:221`)
   - `confidence = 1.0 - (deltaE / 50.0)` 으로 신뢰도 환산 (`:243`)
   - ※ 트라이어드 구성/시프트, 믹스 레시피의 상세 로직은 **2편 분석 문서에서** 다룬다.
3. **`PaintMatchService`** (`PaintMatchService.java`) — 사용자용 색 검색
   - `ColorDistanceUtil` import (`:3`)
   - `findTopMatch(...)` 에서 보유 페인트를 직접 순회하며 `ColorDistanceUtil.deltaE(targetHex, paint.getHex())` (`:114`), 임계 `MAX_DELTA_E` 비교 (`:115`)
   - 카탈로그 최상위는 `paintConversionService.matchByHex(..., 1, ALLOWED_TYPES, EXCLUDED_TYPES, MAX_DELTA_E)` 경유 (`:122~124`)
   - `matchOwnedPaints(...)` 도 같은 직접 호출 + `MAX_DELTA_E` 컷 + `deltaE` 오름차순 정렬 (`:159~166`)
   - 표시용 반올림: `Math.round(deltaE * 100.0) / 100.0` (`:216, :231`)
   - `calcMatchPercent`: `100 - (deltaE * 2)` (`:241~242`) — 주석에 "deltaE 0 = 100%, 10 = 80%, 15 = 70%" (`:239`)
4. **`AiGuideService`** (`AiGuideService.java`) — AI 가이드 카탈로그 매칭 단계
   - AI 응답의 hex+role 을 받아 `enrichWithCatalogMatches(aiJson, ownedIds)` 로 Delta-E 매칭을 엮는다 (`:166`)
   - role 기반 `allowedTypes` 결정 후 `paintConversionService.matchByHex(hex, (MAX_ALTERNATIVES+1)*3, allowedTypes, GLOBALLY_EXCLUDED_TYPES)` 호출 (`:279~280`)
   - 결과 0 개 + 폴백 허용 role 인 경우 DEFAULT 타입으로 재호출 (`:284~288`)
   - primary 선정: `m.deltaE() <= OWNED_PREFER_THRESHOLD` 조건으로 보유 우선 (`:296~305`)
   - 출력 JSON 에 `deltaE = round(deltaE * 10)/10` (`:330`)
5. **`PaintCatalogService`** (`PaintCatalogService.java`) — AI 프롬프트용 카탈로그 샘플링
   - `ColorDistanceUtil` import (`:12`)
   - `deduplicateByDeltaE(sampled, 3.0)` 호출 (`:159`) 로 프롬프트에 너무 유사한 색이 중복 포함되는 것을 방지
   - 구현 `deduplicateByDeltaE(...)` (`:167~183`): 이미 채택된 페인트와 `ColorDistanceUtil.deltaE(...) < minDistance` 이면 제외 (`:173`)

프론트엔드 `miniature-backlog-web/src/utils/colorDistance.ts` (1~166) 는 이름과 달리 **CIEDE2000 구현을 포함하지 않는다**. 실제로 제공하는 기능은:

- `hexToRgb` (`:6~15`)
- `getLuminance` (`:24~28`) — `0.299R + 0.587G + 0.114B` 의 YIQ 근사 휘도 (표준 sRGB 선형 휘도가 **아님**)
- `rgbToHsl` (`:37~52`)
- `compareBySpectrum`, `getTypeSortPriority`, `getCategorySortPriority`, `comparePaintBySpectrum`, `compareCategoryByPriority` — HSL 기반 정렬 유틸 (`:58~165`)

`miniature-backlog-web/src` 전체를 `ciede2000|deltaE|CIEDE` 로 검색한 결과, 프론트 소스 코드(`.ts/.tsx`) 중 CIEDE2000 구현이 있는 파일은 없고, 히트 파일은 모두 i18n 문자열(`src/locales/*.json`) 과 타입 정의(`src/types/*.types.ts`), 그리고 서버가 준 `deltaE` 필드를 **표시**만 하는 UI 컴포넌트(`src/pages/Recolor/EmptyGuidePanel.tsx`, `src/pages/PaintChart/PaintConversionModal.tsx`) 다. 즉 **프론트엔드에는 별도 Delta-E 구현이 없고, 백엔드가 계산한 `deltaE` 값을 그대로 표시만 한다**.

## 8. 설계 의도 / 트레이드오프 (코드에서 읽히는 범위만)

코드와 주석에서 직접 확인되는 사실:

1. **CIEDE2000 을 완전 구현한 이유 (코드 주석 근거)**: `ColorDistanceUtil.java:5~8` 클래스 주석이 "CIE76 대비 파란색/보라색 계열에서 인간 지각과 더 일치하는 결과를 제공한다" 고 명시. 파란색 영역 페인트(예: 애주어, 울트라마린 계열) 에서 CIE76 이 사람 지각과 어긋나는 것이 직접 동기였음을 보여준다 — 이는 CIEDE2000 에 `R_T` 파랑 회전 보정이 있는 이유와도 일치한다.
2. **kL=kC=kH=1 고정**: `ColorDistanceUtil.java:36` 주석 명시. 섬유/그래픽 아트용 비균등 가중(kL=2 등) 은 쓰지 않음 — 미니어처 페인트용 거리로는 기본 가중치가 충분하다는 판단이 깔려 있다 (코드상).
3. **Sharma 2005 검증셋 34쌍 + 허용오차 1e-4 로 회귀 테스트**: 단순히 "공식을 옮겨 넣었다" 가 아니라, 구현의 수치 정확도를 **논문 기준으로 상시 검증**하고 있다. 이는 임계값 기반 필터링(`< 10.0`) 이 결과에 직접 영향을 미치므로 부동소수 오차가 의미 있는 수준으로 쌓이는 것을 막으려는 의도로 해석된다.
4. **임계값이 코드 전역에서 재사용됨**: `MAX_DELTA_E_THRESHOLD = 10.0` (`PaintConversionService.java:33`), `OWNED_PREFER_THRESHOLD = 5.0` (`RecolorPaintMatcher.java:32`, `AiGuideService` 도 같은 이름 사용 `:300`), `WIDE_DELTA_E = 25.0` (`RecolorPaintMatcher.java:34`), `deduplicateByDeltaE(sampled, 3.0)` (`PaintCatalogService.java:159`). **ΔE 값이 비즈니스 룰(보유 우선 / 컷오프 / 다양성 확보 / 중복 제거) 로 직접 번역**되고 있어, 기반 수식 정확도가 떨어지면 상위 모든 결정이 흔들리는 구조다.
5. **파싱 실패 시 POSITIVE_INFINITY** (`ColorDistanceUtil.java:26`): 이후 임계값 비교에서 "자연스럽게 탈락" 하도록 설계. 예외를 던지지 않아 카탈로그 스캔 루프가 단일 잘못된 hex 로 중단되지 않는다.
6. **`deltaE` 호출자는 `matchByHex` 대비 직접 호출이 소수**: 보유 페인트 순회(`PaintMatchService.java:114, :159`) 와 프롬프트용 유사도 중복 제거(`PaintCatalogService.java:173`) 외에는 카탈로그 매칭을 `matchByHex` 로 집약 (`PaintConversionService.java:454, :489`). 즉 `matchByHex` 가 **비용 집중 지점**이며, 모든 브랜드 페인트를 순회하기 때문에 페인트 카탈로그 크기에 비례해 비용이 든다 — 호출자는 `maxDeltaE` 임계값을 전달해 조기 필터링을 유도한다.

**추측 섹션** (코드에 직접 근거 없음, 블로그 본문에 쓰기 전 검토 필요):

- CIE76 / CIE94 / CMC 가 아닌 CIEDE2000 을 고른 "상업적" 이유 (색약/모니터/프린팅 업종 표준 등) — 코드에는 없음.
- `MAX_DELTA_E_THRESHOLD = 10.0` 이 도료 업계 관행 (JND ≈ 2.3, "알아볼 수 있는 차이" ≈ 5) 에서 어떻게 정해졌는지 — 코드에 주석이 없다.
- 프론트에 CIEDE2000 을 두지 않은 이유 (번들 크기? 단일 진리원?) — 코드에 근거 없음.

## 9. 확인 필요 영역 (할루시네이션 방지)

1. **프론트엔드에 색거리 계산이 **정말** 전혀 없는지 재확인**: 본 분석은 `miniature-backlog-web/src` 내 `.ts/.tsx` 를 `ciede2000|deltaE|CIEDE` 키워드로만 검색했다. 다른 변수명(예: `colorDistance`, `distance`, `deltaE94`) 으로 구현되어 있을 가능성은 배제하지 않았다.
2. **`miniature-backlog-web/package.json`**: 프론트 의존성에 `color-diff`, `chroma-js` 등 외부 라이브러리가 있는지 본 분석에서 직접 열지 않았다.
3. **`recolor/service/PaintCatalogService.java` 의 전체 맥락**: 본 분석에서는 `deduplicateByDeltaE` 주변(150~183) 만 확인했다. 이 파일은 239 라인이며, 카탈로그 로딩/샘플링 전반의 흐름은 2편 분석에서 필요할 수 있다.
4. **`PaintMatchService` 의 호출자**: 어떤 API 엔드포인트가 `findTopMatch`, `matchOwnedPaints` 를 호출하는지는 확인하지 않았다.
5. **성능 수치**: `matchByHex` 가 실제로 몇 개의 페인트를 순회하는지, 단일 호출에 `ColorDistanceUtil.deltaE` 가 몇 번 호출되는지 벤치마크 데이터가 코드에 없다 (전형적인 `O(N)` 이지만 N 은 `allBrands.json` 에 의존).
6. **`allBrands.json`, `conversionGroups.json`, `officialConversions.json`** 의 내용/크기 — 본 분석에서 열지 않음. 1편에는 필요 없다.
7. **CIEDE2000 수식이 실제로 논문과 100% 일치한다는 증명**은 구현 코드와 Sharma 테스트셋 통과 사실만으로 수행했다. 수식을 한 줄씩 논문과 대조한 것은 아니다. (다만 34쌍이 `1e-4` 오차로 통과한다는 점은 사실상의 검증이다 — 테스트 파일 직접 확인 `:17~68`.)
8. **`PaintConversionService.java` 내부 구조체들(`PaintEntry`, `GroupEntry`, `OfficialEquivalent`, `MatchCandidate`, `BrandAccumulator`)** 의 쓰임새 — 1편 주제 범위를 벗어나 상세히 다루지 않았다.

## 10. 블로그 포스트 1편 구조 초안

제목(안): "Delta-E 와 CIEDE2000 — 페인트 매칭의 수학적 기반"

### Section 1 — 문제 상황: "AI가 말한 색을 그대로 믿을 수 없다"
- GPT/Vision 이 "이 미니어처의 주조색은 `#5B7BA8`" 이라고 답했을 때, 그게 Citadel 의 어떤 페인트에 가장 가까운가?
- 단순 hex 거리(RGB 유클리드) 가 왜 실패하는가 — 인간 지각 비균등성.
- 예고: 파랑 계열에서 CIE76 마저 실제 눈이 느끼는 차이와 어긋난다.

### Section 2 — Delta-E 의 계보 (교양)
- CIE76 (단순 LAB 유클리드) → CIE94 → CIEDE2000 의 진화.
- 각 세대가 어떤 "실패 사례"를 고치려고 나왔는지 개념 수준으로.
- CIEDE2000 의 세 축: 밝기 가중(SL), 채도 가중(SC), hue 가중(SH) + 파란 회전(R_T).

### Section 3 — PaintLater 의 선택: 코드 해부
- "우리는 왜 CIE76 으로 끝내지 않았나" — `ColorDistanceUtil.java:5~8` 주석 인용.
- **Step 1~3 구조**: G 보정 (`:40~57`), ΔL'/ΔC'/ΔH' (`:60~74`), 가중치/회전 (`:77~106`), 최종 루트 (`:108~112`) — 각 블록에 "수학" 과 "코드" 를 나란히.
- 특히 **R_T 와 파란색 275° 중심** (`:105`) 을 시각화 섹션으로.

### Section 4 — 색 공간 변환은 왜 필요한가
- sRGB 는 지각 공간이 아니다. 감마 보정 → XYZ → LAB 3단계 (`:131~156`).
- D65 백색점(`:144~146`) 의미.
- 하드코딩된 행렬(`:140~142`) 이 IEC/Lindbloom 표준임을 짧게.

### Section 5 — "우리 구현이 정확한가?" 를 증명하는 법
- `PaintConversionServiceCiede2000Test` 설명: Sharma 2005 34쌍 + 허용오차 1e-4 (`PaintConversionServiceCiede2000Test.java:17~68`).
- 핵심 메시지: **수식 자체는 논문, 정확성 증명은 단위 테스트**.

### Section 6 — Delta-E 가 실제로 뭘 결정하는가 (2편 티저)
- `MAX_DELTA_E_THRESHOLD = 10.0` (`PaintConversionService.java:33`), `OWNED_PREFER_THRESHOLD = 5.0` (`RecolorPaintMatcher.java:32`), `WIDE_DELTA_E = 25.0` (`:34`), `deduplicateByDeltaE(..., 3.0)` (`PaintCatalogService.java:159`) — ΔE 값이 곧 비즈니스 룰.
- 호출처 지도 한 단락: `PaintConversionService`, `RecolorPaintMatcher`, `PaintMatchService`, `AiGuideService`, `PaintCatalogService`.
- **2편 예고**: "그런데 AI 는 종종 존재하지 않는 색을 말한다 — 리컬러 파이프라인이 LLM 환각을 어떻게 걸러내는가."

### Section 7 — 교훈
- 수학 수식을 그대로 옮기면 된다 → 옮긴 뒤 "논문 테스트셋으로 회귀 검증" 까지가 엔지니어링.
- "지각 기반 거리" 는 프로덕트 UX 결정(매칭 컷오프, 보유 우선, 다양성, 중복 제거) 의 원초적 재료다.
- 프론트가 아니라 **백엔드에 단일 진리원** 을 둔 선택 — 프론트 `colorDistance.ts` 는 정렬용 HSL 유틸일 뿐이다(`miniature-backlog-web/src/utils/colorDistance.ts:1~166`).
