# 프로젝트 상태 — LLM-Wiki 기반 OKF SI 바이브코딩 하네스

> 전체 프로젝트의 계획·로드맵·진행 상황을 추적하는 **단일 상태 문서**.
> 작업이 진행될 때마다 이 파일을 갱신한다 (하단 [변경 로그](#변경-로그) + 로드맵 표의 상태).
> 최종 갱신: **2026-06-29**

---

## 1. 비전

SI 프로젝트 산출물을 입력으로, **구축이 끝나는 순간 시스템의 스펙·도메인 지식(왜)·운영 데이터가 LLM-Wiki로 함께 완성**되는 AI 바이브코딩 하네스. Andrej Karpathy의 LLM Wiki 구조 + Google **OKF(Open Knowledge Format)** 를 결합하고, 그 위에 SI 전용 확장과 운영 루프를 얹는다. 최종 산출물은 한 프로젝트의 wiki가 아니라 **어떤 SI든 채택하면 OKF 기반 LLM-Wiki가 자동 축적되는 재사용 프레임워크(`okf-commons`)**.

## 2. 참조 문서

- 설계 spec: [`docs/superpowers/specs/2026-06-25-llm-wiki-okf-si-harness-design.md`](docs/superpowers/specs/2026-06-25-llm-wiki-okf-si-harness-design.md)
- 구현 계획 (sub-project A): [`docs/superpowers/plans/2026-06-26-okf-foundation-templates-lint.md`](docs/superpowers/plans/2026-06-26-okf-foundation-templates-lint.md)

## 3. 아키텍처 요약

- **2계층**: 사내 공통 `okf-commons`(상속) + 프로젝트 레이어(`raw/ wiki/ log/ src/`).
- **3계층 저장**: `raw/`(불변 원본) + `wiki/`(LLM 작성 OKF 번들) + `CLAUDE.md`(schema). 단일 `index.md` 카탈로그가 진입점.
- **하이브리드 검증** (핵심 설계 결정):
  - 기계적 판정(필수필드·enum·깨진 링크) = **결정적 스크립트**가 PR에서 머지 차단 (`okf-lint`, `drift-check`).
  - 판단·해석(작성 품질, 링크 따라가는 의미적 모순) = **LLM 스킬** (야간 `wiki-lint` 등, 비동기).

## 4. Sub-project 로드맵

각 sub-project는 자체 spec → plan → 구현 사이클을 가진다(설계 spec §11).

| ID | Sub-project | 산출물 | 블로킹(§10) | 상태 |
|----|-------------|--------|------------|------|
| **A** | OKF 토대 + 템플릿 + okf-lint | `templates/`(10종), `tools/okf-lint`, `tools/okf-init` | — | ✅ **완료** (PR [#1](https://github.com/simjeongho/Wiki-Based-HarnessEngineering/pull/1), branch `feat/okf-foundation`) |
| **B** | drift-check + PR 게이트 | 코드 glob 드리프트 머지 차단 | OQ#1 | ⏳ 대기 (계획 전) |
| **C** | define-screen 스킬 + 화면정의서 구조 | PI 화면 정의→확정→raw ingest | OQ#2 | ⏳ 대기 (계획 전) |
| **D** | spec-author SDD agent (정합 엔진 D') | raw→concept 증류·정합 제안 (생성/갱신/대체) | OQ#4(부분해소) | ✅ **완료** — 에이전트 + eval 코어 8/8, self-check 하드닝, PR [#6](https://github.com/simjeongho/Wiki-Based-HarnessEngineering/pull/6) 머지 |
| **H** | `/ingest` 스킬 (raw 배치 동기화 래퍼) | 미반영 raw 스캔 → pre-pass 분류가드 → spec-author 증류 → 사람 승인 → wiki/index/log 원자적 기록 | OQ#4(부분해소) | ✅ **완료** — 스킬(`.claude/skills/ingest/`) + eval 코어 4/4 + e2e verify(라이브 1회, 2커밋). branch `feat/ingest-skill` |
| **E** | tdd-implementer + code-review 플로우 | 구현 루프, `code:`/`last_verified` 확정 | — | ⏳ 대기 (계획 전) |
| **F** | wiki-lint 야간 배치 (LLM) | 모순·orphan·출처누락 — **링크 따라가는 의미적 모순 탐지** | OQ#5 | ⏳ 대기 (계획 전) |
| **G** | operate agent | 운영 수정 루프 (그래프 진입→원자적 동시 기록) | — | ⏳ 대기 (계획 전) |

**상태 범례:** ✅ 완료 · 🚧 진행중 · 📝 계획중 · ⏳ 대기 · ⛔ 블로킹

**다음 권장 순서:** **H**(`/ingest`) 완료 — 첫 end-to-end ingest 루프 라이브 검증됨. 이후 **F**(의미적 모순 탐지, 불규칙 ingest로 우선도 상승) / **C**(화면정의 진입점, ①을 ②의 특수화로 정렬). B·C·F는 해당 열린 질문 확정이 선행.

## 5. 열린 질문 추적 (설계 spec §10)

| # | 질문 | 영향 sub-project | 상태 |
|---|------|------------------|------|
| OQ#1 | PR 게이트 판정 기준 (드리프트 true/false positive, 머지 차단 범위, 사람 오버라이드) | B | 미해결 |
| OQ#2 | 화면 스키마 직렬화 형식 (md 내 YAML vs 별도 `.schema.json`) | C | 미해결 |
| OQ#3 | commons→project 상속 메커니즘 (링크 vs 복사 vs 심볼릭) | A(후속)/전반 | 미해결 |
| OQ#4 | SDD 자동/수동 경계 | D | 미해결 |
| OQ#5 | 야간 wiki-lint 모순 탐지 알고리즘 | F | 미해결 (방향: "링크 그래프 순회 LLM 크롤러") |
| OQ#6 | processes/ ↔ capabilities/ 경계·중복 규약 | D/E | 미해결 |

## 6. 미해결 후속 항목 (비차단)

- ✅ **okf-lint 예약 파일 skip** — `index.md`/`README.md`/`CLAUDE.md` 를 concept으로 오인하지 않도록 skip. (2026-06-27 완료, branch `feat/okf-supersession`). 단, `commons-wiki/` 게이트 편입은 루트 prose 파일(design-system.md/glossary.md) 처리가 추가로 필요 — 후속.
- **A 후속** (commons 작업 시작 시): `okf-lint` CLI `--commons` 인자 순서 누수 수정; `FOLDER_TO_TYPE`/`REQUIRED_FIELDS` deepEqual 드리프트 가드 추가.

---

## 변경 로그

- **2026-06-29**
  - ✅ **Sub-project H 완료 — `/ingest` 스킬** (`.claude/skills/ingest/SKILL.md`). raw 배치 동기화 트리거: 사람이 `raw/<폴더>/`에 배치 → /ingest가 **미반영 raw**(wiki `sources` 스캔 기준)만 훑어 spec-author 증류 → **파일 1건씩 순차 사람 승인** → wiki/index/log 원자적 기록 → okf-lint 게이트. 핵심 결정 — HA1(배치 트리거, 분류는 사람 배치로 끝남), HA3(**pre-pass 분류 가드**: 폴더≠내용 오배치만 advisory 보고, raw 불변), HA5(D' 출력 `operations`/`index_rows`/`log_entries` 재사용), HA7(게이트는 실제 okf-lint 실행이 진실). D' 프롬프트 수정 불필요. **검증**: eval 코어 4/4(H1·H3·H5·H7, spec-author 실제 dispatch + 샌드박스 독립 lint) + **e2e verify 라이브 1회**(클린 슬레이트, 3 fixture, 2커밋 스냅샷→원복). spec `2026-06-29-ingest-skill.md`, plan 동명. branch `feat/ingest-skill`. 백로그: 미반영 판정 고도화(변경된 raw 재감지), 스테이징 승인, operation별 부분 승인, eval H2/H4/H6/H8. **새 production 코드 0 — eval+verify 주도**.
  - 🧰 **개발 명령 분리** — `tools/README.md` 신설(okf-lint/okf-init 테스트·실행·단일테스트), `CLAUDE.md` §8에 포인터 1줄. CLAUDE.md는 스키마 본문 유지(간결성).
- **2026-06-27**
  - 🚧 **Sub-project D 착수 — spec-author 정합 엔진(D')** — `.claude/agents/spec-author.md`(제안 전용·쓰기 tool 미부여로 "작성≠기록" 구조적 강제) + eval 스위트(`evals/spec-author/`, 자기완결 시나리오 8). **eval-주도**(TDD 아님): 정합성=okf-lint 독립검증 + 루브릭=judge sub-agent. 코어 8/8 통과(E03은 시나리오 보강 후 재실행). 발견: 에이전트 self-check 자기보고 신뢰 불가 → 외부 게이트가 진실(DA5 백스톱 입증). spec `2026-06-27-spec-author-reconcile.md`, plan 동명. branch `docs/spec-author-reconcile`. **OQ#6 해소**(process=흐름 소유/2+capability 시만 생성, capability=related 역링크). 후속: H(`/ingest` 얇은 래퍼), D' 프롬프트 보강(정직한 self-check), 성장 backlog 시나리오 6.
  - 📐 **설계 보강 — ingest/reconcile/supersession** (설계 spec §5·§7·§9·§10 갱신). 빌드/운영을 "트리거 3개(화면 확정·raw 산출물 ingest·코드 변경) + 공유 등뼈"로 통합. raw 산출물 ingest 시 concept 생성·갱신은 **사람 승인 선행**(OQ#4 부분 해소). 과거 결정은 삭제 대신 **대체(supersession)** 로 보존.
  - ✅ **okf-lint supersession 토대** — 예약 파일 skip(`lint.js`), `supersedes`/`superseded_by` 교차링크 추출(`links.js`), `superseded_by`→`status: deprecated` 규칙(`schema.js`), 대체 체인 골든 fixture. 테스트 28/28, TDD(subagent-driven). 태스크별 리뷰 4회 + 최종 전체-브랜치 리뷰(Critical/Important 0). branch `feat/okf-supersession`.
  - ⏳ 후속 sub-project로 분리: **H** ingest 스킬(일반화 트리거), **D'** spec-author 정합 모드, **F** wiki-lint(불규칙 ingest로 우선도 상승). 이들은 프롬프트 작업이라 TDD가 아닌 eval+게이트+verify 흐름.

- **2026-06-26**
  - 📄 본 상태 문서 생성.
  - ✅ **Sub-project A 완료** — `okf-lint`(frontmatter·schema·links·lint·cli), `okf-init`(스캐폴드), `templates/`(10종). 테스트 26/26 통과, TDD. 태스크별 리뷰 7회 + 최종 전체-브랜치 리뷰(Critical/Important 0). PR #1 생성 (`main` ← `feat/okf-foundation`).
  - ✅ **프레임워크 스켈레톤 + 스키마 (§3.1 통합 트리) 완료** — `CLAUDE.md`(OKF schema), `commons-wiki/`, `.claude/{agents,hooks,rules}`, `ci/`, 프로젝트 번들(`raw/ log/ wiki/ src/ index.md`) 스캐폴드. **폴더명 전부 영어 ASCII**(경로/인코딩 안전). PR #2(스켈레톤) → PR #3(`main` 통합) 머지 완료. feature 브랜치 정리됨.
  - 📐 설계 spec(2026-06-25) 및 sub-project A 구현 계획(2026-06-26) 확정.
