# CLAUDE.md — LLM-Wiki / OKF 번들 스키마

이 파일은 Karpathy LLM Wiki 표준의 **schema** 다 — wiki의 구조·네이밍·템플릿·워크플로·불변규칙을 정의한다. **카탈로그가 아니다**(concept 열거는 `index.md` 한 곳에만 — D13). LLM은 navigate할 때 `index.md` 를 먼저 읽고, "어떻게 써야 하는가"는 이 파일을 따른다.

> 이 저장소는 재사용 프레임워크 `okf-commons` 이자, 그 구조를 보여주는 **레퍼런스 번들**을 함께 담는다(spec §3.1 통합 트리). 전체 계획·진행은 [`PROJECT_STATUS.md`](PROJECT_STATUS.md), 설계 근거는 [`docs/superpowers/specs/2026-06-25-llm-wiki-okf-si-harness-design.md`](docs/superpowers/specs/2026-06-25-llm-wiki-okf-si-harness-design.md) 참조.

---

## 1. 3계층 모델 + 진입점

- **`raw/`** — 불변 원본 산출물. 에이전트는 **절대 쓰지 않는다**(읽기만). 모든 wiki 문서의 출처.
- **`wiki/`** — LLM이 raw를 해석해 작성하는 OKF 번들. concept 1개 = 파일 1개.
- **`CLAUDE.md`**(이 파일) — schema(규칙). **`index.md`** — 단일 카탈로그, ingest마다 갱신, LLM 첫 진입점, raw+wiki를 가로지름.
- **`log/`** — append-only 변경 이력(날짜별 `YYYY-MM-DD.md`). 자체 index 없음(날짜 정렬이 인덱스).

## 2. 폴더 구조 (출처 표기 — `[공통]`=프레임워크 상속, `[프로젝트]`=이 SI 고유)

```
CLAUDE.md          [공통+프로젝트] schema (이 파일)
index.md           [프로젝트] 단일 카탈로그 — ingest마다 갱신
.claude/           [공통] agents/ hooks/ rules/ skills/ settings.json
templates/         [공통] OKF concept 타입별 템플릿 (10종)
tools/             [공통] okf-lint(검증), okf-init(스캐폴드)
commons-wiki/      [공통] 사내 공통 OKF 번들 (별도 카탈로그 commons-wiki/index.md 보유)
  design-system.md / glossary.md / governance/ / patterns/ / conventions/
raw/               [프로젝트] 원본·이미지 (불변). 하위 카테고리는 ASCII kebab: screen-definitions/ requirements/ data-models/ interface-specs/ business-policies/ meetings-contracts/ legacy-sql/ infrastructure/ operations/ common/
log/               [프로젝트] append-only 변경 이력 (날짜별)
reports/           [프로젝트] wiki-lint 야간 진단 리포트 (날짜별, 비차단 — log/와 형제)
wiki/              [프로젝트] LLM 작성 OKF 번들 (자체 index 없음 — 루트 index.md가 카탈로그)
src/               [프로젝트] 코드
ci/                [공통→프로젝트] tools/ 호출 (okf-lint, drift-check)
```

## 3. concept 타입 (10) — `wiki/<폴더>/<id>.md`

폴더↔타입 정규 매핑(`tools/okf-lint/src/schema.js`의 `FOLDER_TO_TYPE`가 진실):

| 폴더 | type | 역할 |
|------|------|------|
| `capabilities/` | capability | SPINE 허브 (링크 목록) |
| `processes/` | process | 업무 프로세스 (여러 capability 가로지름) |
| `entities/` | entity | 데이터 모양 + 업무 의미 |
| `queries/` | query | 한 방 쿼리/레거시 SQL + 규칙 추출 |
| `interfaces/` | interface | 연계/API |
| `policies/` | policy | 업무 규칙 + why |
| `decisions/` | decision | ADR (why) |
| `infrastructure/` | infrastructure | 환경·배포·토폴로지 |
| `runbooks/` | runbook | 운영 절차 |
| `references/` | reference | 코드 위 "사용 계약" 인덱스 (commons 등) |

새 concept은 `templates/<type>.md` 를 복사해 작성한다.

## 4. frontmatter 규칙 (okf-lint가 강제)

필수: `id`(=파일명, kebab), `type`(=폴더 매핑), `title`, `status`, `sources`(비어있으면 안 됨 — 모든 wiki는 raw 출처 기재). 권장: `owner`, `layer`, `code`, `related`, `traces`, `tags`, `last_verified`, `supersedes`/`superseded_by`(대체 관계, `[[decisions/<id>]]`).

- `status` ∈ `draft | confirmed | implemented | deprecated`
- `layer` ∈ `business | data | application | infrastructure | quality | governance` (EA식 단면 facet)
- **교차링크**: `[[<폴더>/<id>]]` (예: `[[entities/member]]`). 대상 파일이 존재해야 유효.
- **출처 백링크**: frontmatter `sources[].path`에 적은 각 raw 출처는 **본문 `## 출처` 섹션에 `[[raw/<폴더>/<파일>]]` 백링크로도 적는다**(Obsidian 그래프에 raw↔wiki 연결이 보이도록). `.md` 출처만 백링크; `.sql`·이미지 등 비-md 원본은 경로 텍스트로 표기. okf-lint은 `[[raw/...]]`를 개념 엣지가 아닌 **출처 백링크로 보고 해소하지 않는다**(출처 *존재* 검사는 야간 `wiki-lint` 몫 — §6).
- **대체(supersession)**: `superseded_by`가 있으면 `status`는 `deprecated`. 과거 결정은 지우지 않고 deprecated로 남겨 ADR 체인으로 보존(정제/대체 절차는 ingest 스킬 참조).

## 5. 워크플로 (요지)

**빌드 루프** — 각 단계의 부산물로 wiki가 자동 축적:
`define-screen`(PI 화면 정의) → `on-confirm` hook(raw ingest + capability 생성 + index/log 갱신) → `spec-author`(raw→entities/queries/policies/decisions 증류) → `tdd-implementer`(`code:` 확정, `last_verified` 갱신) → code-review → E2E → **PR 게이트**(drift-check + okf-lint).

**ingest 트리거** — 불규칙 raw 산출물은 `/ingest` 스킬로 반영: 사람이 `raw/<폴더>/`에 배치 → 미반영분 스캔 → pre-pass 분류 가드 → `spec-author` 증류 → **파일 1건씩 사람 승인** → wiki/index/log 기록 → okf-lint 게이트. (`on-confirm`은 이 일반 트리거의 화면 전용 특수화.)

**운영 루프** — capability 허브에서 그래프 진입 → 과거 why(log/decisions) 이해 → 코드+concept+ADR+log **원자적 동시 기록**(한 PR) → 동일 게이트.

## 6. 검증 (하이브리드)

- **결정적 스크립트 (PR 동기 게이트, 머지 차단)**: `okf-lint`(필수 frontmatter·enum·**구조적** 링크 유효성), `drift-check`(concept `code:` glob이 바뀐 파일과 겹치는데 미갱신 → 차단). `ci/` 에서 호출.
- **LLM 스킬 (야간 비동기)**: `wiki-lint` — **링크를 타고 다니며 의미적 모순** 탐지, orphan, 출처 누락. 비차단 진단 → `reports/wiki-lint/<날짜>.md`에 리포트(wiki/raw/index/log 안 씀). 발견은 `/ingest`·operate로 처리.

## 7. 불변규칙 (위반 = 게이트 실패)

1. `raw/` 는 불변 — 에이전트가 쓰지 않는다.
2. 모든 wiki 문서는 `sources:` 로 raw 출처를 기재한다(예외 없음).
3. concept 열거는 `index.md` 한 곳에만 — **인덱스 중복 금지**.
4. 코드 변경 시 영향 concept을 **같은 PR에서 동시 갱신**한다.
5. 문서는 한글로 작성(코드·식별자·enum은 원문 유지).

## 8. 검증 명령

```bash
node tools/okf-lint/src/cli.js wiki          # 이 프로젝트 wiki 번들 린트 (현재 clean)
node tools/okf-init/src/cli.js <대상디렉터리> # 신규 프로젝트 번들 스캐폴드
```

> 도구 코드 테스트·개발 명령(단일 테스트 실행 등)은 `tools/README.md` 참조.

> `commons-wiki/` 는 카탈로그(`index.md`)·레퍼런스 prose가 concept과 섞여 있어 아직 린트하지 않는다. okf-lint가 **예약 파일(`index.md`/`README.md`/`CLAUDE.md`)을 건너뛰는** 개선(sub-project A 후속) 후에 `okf-lint commons-wiki` 를 게이트에 넣는다.
