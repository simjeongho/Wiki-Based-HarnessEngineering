# Ingest · Reconcile · Supersession Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 불규칙하게 도착하는 raw 산출물(회의록·데이터모델·인터페이스정의서·레거시SQL 등)을 사람이 확인하는 절차로 ingest해 wiki concept를 생성·**갱신**하고, 과거 결정이 뒤집힐 때 히스토리를 지우지 않고 **대체(supersession)** 로 기록하는 흐름의 **결정적 토대**를 okf-lint에 구축한다.

**Architecture:** 빌드/운영 루프를 "트리거 3개 + 공유 등뼈" 모델로 통합한다(아래 설계 결정). 본 계획은 그 등뼈 중 **결정적으로 검증 가능한 부분만** 다룬다 — okf-lint에 (1) 예약 파일 skip, (2) `supersedes`/`superseded_by` 교차링크 + status 전이 규칙을 추가한다. ingest 스킬·spec-author 정합 에이전트(LLM 작업)는 별도 spec→plan으로 분리한다(§"후속 sub-project").

**Tech Stack:** Node.js ≥ 18, ES 모듈(`"type": "module"`), 테스트 `node:test` + `node:assert/strict`, frontmatter 파싱 `yaml`. 런타임 의존성은 okf-lint의 `yaml` 외 없음.

---

## 설계 결정 (이번 대화에서 확정 — 구현 전 캡처)

> 이 절은 "이 후 수정은 어떻게 될까?"에 대한 답이며, 본 계획의 모든 task가 암묵적으로 따른다. 코드를 늘리지 않는 합의이므로 여기에 박제하고, 별도로 설계 spec(§"문서 반영")에 접는다.

### D-INGEST-1: 루프가 아니라 트리거가 3개 — 공유 등뼈
빌드/운영을 별개 루프로 두지 않고, **3개 트리거가 하나의 등뼈로 수렴**한다.

| 트리거 | 예시 | 시점 |
|---|---|---|
| ① 화면 확정 | define-screen → on-confirm | 규칙적 |
| ② **raw 산출물 ingest** | 회의록, 데이터모델, 인터페이스정의서, 레거시SQL, 계약서 | **불규칙** |
| ③ 코드/요구 변경 | 운영 수정 요청 | 불규칙 |

공유 등뼈:
```
[기록]   raw 적재(불변) + log[ingest] + index.md ingest 테이블 갱신
[증류·정합] spec-author: 영향 concept을 그래프로 찾아 생성 OR 갱신
[승인]   ★사람이 변경 diff를 확인·승인 (D-INGEST-2)
[원자적 기록] 한 PR 안에 raw + concept + (필요시)ADR + log 동시
[게이트] okf-lint (+ 코드 동반 시 drift-check)
[야간]   wiki-lint: 의미적 모순·orphan 검사
```
①은 ②의 화면 전용 특수화, ③은 ②가 코드 변경을 동반한 형태다.

### D-INGEST-2: ingest의 concept 생성·갱신은 **사람 승인 선행** (OQ#4 부분 해소)
초기 단계에서는 AI가 concept를 자동 확정하지 않는다. ingest 스킬은 변경안(신규 concept / 기존 concept diff / 대체 제안)을 **제시**하고, 사람이 승인한 뒤에만 wiki에 기록한다. (자동화 범위 확대는 신뢰 축적 후 재검토.)

### D-INGEST-3: 수정은 **2종** — 정제(refine) vs 대체(supersede)
새 raw가 기존 concept를 건드릴 때:

- **정제(모순 없음)**: concept를 in-place 갱신. `sources:`에 새 출처를 **누적**(리스트가 자란다), `last_verified` 갱신, 본문 수정. log `[update]`.
- **대체(과거 판단을 뒤집음)**: 히스토리를 **지우지 않는다**(운영 루프의 핵심 가치 = 과거 why 보존).
  - 기존 `decisions/old.md`: `status: deprecated` + `superseded_by: "[[decisions/new]]"`.
  - 신규 `decisions/new.md`: `status: confirmed` + `supersedes: "[[decisions/old]]"`, `sources:` → 그 회의록.
  - 영향받는 policy/entity는 새 결정을 가리키도록 갱신. log `[decision]`(+ 충돌 해소 시 `[contradiction]`).

provenance는 git + `log/` + **deprecated로 보존된 ADR 체인**에 남는다.

### D-INGEST-4: 이 패턴은 wiki-lint(F)의 중요도를 올린다
사람이 불규칙하게 이질적 문서를 밀어넣는 지점이 의미적 모순이 가장 잘 끼는 곳이다. 결정적 게이트는 *구조*만 본다 — *의미적* 모순(회의록은 X, 옛 정책은 Y)은 야간 wiki-lint(sub-project F)만 잡는다. F는 nice-to-have가 아니라 이 트리거의 안전망이다.

---

## Global Constraints

설계 spec(`docs/superpowers/specs/2026-06-25-llm-wiki-okf-si-harness-design.md` §5, §8, D5, D7, D13)에서 그대로(verbatim) 가져온다. 모든 task의 요구사항은 이 절을 암묵 포함한다.

- **concept `type` enum (verbatim):** `capability | process | entity | query | interface | policy | decision | infrastructure | runbook | reference`
- **`status` enum (verbatim):** `draft | confirmed | implemented | deprecated`
- **`layer` facet enum (verbatim):** `business | data | application | infrastructure | quality | governance`
- **필수 frontmatter 필드:** `id`, `type`, `title`, `status`, `sources` (sources 비어있으면 안 됨 — D7).
- **교차링크 형식:** `[[<folder>/<id>]]`. 해석 전 앵커(`#section`)는 제거. 번들(또는 제공된 commons 번들) 안에 `<linkRoot>/<folder>/<id>.md`가 존재할 때만 유효.
- **예약 파일(Karpathy 표준):** `index.md`, `CLAUDE.md`는 카탈로그/스키마이지 concept가 아니다. `README.md`도 prose다. okf-lint는 이들을 concept로 검사하지 않는다.
- **`raw/`는 불변(D5):** 어떤 도구도 `raw/` 안에 내용을 쓰지 않는다.
- **모든 코드·식별자는 영어.** 한글은 템플릿/스텁 본문에서만.
- **명령은 저장소 루트에서 실행:** `C:\Users\jeongho.sim\Desktop\Project\vault`. 테스트는 fixture를 테스트 파일 기준 상대경로 또는 tmp로 잡으므로 cwd 영향 없음.
- **okf-lint 의존성 설치 선행:** 클론 직후엔 `npm install --prefix tools/okf-lint`를 먼저 실행해야 테스트가 `yaml`을 찾는다. 미설치 시 전 테스트가 `ERR_MODULE_NOT_FOUND`로 실패한다.

---

## File Structure

| 파일 | 책임 | 변경 |
|---|---|---|
| `tools/okf-lint/src/lint.js` | 번들 walk + 파일별 검사 오케스트레이션 | 수정 — `walk()`에 예약 파일 skip |
| `tools/okf-lint/src/links.js` | 교차링크 추출·해석 | 수정 — `extractLinks`가 `supersedes`/`superseded_by`도 스캔 |
| `tools/okf-lint/src/schema.js` | enum·필수필드·검증 (검증의 진실 소스) | 수정 — `superseded_by` → `status: deprecated` 규칙 |
| `tools/okf-lint/test/lint.test.js` | 오케스트레이션 테스트 | 수정 — 예약 파일 skip 테스트 |
| `tools/okf-lint/test/links.test.js` | 링크 테스트 | 수정 — supersession 필드 추출 테스트 |
| `tools/okf-lint/test/schema.test.js` | 스키마 테스트 | 수정 — supersession status 규칙 테스트 |

기존 파일만 수정한다. 새 모듈·새 의존성 없음 — 검증된 패턴 위에 규칙 3개를 얹는다.

---

### Task 1: 예약 파일 skip (index.md / README.md / CLAUDE.md)

ingest되거나 스캐폴드된 번들에는 `index.md`(카탈로그) 등 concept가 아닌 `.md`가 섞인다. 현재 `walk()`는 이들도 concept로 검사해 필수필드 누락 에러를 낸다. 예약 파일을 skip한다.

**Files:**
- Modify: `tools/okf-lint/src/lint.js` (`walk` 함수 + 상단 상수)
- Test: `tools/okf-lint/test/lint.test.js`

**Interfaces:**
- Consumes: 없음(순수 fs walk).
- Produces: `lintBundle`/`lintFile` 시그니처 불변. 동작만 변경 — basename이 `index.md`/`README.md`/`CLAUDE.md`이거나 `_`로 시작하는 `.md`는 lint 대상에서 제외.

- [ ] **Step 1: 실패하는 테스트 작성**

`tools/okf-lint/test/lint.test.js`의 마지막에 추가:

```js
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'

test('skips reserved files (index.md, README.md, CLAUDE.md)', () => {
  const root = mkdtempSync(join(tmpdir(), 'okf-reserved-'))
  // reserved files with non-concept content must NOT produce findings
  writeFileSync(join(root, 'index.md'), '# catalog, not a concept\n')
  writeFileSync(join(root, 'README.md'), '# readme\n')
  writeFileSync(join(root, 'CLAUDE.md'), '# schema\n')
  mkdirSync(join(root, 'entities'), { recursive: true })
  writeFileSync(
    join(root, 'entities', 'member.md'),
    '---\nid: member\ntype: entity\ntitle: 회원\nstatus: confirmed\nsources:\n  - path: raw/x.md\n---\n## body\n')
  assert.deepEqual(lintBundle({ wikiRoot: root }), [])
})
```

> 주의: `import` 문은 파일 상단의 기존 import 묶음으로 합쳐도 되고, 위치상 테스트 위에 두어도 동작한다. 중복 import가 되지 않도록 상단에 `mkdtempSync, mkdirSync, writeFileSync`, `tmpdir`가 이미 있는지 확인하고 없으면 추가한다(현재 `lint.test.js`에는 없음).

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `node --test tools/okf-lint/test/lint.test.js`
Expected: FAIL — `index.md`/`README.md`/`CLAUDE.md`가 concept로 검사되어 `missing required field` finding이 생기므로 `deepEqual([], ...)` 단언 실패.

- [ ] **Step 3: 최소 구현 작성**

`tools/okf-lint/src/lint.js`에서 `walk` 함수를 아래로 교체하고, 파일 상단(import 아래)에 상수를 추가:

```js
const RESERVED_FILES = new Set(['index.md', 'README.md', 'CLAUDE.md'])

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...walk(full))
    } else if (
      entry.name.endsWith('.md') &&
      !entry.name.startsWith('_') &&
      !RESERVED_FILES.has(entry.name)
    ) {
      out.push(full)
    }
  }
  return out
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `node --test tools/okf-lint/test/lint.test.js`
Expected: PASS — 신규 테스트 포함 전부 green.

- [ ] **Step 5: 커밋**

```bash
git add tools/okf-lint/src/lint.js tools/okf-lint/test/lint.test.js
git commit -m "feat(okf-lint): skip reserved files (index/README/CLAUDE) when linting"
```

---

### Task 2: supersession 링크 필드 추출 + 해석

대체 관계는 frontmatter `supersedes`/`superseded_by`에 `[[decisions/...]]` 링크로 적는다. 이 링크도 깨지면 안 되므로 `extractLinks`가 스캔하게 해 기존 링크 해석 경로(lintFile)가 자동으로 검사하도록 한다.

**Files:**
- Modify: `tools/okf-lint/src/links.js` (`extractLinks`)
- Test: `tools/okf-lint/test/links.test.js`

**Interfaces:**
- Consumes: 없음.
- Produces: `extractLinks(fm, body)` — 기존 `fm.related` + body에 더해 `fm.supersedes`, `fm.superseded_by`(문자열 또는 문자열 배열)에서도 `[[folder/id]]`를 추출. 반환 형태(고유 타겟 문자열 배열) 불변. `resolveLink`는 변경 없음.

- [ ] **Step 1: 실패하는 테스트 작성**

`tools/okf-lint/test/links.test.js`에 추가:

```js
test('extracts links from supersedes and superseded_by fields', () => {
  const fm = {
    related: ['[[entities/member]]'],
    supersedes: '[[decisions/old-auth]]',
    superseded_by: ['[[decisions/new-auth]]'],
  }
  assert.deepEqual(
    extractLinks(fm, '').sort(),
    ['decisions/new-auth', 'decisions/old-auth', 'entities/member'])
})

test('supersession fields are optional', () => {
  assert.deepEqual(extractLinks({ related: [] }, 'no links'), [])
})
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `node --test tools/okf-lint/test/links.test.js`
Expected: FAIL — 현재 `extractLinks`는 `supersedes`/`superseded_by`를 보지 않아 첫 테스트가 `['entities/member']`만 반환, 단언 실패.

- [ ] **Step 3: 최소 구현 작성**

`tools/okf-lint/src/links.js`의 `extractLinks`를 아래로 교체:

```js
export function extractLinks(fm, body) {
  const targets = new Set()
  const scan = (text) => {
    if (typeof text !== 'string') return
    const re = /\[\[([^\]]+)\]\]/g
    let m
    while ((m = re.exec(text)) !== null) targets.add(m[1].trim())
  }
  const scanField = (v) => {
    if (Array.isArray(v)) v.forEach(scan)
    else scan(v)
  }
  if (fm) {
    scanField(fm.related)
    scanField(fm.supersedes)
    scanField(fm.superseded_by)
  }
  scan(body)
  return [...targets]
}
```

> `scanField`는 문자열/배열/undefined를 모두 안전하게 처리한다(undefined는 `scan`에서 typeof 가드로 무시). 기존 `related` 동작과 동일.

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `node --test tools/okf-lint/test/links.test.js`
Expected: PASS — 신규 2개 포함 전부 green.

- [ ] **Step 5: 커밋**

```bash
git add tools/okf-lint/src/links.js tools/okf-lint/test/links.test.js
git commit -m "feat(okf-lint): extract cross-links from supersedes/superseded_by fields"
```

---

### Task 3: supersession status 규칙 (`superseded_by` → `deprecated`)

대체된 concept은 살아있는 상태로 남으면 안 된다. `superseded_by`가 있으면 `status`는 반드시 `deprecated`여야 한다 — 결정적 규칙.

**Files:**
- Modify: `tools/okf-lint/src/schema.js` (`validateFrontmatter`)
- Test: `tools/okf-lint/test/schema.test.js`

**Interfaces:**
- Consumes: 없음.
- Produces: `validateFrontmatter(fm, ctx)` — 기존 검사 + 규칙 추가: `superseded_by`가 존재하고 비어있지 않은데 `status !== 'deprecated'`이면 에러 `"superseded_by requires status: deprecated"`. 반환 형태(에러 메시지 배열) 불변.

- [ ] **Step 1: 실패하는 테스트 작성**

`tools/okf-lint/test/schema.test.js`에 추가(상단 import에 `validateFrontmatter`가 이미 있으므로 추가 import 불필요):

```js
test('superseded_by requires deprecated status', () => {
  const live = validateFrontmatter(
    { id: 'old', type: 'decision', title: 't', status: 'confirmed',
      sources: [{ path: 'r' }], superseded_by: '[[decisions/new]]' },
    { id: 'old', folder: 'decisions' })
  assert.ok(live.some(e => e.includes('superseded_by requires status: deprecated')))

  const deprecated = validateFrontmatter(
    { id: 'old', type: 'decision', title: 't', status: 'deprecated',
      sources: [{ path: 'r' }], superseded_by: '[[decisions/new]]' },
    { id: 'old', folder: 'decisions' })
  assert.ok(!deprecated.some(e => e.includes('superseded_by requires status: deprecated')))
})

test('supersedes alone does not force deprecated', () => {
  const errs = validateFrontmatter(
    { id: 'new', type: 'decision', title: 't', status: 'confirmed',
      sources: [{ path: 'r' }], supersedes: '[[decisions/old]]' },
    { id: 'new', folder: 'decisions' })
  assert.ok(!errs.some(e => e.includes('superseded_by requires status: deprecated')))
})
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `node --test tools/okf-lint/test/schema.test.js`
Expected: FAIL — 첫 테스트가 기대하는 에러 메시지가 아직 생성되지 않아 `assert.ok(... some ...)` 실패.

- [ ] **Step 3: 최소 구현 작성**

`tools/okf-lint/src/schema.js`의 `validateFrontmatter`에서, `id`/`folder` 일치 검사 블록 다음, `sources` 검사 블록 **앞**에 삽입:

```js
  const supersededBy = fm.superseded_by
  const hasSupersededBy =
    supersededBy !== undefined &&
    supersededBy !== null &&
    supersededBy !== '' &&
    !(Array.isArray(supersededBy) && supersededBy.length === 0)
  if (hasSupersededBy && fm.status !== 'deprecated') {
    errors.push('superseded_by requires status: deprecated')
  }
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `node --test tools/okf-lint/test/schema.test.js`
Expected: PASS — 신규 2개 포함 전부 green.

- [ ] **Step 5: 커밋**

```bash
git add tools/okf-lint/src/schema.js tools/okf-lint/test/schema.test.js
git commit -m "feat(okf-lint): require deprecated status when superseded_by is set"
```

---

### Task 4: 전체 회귀 + supersession 골든 fixture (end-to-end)

새 규칙들이 실제 번들 lint에서 함께 동작함을 골든 fixture로 고정한다(대체 체인 1쌍이 clean하게 통과).

**Files:**
- Create: `tools/okf-lint/test/fixtures/good/decisions/old-auth.md`
- Create: `tools/okf-lint/test/fixtures/good/decisions/new-auth.md`
- Test: `tools/okf-lint/test/lint.test.js` (기존 'clean bundle' 테스트가 이 fixture를 자동 포함)

**Interfaces:**
- Consumes: Task 1–3의 동작.
- Produces: `good` 번들에 유효한 supersession 쌍 추가 — 여전히 `lintBundle` findings == [].

- [ ] **Step 1: deprecated(피대체) ADR fixture 생성**

`tools/okf-lint/test/fixtures/good/decisions/old-auth.md`:

```markdown
---
id: old-auth
type: decision
title: 세션을 서버 세션으로 관리 (구)
status: deprecated
owner: auth-squad
layer: application
sources:
  - path: raw/meetings-contracts/2026-06-01-auth.md
superseded_by:
  - "[[decisions/new-auth]]"
---
## 맥락
구 결정. 아래 결정으로 대체됨.

## 결정
서버 세션. → [[decisions/new-auth]] 로 대체.
```

- [ ] **Step 2: 신규(대체) ADR fixture 생성**

`tools/okf-lint/test/fixtures/good/decisions/new-auth.md`:

```markdown
---
id: new-auth
type: decision
title: 세션을 JWT로 관리
status: confirmed
owner: auth-squad
layer: application
sources:
  - path: raw/meetings-contracts/2026-06-27-auth.md
supersedes:
  - "[[decisions/old-auth]]"
---
## 맥락
2026-06-27 회의에서 구 결정을 뒤집음.

## 결정
JWT 세션으로 전환. [[decisions/old-auth]] 를 supersede.
```

- [ ] **Step 3: clean 번들 테스트가 여전히 통과하는지 확인**

Run: `node --test tools/okf-lint/test/lint.test.js`
Expected: PASS — `clean bundle produces no findings`가 새 fixture(상호 링크 해석 + deprecated 규칙 만족) 포함해도 `[]` 유지. (링크 `decisions/old-auth` ↔ `decisions/new-auth`가 서로 존재하므로 broken 없음.)

- [ ] **Step 4: okf-lint 전체 스위트 회귀**

Run: `npm test --prefix tools/okf-lint`
Expected: PASS — 전 스위트 green, `# fail 0`. (frontmatter 4 + schema 9 + links 6 + lint 3 + cli 3 + templates 2 = 27.)

- [ ] **Step 5: 프로젝트 wiki 번들 린트(현행 clean 유지 확인)**

Run: `node tools/okf-lint/src/cli.js wiki`
Expected: `okf-lint: OK`, 종료 코드 0.

- [ ] **Step 6: 커밋**

```bash
git add tools/okf-lint/test/fixtures/good/decisions
git commit -m "test(okf-lint): add supersession chain golden fixture"
```

---

## 문서 반영 (구현 후 마지막 커밋)

코드가 아니지만 설계 일관성을 위해 같은 PR에서 갱신한다(불변규칙 4: 영향 concept 동시 갱신의 정신).

- [ ] **CLAUDE.md §4 frontmatter 규칙**: 권장 필드에 `supersedes`, `superseded_by`(`[[decisions/<id>]]`) 추가 1줄. 규칙 "`superseded_by` 있으면 `status: deprecated`" 1줄.
- [ ] **설계 spec(2026-06-25) 갱신**: §7 빌드 루프에 트리거 ②(raw ingest, 사람 승인) 추가, §9 운영 루프와 "공유 등뼈" 통합 명시, §5에 supersession 필드, §10 OQ#4를 "사람 승인 선행으로 부분 해소"로 갱신. (위 "설계 결정" 절을 출처로.)
- [ ] **PROJECT_STATUS.md**: 변경 로그에 본 작업 + supersession 토대 추가. §6 후속 항목의 "예약 파일 skip"을 ✅로.
- [ ] 커밋:

```bash
git add CLAUDE.md docs/superpowers/specs/2026-06-25-llm-wiki-okf-si-harness-design.md PROJECT_STATUS.md
git commit -m "docs: capture ingest/reconcile/supersession design + supersession schema"
```

---

## 후속 sub-project (본 계획 범위 밖 — 각자 spec→plan 필요)

본 계획은 **결정적 토대**만 만든다. 트리거 ②의 나머지는 LLM 작업이라 TDD 스크립트 형태가 아니며, 별도 사이클로 진행한다:

- **sub-project H — `ingest` 스킬 (일반화 트리거)**: 임의 raw 산출물 → 카테고리 분류·`raw/<cat>/` 적재 → `log[ingest]` + index 갱신 → spec-author 호출 → **사람 승인 후** 기록(D-INGEST-2). `define-screen`/`on-confirm`을 이 일반 트리거의 특수화로 리팩터.
- **sub-project D' — spec-author 정합(reconcile) 모드**: 백지 생성이 아니라 **기존 그래프 진입 → 영향 concept diff → 정제/대체 제안**. supersession 체인을 작성(deprecated 전이 + ADR 쌍). OQ#6(process↔capability 경계)와 함께 spec 필요.
- **sub-project F — wiki-lint 야간 배치**: D-INGEST-4로 우선도 상승. 의미적 모순·orphan·출처 누락. OQ#5.
- **sub-project B — drift-check**: 코드↔wiki 게이트. 순수 wiki ingest PR(코드 변경 없음)에는 트리거되지 않음 — 그쪽은 okf-lint(구조) + wiki-lint(의미)가 커버.

---

## Self-Review

**1. Spec/요구 커버리지:**
- "사람 확인 절차" → D-INGEST-2로 설계 캡처 + 후속 H/D'에서 구현(본 계획은 토대). ✓
- "이 후 수정은 어떻게 될까(supersession)" → D-INGEST-3 + Task 2·3·4(링크·status 규칙·골든 fixture). ✓
- 불규칙 ingest를 받을 자리(예약 파일 혼재) → Task 1. ✓
- 히스토리 보존(과거 why) → deprecated 보존 + ADR 체인(D-INGEST-3, Task 4 fixture). ✓
- 결정적 게이트와 의미 게이트 분리 → 후속 F 명시, 본 계획은 결정적 규칙만. ✓

**2. Placeholder 스캔:** "TBD"/"적절히 처리"/"Task N과 유사"/"위 내용 테스트" 류 없음. 모든 코드 step에 실제 코드, 모든 실행 step에 명령 + 기대 결과. fixture 본문의 한글 prose는 작성 내용이지 placeholder 아님.

**3. 타입 정합성:** `extractLinks(fm, body)`/`resolveLink(target, roots)` 시그니처 불변(Task 2). `validateFrontmatter(fm, {id, folder})` 시그니처 불변, 반환은 에러 문자열 배열(Task 3). `lintBundle({wikiRoot, linkRoots})`/`walk(dir)` 불변(Task 1). 새 frontmatter 키 `supersedes`/`superseded_by`는 Task 2(추출)·Task 3(status 규칙)·Task 4(fixture)에서 동일 철자로 사용. 에러 메시지 문자열 `"superseded_by requires status: deprecated"`가 Task 3 구현·테스트에서 일치. 회귀 테스트 카운트(27)는 기존 23 + 신규 4(lint 1, links 2, schema… 실제 schema 2개·links 2개·lint 1개 = 5)로 추정치이므로 Step에서는 `# fail 0`만 단언하고 총계는 참고치로 둔다.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-27-ingest-reconcile-supersession.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — task마다 fresh subagent, task 사이 리뷰, 빠른 반복.

**2. Inline Execution** — executing-plans로 이 세션에서 체크포인트 단위 일괄 실행.

**Which approach?**
