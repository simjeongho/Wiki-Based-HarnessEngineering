# spec-author (D') Reconcile Engine — Implementation Plan (eval-주도)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development 또는 superpowers:executing-plans. 단 이 plan은 **TDD가 아니라 eval-주도**다 — production 코드가 없고(§ spec DA5/§5), "테스트 사이클"은 `시나리오 실행 → 루브릭 채점 + okf-lint 정합성`이다. 각 task는 체크박스(`- [ ]`)로 추적한다.

**Goal:** raw 산출물 1건 + 현재 wiki 그래프를 입력받아 OKF concept 변경안(JSON)을 *제안*하는 순수 sub-agent(`spec-author`)와, 그 행동을 고정하는 eval 스위트를 만든다.

**Architecture:** D'는 `.claude/agents/spec-author.md`(프롬프트 + JSON 출력 계약 + 디스크 쓰기 금지 tool 제한)로 구현. 검증은 `evals/spec-author/`의 시나리오(입력 raw + 루브릭) — 채점은 (a) 루브릭 MUST/MUST NOT(judge sub-agent 또는 사람) + (b) 제안된 `content`를 임시 번들에 펼쳐 **기존 okf-lint CLI로 정합성 검사**(결정적 백스톱, 새 코드 없음).

**Tech Stack:** Claude Code sub-agent(.md), 기존 `tools/okf-lint`(Node ESM CLI), eval은 마크다운 fixture + 루브릭. 새 런타임 코드·새 의존성 없음.

## Global Constraints

spec(`docs/superpowers/specs/2026-06-27-spec-author-reconcile.md`)와 상위 설계(`2026-06-25-...`)에서 verbatim:

- **concept type enum:** `capability | process | entity | query | interface | policy | decision | infrastructure | runbook | reference`
- **status enum:** `draft | confirmed | implemented | deprecated`
- **필수 frontmatter:** `id`, `type`, `title`, `status`, `sources`(비어있으면 안 됨).
- **폴더↔타입:** `(type,id)` → `wiki/<폴더>/<id>.md` (FOLDER_TO_TYPE). 교차링크 `[[<폴더>/<id>]]`는 대상 존재 시만 유효.
- **supersession:** `superseded_by`가 있으면 `status: deprecated`. 대체 = `update(old=deprecated+superseded_by)` + `create(new=supersedes)`.
- **DA1 작성≠기록:** D'는 디스크를 쓰지 않는다 — Edit/Write tool 미부여로 **구조적으로 강제**. 제안만 반환.
- **DA6 입자:** capability=한 기능/화면, process=여러 화면 가로지르는 업무 능력. process가 흐름 소유, capability는 `related` 역링크. 2+ capability 가로지를 때만 process 생성.
- **DA-Q 기본값:** 변경안은 inline "변경 내역(요약/diff)"만 제시 / 영향 concept 탐지는 `index.md` 의미 판단 / traces는 raw에 REQ-ID 명시 시만 결선.
- **문서 한글, 코드·식별자·enum 원문.** 모든 명령은 저장소 루트 `C:\Users\jeongho.sim\Desktop\Project\vault`.

---

## File Structure

| 경로 | 책임 |
|---|---|
| `.claude/agents/spec-author.md` | D' 에이전트 정의 — 프롬프트(§4 규칙 인코딩) + JSON 출력 계약 + read-only tool |
| `evals/spec-author/README.md` | eval 실행·채점 규약(run 방법, 정합성 검사 절차) |
| `evals/spec-author/judge-prompt.md` | 루브릭 채점용 judge sub-agent 프롬프트 템플릿 |
| `evals/spec-author/scenarios/<Exx-name>.md` | **자기완결 시나리오 1개 = 파일 1개** — 입력 raw·(선택)wiki-before·rubric를 fenced 블록으로 한 파일에 |
| `evals/spec-author/RESULTS.md` | eval 실행 결과 기록 |

> **구조 결정(2026-06-27):** 시나리오마다 디렉터리 트리(raw/+wiki-before/+rubric.md)를 만들지 않는다 — 파일 ~40개로 폭발. 대신 **자기완결 마크다운 1개**. 실행 시 그 안의 블록을 에이전트 dispatch에 그대로 붙여주면 되므로(D'는 내용을 읽지 실제 디스크 경로가 필수는 아님) wiki-before를 미리 깔 필요도 없다. 그리고 **코어 8개부터 시작**(E01·E02·E03·E04·E05·E06·E10·E14), 나머지 6개(E07·E08·E09·E11·E12·E13)는 실패를 발견할 때 추가(성장형).

---

### Task 1: eval 하네스 + 규약 + 워크드 시나리오 2개

eval 루프를 먼저 세운다(시나리오 = "성공의 정의" = red). 에이전트가 없으니 이 시점엔 모든 시나리오가 "미충족"이다.

**Files:**
- Create: `evals/spec-author/README.md`
- Create: `evals/spec-author/judge-prompt.md`
- Create: `evals/spec-author/scenarios/E02-new-data-model.md` (자기완결)
- Create: `evals/spec-author/scenarios/E01-supersede-decision.md` (자기완결)

**Interfaces:**
- Produces: 자기완결 시나리오 파일 규약(`## 입력 raw`, 선택 `## wiki-before`, `## rubric` 섹션을 fenced 블록으로), 정합성 검사 절차, judge 프롬프트. Task 2가 이 패턴을 복제한다.

- [ ] **Step 1: 실행·채점 규약 작성** — `evals/spec-author/README.md`

````markdown
# spec-author eval 스위트

각 시나리오 = `scenarios/<id>.md` **파일 하나**, 아래 섹션을 fenced 블록으로:
- `## 입력 raw (path: raw/<category>/<file>)` — 입력 산출물 내용
- `## wiki-before (path: wiki/<폴더>/<id>.md)` — (선택) 사전 wiki 상태. update/대체/멱등 시나리오만, 여러 개 가능.
- `## rubric` — MUST / MUST NOT 체크리스트

## 실행 (Inline + judge sub-agent)
1. spec-author 에이전트를 dispatch — 시나리오의 `입력 raw` 블록(+ 있으면 `wiki-before` 블록)을 프롬프트에 그대로 붙이고, 의도 경로를 알려준다. 출력: 제안 JSON.
2. 채점:
   - **정합성(결정적):** 제안 JSON의 각 `operations[].content`(+ wiki-before)를 임시 디렉터리 `wiki/<type>/<id>.md`에 펼친 뒤
     `node tools/okf-lint/src/cli.js <임시>/wiki` 실행 → `okf-lint: OK`(exit 0)여야 함.
   - **루브릭(판단):** `judge-prompt.md`로 **judge sub-agent**를 띄워 MUST/MUST NOT 채점.
3. 결과를 `RESULTS.md`에 1행 기록.

## 원칙
- 시나리오는 happy path가 아니라 **두려운 실패 모드**마다 하나. **코어 8개부터**, 실패 발견 시 추가(성장형).
- eval 프레임워크/러너 코드는 만들지 않는다(과설계 회피). 위 절차는 수동 + 기존 okf-lint 재사용.
````

- [ ] **Step 2: judge 프롬프트 작성** — `evals/spec-author/judge-prompt.md`

````markdown
# spec-author judge (루브릭 채점용 sub-agent 프롬프트)

당신은 spec-author가 낸 제안 JSON이 시나리오 루브릭을 충족하는지 채점한다.

## 입력
- 루브릭: [RUBRIC_FILE]
- 제안 JSON: [PROPOSAL_FILE]
- (참고) 입력 raw + wiki-before: [SCENARIO_DIR]

## 채점
루브릭의 각 MUST / MUST NOT 항목을 제안 JSON과 대조한다. 제안의 근거(rationale)는 주장일 뿐 — 실제 operations 내용으로 판정한다.

## 출력
### 판정: PASS | FAIL
### MUST (각 항목)
- [✅/❌] <항목> — 근거(operation/필드 인용)
### MUST NOT (각 항목)
- [✅ 안 함/❌ 위반] <항목> — 근거
### 코멘트
가장 중요한 실패 1~2개.
````

- [ ] **Step 3: 워크드 시나리오 E02(생성) 작성** — `scenarios/E02-new-data-model.md` (자기완결, 사전 wiki 없음)

````markdown
# E02 — 신규 데이터모델 → entities (생성)

## 입력 raw (path: raw/data-models/member.md)
```
# 회원 데이터 모델
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | bigint | PK |
| email | varchar(255) | 로그인 식별자, unique |
| status | varchar(20) | active / dormant / withdrawn |
```

## rubric
MUST:
- `entities/member` create 1개(type: entity, id: member), 필수필드 + sources에 raw 경로
- 속성(email/status 등) 본문 반영, status는 enum 값
MUST NOT: 중복 entity 생성 / 디스크 write / sources 비움
````

- [ ] **Step 4: 워크드 시나리오 E01(대체) 작성** — `scenarios/E01-supersede-decision.md` (자기완결, wiki-before 포함)

````markdown
# E01 — 회의록이 기존 결정 뒤집음 (대체)

## 입력 raw (path: raw/meetings-contracts/2026-07-auth.md)
```
2026-07-05 인증 재검토: 서버 세션을 폐기하고 JWT 토큰 기반으로 전환. 기존 jwt-decision(서버 세션)을 뒤집음. 사유: 수평 확장 시 세션 스토어 병목.
```

## wiki-before (path: wiki/decisions/jwt-decision.md)
```
---
id: jwt-decision
type: decision
title: 세션을 서버 세션으로 관리
status: confirmed
sources:
  - path: raw/meetings-contracts/2026-06-01-auth.md
---
## 결정
서버 세션 방식으로 인증 상태를 관리한다.
```

## rubric
MUST:
- `decisions/jwt-decision` update: status→deprecated, superseded_by에 새 결정
- 새 `decisions/*` create: supersedes [[decisions/jwt-decision]], status confirmed, sources에 회의록
- log_entries에 [decision], 두 결정 양방향 링크(끊김 없음)
MUST NOT: jwt-decision 삭제/내용 소실 / 새 결정을 deprecated로 / 디스크 write
````

- [ ] **Step 5: 커밋**

```bash
git add evals/spec-author/README.md evals/spec-author/judge-prompt.md evals/spec-author/scenarios/E01-supersede-decision.md evals/spec-author/scenarios/E02-new-data-model.md
git commit -m "test(spec-author): add eval harness, judge prompt, worked scenarios E01/E02"
```

---

### Task 2: 나머지 코어 시나리오 (E03·E04·E05·E06·E10·E14)

Task 1 패턴(자기완결 `.md` 1개: `## 입력 raw` + 선택 `## wiki-before` + `## rubric`)을 복제. 코어 8개 중 E01·E02는 Task 1 완료 → 여기서 나머지 코어 6개. MUST/MUST NOT은 spec §6 표가 진실.

**Files (각 `scenarios/<id>.md` 자기완결):**
- Create: `E03-legacy-sql.md` (raw/legacy-sql/active_members.sql — 박힌 업무규칙 1개 포함 → queries + policies 승격)
- Create: `E04-chitchat-meeting.md` (raw/meetings-contracts/standup.md — 일정·현황만 → worthy:false)
- Create: `E05-entity-refine.md` (raw 속성 1개 추가 + wiki-before/entities/member.md → in-place 갱신·sources 누적)
- Create: `E06-cross-capability-process.md` (raw 온보딩 흐름 + wiki-before 3 capability → processes 생성)
- Create: `E10-idempotent-reingest.md` (E02와 동일 raw + wiki-before에 동일 entity 존재 → no-op)
- Create: `E14-conformance.md` (임의 raw → 제안이 okf-lint 통과)

**Interfaces:** Consumes Task 1의 시나리오 규약·judge·README.

- [ ] **Step 1: E03, E05, E06 작성** (생성/정제/입자) — spec §6 해당 행의 MUST/MUST NOT을 rubric에 옮긴다.
- [ ] **Step 2: E04, E10, E14 작성** (worthiness/멱등/정합성) — E04는 worthy:false, E10은 wiki-before에 동일 concept을 둬 no-op 기대.
- [ ] **Step 3: 코어 시나리오 개수 점검**

Run: `ls evals/spec-author/scenarios/*.md | wc -l`
Expected: `8` (E01·E02 + 신규 6)

- [ ] **Step 4: 커밋**

```bash
git add evals/spec-author/scenarios
git commit -m "test(spec-author): add remaining core eval scenarios (E03-E06,E10,E14)"
```

> **성장 backlog(비차단)**: E07(모호→질문)·E08(충돌≠reversal)·E09(dangling)·E11(commons 재사용)·E12(부분 worthy)·E13(process 과추출 금지)는 eval 실행에서 해당 실패 모드를 만나면 추가한다.

---

### Task 3: spec-author 에이전트 정의

D' 본체. 프롬프트가 spec §4 판단 규칙을 인코딩하고, §3 JSON 계약만 출력하며, 디스크 쓰기 tool이 없어 "제안만" 함이 구조적으로 강제된다.

**Files:**
- Create: `.claude/agents/spec-author.md`

**Interfaces:**
- Produces: `spec-author` 에이전트. 입력(프롬프트로 받음): raw 파일 경로 + 읽기용 wiki 경로. 출력: 제안 JSON(아래 스키마).

- [ ] **Step 1: 에이전트 frontmatter + 역할 작성** (tool 제한으로 쓰기 금지 강제)

```markdown
---
name: spec-author
description: raw 산출물 1건을 읽어 OKF concept 변경안(JSON)을 제안하는 순수 엔진. 디스크에 쓰지 않는다.
tools: Read, Grep, Glob, Bash
model: sonnet
---

너는 spec-author(D')다. 입력 raw 산출물 1건 + 현재 wiki 그래프를 읽고, 만들거나 고쳐야 할 OKF concept **변경안을 제안**한다. 너는 **디스크에 쓰지 않는다**(파일 write·git 금지) — 제안 JSON만 반환한다. 승인·기록은 호출자(H/on-confirm)가 한다.
```

- [ ] **Step 2: JSON 출력 계약 명시** (spec §3와 동일 — 에이전트는 이 형태만 출력)

````markdown
## 출력 — 아래 JSON만 반환(다른 텍스트 금지)

```json
{
  "worthy": true,
  "skip_reason": null,
  "operations": [
    { "op": "create|update", "type": "<concept type>", "id": "<kebab id>",
      "content": "<frontmatter+본문 전체>", "rationale": "<왜>" }
  ],
  "log_entries": ["[ingest] <raw 경로>", "..."],
  "index_rows": [{ "date": "<YYYY-MM-DD>", "source": "<raw 경로>", "concepts": ["<폴더/id>", "..."] }]
}
```
- 경로는 쓰지 마라 — `(type,id)`만. 호출자가 `wiki/<type>/<id>.md`로 푼다.
- 대체(supersession)는 별도 op 아님: `update`(old=deprecated+superseded_by) + `create`(new=supersedes).
- worthy:false면 operations는 빈 배열, skip_reason 채움.
````

- [ ] **Step 3: 판단 규칙을 spec §4 참조로 인코딩** (DRY — 규칙 전문은 spec에 있음; 에이전트엔 요지 + 절차)

```markdown
## 절차
1. raw를 읽고 **worthiness** 판정: 지속적 지식(규칙·결정·데이터 모양·연계·흐름) 있으면 concept, 순수 현황/잡담/일정이면 worthy:false.
2. `index.md`를 읽어 이 raw가 건드리는 **기존 concept을 의미로 탐지**(이름이 달라도).
3. raw 타입 → concept 타입 매핑(데이터모델→entities / 레거시SQL→queries+규칙 policies 승격 / 인터페이스→interfaces / 업무정책→policies / 회의록→decisions+영향 concept / 요구→capabilities 씨앗+traces).
4. **정제 vs 대체**: 모순 없는 보강은 기존 concept update(sources 누적·last_verified 갱신). 과거 *결정*을 뒤집으면 대체(old deprecated+superseded_by, new supersedes, 영향 concept 재링크).
5. **입자(DA6)**: 흐름이 2+ capability를 가로지르면 processes/ 생성(본문=순서, capability 링크). 한 capability 안이면 그 capability 본문에 남김 — process 과추출 금지.
6. 정보 부족·모호하면 추측하지 말고 그 사실을 skip_reason 또는 rationale에 적고 질문 필요를 표시.
7. 공통 자산(디자인시스템 등)은 재구현 말고 commons reference 링크(D6).
8. 모든 concept은 templates/<type>.md 구조 + sources 필수. traces는 raw에 REQ-ID가 명시된 경우만.

상세 규칙·매핑표·근거: docs/superpowers/specs/2026-06-27-spec-author-reconcile.md §4 참조.

## self-check (반환 전)
각 operations[].content를 임시 디렉터리의 wiki/<type>/<id>.md로 펼치고
`node tools/okf-lint/src/cli.js <임시>/wiki` 를 실행해 okf-lint: OK 인지 확인. 실패하면 고쳐서 다시.
```

- [ ] **Step 4: 에이전트 존재·형식 점검**

Run: `node tools/okf-lint/src/cli.js wiki`
Expected: `okf-lint: OK` (에이전트 추가가 프로젝트 wiki 린트에 영향 없음 — 회귀 확인).

추가로 frontmatter 파싱 확인:
Run: `node tools/okf-lint/src/cli.js .claude/agents 2>&1 | head -1` 은 하지 말 것(agents는 번들 아님). 대신 파일 존재만:
Run: `test -f .claude/agents/spec-author.md && echo OK`
Expected: `OK`

- [ ] **Step 5: 커밋**

```bash
git add .claude/agents/spec-author.md
git commit -m "feat(spec-author): add D' reconcile agent (proposal-only, read-only tools)"
```

---

### Task 4: eval 실행 + 채점 + 프롬프트 반복

에이전트를 시나리오에 돌려 루브릭 + 정합성을 채점하고, 실패를 프롬프트 수정으로 잡는다(GREEN). 이 task는 controller가 직접 수행(에이전트 dispatch + 채점)하는 게 자연스럽다.

**Files:**
- Create: `evals/spec-author/RESULTS.md`
- Modify: `.claude/agents/spec-author.md` (실패 기반 반복)

**Interfaces:** Consumes Task 1~3 전부.

- [ ] **Step 1: 코어 시나리오 실행 (E01, E02)** — README 절차대로 에이전트 dispatch → 제안 JSON 확보 → 정합성(okf-lint) + judge 채점. 결과를 RESULTS.md에 기록.
- [ ] **Step 2: 나머지 시나리오 실행 (E03~E14)** — 동일 절차. 특히 E04/E07(worthy:false·질문), E10(no-op), E11(commons 링크), E13(process 과추출 금지) 확인.
- [ ] **Step 3: 실패 분류 + 프롬프트 수정** — FAIL 항목을 모아 `.claude/agents/spec-author.md`의 해당 규칙을 보강(예: 대체 시 양방향 링크 누락 → Step 3 절차 4 강화). 수정 후 실패 시나리오만 재실행.
- [ ] **Step 4: 전 시나리오 통과 확인** — RESULTS.md에서 14개 모두 정합성 OK + 루브릭 PASS인지 확인.

Run: `grep -c "PASS" evals/spec-author/RESULTS.md`
Expected: `14` (또는 worthy:false가 의도인 E04/E07/E12 포함 14행 PASS)

- [ ] **Step 5: 커밋**

```bash
git add evals/spec-author/RESULTS.md .claude/agents/spec-author.md
git commit -m "test(spec-author): run eval suite, tune agent prompt to green (14/14)"
```

---

## 문서 반영 (마지막 커밋)

- [ ] **PROJECT_STATUS.md**: 로드맵 표 D(spec-author)를 🚧/✅로, 변경 로그에 D' 정합 엔진 + eval 스위트 추가. OQ#6 해소(process/capability 입자) 기록.
- [ ] 커밋:

```bash
git add PROJECT_STATUS.md
git commit -m "docs: spec-author (D') reconcile engine + eval suite landed"
```

---

## Self-Review

**1. spec 커버리지:**
- DA1 작성≠기록(쓰기 금지) → Task 3 tool 제한 + 출력 계약. ✓
- DA2 제안 형식(JSON) → Task 3 Step 2. ✓
- DA3 정제 vs 대체 → Task 3 절차 4 + E01/E05. ✓
- DA4 worthiness 프롬프트 규칙 → Task 3 절차 1 + E04/E12. ✓
- DA5 okf-lint 백스톱 → Task 1 정합성 절차 + Task 3 self-check + E14. ✓
- DA6 process/capability 입자 → Task 3 절차 5 + E06/E13. ✓
- §3 JSON 계약 → Task 3 Step 2. ✓
- §4 매핑·규칙 → Task 3 절차(요지) + spec 참조(DRY). ✓
- §6 eval 14종 → Task 1(2) + Task 2(12). ✓
- §7 DA-Q 기본값(inline/index.md/REQ-ID) → Global Constraints + Task 3 절차. ✓

**2. placeholder 스캔:** 코드 step 없음(프롬프트/시나리오는 내용 제시 또는 spec §6 참조). Task 2는 spec §6 표를 진실로 삼아 fixture를 채우는 작업 — 루브릭 내용은 spec에 이미 명시. "적절히 처리"류 없음.

**3. 타입 정합성:** 출력 JSON 키(`worthy/skip_reason/operations[op,type,id,content,rationale]/log_entries/index_rows`)가 spec §3·Task 3·judge·rubric에서 일관. `(type,id)`→경로 규칙이 Task 1 정합성 절차와 Task 3 출력 계약에서 일치. op enum `create|update`만 사용(대체=update+create) — spec·Task 3·E01 일치.

**주의(비-TDD):** 이 plan은 red-green 코드 사이클이 없다. "검증"은 (a) 결정적 okf-lint 정합성 + (b) judge/사람 루브릭이다. Task 4는 cheap-model 구현자에게 맡기기보다 controller 직접 수행(에이전트 dispatch + 채점)이 적합 — 실행 핸드오프 참고.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-27-spec-author-reconcile-plan.md`. 실행 옵션:**

**1. Subagent-Driven** — Task 1~3(시나리오·에이전트 작성)은 fresh subagent로, **Task 4(eval 실행·채점)는 controller 직접 수행**(에이전트를 띄워 채점해야 하므로). 

**2. Inline Execution** — 프롬프트·eval 작업 특성상 이 세션에서 직접 작성·채점하며 반복하는 게 자연스러울 수 있음.

**어느 쪽으로 진행할까요?**
