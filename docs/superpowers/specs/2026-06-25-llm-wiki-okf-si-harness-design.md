# LLM-Wiki 기반 SI 바이브코딩 하네스 — 설계 문서

- **작성일**: 2026-06-25
- **상태**: 설계 확정 (일부 열린 질문 존재 — §10)
- **이번 세션 범위**: LLM-Wiki(OKF 번들) **구조** 우선. 빌드/운영 프로세스는 구조를 읽고 쓰는 소비자로서 함께 설계.

---

## 1. 목적과 비전

SI 프로젝트의 산출물을 입력으로, **구축이 끝나는 순간 시스템의 스펙·도메인 지식(왜 그렇게 만들었는가)·운영 데이터가 LLM-Wiki로 함께 완성**되는 AI 바이브코딩 하네스를 만든다. 이 wiki는 구축 이후 운영(수정·변경) 단계에서 AI가 **기존 히스토리를 참조해 정합성 있게** 시스템을 발전시키는 토대가 된다.

최종 산출물은 한 프로젝트의 wiki가 아니라, **어떤 SI 프로젝트든 채택하면 OKF 기반 LLM-Wiki가 자동으로 축적되는 재사용 가능한 방법론 + 하네스 엔지니어링 프레임워크**다.

### 토대 기술: OKF (Open Knowledge Format)
구글 클라우드가 2026-06-12 공개한 스펙. "LLM-Wiki 패턴"을 표준화한 것으로:
- 지식 = **마크다운 파일들의 디렉터리**. 파일 1개 = concept 1개.
- 각 문서 = **YAML frontmatter(구조화 필드) + 마크다운 본문**.
- concept끼리 **마크다운 링크로 연결** → 디렉터리 전체가 관계 그래프.
- 예약 파일명, 교차 링크 규칙, 적합성(conformance) 기준 존재.

본 프레임워크의 LLM-Wiki는 "SI 산출물로 채운 OKF 번들"이며, 빌드 하네스와 운영 루프는 그 번들의 생산자/소비자다.

### 채택 표준: Karpathy LLM Wiki
본 프로젝트는 **Andrej Karpathy의 LLM Wiki 구조를 표준으로 채택**하고, 그 위에 OKF 적합성과 SI 전용 확장을 얹는다. Karpathy 표준의 핵심:
- **3계층**: `raw/`(불변 원본) + `wiki/`(LLM이 소유·생성하는 페이지) + **`CLAUDE.md`(schema)**.
- **`index.md`** = **콘텐츠 카탈로그**. *ingest(원본 적재)마다 갱신*되며 **LLM이 가장 먼저 읽어 navigate하는 단일 진입점**. raw→wiki ingest를 기록하므로 태생적으로 raw를 안다. (단 ~100페이지 초과 시 한 번에 읽기 어려우므로 분할 필요.)
- **`log.md`** = **append-only 작업 로그**. 모든 ingest·페이지 갱신·발견된 모순을 기록.
- **`CLAUDE.md`** = **schema** = 페이지 구조·네이밍·템플릿·워크플로 정의(규칙). *카탈로그가 아님* — `index.md`와 역할이 분리된다.

> 우리가 표준에서 **의도적으로 확장(extend)** 하는 것: (1) `log`를 단일 파일 대신 **날짜별 `log/` 폴더**로 분할, (2) 자유형 페이지 대신 **OKF frontmatter + SI concept 타입**(capabilities/queries/processes/policies…), (3) **2계층**(사내 공통 + 프로젝트). 인덱스가 ~100페이지를 넘는 SI 규모 대응으로 **루트 `index.md`(최상위 카탈로그) + 타입별 하위 인덱스**로 분할한다.

출처: [LLM Wiki — Karpathy gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f), [Starmorph 가이드](https://blog.starmorph.com/blog/karpathy-llm-wiki-knowledge-base-guide), [OKF SPEC — GoogleCloudPlatform/knowledge-catalog](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md)

---

## 2. 핵심 설계 결정

| # | 결정 | 근거 |
|---|---|---|
| D1 | **2계층**: 사내 공통 레이어 + 프로젝트 레이어 | 디자인시스템 등 공통 자산을 여러 SI가 재사용. 프레임워크 목적과 직결. |
| D2 | concept 중심축 = **하이브리드** (기능/엔티티 세로 슬라이스 + 공통 레퍼런스) | 한 기능의 맥락이 흩어지지 않고 한 허브에서 그래프로 도달. 토큰 효율적(lazy 로딩). |
| D3 | 입력 산출물 = **전부 수집** (요구/화면정의, 데이터모델, 인터페이스/API, 업무·정책·테스트·의사결정) | — |
| D4 | wiki↔코드 동기화 = **원자적 동시 기록 + 드리프트 검사** | 사람/AI가 짠 코드 모두 wiki가 따라붙고 why까지 포착. 빌드·운영 통일. |
| D5 | **raw(원본)와 wiki(LLM 작성)를 최상위에서 물리적으로 분리** | 원본 불변 규칙 강제, 출처 추적 명확. |
| D6 | 사내 공통 표준(코드로 존재)은 **재구현하지 않고 코드 위 "사용 계약" 인덱스**로만 wiki화 (가능시 자동 생성) | 중복 제거. 코드가 진실. |
| D7 | **모든 wiki 문서는 raw 출처를 frontmatter에 필수 기재**. PI 확정물도 raw에 적재 → "모든 wiki ← raw" 예외 없이 성립 | 추적성·신뢰성. |
| D8 | `log/`는 **단일 책임(append-only 변경 이력)** 으로 **프로젝트 root**에 **날짜별 폴더**로 위치 (raw·wiki·code 변경·모순 모두 기록) | Karpathy `log.md`의 책임을 따르되, ~100페이지 비대화 방지를 위해 날짜 분할로 확장. |
| D13 | **단일 `index.md`(루트 카탈로그)** 채택. Karpathy 표준대로 ingest마다 갱신되는 첫 진입점이며 raw+wiki를 가로지름. **인덱스 중복 금지** — concept 열거는 여기 한 곳 + 타입별 하위 인덱스. `CLAUDE.md`는 schema(규칙)로 카탈로그와 분리 | "같은 걸 두 번 적기" 제거. wiki/index.md만으로는 raw를 못 보는 문제 해소. |
| D9 | OKF 템플릿은 **중앙 `templates/`**, 스크립트는 **스킬 폴더 내 `scripts/`**, 공용 스크립트만 `tools/` | Claude Code 규약 준수 + 거버넌스. |
| D10 | Claude Code 구조 채택. **`commands/`는 v2.1.3에서 skills로 통합되어 제외**, `skills/`로 일원화 | 도구 현행 규약. |
| D11 | concept 타입에 **`queries/`(한 방 쿼리), `processes/`(업무 프로세스), `infrastructure/`** 추가. 보안·표준은 commons `governance/` | 레거시 SQL 로직·업무흐름·운영 지속성 대응. |
| D12 | GPT 제안 10분류는 **폴더 구조로는 기각**(수평 분류=맥락 분산), 대신 **`layer` facet + `traces` frontmatter**로 흡수 | EA식 단면 뷰는 폴더가 아니라 태그/쿼리로. |

---

## 3. 아키텍처 (2계층)

```
■ 사내 공통 레이어 (okf-commons — 재사용 프레임워크, 모든 SI가 상속)
├─ .claude/
│   ├─ agents/        서브에이전트 (define-screen, spec-author, tdd-implementer,
│   │                 code-review, operate, wiki-lint 등)
│   ├─ skills/        스킬 (SKILL.md + scripts/) — commands 통합됨
│   ├─ hooks/         훅 스크립트 (settings.json에서 연결)
│   ├─ rules/         규칙 .md (CLAUDE.md가 @import)
│   └─ settings.json  권한·훅·MCP·schedule 설정
├─ CLAUDE.md          하네스 운전 매뉴얼 (규칙·워크플로)
├─ templates/         공유 OKF concept 템플릿 (타입별)
├─ tools/             공용 독립 스크립트 (drift-check, okf-lint, 스텁 생성기)
└─ commons-wiki/      공통 OKF 번들
    ├─ index.md
    ├─ design-system.md   코드 위 사용 계약 인덱스 (자동 생성)
    ├─ glossary.md        사내 전용 용어집
    ├─ governance/        보안·표준
    ├─ patterns/          표준 아키텍처·재사용 패턴
    └─ conventions/       코딩·네이밍·테스트 규약

■ 각 SI 프로젝트 (scaffold로 위 프레임워크를 설치)
├─ CLAUDE.md           schema/규칙 (@import 공통 규칙 + 프로젝트 특이사항). ※카탈로그 아님
├─ index.md            ★단일 카탈로그 — ingest마다 갱신, LLM 첫 진입점. raw+wiki 가로지름
├─ .claude/            공통 상속 + 프로젝트 오버라이드
├─ raw/                ★원본 산출물·이미지 + PI 확정 화면정의 적재. 불변(에이전트 쓰기금지)
├─ log/                ★append-only 변경 이력 (raw·wiki·code·모순). 날짜별. 단일 책임
│   └─ 2026-06-25.md …   ※index.md 없음 — 날짜 정렬이 곧 인덱스
├─ wiki/               LLM이 raw를 해석해 작성하는 OKF 번들 (= LLM-Wiki). ※자체 index 없음, 루트 index.md가 카탈로그
│   ├─ capabilities/       SPINE 허브 (링크 목록)
│   ├─ processes/          업무 프로세스 (여러 capability 가로지름)
│   ├─ entities/           데이터 모양
│   ├─ queries/            한 방 쿼리/레거시 SQL 로직 + 규칙 추출
│   ├─ interfaces/         연계/API
│   ├─ policies/           업무 규칙
│   ├─ decisions/          ADR (why)
│   ├─ infrastructure/     환경·배포·토폴로지
│   └─ runbooks/           운영 절차
├─ src/                코드
└─ ci/                 tools/ 호출 (drift-check, okf-lint)
```

> 규모 대응: SI 프로젝트는 ~100페이지를 쉽게 넘으므로, 루트 `index.md`는 타입별 하위 인덱스(예: `wiki/capabilities/_index.md`)로 분할해 한 번에 읽는 분량을 제한한다.

프로젝트의 `wiki/`는 `commons-wiki/`의 concept를 마크다운 링크로 **참조(상속)**한다. 신규 프로젝트는 scaffold로 골격 + CI를 즉시 설치한다.

### 3.1 통합 구조 — 실제 SI 프로젝트의 최종 폴더 트리

위 두 레이어가 합쳐져, 실제로 SI 프로젝트를 진행할 때 디스크에 떨어지는 최종 모습. 각 항목에 출처를 표기한다 — `[공통]`은 사내 공통 레이어에서 상속(scaffold 설치, 프로젝트 간 동일), `[프로젝트]`는 이 SI에서 생성·축적되는 고유 자산.

```
<si-project>/
├─ CLAUDE.md                        [공통+프로젝트] schema/규칙. 공통 @import + 프로젝트 특이사항. ※카탈로그 아님
├─ index.md                        [프로젝트] ★단일 카탈로그 — ingest마다 갱신, LLM 첫 진입점 (raw+wiki)
├─ .claude/                        [공통] 하네스 엔진 (상속, 프로젝트 오버라이드 가능)
│   ├─ agents/                       define-screen, spec-author, tdd-implementer,
│   │                                code-review, operate, wiki-lint …
│   ├─ skills/                       SKILL.md + scripts/
│   ├─ hooks/                        on-confirm, drift 기록 등
│   ├─ rules/                        CLAUDE.md가 @import
│   └─ settings.json                 권한·훅·MCP·schedule(야간 wiki-lint)
├─ templates/                       [공통] OKF concept 타입별 템플릿
├─ tools/                           [공통] drift-check, okf-lint, 스텁 생성기
│
├─ commons-wiki/                    [공통] 사내 공통 OKF 번들 (상속 — 참조/벤더링). 자체 index.md 보유(별도 번들)
│   ├─ index.md                       commons 번들 카탈로그
│   ├─ design-system.md               코드 위 사용 계약 인덱스 (자동 생성)
│   ├─ glossary.md                     사내 전용 용어집
│   ├─ governance/                     보안·표준
│   ├─ patterns/                       표준 아키텍처·재사용 패턴
│   └─ conventions/                    코딩·네이밍·테스트 규약
│
├─ raw/                            [프로젝트] 원본 산출물·이미지 + PI 확정 화면정의. 불변
│   ├─ 화면정의서/
│   │   ├─ signup.md                   3층(요구·스키마·렌더 링크)
│   │   └─ signup.html                 확정 렌더 결과
│   ├─ 요구정의서/  데이터모델/  인터페이스정의서/  업무정책/  회의록·계약·제안서/ …
│
├─ log/                            [프로젝트] append-only 변경 이력 (raw·wiki·code·모순). 날짜별. 단일 책임
│   └─ 2026-06-25.md …                ※index.md 없음 — 날짜 정렬이 곧 인덱스
│
├─ wiki/                           [프로젝트] LLM이 raw를 해석해 작성하는 OKF 번들 (commons-wiki 링크 참조). ※자체 index 없음
│   ├─ capabilities/                  SPINE 허브 (링크 목록)
│   ├─ processes/                     업무 프로세스 (여러 capability 가로지름)
│   ├─ entities/                      데이터 모양
│   ├─ queries/                       한 방 쿼리/레거시 SQL + 규칙 추출
│   ├─ interfaces/                    연계/API
│   ├─ policies/                      업무 규칙
│   ├─ decisions/                     ADR (why)
│   ├─ infrastructure/                환경·배포·토폴로지
│   └─ runbooks/                      운영 절차
│
├─ src/                            [프로젝트] 코드
└─ ci/                             [공통→프로젝트] tools/ 호출 (drift-check, okf-lint)
```

요점: **`[공통]` 영역은 scaffold로 모든 SI에 동일하게 깔리고**, 한 프로젝트를 진행하며 채워지는 것은 **`raw/` → `wiki/` → `src/`** 와 그 변경을 기록하는 **`log/`** 다. `wiki/`의 concept들은 `commons-wiki/`(디자인시스템·용어·표준)를 마크다운 링크로 참조한다.

> `commons-wiki/`를 프로젝트 안에 **벤더링(복사)** 할지 **외부 참조(서브모듈/링크)** 할지는 상속 메커니즘 결정에 달림 — §10 열린 질문 #3.

---

## 4. LLM-Wiki 구조 — 하이브리드 축

- **SPINE (세로 슬라이스)**: `capabilities/<기능>.md`가 허브. 본문은 주로 **마크다운 링크 목록**이며(이미지 아님, 토큰 효율적), 요구·엔티티·쿼리·인터페이스·정책·결정·코드로 그래프를 타고 도달한다. AI는 이 한 노드에서 시작해 필요한 이웃 노드만 lazy하게 불러온다.
- **CROSS-CUTTING (레퍼런스)**: `entities/ queries/ interfaces/ policies/ decisions/ processes/ infrastructure/ runbooks/`. 여러 슬라이스가 공유.
- **PROVENANCE**: 원본은 `raw/`에 그대로 보존하고, wiki concept는 그것을 해석·구조화한 결과 + `sources:` 링크로 출처 추적.

---

## 5. OKF concept 템플릿

### 공통 frontmatter (모든 concept 필수)
```yaml
---
id: signup                          # 안정적 kebab id (파일명과 일치)
type: capability                    # capability|process|entity|query|interface|
                                    #   policy|decision|infrastructure|runbook|reference
title: 회원가입
status: draft                       # draft → confirmed(PI승인) → implemented → deprecated
owner: auth-squad
layer: business                     # business|data|application|infrastructure|quality|governance (facet)
sources:                            # ★출처 필수
  - path: raw/화면정의서/회원가입.md
    ref: "Sheet2!A1:F30"            # 선택: 원본 내 위치
code:                               # 매핑되는 코드 (드리프트 검사 앵커)
  - src/auth/signup/**
related:                            # OKF 교차링크
  - "[[entities/member]]"
  - "[[policies/password-rule]]"
traces: [REQ-001, REQ-002]          # 요구사항 추적성
tags: [auth, onboarding]
last_verified: 2026-06-25
---
```
핵심 필드: `sources`(추적성), `code`(드리프트 검사 연결고리), `layer`/`traces`(EA식 단면 + 추적성).

### 타입별 본문 템플릿 (요지)

**`capabilities/` — SPINE 허브 (링크 위주, 작게)**: 목적 / 화면·UI(디자인시스템 컴포넌트 링크) / 흐름 / 구성요소(엔티티·쿼리·인터페이스·정책·결정 링크) / 인수 기준(TDD 시드).

**`processes/` — 업무 프로세스 (여러 capability 가로지름)**: 프로세스 목적 / 단계(각 단계가 호출하는 capability 링크) / 액터 / 분기·예외 / 관련 정책.

**`entities/` — 데이터 모양 + 업무 의미**: 업무적 의미 / 속성 표 / 불변 규칙(→policies 링크) / 관계 / 사용처(capabilities 링크).

**`queries/` — 한 방 쿼리 / 레거시 SQL**: 하는 일(평문) / 건드리는 테이블·엔티티 / **박힌 업무 규칙 추출 → policies 승격** / 입출력 / 왜 이렇게 짰는가(→decisions) / 코드 위치.

**`policies/` — 업무 규칙 + 왜**: 규칙(단정문) / 근거(why) / 출처(명시 sources 또는 query에서 역추출) / 영향 기능 / 예외.

**`decisions/` — ADR**: 맥락 / 결정 / 대안(기각 사유) / 결과(트레이드오프).

**`interfaces/` — 연계/API**: 프로토콜 / 요청·응답 스키마 / 시퀀스(원본 다이어그램 링크) / 에러 처리 / 외부 시스템 / 소유자.

**`infrastructure/` — 환경·배포·토폴로지**: 환경 구성 / 배포 방식 / 의존 서비스 / 관련 runbook.

**`runbooks/` — 운영 절차 (운영 단계 성장)**: 시나리오 / 증상 / 조치 단계 / 롤백 / 관련 capabilities·queries.

### 예약 파일 (Karpathy 표준)
- **`/index.md`** (루트, 단일 카탈로그): LLM이 **가장 먼저 읽는 진입점**. ingest마다 갱신되며 raw→wiki 매핑과 타입별 목록을 담는다. raw+wiki를 가로지른다. ~100페이지 초과 시 타입별 하위 인덱스(`wiki/<type>/_index.md`)로 분할. **concept 열거는 여기 한 곳에만** (인덱스 중복 금지).
- **`/CLAUDE.md`** (schema): 페이지 구조·네이밍·템플릿·워크플로·불변규칙 정의. *카탈로그가 아님* — `index.md`와 분리.
- **`/log/<날짜>.md`** (append-only): 변경 이력 엔트리 (예: `[ingest] raw 수집`, `[create] concept`, `[confirm] PI 승인`, `[update] 페이지 갱신`, `[contradiction] 모순 발견`, `[code] 구현·last_verified 갱신`). `log/`에는 별도 index를 두지 않는다(날짜 정렬이 인덱스).
- **`wiki/`** 자체에는 index를 두지 않는다 — 루트 `/index.md`가 단일 카탈로그.
- **`commons-wiki/index.md`**: 공통 번들은 별도 OKF 번들이므로 자체 카탈로그를 가진다. 루트 `/index.md`가 이를 링크.

---

## 6. 화면정의서 자료구조

PI 확정 시 **화면 Frontend + PI 요구사항을 모두 포함**하는 산출물. raw에 적재(불변).

```
raw/화면정의서/<기능>.md    (확정 화면정의 — 3층 구조)
raw/화면정의서/<기능>.html  (확정된 렌더 결과 = 시각적 진실)
```

`<기능>.md` 3층:
1. **요구사항**: PI가 요구한 것, REQ-ID 부여 (추적성 시작점).
2. **화면 스키마**: 컴포넌트 트리. 각 컴포넌트가 `use`(디자인시스템 참조), `binds`(→entity.field), `validates`(→policy), `action`(→interface/query), `satisfies`(→REQ-ID)를 보유.
3. **렌더 결과**: `<기능>.html` 링크.

**핵심**: 화면정의서가 이미 데이터·규칙·인터페이스·요구 링크를 들고 있어 **capability 허브의 씨앗**이 된다. SDD agent는 이 링크들을 그대로 승격한다. 요구-화면-데이터-규칙 추적성이 확정 시점에 자동 결선된다.

> 화면 스키마(2층)의 직렬화 형식(마크다운 내 YAML 블록 vs 별도 `.schema.json`)은 **열린 질문(§10)**.

---

## 7. 빌드 프로세스

원칙: **각 단계의 부산물로 wiki가 자동 축적된다.** SDD=concept 작성, TDD=`code` 필드 확정 → 별도 문서화 없이 개발이 wiki를 채운다.

```
[1] PI 화면 정의 (채팅)            skill: define-screen
    · commons-wiki/design-system.md 규칙대로 HTML/CSS 렌더 → 시연 → 반복
[2] PI 확정                         hook(on-confirm)
    · 확정 화면정의를 raw/화면정의서/<기능>.{md,html} 적재 (ingest)
    · wiki/capabilities/<기능>.md 생성 (templates/capability.md, status: confirmed)
    · index.md 카탈로그 갱신 (ingest마다) + log/<날짜>.md [ingest][confirm] 기록
[3] SDD — 명세 증류                 agent: spec-author
    · raw + 확정 capability를 읽어 entities/queries/interfaces/policies/processes/decisions 생성·갱신
    · 한 방 쿼리 → queries/ + 규칙 policies 승격
    · 설계 판단 → decisions/ (ADR)
    · 모든 문서 sources/code/layer/traces 기재
[4] TDD — 구현                      agent: tdd-implementer
    · 인수 기준 → 테스트 먼저 → 실패 → 구현 → 통과
    · concept의 code 필드를 실경로로 확정, last_verified 갱신
[4.5] 코드 리뷰                     agent: code-review (구현 직후 플로우)
[4.6] E2E 테스트                    SDD 결과물을 시나리오 기반 E2E로 검증
[5] 게이트 (PR 시점)               hook/CI: drift-check + okf-lint  ← §8, 세부 미해결(§10)
```

---

## 8. 검증 — 2계층

```
■ PR 시점 (동기, 머지 차단)   ← 세부 기준 미해결(§10)
   drift-check : concept의 code 글롭이 변경 파일과 겹치는데 해당 concept 미갱신·last_verified 미갱신
                 → 드리프트로 머지 차단. "코드만 고치고 wiki 방치" 구조적 차단.
   okf-lint    : 필수 frontmatter, 링크 유효성, OKF 적합성.

■ 야간 배치 (비동기, Claude Code schedule / CronCreate)   skill: wiki-lint
   · 모순(contradiction) 탐지 — wiki 문서 간 상충 내용
   · orphan 문서 — 아무도 링크하지 않는 고립 concept
   · raw 출처 누락 — sources 비었거나 raw에 실제 파일 없음
   → 위반 리포트 생성 (다음날 운영자/AI 처리)
```

빌드와 운영이 **동일 게이트(drift-check)** 를 공유하여 구축 이후에도 정합성이 규칙으로 강제된다.

---

## 9. 운영 루프

```
[1] 수정 요청 도착
[2] operate agent: 영향 capabilities/<기능> 허브에서 그래프 진입
    · entities·queries·policies·interfaces·decisions + log/(과거 변경 why) 수집
    · "왜 이렇게 되어 있는가" 이해 후 수정 설계
[3] 원자적 동시 기록 (한 PR 안):
    · 코드 수정 + 영향 concept 갱신 + (판단 변경 시) 새 decisions ADR + log/ 엔트리
[4] CI 게이트: drift-check + okf-lint (빌드와 동일 메커니즘)
```

---

## 10. 열린 질문 (Open Questions)

1. **PR 시점 게이트(§8)의 판정 기준** — 드리프트 true/false positive 처리, 어디까지 머지 차단할지, 사람 오버라이드 절차. (가장 큰 미해결 영역.)
2. **화면 스키마(§6 2층) 직렬화 형식** — 마크다운 내 YAML 블록 vs 별도 `.schema.json` (JSON Schema 검증).
3. commons → project **상속/오버라이드 메커니즘** 구체화 (링크 참조 vs 복사 vs 심볼릭).
4. **자동 vs 수동 경계** — SDD 단계에서 어디까지 AI가 자동 생성하고 어디부터 사람이 승인하는지.
5. 야간 wiki-lint의 **모순 탐지** 구체 알고리즘(임베딩 유사도? 규칙 기반?).
6. `processes/`와 `capabilities/` 간 **중복·경계** 규약 (프로세스가 너무 비대해지지 않도록).

---

## 11. 비범위 / 후속

- 빌드 하네스(B)·운영 루프(C)의 **상세 구현**은 본 세션 범위 밖. 본 문서는 구조 우선, 프로세스는 구조 소비자로서의 골격만.
- 각 서브 프로젝트(하네스 엔진 구현, 화면정의 스킬, drift-check 도구 등)는 자체 spec → plan → 구현 사이클을 가진다.
