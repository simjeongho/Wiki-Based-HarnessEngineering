# H — `/ingest` 스킬 Implementation Plan (eval + verify 주도)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development 또는 superpowers:executing-plans. 단 이 plan은 **TDD가 아니라 eval+verify 주도**다 — production 코드가 없다(스킬=프롬프트). "검증"은 (a) 결정적 부분 eval(미반영 판정·pre-pass·기록 후 okf-lint) + (b) end-to-end 수동 verify(승인 UX)다. 각 task는 체크박스(`- [ ]`).

**Goal:** 사람이 `raw/<category>/`에 배치한 산출물 중 **미반영분**을 찾아 spec-author(D')로 증류 → **사람 승인** → wiki/index/log에 원자적 기록하는 얇은 오케스트레이터 스킬 `/ingest`와, 그 행동을 고정하는 eval/verify를 만든다.

**Architecture:** `/ingest`는 `.claude/skills/ingest/SKILL.md`(프롬프트)로 구현 — **메인 세션에서 도는 오케스트레이터**다(사람 승인·디스크 쓰기가 필요하므로 sub-agent 아님). 증류는 `spec-author` sub-agent에 위임(읽기 전용 제안 엔진). 검증은 `evals/ingest/`(결정적 시나리오) + 수동 verify.

**Tech Stack:** Claude Code 스킬(.md), 기존 `spec-author` 에이전트, 기존 `tools/okf-lint` CLI. 새 런타임 코드·새 의존성 없음.

## Global Constraints

spec(`docs/superpowers/specs/2026-06-29-ingest-skill.md`)와 상위 설계(`2026-06-25-...`)에서 verbatim:

- **HA1 배치 트리거:** 사람이 raw를 폴더에 배치 → /ingest는 미반영분 전체를 훑음. 분류·배치는 사람.
- **HA2 미반영 판정:** wiki `sources[].path` 스캔 = 이미 반영된 raw 집합. raw/ 중 그에 없는 것 = 미반영.
- **HA3 pre-pass 가드:** 배치 시작 시 폴더 vs 내용 점검, **불일치만** 모아 보고, 사람 결정. raw 이동 ❌.
- **HA4 순차 승인:** 파일 1건씩 제안→승인→기록→다음.
- **HA5 기록 재사용:** D' 출력 `operations`(content)·`index_rows`·`log_entries`를 그대로 write — 발명 ❌.
- **HA6 전체 승인:** 한 파일의 제안(딸린 operations 묶음) 통째 승인. operation별 부분승인 ❌(백로그).
- **HA7 게이트 진실:** 기록 후 `node tools/okf-lint/src/cli.js wiki` 실제 실행이 진실 — 자기보고 갈음 ❌.
- **불변규칙:** `raw/` 불변(에이전트 안 씀). 모든 wiki는 `sources` 필수. 교차링크 `[[<폴더>/<id>]]` 대상 존재 시만 유효. 문서 한글, 코드·식별자·enum 원문.
- 모든 명령은 저장소 루트에서 실행.

---

## File Structure

| 경로 | 책임 |
|---|---|
| `.claude/skills/ingest/SKILL.md` | `/ingest` 스킬 정의 — frontmatter(name/description) + §3 4단계 흐름 인코딩 |
| `evals/ingest/README.md` | eval+verify 실행·채점 규약 |
| `evals/ingest/scenarios/<Hxx-name>.md` | 자기완결 시나리오 1개=파일 1개 (사전 wiki 상태 + raw 배치 + 호출 + 기대) |
| `evals/ingest/RESULTS.md` | 실행 결과 기록 |

> **구조 결정:** spec-author eval과 동형 — 시나리오는 디렉터리 트리 대신 자기완결 마크다운 1개. **코어부터 시작**(H1·H3·H5·H7가 핵심: 미반영판정·오배치·worthy처리·기록정합성), 나머지(H2·H4·H6·H8)는 실패 발견 시 추가(성장형).

---

### Task 1: eval 하네스 + 규약 + 코어 시나리오

`/ingest`의 "성공의 정의"를 시나리오로 먼저 고정한다. 스킬이 없으니 이 시점엔 전부 미충족.

**Files:**
- Create: `evals/ingest/README.md`
- Create: `evals/ingest/scenarios/H1-detect-unreflected.md` (사전 wiki에 일부 raw 반영됨 → 미반영분만 골라야)
- Create: `evals/ingest/scenarios/H3-prepass-misfile.md` (data-model이 meetings 폴더에 → 오배치 보고)
- Create: `evals/ingest/scenarios/H5-worthy-false.md` (잡담 회의록 → 보고 후 raw 보존, 다음으로)
- Create: `evals/ingest/scenarios/H7-record-conformance.md` (승인 후 기록 결과가 okf-lint OK)

**Interfaces:** Produces 시나리오 규약(`## 사전 wiki`, `## raw 배치`, `## 호출`, `## 기대(MUST/MUST NOT)`) + 채점 절차. Task 3가 이 패턴으로 실행.

- [ ] **Step 1: 실행·채점 규약 작성** (`README.md`) — 채점 2트랙: (a) 결정적(미반영 목록 정확도·pre-pass 탐지·기록 후 okf-lint exit 0) + (b) 루브릭(judge 또는 사람). 승인은 eval에서 controller가 자동 승인으로 흉내.
- [ ] **Step 2: H1, H3 작성** — 미반영 판정 / pre-pass 오배치. MUST/MUST NOT은 spec §6 (A) 표가 진실.
- [ ] **Step 3: H5, H7 작성** — worthy:false 처리 / 기록 후 정합성.
- [ ] **Step 4: 커밋**

```bash
git add evals/ingest/README.md evals/ingest/scenarios
git commit -m "test(ingest): add eval harness + core scenarios (H1,H3,H5,H7)"
```

> **성장 backlog(비차단):** H2(미반영 0건)·H4(pre-pass 정상통과 무소음)·H6(승인 거절 시 변경 0)·H8(배치 순차성)은 실패 모드 만날 때 추가.

---

### Task 2: `/ingest` 스킬 정의

스킬 본체. 프롬프트가 spec §3 4단계 흐름을 인코딩하고, 증류는 spec-author에 위임하며, 기록은 D' 출력을 재사용한다.

**Files:**
- Create: `.claude/skills/ingest/SKILL.md`

**Interfaces:** Produces `/ingest` 스킬. 입력: 사람의 호출(인자 없음, raw/ 전체 스캔). 출력: 승인분의 wiki/index/log 변경 + 게이트 결과.

- [ ] **Step 1: frontmatter + 역할** — `name: ingest`, description(raw 배치 동기화: 미반영 스캔→증류→승인→기록). "메인 세션 오케스트레이터, 증류는 spec-author 위임, raw 안 씀" 명시.
- [ ] **Step 2: 4단계 흐름 인코딩** (spec §3):
  - **[1] 스캔(HA2):** wiki/** 의 frontmatter `sources[].path` 전부 수집 → 이미 반영된 raw 집합. raw/** 중 그에 없는 파일 = 미반영. 0건이면 보고 후 종료.
  - **[2] pre-pass(HA3):** 미반영 각 파일의 폴더 vs 헤더/앞부분 내용 점검. 불일치만 한 번에 보고("raw/.../x.md → data-model로 보임"), 사람 결정(진행/정리 후 재호출). 일치는 조용히 통과.
  - **[3] 배치 루프(HA4):** 미반영 raw 각각 순차 — spec-author 호출(raw 경로+카테고리+wiki 그래프)→제안 JSON. worthy:false면 사유 보고 후 raw 보존하고 다음. worthy:true면 변경 diff(전체 content 아닌 변경내역, DA-Q1) 제시→사람 승인(전체, HA6)→승인 시 기록: `operations[].content`를 `wiki/<type>/<id>.md`에, `index_rows`를 index.md(ingest 테이블+카탈로그)에, `log_entries`를 `log/<날짜>.md`에 append(HA5).
  - **[4] 게이트(HA7):** `node tools/okf-lint/src/cli.js wiki` 실제 실행 → `okf-lint: OK` 확인. 실패 시 보고.
- [ ] **Step 3: 정직성·경계 규칙** — raw 절대 안 씀(불변규칙 1), 승인 전 wiki 변경 금지, 게이트 결과 자기보고 금지(실제 실행), 모호하면 추측 말고 질문.
- [ ] **Step 4: 스킬 추가가 프로젝트 wiki 린트에 영향 없음 회귀 확인**

Run: `node tools/okf-lint/src/cli.js wiki`
Expected: `okf-lint: OK`

- [ ] **Step 5: 커밋**

```bash
git add .claude/skills/ingest/SKILL.md
git commit -m "feat(ingest): add /ingest orchestrator skill (scan→prepass→approve→record→gate)"
```

---

### Task 3: eval 실행 + end-to-end verify + 프롬프트 반복

스킬을 코어 시나리오에 돌려 채점하고(GREEN), 실제 raw fixture로 end-to-end verify한다. controller가 직접 수행(스킬 실행 + 채점).

**Files:**
- Create: `evals/ingest/RESULTS.md`
- Modify: `.claude/skills/ingest/SKILL.md` (실패 기반 반복)

- [ ] **Step 1: 코어 시나리오 실행 (H1,H3,H5,H7)** — README 절차대로 스킬 흐름을 따라 (a) 결정적 채점 + (b) 루브릭. controller가 승인을 자동으로 흉내. 결과 RESULTS.md 기록.
- [ ] **Step 2: end-to-end 수동 verify (spec §6 B) — 실제 repo, 2커밋 방식**

  fixture raw 2~3건을 **실제 `raw/`에 두고** `/ingest`를 실제 호출, 미반영 탐지→pre-pass→승인→기록→게이트가 한 흐름으로 도는지 관찰. 중간 산출물(어떤 concept이 나왔는지)을 **git 히스토리에 영구 보존**하되 작업트리는 원복한다:

  1. 실행 중 spec-author 제안 JSON을 `evals/ingest/runs/<Hxx>.json`으로 저장(중간물 가시화). /ingest는 평소처럼 `wiki/`·`index.md`·`log/`에 기록.
  2. **스냅샷 커밋** — 산출물 전부 커밋(히스토리에 박제):
     ```bash
     git add raw/ wiki/ index.md log/ evals/ingest/runs/
     git commit -m "test(ingest): e2e verify run snapshot — artifacts for review (reverted next commit)"
     ```
  3. **원복 커밋** — fixture raw·생성된 concept·index/log 변경·runs/ 를 되돌려 실제 번들을 깨끗이:
     ```bash
     git revert --no-edit HEAD     # 또는 해당 파일만 삭제/체크아웃 후 커밋
     ```
     → 두 커밋(스냅샷 + 되돌림)이 모두 히스토리에 남아 "뭐가 나왔는지" 언제든 확인 가능, 작업트리는 clean.
  4. 원복 후 회귀: `node tools/okf-lint/src/cli.js wiki` → `okf-lint: OK` (테스트 찌꺼기 없음 확인).

- [ ] **Step 3: 실패 분류 + 프롬프트 수정** — FAIL을 모아 SKILL.md 해당 단계 보강(예: 미반영 판정이 sources 누락 concept을 놓침 → [1] 강화). 수정 후 실패분만 재실행.
- [ ] **Step 4: 통과 확인** — RESULTS.md에서 코어 시나리오 결정적 OK + 루브릭 PASS 확인. okf-lint 게이트가 양쪽(eval·verify)에서 OK. **스냅샷 커밋 시점의 번들도 okf-lint OK였는지** RESULTS.md에 기록(기록 정합성 = HA7).
- [ ] **Step 5: 커밋 (영구 테스트 자산)**

```bash
git add evals/ingest/RESULTS.md .claude/skills/ingest/SKILL.md
git commit -m "test(ingest): run eval + e2e verify, tune skill prompt to green"
```

> **남는 것/버리는 것:** `scenarios/`·`README.md`·`judge-prompt.md`·`RESULTS.md`는 영구(커밋). verify 실행 산출물(fixture raw·생성 concept·index/log·`runs/*.json`)은 **스냅샷 커밋으로 히스토리에만 보존하고 원복 커밋으로 작업트리에서 제거**. 임시 lint 디렉터리는 스크래치패드(repo 밖)에 만들고 커밋하지 않는다.

---

## 문서 반영 (마지막 커밋)

- [ ] **PROJECT_STATUS.md**: 로드맵 표 H를 ✅로, 변경 로그에 `/ingest` 랜딩 기록. (spec 착수는 2026-06-29 이미 기록됨 — 완료로 갱신.)
- [ ] **CLAUDE.md §5 워크플로**: 빌드 루프에 트리거 ②(`/ingest`) 1줄 반영 검토(과증식 주의 — 포인터 수준).
- [ ] 커밋:

```bash
git add PROJECT_STATUS.md CLAUDE.md
git commit -m "docs: /ingest skill (H) landed"
```

---

## Self-Review

**1. spec 커버리지:**
- HA1 배치 트리거 → Task 2 Step 2 [1] + H1. ✓
- HA2 미반영=sources 스캔 → Task 2 [1] + H1. ✓
- HA3 pre-pass 가드 → Task 2 [2] + H3. ✓
- HA4 순차 승인 → Task 2 [3] + H8(backlog). ✓
- HA5 D' 출력 재사용 → Task 2 [3] 기록. ✓
- HA6 전체 승인 → Task 2 [3]. ✓
- HA7 게이트 진실 → Task 2 [4] + Task 3 Step 4 + H7. ✓
- §6 검증 분리(eval A + verify B) → Task 1·Task 3 Step 1/2. ✓
- §7 D' 무수정 → 본 plan은 spec-author 파일 안 건드림. ✓

**2. placeholder 스캔:** 코드 step 없음(스킬/시나리오는 내용 제시 또는 spec §3·§6 참조). "적절히 처리"류 없음.

**3. 타입 정합성:** D' 출력 키(`operations[op,type,id,content]`/`index_rows`/`log_entries`)를 Task 2 [3] 기록이 그대로 소비 — spec-author spec §3과 일치. `(type,id)`→`wiki/<type>/<id>.md` 규칙 일관. okf-lint 호출(`wiki`)이 Task 2 [4]·Task 3·게이트에서 동일.

**주의(비-TDD):** red-green 코드 사이클 없음. /ingest는 디스크 쓰기·사람 승인이 끼어 완전 자동 eval 불가 — 결정적 부분만 eval, 승인 UX는 수동 verify. Task 3는 controller 직접 수행이 적합.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-29-ingest-skill-plan.md`. 실행 옵션:**

**1. Subagent-Driven** — Task 1(시나리오)·Task 2(스킬 작성)는 fresh subagent로, **Task 3(eval 실행·verify)는 controller 직접 수행**.

**2. Inline Execution** — 프롬프트·eval 작업 특성상 이 세션에서 직접 작성·채점·verify하며 반복.

**어느 쪽으로 진행할까요?**
