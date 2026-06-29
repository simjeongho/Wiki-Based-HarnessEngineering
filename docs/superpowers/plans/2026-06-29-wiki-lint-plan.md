# F — `wiki-lint` 야간 진단 스킬 Implementation Plan (eval + verify 주도)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development 또는 superpowers:executing-plans. 단 이 plan은 **TDD가 아니라 eval+verify 주도**다 — production 코드가 없다(스킬=프롬프트). "검증"은 (a) eval(루브릭 MUST/MUST NOT + 리포트 형식·위치 결정적 확인) + (b) end-to-end 수동 verify(2커밋 보존)다. 각 step은 체크박스(`- [ ]`).

**Goal:** okf-lint(구조 게이트) 위에서 의미적 모순·orphan·출처무결성을 링크 그래프를 타고 진단해 `reports/wiki-lint/<날짜>.md`에 비차단 리포트로 남기는 LLM 스킬 `wiki-lint`와, 그 행동을 고정하는 eval/verify를 만든다.

**Architecture:** `wiki-lint`는 `.claude/skills/wiki-lint/SKILL.md`(프롬프트)로 구현 — **메인 세션 또는 야간 cron에서 도는 진단 스킬**이다. wiki/raw/index/log를 쓰지 않고 리포트만 낸다. 검증은 `evals/wiki-lint/`(자기완결 시나리오) + 2커밋 수동 verify. 새 런타임 코드·새 의존성 없음(기존 `tools/okf-lint` CLI는 회귀 확인용으로만 재사용).

**Tech Stack:** Claude Code 스킬(.md), 기존 `tools/okf-lint` CLI(회귀 확인). 새 코드·의존성 없음.

## Global Constraints

spec(`docs/superpowers/specs/2026-06-29-wiki-lint-design.md`)와 상위 설계(`2026-06-25-...`)에서 verbatim:

- **FA1 산출물 범위:** 스킬 + eval만. cron 야간 배선은 후속(이 plan 비포함).
- **FA2 모순 탐지:** 링크 그래프 순회. 각 노드 + 1-hop 이웃(related/supersedes/본문 `[[ ]]`)만 LLM 컨텍스트에 올려 상충 판정.
- **FA3 supersession 제외:** `superseded_by`/`supersedes` 엣지로 이어진 쌍은 의도된 old↔new 대체 — 모순으로 보고하지 않음.
- **FA4 orphan:** 인바운드 `[[ ]]` 0인 candidate를 추린 뒤, capability 허브·index 진입점 같은 정당 root는 LLM이 제외. 진짜 고립만 보고.
- **FA5 출처 무결성:** 각 `sources[].path`가 디스크에 실제 존재하는지 점검. 없으면 dangling 보고.
- **FA6 리포트만:** wiki/raw/index/log 안 씀. `reports/wiki-lint/<YYYY-MM-DD>.md`에만 기록. 자동 수정 ❌.
- **FA7 리포트 위치:** `reports/wiki-lint/<YYYY-MM-DD>.md` (log/와 형제, 별도 최상위).
- **FA8 2커밋 보존:** eval/verify 중간 산출물은 스냅샷 커밋(박제)→원복 커밋(작업트리 clean).
- **불변규칙:** `raw/`·`wiki/`·`index.md`·`log/` 안 씀(wiki-lint는 reports/만 씀). 문서 한글, 코드·식별자·enum 원문.
- **전제:** okf-lint 통과(구조 clean) 가정 — 구조 검사 중복 안 함.
- 모든 명령은 저장소 루트에서 실행. 브랜치 `feat/wiki-lint`.

---

## File Structure

| 경로 | 책임 |
|---|---|
| `.claude/skills/wiki-lint/SKILL.md` | `wiki-lint` 스킬 정의 — frontmatter(name/description) + §5 알고리즘(그래프 구성→3탐지기 순회→리포트→비차단 종료) 인코딩 |
| `evals/wiki-lint/README.md` | eval+verify 실행·채점 규약(루브릭 + 리포트 형식/위치 결정적 확인 + 2커밋 verify) |
| `evals/wiki-lint/judge-prompt.md` | wiki-lint 전용 루브릭 채점 sub-agent 프롬프트 — 진단 **리포트**의 findings(모순/orphan/출처)를 시나리오 MUST/MUST NOT와 대조. spec-author judge-prompt의 *형식*(dispatch 템플릿 + 판정/MUST/MUST NOT 출력)만 차용, 도메인은 별개 |
| `evals/wiki-lint/scenarios/<Fxx-name>.md` | 자기완결 시나리오 1개=파일 1개 (사전 wiki 그래프 + 호출 + 기대 findings MUST/MUST NOT) |
| `evals/wiki-lint/RESULTS.md` | 실행 결과 + verify 스냅샷 커밋 해시 기록 |

> **구조 결정:** spec-author·ingest eval과 동형 — 시나리오는 디렉터리 트리 대신 자기완결 마크다운 1개. **코어부터 시작**(F1~F4: 모순 탐지·false-positive 회피·orphan·출처누락), 나머지(F5 클린·F6 다중 hop·F7 심각도)는 실패 발견 시 추가(성장형).

---

### Task 1: eval 하네스 + 규약 + 코어 시나리오 (F1~F4)

`wiki-lint`의 "성공의 정의"를 시나리오로 먼저 고정한다. 스킬이 없으니 이 시점엔 전부 미충족.

**Files:**
- Create: `evals/wiki-lint/README.md`
- Create: `evals/wiki-lint/judge-prompt.md`
- Create: `evals/wiki-lint/scenarios/F1-contradiction.md`
- Create: `evals/wiki-lint/scenarios/F2-no-false-positive.md`
- Create: `evals/wiki-lint/scenarios/F3-orphan.md`
- Create: `evals/wiki-lint/scenarios/F4-source-integrity.md`

**Interfaces:**
- Produces 시나리오 규약 + 채점 절차. Task 3가 이 패턴으로 실행.
- 시나리오 섹션 형식: `## 사전 wiki (path: wiki/<폴더>/<id>.md)` (여러 개 가능, fenced 블록에 frontmatter+본문) · `## raw 배치` (선택, sources 존재/부재 확인용) · `## 호출` · `## 기대 (rubric)` (MUST / MUST NOT).

- [ ] **Step 1: 실행·채점 규약 작성** (`README.md`)

  내용에 반드시 포함:
  - eval은 spec-author·ingest와 동형 — 시나리오=자기완결 마크다운 1파일. 디렉터리 트리 안 만듦.
  - **셋업(흉내):** 시나리오의 `사전 wiki`·`raw 배치` 블록을 스크래치패드 임시 번들에 펼친다(실제 `wiki/` 안 건드림). `wiki-lint` 흐름을 그 번들 기준으로 수행, 리포트는 임시 번들의 `reports/wiki-lint/<날짜>.md`에 쓴다.
  - **채점 — 결정적 트랙:** (a) 리포트 파일이 `reports/wiki-lint/<날짜>.md` 경로·형식(요약 줄 + 카테고리 섹션)으로 생성됐는가? (b) 출처 무결성(F4)은 디스크 존재 여부라 결정적 — dangling path가 보고됐는가?
  - **채점 — 루브릭 트랙:** `evals/wiki-lint/judge-prompt.md`(이 폴더 전용, Step 1b에서 작성)의 judge sub-agent(또는 사람)로 MUST/MUST NOT 채점. spec-author judge-prompt는 *형식만* 참고하고 도메인(리포트 채점)은 wiki-lint 전용으로 새로 쓴다.
  - **원칙:** wiki-lint는 `reports/`에만 쓴다(wiki/raw/index/log 불변). eval 중간 산출물(임시 번들·리포트·judge 채점)은 스크래치패드에서 버린다. 영구 보존은 `scenarios/`·`RESULTS.md`뿐.
  - **코어 4 + 성장 backlog** 명시: F5(클린 그래프 0·0·0)·F6(다중 hop 모순)·F7(심각도 등급)은 실패 모드 만날 때 추가.

- [ ] **Step 1b: wiki-lint 전용 judge-prompt 작성** (`evals/wiki-lint/judge-prompt.md`)

  spec-author judge-prompt의 *형식*(dispatch 템플릿 + `### 판정: PASS|FAIL` / `### MUST` / `### MUST NOT` / `### 코멘트` 출력)만 차용하되, 채점 대상·방법을 wiki-lint 도메인으로 새로 쓴다:
  - judge는 read-only로 채점만, 파일 안 건드림.
  - 입력 placeholder: `[SCENARIO_MD]`(시나리오 전체) + `[REPORT_MD]`(wiki-lint가 낸 `reports/wiki-lint/<날짜>.md` 전체).
  - 채점 방법: 시나리오 rubric의 MUST/MUST NOT 각 항목을 **리포트의 findings**(모순 쌍+근거 인용 / orphan 목록 / 출처누락 목록)와 대조. 근거 없는 모호 보고나 false-positive(정상 쌍·supersession을 모순으로 보고, 허브를 orphan으로 보고)는 MUST NOT 위반으로 판정.
  - 출력은 spec-author judge와 동일 형식(`### 판정` / `### MUST` / `### MUST NOT` / `### 코멘트`).

- [ ] **Step 2: F1 작성** (`scenarios/F1-contradiction.md`) — 모순 탐지

  사전 wiki 2개 + 기대. 핵심 내용:
  - `## 사전 wiki (path: wiki/entities/order.md)` — frontmatter(id: order, type: entity, title, status: confirmed, sources: [raw/data-models/order.md]) + 본문에 `status` enum = `pending / paid / shipped / cancelled`, 그리고 `[[policies/refund-rule]]` 링크.
  - `## 사전 wiki (path: wiki/policies/refund-rule.md)` — frontmatter(id: refund-rule, type: policy, title, status: confirmed, sources: [raw/business-policies/refund-rule.md]) + 본문에 "환불 시 `status`를 `refunded`로 전이" (order enum에 `refunded` 없음 → 상충).
  - `## 호출` — `wiki-lint — wiki 그래프 진단해 리포트 남겨줘.`
  - `## 기대 (rubric)`:
    - **MUST:** `[[entities/order]] ↔ [[policies/refund-rule]]` 쌍을 모순으로 보고 + 근거 인용("order enum에 refunded 없음" / "refund-rule이 refunded 전제"). 리포트가 `reports/wiki-lint/<날짜>.md`에 생성.
    - **MUST NOT:** 근거 없는 모호 보고. wiki/raw/index/log에 쓰기.

- [ ] **Step 3: F2 작성** (`scenarios/F2-no-false-positive.md`) — 모순 false-positive 회피

  사전 wiki 2쌍 + 기대. 핵심 내용:
  - (a) **일관 쌍:** `wiki/entities/member.md`(status enum 포함) + `wiki/policies/login-rule.md`가 member를 `[[entities/member]]`로 링크하되 enum과 상충 없는 규칙 명시 → 모순 아님.
  - (b) **supersession 쌍:** `wiki/decisions/auth-v1.md`(status: deprecated, `superseded_by: [[decisions/auth-v2]]`, 본문 "세션 기반 인증") + `wiki/decisions/auth-v2.md`(status: confirmed, `supersedes: [[decisions/auth-v1]]`, 본문 "JWT 기반 인증"). 둘이 다른 말을 하지만 supersession 엣지 → FA3 제외.
  - `## 기대 (rubric)`:
    - **MUST:** 두 쌍 모두 모순으로 **보고하지 않음**(조용히 통과). supersession 쌍의 차이를 모순으로 오보하지 않음(FA3).
    - **MUST NOT:** 정상 일관 쌍을 모순으로 보고. deprecated↔현행 대체 쌍을 모순으로 보고.

- [ ] **Step 4: F3 작성** (`scenarios/F3-orphan.md`) — orphan 탐지 + 정당 root 제외

  사전 wiki 3개 + 기대. 핵심 내용:
  - `wiki/capabilities/payment.md` — type: capability(SPINE 허브). 인바운드 링크 없음(허브는 root). 본문에서 `[[entities/order]]`를 링크(아웃바운드).
  - `wiki/entities/order.md` — payment 허브가 링크함(인바운드 1) → orphan 아님.
  - `wiki/queries/legacy-batch.md` — 아무도 `[[ ]]`로 안 가리킴(인바운드 0), 허브도 아님 → 진짜 orphan.
  - `## 기대 (rubric)`:
    - **MUST:** `[[queries/legacy-batch]]`를 orphan으로 보고. `[[capabilities/payment]]`(허브, 정당 root)는 orphan으로 **보고 안 함**.
    - **MUST NOT:** capability 허브를 orphan으로 오보. 인바운드 있는 order를 orphan으로 오보.

- [ ] **Step 5: F4 작성** (`scenarios/F4-source-integrity.md`) — 출처 무결성

  사전 wiki 2개 + raw 배치 + 기대. 핵심 내용:
  - `wiki/entities/member.md` — sources: [`raw/data-models/member.md`]. **raw 배치에 member.md를 두지 않음** → dangling(디스크에 없음).
  - `wiki/entities/order.md` — sources: [`raw/data-models/order.md`]. **raw 배치에 order.md를 둠** → 정상.
  - `## raw 배치` — `raw/data-models/order.md`만 존재(member.md 없음).
  - `## 기대 (rubric)`:
    - **MUST:** `[[entities/member]]`의 sources[0].path가 디스크에 없음을 출처누락으로 보고. order는 정상이라 보고 안 함.
    - **MUST NOT:** 존재하는 order의 출처를 누락으로 오보. raw에 쓰기.

- [ ] **Step 6: 커밋**

```bash
git add evals/wiki-lint/README.md evals/wiki-lint/judge-prompt.md evals/wiki-lint/scenarios
git commit -m "test(wiki-lint): add eval harness + judge-prompt + core scenarios (F1-F4)"
```

> **성장 backlog(비차단):** F5(클린 그래프 0·0·0 리포트)·F6(다중 hop 전이 모순)·F7(심각도 등급)은 실패 모드 만날 때 추가.

---

### Task 2: `wiki-lint` 스킬 정의

스킬 본체. 프롬프트가 spec §5 알고리즘을 인코딩하고, 리포트만 쓰며(FA6), 구조 검사는 okf-lint에 맡긴다(전제).

**Files:**
- Create: `.claude/skills/wiki-lint/SKILL.md`

**Interfaces:**
- Produces `wiki-lint` 스킬. 입력: 호출(인자 없음, wiki/ 전체 스캔). 출력: `reports/wiki-lint/<YYYY-MM-DD>.md`.
- Consumes: 없음(독립 진단). 회귀 확인용으로만 `node tools/okf-lint/src/cli.js wiki`.

- [ ] **Step 1: frontmatter + 역할**

  `name: wiki-lint`, description: "wiki 그래프를 순회하며 의미적 모순·orphan·출처무결성을 진단해 비차단 리포트(reports/wiki-lint/<날짜>.md)로 남긴다. 야간 배치 또는 수동 호출. okf-lint(구조 게이트) 통과를 전제로 그 위 의미 계층만 본다."

  본문 역할 명시: "너는 비차단 진단 스킬이다. wiki/raw/index/log를 절대 쓰지 않고 `reports/`에만 리포트를 낸다. 발견은 다음날 사람/AI가 /ingest·operate로 처리한다." + 설계 근거 포인터(`docs/superpowers/specs/2026-06-29-wiki-lint-design.md`, 스키마 `CLAUDE.md`).

- [ ] **Step 2: 알고리즘 인코딩** (spec §5)

  - **[1] 그래프 구성:** `wiki/**/*.md`의 각 파일 = 노드. frontmatter `related`/`supersedes`/`superseded_by` + 본문의 `[[폴더/id]]` = 엣지. `commons-wiki/**`는 링크 해소 컨텍스트로만, 1차 스캔 대상은 프로젝트 `wiki/`.
  - **[2] 탐지기 순회:**
    - **모순(FA2/FA3):** 각 노드 N에 대해 N + 1-hop 이웃을 함께 읽어 상충하는 사실/규칙이 있는지 판정. **supersession 엣지(`superseded_by`/`supersedes`)로 이어진 쌍은 건너뛴다**(의도된 old↔new 대체). 보고 단위 = 상충 쌍 + 근거 인용.
    - **orphan(FA4):** 인바운드 `[[ ]]` 0인 노드를 모은다. 그중 capability 허브·index에서만 닿는 진입점 같은 **정당 root는 제외**. 그 외 진짜 고립만 보고.
    - **출처(FA5):** 각 노드의 `sources[].path`가 디스크에 실제 존재하는지 확인. 없으면(raw 이동·삭제 dangling) 보고. (sources 비어있음은 okf-lint 소관 — 중복 안 함.)
  - **[3] 리포트 작성:** `reports/wiki-lint/<YYYY-MM-DD>.md`에 spec §6 형식으로 — 요약 줄(`## 요약: 모순 N · orphan M · 출처누락 K`) + 카테고리별 섹션(근거 인용 포함) + `## 처리 안내`. 클린이면 `요약: 0·0·0` 리포트.
  - **[4] 비차단 종료:** 리포트만 남기고 끝. 머지 차단 없음.

- [ ] **Step 3: 정직성·경계 규칙**

  - wiki/raw/index/log 절대 안 씀 — `reports/`만(FA6).
  - 구조 검사(깨진 링크·필수필드·enum) 중복 ❌ — okf-lint 소관(통과 전제).
  - 모순은 **근거 인용 필수** — 추측·모호 보고 금지. 확신 없으면 보고하지 말고(false-positive 회피) 필요 시 "확인 필요"로 표기.
  - supersession 쌍은 모순 아님(FA3).

- [ ] **Step 4: 스킬 추가가 프로젝트 wiki 린트에 영향 없음 회귀 확인**

Run: `node tools/okf-lint/src/cli.js wiki`
Expected: `okf-lint: OK`

- [ ] **Step 5: 커밋**

```bash
git add .claude/skills/wiki-lint/SKILL.md
git commit -m "feat(wiki-lint): add nightly diagnostic skill (graph crawl: contradiction/orphan/source-integrity)"
```

---

### Task 3: eval 실행 + end-to-end verify (2커밋) + 프롬프트 반복

스킬을 코어 시나리오에 돌려 채점하고(GREEN), 실제 wiki fixture로 end-to-end verify한다. controller가 직접 수행(스킬 실행 + 채점).

**Files:**
- Create: `evals/wiki-lint/RESULTS.md`
- Modify: `.claude/skills/wiki-lint/SKILL.md` (실패 기반 반복)

- [ ] **Step 1: 코어 시나리오 실행 (F1~F4)**

  README 절차대로 각 시나리오의 `사전 wiki`·`raw 배치`를 스크래치패드 임시 번들에 펼치고 `wiki-lint` 흐름을 수행. (a) 결정적 채점(리포트 경로·형식, F4 dangling 보고) + (b) 루브릭(judge 또는 controller) MUST/MUST NOT. 결과를 `RESULTS.md`에 시나리오별 1행 + 근거로 기록.

- [ ] **Step 2: end-to-end 수동 verify (spec §8 B) — 실제 repo, 2커밋(FA8)**

  fixture wiki 그래프(모순 1·orphan 1·출처누락 1을 포함한 4~5 concept)를 **실제 `wiki/`에 두고** `wiki-lint`를 실제 호출, 그래프 순회→3탐지기→리포트 생성이 한 흐름으로 도는지 관찰:

  1. fixture를 `wiki/`에 펼치고(필요한 raw도 `raw/`에, 단 출처누락 검증용 1건은 일부러 누락), `wiki-lint` 실행 → `reports/wiki-lint/<날짜>.md` 생성. 중간 산출물(발견 목록 등)을 `evals/wiki-lint/runs/<날짜>.md`로 저장(가시화).
  2. **스냅샷 커밋** — 산출물 전부 커밋(히스토리에 박제):
     ```bash
     git add wiki/ raw/ reports/ evals/wiki-lint/runs/
     git commit -m "test(wiki-lint): e2e verify run snapshot — artifacts for review (reverted next commit)"
     ```
  3. **원복 커밋** — fixture wiki·생성 리포트·runs/ 를 되돌려 실제 번들을 깨끗이:
     ```bash
     git revert --no-edit HEAD
     ```
     → 두 커밋(스냅샷 + 되돌림)이 모두 히스토리에 남아 "뭐가 나왔는지" 언제든 `git show <스냅샷>`으로 확인 가능, 작업트리는 clean.
  4. 원복 후 회귀: `node tools/okf-lint/src/cli.js wiki` → `okf-lint: OK` (테스트 찌꺼기 없음 확인).

- [ ] **Step 3: 실패 분류 + 프롬프트 수정**

  FAIL을 모아 SKILL.md 해당 단계 보강(예: 모순 false-positive가 났으면 [2] 모순 판정에 "확신 없으면 보고 안 함" 강화, supersession 오보면 FA3 규칙 강조). 수정 후 실패분만 재실행.

- [ ] **Step 4: 통과 확인**

  `RESULTS.md`에서 코어 시나리오 루브릭 PASS + 리포트 형식/위치 결정적 OK 확인. verify에서 리포트가 올바른 경로에 생성되고 원복 후 `okf-lint: OK`임을 기록. **스냅샷 커밋 해시**를 RESULTS.md에 기록(산출물 영구 추적용).

- [ ] **Step 5: 커밋 (영구 테스트 자산)**

```bash
git add evals/wiki-lint/RESULTS.md .claude/skills/wiki-lint/SKILL.md
git commit -m "test(wiki-lint): run eval + e2e verify (2-commit), tune skill prompt to green"
```

> **남는 것/버리는 것:** `scenarios/`·`README.md`·`judge-prompt.md`·`RESULTS.md`는 영구(커밋). verify 실행 산출물(fixture wiki·생성 리포트·`runs/*`)은 **스냅샷 커밋으로 히스토리에만 보존하고 원복 커밋으로 작업트리에서 제거**. 임시 lint 디렉터리는 스크래치패드(repo 밖)에 만들고 커밋하지 않는다.

---

## 문서 반영 (마지막 커밋)

- [ ] **PROJECT_STATUS.md**: 로드맵 표 F를 ✅로, 변경 로그에 `wiki-lint` 랜딩 기록. OQ#5를 "해소(방향 확정: 링크 그래프 순회 크롤러)"로 갱신.
- [ ] **CLAUDE.md §6 검증**: 야간 LLM 스킬 줄에 `wiki-lint`가 리포트를 `reports/wiki-lint/<날짜>.md`에 낸다는 포인터 1줄 검토(과증식 주의 — 포인터 수준). §2 폴더 구조에 `reports/` 1줄 추가.
- [ ] 커밋:

```bash
git add PROJECT_STATUS.md CLAUDE.md
git commit -m "docs: wiki-lint skill (F) landed; OQ#5 resolved (graph-crawl direction)"
```

---

## Self-Review

**1. spec 커버리지:**
- FA1 산출물=스킬+eval → Task 2 + Task 1/3. cron 제외 확인. ✓
- FA2 링크 그래프 순회 → Task 2 Step 2 [1][2] + F1. ✓
- FA3 supersession 제외 → Task 2 Step 2 모순 + Step 3 + F2(b). ✓
- FA4 orphan + 정당 root 제외 → Task 2 Step 2 orphan + F3. ✓
- FA5 출처 무결성 → Task 2 Step 2 출처 + F4. ✓
- FA6 리포트만 → Task 2 Step 1/3 + 모든 시나리오 MUST NOT(쓰기 금지). ✓
- FA7 리포트 위치 → Task 2 Step 2 [3] + Task 1 결정적 채점. ✓
- FA8 2커밋 보존 → Task 3 Step 2. ✓
- §6 리포트 형식 → Task 2 Step 2 [3]. ✓
- §8 검증 분리(eval A + verify B) → Task 1 · Task 3 Step 1/2. ✓
- §11 okf-lint/spec-author 무수정 → 본 plan은 두 파일 안 건드림(okf-lint는 회귀 확인 호출만). ✓

**2. placeholder 스캔:** 코드 step 없음(스킬/시나리오는 내용 제시 또는 spec §5·§6·§8 참조). "적절히 처리"류 없음. 각 시나리오 Step에 사전 wiki·기대 MUST/MUST NOT 구체 명시.

**3. 타입 정합성:** 리포트 경로(`reports/wiki-lint/<YYYY-MM-DD>.md`)·요약 형식(`모순 N · orphan M · 출처누락 K`)·시나리오 섹션 키(`사전 wiki`/`raw 배치`/`호출`/`기대`)가 Task 1·2·3에서 일관. 탐지기 3종(모순/orphan/출처) 명칭 일관. okf-lint 호출(`wiki`)이 Task 2 Step 4·Task 3 Step 2-4에서 동일.

**주의(비-TDD):** red-green 코드 사이클 없음. wiki-lint는 리포트 산출·판단이 끼어 완전 자동 eval이 어렵다 — 루브릭+형식 결정적 부분만 eval, 진단 품질은 수동 verify. Task 3는 controller 직접 수행이 적합.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-29-wiki-lint-plan.md`. 실행 옵션:**

**1. Subagent-Driven (recommended)** — Task 1(시나리오)·Task 2(스킬 작성)는 fresh subagent로, **Task 3(eval 실행·2커밋 verify)는 controller 직접 수행**. 태스크별 리뷰 게이트.

**2. Inline Execution** — 프롬프트·eval 작업 특성상 이 세션에서 직접 작성·채점·verify하며 반복(executing-plans, 체크포인트).

**어느 쪽으로 진행할까요?**
