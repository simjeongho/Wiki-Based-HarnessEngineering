# OKF 토대 — 템플릿 + okf-lint 구현 계획

> **에이전트 작업자용:** 필수 서브스킬: superpowers:subagent-driven-development(권장) 또는 superpowers:executing-plans 로 이 계획을 task 단위로 구현하라. 각 step은 체크박스(`- [ ]`) 문법으로 추적한다.

**목표:** LLM-Wiki/OKF SI 하네스에서 **열린 질문에 막히지 않는 토대**를 구축한다 — OKF concept 구조 표준(타입별 템플릿), 적합성 검증기(`okf-lint`), 프로젝트 번들 스캐폴드(`okf-init`). 이로써 이후 모든 sub-project(drift-check, define-screen, spec-author, wiki-lint, operate)가 **이미 정의되고 기계적으로 검사 가능한 구조**를 읽고 쓰게 된다.

**아키텍처:** 이 저장소가 곧 재사용 프레임워크 `okf-commons` 다. `templates/`(타입별 OKF concept 템플릿)와 `tools/`(작은 Node 패키지 2개: `okf-lint`는 OKF 번들의 frontmatter + 교차링크를 검증, `okf-init`은 신규 프로젝트의 `raw/ wiki/ log/` 골격 + `index.md` 를 스캐폴드)를 추가한다. `okf-lint`는 독립적으로 테스트되는 순수 모듈들로 구성된다(frontmatter 파서 → schema 검증 → 링크 해석 → 오케스트레이터 → CLI). §10의 어떤 열린 질문도 이 범위를 건드리지 않는다.

**기술 스택:** Node.js ≥ 20(`node:test` 용), ES 모듈, 테스트는 `node:test` + `node:assert/strict`, frontmatter 파싱은 `yaml` npm 패키지. 그 외 런타임 의존성 없음.

**검증 철학 (하이브리드 — 합의됨):** 이 프로젝트의 검증은 두 갈래로 나뉜다. **(a) 기계적 판정(맞다/틀리다가 명확)은 결정적 스크립트로** — okf-lint(필수필드·enum·깨진 링크)는 PR에서 머지를 차단(spec §8 동기 게이트)한다. 머지를 막으려면 결정적이어야 하므로 LLM이 아닌 스크립트다. **(b) 판단·해석이 필요한 일은 LLM 스킬로** — 작성(frontmatter 채우기·규칙 승격), 그리고 **링크를 타고 다니며 의미적 모순을 찾는 일**은 야간 wiki-lint 스킬(spec §8 비동기 배치, sub-project F, OQ#5)이 맡는다. 본 계획(sub-project A)은 (a)의 토대만 만든다.

## 전역 제약 (Global Constraints)

아래는 설계 spec(`docs/superpowers/specs/2026-06-25-llm-wiki-okf-si-harness-design.md` §5, §8, D5, D7, D13)에서 그대로 가져온 것이다. 모든 task의 요구사항은 이 절을 암묵적으로 포함한다. enum 값은 **그대로(verbatim)** 복사하라 — 의역 금지.

- **concept `type` enum (verbatim):** `capability | process | entity | query | interface | policy | decision | infrastructure | runbook | reference`
- **`status` enum (verbatim):** `draft | confirmed | implemented | deprecated`
- **`layer` facet enum (verbatim):** `business | data | application | infrastructure | quality | governance`
- **필수 frontmatter 필드(모든 concept):** `id`, `type`, `title`, `status`, `sources` (sources 비어있으면 안 됨 — D7: 모든 wiki 문서는 `raw/` 출처를 기재).
- **`id` 는 파일명과 일치**(kebab-case, `.md` 제외). **`type` 은 폴더와 일치** — 정규 폴더→타입 맵(`capabilities`→`capability`, `processes`→`process`, `entities`→`entity`, `queries`→`query`, `interfaces`→`interface`, `policies`→`policy`, `decisions`→`decision`, `infrastructure`→`infrastructure`, `runbooks`→`runbook`, `references`→`reference`).
- **교차링크 형식:** `[[<folder>/<id>]]` (예: `[[entities/member]]`). 링크는 번들(또는 제공된 commons 번들) 안에 `<linkRoot>/<folder>/<id>.md` 가 존재할 때만 유효. 해석 전 앵커(`#section`)는 제거한다.
- **`raw/` 는 불변**(D5): 스캐폴드는 `raw/` 를 *생성*할 수 있으나, 본 계획의 어떤 도구도 `raw/` 안에 내용을 쓰지 않는다.
- **인덱스 중복 금지**(D13): 스캐폴드는 단일 `index.md` 카탈로그 스텁을 작성한다. `wiki/` 자체에는 index를 두지 않는다.
- **모든 코드와 식별자는 영어**. 한글은 템플릿 예시 본문과 `index.md` 스텁 안에서만 그대로 유지한다(도메인 용어이므로).
- 아래 모든 명령은 저장소 루트에서 실행한다: `C:\Users\simje\Ai\pi-dev-harness\Wiki-Based-HarnessEngineering`. Node 테스트 파일은 fixture 를 테스트 파일 기준 상대경로로 찾으므로 cwd 의 영향을 받지 않는다.

---

### Task 1: okf-lint 패키지 셋업 + frontmatter 파서

**파일:**
- 생성: `tools/okf-lint/package.json`
- 생성: `tools/okf-lint/.gitignore`
- 생성: `tools/okf-lint/src/frontmatter.js`
- 테스트: `tools/okf-lint/test/frontmatter.test.js`

**인터페이스:**
- 소비(Consumes): `yaml` 패키지(`import { parse } from 'yaml'`).
- 생산(Produces): `parseDocument(text: string) -> { frontmatter: object|null, body: string, error?: string }`. 성공 시 `error` 는 `undefined`, `frontmatter` 는 파싱된 매핑(블록이 비었으면 `{}`). 실패 시 `error` 는 `"missing frontmatter"` 또는 `"invalid yaml: <msg>"` 이고 `frontmatter` 는 `null`. CRLF 입력은 파싱 전 LF 로 정규화한다.

- [ ] **Step 1: `tools/okf-lint/package.json` 생성**

```json
{
  "name": "okf-lint",
  "version": "0.1.0",
  "description": "OKF bundle conformance linter for the LLM-Wiki SI harness",
  "type": "module",
  "bin": {
    "okf-lint": "src/cli.js"
  },
  "scripts": {
    "test": "node --test"
  },
  "dependencies": {
    "yaml": "^2.4.0"
  }
}
```

- [ ] **Step 2: `tools/okf-lint/.gitignore` 생성**

```gitignore
node_modules/
```

- [ ] **Step 3: 의존성 설치**

실행: `npm install --prefix tools/okf-lint`
기대 결과: `tools/okf-lint/node_modules/` 와 `tools/okf-lint/package-lock.json` 생성, `added N packages` 출력.

- [ ] **Step 4: 실패하는 테스트 작성**

`tools/okf-lint/test/frontmatter.test.js` 생성:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseDocument } from '../src/frontmatter.js'

test('parses valid frontmatter and body', () => {
  const text = '---\nid: signup\ntype: capability\n---\n## Body\nhello\n'
  const { frontmatter, body, error } = parseDocument(text)
  assert.equal(error, undefined)
  assert.equal(frontmatter.id, 'signup')
  assert.equal(frontmatter.type, 'capability')
  assert.match(body, /## Body/)
})

test('reports missing frontmatter', () => {
  const { frontmatter, error } = parseDocument('no frontmatter here')
  assert.equal(frontmatter, null)
  assert.equal(error, 'missing frontmatter')
})

test('reports invalid yaml', () => {
  const { error } = parseDocument('---\nid: [unclosed\n---\nbody\n')
  assert.match(error, /invalid yaml/)
})

test('handles CRLF line endings', () => {
  const { frontmatter, error } = parseDocument('---\r\nid: x\r\n---\r\nbody\r\n')
  assert.equal(error, undefined)
  assert.equal(frontmatter.id, 'x')
})
```

- [ ] **Step 5: 테스트 실행하여 실패 확인**

실행: `node --test tools/okf-lint/test/frontmatter.test.js`
기대 결과: 실패 — `Cannot find module '.../tools/okf-lint/src/frontmatter.js'` (모듈이 아직 없음).

- [ ] **Step 6: 최소 구현 작성**

`tools/okf-lint/src/frontmatter.js` 생성:

```js
import { parse } from 'yaml'

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/

/**
 * Split a markdown document into YAML frontmatter and body.
 * @param {string} text
 * @returns {{frontmatter: object|null, body: string, error?: string}}
 */
export function parseDocument(text) {
  const normalized = text.replace(/\r\n/g, '\n')
  const match = normalized.match(FRONTMATTER_RE)
  if (!match) {
    return { frontmatter: null, body: normalized, error: 'missing frontmatter' }
  }
  try {
    const frontmatter = parse(match[1]) ?? {}
    return { frontmatter, body: match[2] }
  } catch (e) {
    return { frontmatter: null, body: match[2], error: `invalid yaml: ${e.message}` }
  }
}
```

- [ ] **Step 7: 테스트 실행하여 통과 확인**

실행: `node --test tools/okf-lint/test/frontmatter.test.js`
기대 결과: 통과 — `# pass 4`, `# fail 0`.

- [ ] **Step 8: 커밋**

```bash
git add tools/okf-lint/package.json tools/okf-lint/package-lock.json tools/okf-lint/.gitignore tools/okf-lint/src/frontmatter.js tools/okf-lint/test/frontmatter.test.js
git commit -m "feat(okf-lint): add frontmatter parser with YAML + CRLF handling"
```

---

### Task 2: schema 상수 + frontmatter 검증

**파일:**
- 생성: `tools/okf-lint/src/schema.js`
- 테스트: `tools/okf-lint/test/schema.test.js`

**인터페이스:**
- 소비: 없음(순수 모듈).
- 생산:
  - `CONCEPT_TYPES: string[]`, `STATUSES: string[]`, `LAYERS: string[]`, `FOLDER_TO_TYPE: Record<string,string>`, `REQUIRED_FIELDS: string[]` — 전역 제약의 enum 을 그대로(verbatim).
  - `validateFrontmatter(fm: object|null, ctx: { id?: string, folder?: string }) -> string[]` — 사람이 읽을 수 있는 에러 메시지 배열 반환(빈 배열 = 유효). `ctx.id` 는 기대 id(파일명), `ctx.folder` 는 포함 폴더명.

- [ ] **Step 1: 실패하는 테스트 작성**

`tools/okf-lint/test/schema.test.js` 생성:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateFrontmatter, CONCEPT_TYPES, STATUSES, LAYERS } from '../src/schema.js'

test('enums match the spec verbatim', () => {
  assert.deepEqual(CONCEPT_TYPES, [
    'capability', 'process', 'entity', 'query', 'interface',
    'policy', 'decision', 'infrastructure', 'runbook', 'reference',
  ])
  assert.deepEqual(STATUSES, ['draft', 'confirmed', 'implemented', 'deprecated'])
  assert.deepEqual(LAYERS, [
    'business', 'data', 'application', 'infrastructure', 'quality', 'governance',
  ])
})

test('valid frontmatter yields no errors', () => {
  const fm = {
    id: 'signup', type: 'capability', title: '회원가입', status: 'confirmed',
    layer: 'business', sources: [{ path: 'raw/화면정의서/signup.md' }],
  }
  assert.deepEqual(validateFrontmatter(fm, { id: 'signup', folder: 'capabilities' }), [])
})

test('missing required fields are reported', () => {
  const errs = validateFrontmatter({ type: 'capability' }, { id: 'x', folder: 'capabilities' })
  assert.ok(errs.some(e => e.includes('missing required field: id')))
  assert.ok(errs.some(e => e.includes('missing required field: title')))
  assert.ok(errs.some(e => e.includes('missing required field: status')))
  assert.ok(errs.some(e => e.includes('missing required field: sources')))
})

test('invalid enum values are reported', () => {
  const errs = validateFrontmatter(
    { id: 'x', type: 'widget', title: 't', status: 'wip', layer: 'space', sources: [{ path: 'r' }] },
    { id: 'x', folder: 'capabilities' })
  assert.ok(errs.some(e => e.includes('invalid type: widget')))
  assert.ok(errs.some(e => e.includes('invalid status: wip')))
  assert.ok(errs.some(e => e.includes('invalid layer: space')))
})

test('id must match the filename', () => {
  const errs = validateFrontmatter(
    { id: 'other', type: 'entity', title: 't', status: 'draft', sources: [{ path: 'r' }] },
    { id: 'member', folder: 'entities' })
  assert.ok(errs.some(e => e.includes('does not match filename')))
})

test('type must match the folder', () => {
  const errs = validateFrontmatter(
    { id: 'member', type: 'entity', title: 't', status: 'draft', sources: [{ path: 'r' }] },
    { id: 'member', folder: 'capabilities' })
  assert.ok(errs.some(e => e.includes('does not match folder')))
})

test('empty or pathless sources are reported', () => {
  const empty = validateFrontmatter(
    { id: 'x', type: 'entity', title: 't', status: 'draft', sources: [] },
    { id: 'x', folder: 'entities' })
  assert.ok(empty.some(e => e.includes('sources must not be empty')))

  const pathless = validateFrontmatter(
    { id: 'x', type: 'entity', title: 't', status: 'draft', sources: [{ ref: 'A1' }] },
    { id: 'x', folder: 'entities' })
  assert.ok(pathless.some(e => e.includes('sources[0] missing path')))
})
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

실행: `node --test tools/okf-lint/test/schema.test.js`
기대 결과: 실패 — `Cannot find module '.../tools/okf-lint/src/schema.js'`.

- [ ] **Step 3: 최소 구현 작성**

`tools/okf-lint/src/schema.js` 생성:

```js
export const CONCEPT_TYPES = [
  'capability', 'process', 'entity', 'query', 'interface',
  'policy', 'decision', 'infrastructure', 'runbook', 'reference',
]

export const STATUSES = ['draft', 'confirmed', 'implemented', 'deprecated']

export const LAYERS = [
  'business', 'data', 'application', 'infrastructure', 'quality', 'governance',
]

export const FOLDER_TO_TYPE = {
  capabilities: 'capability',
  processes: 'process',
  entities: 'entity',
  queries: 'query',
  interfaces: 'interface',
  policies: 'policy',
  decisions: 'decision',
  infrastructure: 'infrastructure',
  runbooks: 'runbook',
  references: 'reference',
}

export const REQUIRED_FIELDS = ['id', 'type', 'title', 'status', 'sources']

/**
 * Validate one concept's frontmatter against the OKF schema.
 * @param {object|null} fm
 * @param {{id?: string, folder?: string}} ctx
 * @returns {string[]} error messages (empty = valid)
 */
export function validateFrontmatter(fm, { id, folder } = {}) {
  if (!fm || typeof fm !== 'object' || Array.isArray(fm)) {
    return ['frontmatter is empty or not a mapping']
  }

  const errors = []

  for (const field of REQUIRED_FIELDS) {
    const v = fm[field]
    if (v === undefined || v === null || v === '') {
      errors.push(`missing required field: ${field}`)
    }
  }

  if (fm.type !== undefined && !CONCEPT_TYPES.includes(fm.type)) {
    errors.push(`invalid type: ${fm.type}`)
  }
  if (fm.status !== undefined && !STATUSES.includes(fm.status)) {
    errors.push(`invalid status: ${fm.status}`)
  }
  if (fm.layer !== undefined && !LAYERS.includes(fm.layer)) {
    errors.push(`invalid layer: ${fm.layer}`)
  }

  if (fm.id !== undefined && id !== undefined && fm.id !== id) {
    errors.push(`id "${fm.id}" does not match filename "${id}"`)
  }

  if (folder && FOLDER_TO_TYPE[folder] && fm.type !== undefined) {
    const expected = FOLDER_TO_TYPE[folder]
    if (fm.type !== expected) {
      errors.push(`type "${fm.type}" does not match folder "${folder}" (expected "${expected}")`)
    }
  }

  if (Array.isArray(fm.sources)) {
    if (fm.sources.length === 0) {
      errors.push('sources must not be empty')
    } else {
      fm.sources.forEach((s, i) => {
        if (!s || typeof s !== 'object' || !s.path) {
          errors.push(`sources[${i}] missing path`)
        }
      })
    }
  } else if (fm.sources !== undefined && fm.sources !== null) {
    errors.push('sources must be a list')
  }

  return errors
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

실행: `node --test tools/okf-lint/test/schema.test.js`
기대 결과: 통과 — `# pass 7`, `# fail 0`.

- [ ] **Step 5: 커밋**

```bash
git add tools/okf-lint/src/schema.js tools/okf-lint/test/schema.test.js
git commit -m "feat(okf-lint): add OKF schema enums and frontmatter validation"
```

---

### Task 3: 교차링크 추출 + 해석

**파일:**
- 생성: `tools/okf-lint/src/links.js`
- 테스트: `tools/okf-lint/test/links.test.js`

**인터페이스:**
- 소비: 없음(순수 + `node:fs`/`node:path`).
- 생산:
  - `extractLinks(fm: object|null, body: string) -> string[]` — `fm.related`(문자열 배열)와 `body` 에서 찾은 모든 고유 `[[<folder>/<id>]]` 타겟. 둘러싼 `[[ ]]` 는 제거하고 trim.
  - `resolveLink(target: string, roots: string[]) -> boolean` — `roots` 중 한 곳에서 `<root>/<앵커제거-target>.md` 가 존재하면 `true`.
- **범위 주의:** 이 검사는 **구조적(파일 존재 여부)만** 한다. "링크를 타고 가서 대상 문서와 의미적으로 모순되지 않는가"는 판단 영역이므로 **여기서 하지 않는다** — 야간 wiki-lint LLM 스킬(sub-project F, spec §8 비동기 배치)이 링크 그래프를 순회하며 처리하며, 이는 OQ#5에 대한 구체적 답이다. 결정적 머지 게이트(okf-lint)에 비결정적 의미 검사를 섞지 않는다.

- [ ] **Step 1: 실패하는 테스트 작성**

`tools/okf-lint/test/links.test.js` 생성:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { extractLinks, resolveLink } from '../src/links.js'

test('extracts and de-duplicates links from related and body', () => {
  const fm = { related: ['[[entities/member]]', '[[policies/pw]]'] }
  const body = 'see [[queries/q1]] and [[entities/member]] again'
  assert.deepEqual(
    extractLinks(fm, body).sort(),
    ['entities/member', 'policies/pw', 'queries/q1'])
})

test('extractLinks tolerates missing related', () => {
  assert.deepEqual(extractLinks({}, 'no links'), [])
  assert.deepEqual(extractLinks(null, 'no links'), [])
})

test('resolveLink finds an existing concept file', () => {
  const root = mkdtempSync(join(tmpdir(), 'okf-links-'))
  mkdirSync(join(root, 'entities'), { recursive: true })
  writeFileSync(join(root, 'entities', 'member.md'), '---\nid: member\n---\n')
  assert.equal(resolveLink('entities/member', [root]), true)
  assert.equal(resolveLink('entities/ghost', [root]), false)
})

test('resolveLink strips anchors before resolving', () => {
  const root = mkdtempSync(join(tmpdir(), 'okf-links-'))
  mkdirSync(join(root, 'entities'), { recursive: true })
  writeFileSync(join(root, 'entities', 'member.md'), '')
  assert.equal(resolveLink('entities/member#attributes', [root]), true)
})
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

실행: `node --test tools/okf-lint/test/links.test.js`
기대 결과: 실패 — `Cannot find module '.../tools/okf-lint/src/links.js'`.

- [ ] **Step 3: 최소 구현 작성**

`tools/okf-lint/src/links.js` 생성:

```js
import { existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Collect every [[folder/id]] target from frontmatter.related and the body.
 * @param {object|null} fm
 * @param {string} body
 * @returns {string[]} unique targets, [[ ]] stripped
 */
export function extractLinks(fm, body) {
  const targets = new Set()
  const scan = (text) => {
    if (typeof text !== 'string') return
    const re = /\[\[([^\]]+)\]\]/g
    let m
    while ((m = re.exec(text)) !== null) targets.add(m[1].trim())
  }
  if (fm && Array.isArray(fm.related)) {
    for (const r of fm.related) scan(r)
  }
  scan(body)
  return [...targets]
}

/**
 * @param {string} target  e.g. "entities/member" or "entities/member#attrs"
 * @param {string[]} roots bundle roots to resolve against
 * @returns {boolean}
 */
export function resolveLink(target, roots) {
  const clean = target.split('#')[0].trim()
  return roots.some((root) => existsSync(join(root, `${clean}.md`)))
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

실행: `node --test tools/okf-lint/test/links.test.js`
기대 결과: 통과 — `# pass 4`, `# fail 0`.

- [ ] **Step 5: 커밋**

```bash
git add tools/okf-lint/src/links.js tools/okf-lint/test/links.test.js
git commit -m "feat(okf-lint): add cross-link extraction and resolution"
```

---

### Task 4: lint 오케스트레이션 + fixtures

**파일:**
- 생성: `tools/okf-lint/src/lint.js`
- 생성: `tools/okf-lint/test/fixtures/good/capabilities/signup.md`
- 생성: `tools/okf-lint/test/fixtures/good/entities/member.md`
- 생성: `tools/okf-lint/test/fixtures/bad/capabilities/broken.md`
- 테스트: `tools/okf-lint/test/lint.test.js`

**인터페이스:**
- 소비: `parseDocument`(Task 1), `validateFrontmatter`(Task 2), `extractLinks` + `resolveLink`(Task 3).
- 생산:
  - `Finding` 은 `{ file: string, level: 'error', rule: 'frontmatter'|'schema'|'links', message: string }` (`file` 은 번들 상대경로).
  - `lintFile(absPath: string, ctx: { wikiRoot: string, linkRoots: string[] }) -> Finding[]`.
  - `lintBundle(opts: { wikiRoot: string, linkRoots?: string[] }) -> Finding[]` — `wikiRoot` 아래 모든 `.md` 를 순회(이름이 `_` 로 시작하는 파일은 제외), `linkRoots` 기본값은 `[wikiRoot]`.

- [ ] **Step 1: "good" fixture concept 생성**

`tools/okf-lint/test/fixtures/good/capabilities/signup.md` 생성:

```markdown
---
id: signup
type: capability
title: 회원가입
status: confirmed
owner: auth-squad
layer: business
sources:
  - path: raw/화면정의서/signup.md
related:
  - "[[entities/member]]"
---
## 목적
회원 가입 기능. [[entities/member]] 엔티티를 생성한다.
```

`tools/okf-lint/test/fixtures/good/entities/member.md` 생성:

```markdown
---
id: member
type: entity
title: 회원
status: confirmed
owner: auth-squad
layer: data
sources:
  - path: raw/데이터모델/member.md
---
## 속성
- email
- password
```

- [ ] **Step 2: "bad" fixture concept 생성**

`tools/okf-lint/test/fixtures/bad/capabilities/broken.md` 생성:

```markdown
---
id: broken
type: entity
title: 깨진 문서
status: wip
sources: []
related:
  - "[[entities/ghost]]"
---
본문에서 존재하지 않는 [[policies/nonexistent]] 를 가리킨다.
```

- [ ] **Step 3: 실패하는 테스트 작성**

`tools/okf-lint/test/lint.test.js` 생성:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { lintBundle } from '../src/lint.js'

const here = dirname(fileURLToPath(import.meta.url))
const good = join(here, 'fixtures', 'good')
const bad = join(here, 'fixtures', 'bad')

test('clean bundle produces no findings', () => {
  assert.deepEqual(lintBundle({ wikiRoot: good }), [])
})

test('bad bundle reports schema and link errors', () => {
  const findings = lintBundle({ wikiRoot: bad })
  const messages = findings.map(f => f.message)

  assert.ok(messages.some(m => m.includes('sources must not be empty')))
  assert.ok(messages.some(m => m.includes('invalid status: wip')))
  assert.ok(messages.some(m => m.includes('does not match folder')))

  const linkFindings = findings.filter(f => f.rule === 'links')
  assert.equal(linkFindings.length, 2)
  assert.ok(linkFindings.every(f => f.level === 'error'))
})
```

- [ ] **Step 4: 테스트 실행하여 실패 확인**

실행: `node --test tools/okf-lint/test/lint.test.js`
기대 결과: 실패 — `Cannot find module '.../tools/okf-lint/src/lint.js'`.

- [ ] **Step 5: 최소 구현 작성**

`tools/okf-lint/src/lint.js` 생성:

```js
import { readdirSync, readFileSync } from 'node:fs'
import { join, basename, relative, sep } from 'node:path'
import { parseDocument } from './frontmatter.js'
import { validateFrontmatter } from './schema.js'
import { extractLinks, resolveLink } from './links.js'

/**
 * Lint a single concept file.
 * @param {string} absPath
 * @param {{wikiRoot: string, linkRoots: string[]}} ctx
 * @returns {Array<{file:string,level:string,rule:string,message:string}>}
 */
export function lintFile(absPath, { wikiRoot, linkRoots }) {
  const findings = []
  const rel = relative(wikiRoot, absPath)
  const folder = rel.split(sep)[0]
  const id = basename(absPath, '.md')
  const push = (rule, message) => findings.push({ file: rel, level: 'error', rule, message })

  const text = readFileSync(absPath, 'utf8')
  const { frontmatter, body, error } = parseDocument(text)
  if (error) {
    push('frontmatter', error)
    return findings
  }

  for (const msg of validateFrontmatter(frontmatter, { id, folder })) {
    push('schema', msg)
  }
  for (const target of extractLinks(frontmatter, body)) {
    if (!resolveLink(target, linkRoots)) push('links', `broken link: [[${target}]]`)
  }
  return findings
}

/**
 * Walk a bundle and lint every concept file under it.
 * @param {{wikiRoot: string, linkRoots?: string[]}} opts
 */
export function lintBundle({ wikiRoot, linkRoots }) {
  const roots = linkRoots ?? [wikiRoot]
  const findings = []
  for (const file of walk(wikiRoot)) {
    findings.push(...lintFile(file, { wikiRoot, linkRoots: roots }))
  }
  return findings
}

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...walk(full))
    } else if (entry.name.endsWith('.md') && !entry.name.startsWith('_')) {
      out.push(full)
    }
  }
  return out
}
```

- [ ] **Step 6: 테스트 실행하여 통과 확인**

실행: `node --test tools/okf-lint/test/lint.test.js`
기대 결과: 통과 — `# pass 2`, `# fail 0`.

- [ ] **Step 7: 커밋**

```bash
git add tools/okf-lint/src/lint.js tools/okf-lint/test/lint.test.js tools/okf-lint/test/fixtures
git commit -m "feat(okf-lint): add bundle lint orchestration with golden fixtures"
```

---

### Task 5: CLI 진입점 + 통합 테스트

**파일:**
- 생성: `tools/okf-lint/src/cli.js`
- 테스트: `tools/okf-lint/test/cli.test.js`

**인터페이스:**
- 소비: `lintBundle`(Task 4); "good"·"bad" fixtures(Task 4).
- 생산: 실행 가능한 CLI `node src/cli.js <wikiRoot> [--commons <commonsRoot>]`. 각 finding 을 **stderr** 에 `ERROR <file> [<rule>] <message>` 로 출력. 깨끗하면 **stdout** 에 `okf-lint: OK` 출력 후 `0` 종료. error finding 이 있으면 `1` 종료. `<wikiRoot>` 가 없으면 `2` 종료.

- [ ] **Step 1: 실패하는 테스트 작성**

`tools/okf-lint/test/cli.test.js` 생성:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const cli = join(here, '..', 'src', 'cli.js')
const good = join(here, 'fixtures', 'good')
const bad = join(here, 'fixtures', 'bad')

test('cli exits 0 and prints OK on a clean bundle', () => {
  const out = execFileSync('node', [cli, good], { encoding: 'utf8' })
  assert.match(out, /okf-lint: OK/)
})

test('cli exits 1 on a bundle with errors', () => {
  assert.throws(
    () => execFileSync('node', [cli, bad], { stdio: 'pipe' }),
    (e) => e.status === 1)
})

test('cli exits 2 when the bundle root is missing', () => {
  assert.throws(
    () => execFileSync('node', [cli, join(here, 'fixtures', 'does-not-exist')], { stdio: 'pipe' }),
    (e) => e.status === 2)
})
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

실행: `node --test tools/okf-lint/test/cli.test.js`
기대 결과: 실패 — `src/cli.js` 가 없어 각 테스트가 throw(`Cannot find module`), `e.status` 가 undefined 라 단언 실패.

- [ ] **Step 3: 최소 구현 작성**

`tools/okf-lint/src/cli.js` 생성:

```js
#!/usr/bin/env node
import { argv, exit } from 'node:process'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { lintBundle } from './lint.js'

function main() {
  const args = argv.slice(2)
  const positional = args.filter((a) => !a.startsWith('--'))
  const wikiRoot = resolve(positional[0] ?? 'wiki')

  if (!existsSync(wikiRoot)) {
    console.error(`okf-lint: bundle root not found: ${wikiRoot}`)
    exit(2)
  }

  const linkRoots = [wikiRoot]
  const ci = args.indexOf('--commons')
  if (ci !== -1 && args[ci + 1]) linkRoots.push(resolve(args[ci + 1]))

  const findings = lintBundle({ wikiRoot, linkRoots })
  for (const f of findings) {
    console.error(`${f.level.toUpperCase()} ${f.file} [${f.rule}] ${f.message}`)
  }

  const errors = findings.filter((f) => f.level === 'error').length
  if (errors > 0) {
    console.error(`okf-lint: ${errors} error(s)`)
    exit(1)
  }
  console.log('okf-lint: OK')
  exit(0)
}

main()
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

실행: `node --test tools/okf-lint/test/cli.test.js`
기대 결과: 통과 — `# pass 3`, `# fail 0`.

- [ ] **Step 5: okf-lint 전체 스위트로 회귀 검사**

실행: `npm test --prefix tools/okf-lint`
기대 결과: 통과 — 전 스위트 green, `# fail 0` (frontmatter 4 + schema 7 + links 4 + lint 2 + cli 3 = 총 20개 테스트).

- [ ] **Step 6: 커밋**

```bash
git add tools/okf-lint/src/cli.js tools/okf-lint/test/cli.test.js
git commit -m "feat(okf-lint): add CLI with exit codes and integration tests"
```

---

### Task 6: OKF concept 템플릿 (10개 타입 전부)

**파일:**
- 생성: `templates/capability.md`, `templates/process.md`, `templates/entity.md`, `templates/query.md`, `templates/interface.md`, `templates/policy.md`, `templates/decision.md`, `templates/infrastructure.md`, `templates/runbook.md`, `templates/reference.md`
- 테스트: `tools/okf-lint/test/templates.test.js`

**인터페이스:**
- 소비: `parseDocument`(Task 1), `REQUIRED_FIELDS`(Task 2).
- 생산: 타입별 작성 템플릿 10개. 각각 worked example(필수 필드를 모두 갖춘 유효한 YAML frontmatter + §5 본문 골격). 작성자/에이전트가 새 concept 을 만들 때 복사한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`tools/okf-lint/test/templates.test.js` 생성:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parseDocument } from '../src/frontmatter.js'
import { REQUIRED_FIELDS, CONCEPT_TYPES } from '../src/schema.js'

const here = dirname(fileURLToPath(import.meta.url))
const templatesDir = join(here, '..', '..', '..', 'templates')

test('there is one template per concept type', () => {
  const files = readdirSync(templatesDir).filter(f => f.endsWith('.md')).sort()
  const expected = CONCEPT_TYPES.map(t => `${t}.md`).sort()
  assert.deepEqual(files, expected)
})

test('every template parses and carries all required frontmatter fields', () => {
  for (const file of readdirSync(templatesDir).filter(f => f.endsWith('.md'))) {
    const { frontmatter, error } = parseDocument(readFileSync(join(templatesDir, file), 'utf8'))
    assert.equal(error, undefined, `${file}: ${error}`)
    for (const field of REQUIRED_FIELDS) {
      assert.ok(field in frontmatter, `${file} missing required field: ${field}`)
    }
  }
})
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

실행: `node --test tools/okf-lint/test/templates.test.js`
기대 결과: 실패 — `ENOENT ... templates` (디렉터리가 아직 없음).

- [ ] **Step 3: `templates/capability.md` 생성**

```markdown
---
id: signup
type: capability
title: 회원가입
status: confirmed
owner: auth-squad
layer: business
sources:
  - path: raw/화면정의서/signup.md
    ref: "Sheet2!A1:F30"
code:
  - src/auth/signup/**
related:
  - "[[entities/member]]"
  - "[[policies/password-rule]]"
traces: [REQ-001, REQ-002]
tags: [auth, onboarding]
last_verified: 2026-06-25
---
## 목적
이 기능이 무엇을 가능하게 하는가 (한 문장).

## 화면·UI
- 사용 컴포넌트: [[references/design-system]] 의 컴포넌트 링크

## 흐름
1. 단계 …

## 구성요소
- 엔티티: [[entities/member]]
- 정책: [[policies/password-rule]]
- 인터페이스: [[interfaces/...]]
- 결정: [[decisions/...]]

## 인수 기준 (TDD 시드)
- [ ] …
```

- [ ] **Step 4: `templates/process.md` 생성**

```markdown
---
id: member-onboarding
type: process
title: 회원 온보딩 프로세스
status: draft
owner: auth-squad
layer: business
sources:
  - path: raw/업무정책/onboarding.md
related:
  - "[[capabilities/signup]]"
tags: [onboarding]
---
## 프로세스 목적
여러 capability를 가로지르는 업무 흐름의 목적.

## 단계
1. [[capabilities/signup]] — 가입
2. [[capabilities/...]] — …

## 액터
- 고객 / 운영자 / 시스템

## 분기·예외
- …

## 관련 정책
- [[policies/...]]
```

- [ ] **Step 5: `templates/entity.md` 생성**

```markdown
---
id: member
type: entity
title: 회원
status: confirmed
owner: auth-squad
layer: data
sources:
  - path: raw/데이터모델/member.md
related:
  - "[[policies/password-rule]]"
tags: [auth]
---
## 업무적 의미
이 엔티티가 업무에서 의미하는 바.

## 속성
| 속성 | 타입 | 설명 |
|---|---|---|
| email | string | 로그인 식별자 |

## 불변 규칙
- [[policies/password-rule]]

## 관계
- …

## 사용처
- [[capabilities/signup]]
```

- [ ] **Step 6: `templates/query.md` 생성**

```markdown
---
id: active-members-by-region
type: query
title: 지역별 활성 회원 집계
status: draft
owner: data-squad
layer: data
sources:
  - path: raw/레거시SQL/active_members.sql
code:
  - src/reports/active_members.sql
related:
  - "[[entities/member]]"
tags: [report, legacy-sql]
---
## 하는 일 (평문)
이 쿼리가 무엇을 반환하는지 평문으로.

## 건드리는 테이블·엔티티
- [[entities/member]]

## 박힌 업무 규칙 → policies 승격
- 추출한 규칙: [[policies/...]]

## 입출력
- 입력 / 출력 컬럼 …

## 왜 이렇게 짰는가
- [[decisions/...]]

## 코드 위치
- `src/reports/active_members.sql`
```

- [ ] **Step 7: `templates/interface.md` 생성**

```markdown
---
id: payment-gateway
type: interface
title: 결제 게이트웨이 연계
status: draft
owner: payments-squad
layer: application
sources:
  - path: raw/인터페이스정의서/payment.md
related:
  - "[[capabilities/checkout]]"
tags: [external, api]
---
## 프로토콜
REST / SOAP / MQ …

## 요청·응답 스키마
- 요청: …
- 응답: …

## 시퀀스
원본 다이어그램: raw/인터페이스정의서/payment-sequence.png

## 에러 처리
- …

## 외부 시스템 / 소유자
- 시스템: … / 소유자: …
```

- [ ] **Step 8: `templates/policy.md` 생성**

```markdown
---
id: password-rule
type: policy
title: 비밀번호 규칙
status: confirmed
owner: auth-squad
layer: governance
sources:
  - path: raw/업무정책/password.md
related:
  - "[[capabilities/signup]]"
traces: [REQ-002]
tags: [auth, security]
---
## 규칙 (단정문)
비밀번호는 최소 10자, 영문·숫자·특수문자를 포함한다.

## 근거 (why)
이 규칙이 존재하는 이유.

## 출처
- 명시: raw/업무정책/password.md (또는 [[queries/...]] 에서 역추출)

## 영향 기능
- [[capabilities/signup]]

## 예외
- …
```

- [ ] **Step 9: `templates/decision.md` 생성**

```markdown
---
id: use-jwt-sessions
type: decision
title: 세션을 JWT로 관리
status: confirmed
owner: auth-squad
layer: application
sources:
  - path: raw/회의록·계약·제안서/2026-06-20-auth-design.md
related:
  - "[[capabilities/signup]]"
tags: [adr, auth]
---
## 맥락
어떤 문제·제약 하에서 결정했는가.

## 결정
무엇을 하기로 했는가.

## 대안 (기각 사유)
- 대안 A — 기각 사유
- 대안 B — 기각 사유

## 결과 (트레이드오프)
- 긍정 / 부정 영향
```

- [ ] **Step 10: `templates/infrastructure.md` 생성**

```markdown
---
id: prod-topology
type: infrastructure
title: 운영 환경 토폴로지
status: draft
owner: platform-squad
layer: infrastructure
sources:
  - path: raw/인프라/topology.md
related:
  - "[[runbooks/deploy]]"
tags: [ops]
---
## 환경 구성
- dev / stg / prod …

## 배포 방식
- …

## 의존 서비스
- …

## 관련 runbook
- [[runbooks/deploy]]
```

- [ ] **Step 11: `templates/runbook.md` 생성**

```markdown
---
id: deploy
type: runbook
title: 배포 절차
status: draft
owner: platform-squad
layer: quality
sources:
  - path: raw/운영/deploy-runbook.md
related:
  - "[[infrastructure/prod-topology]]"
tags: [ops]
---
## 시나리오
언제 이 절차를 수행하는가.

## 증상
- …

## 조치 단계
1. …

## 롤백
- …

## 관련 capabilities·queries
- [[capabilities/...]]
```

- [ ] **Step 12: `templates/reference.md` 생성**

```markdown
---
id: design-system
type: reference
title: 디자인 시스템 사용 계약
status: confirmed
owner: platform-squad
layer: application
sources:
  - path: raw/공통/design-system-readme.md
related:
  - "[[capabilities/signup]]"
tags: [commons, ui]
---
## 무엇에 대한 레퍼런스인가
코드로 존재하는 공통 자산의 "사용 계약" 인덱스 (재구현 아님 — 코드가 진실).

## 사용법 / 계약
- 컴포넌트 / 토큰 / 진입점 …

## 코드 위치
- `src/...` (또는 commons 패키지)
```

- [ ] **Step 13: 테스트 실행하여 통과 확인**

실행: `node --test tools/okf-lint/test/templates.test.js`
기대 결과: 통과 — `# pass 2`, `# fail 0`.

- [ ] **Step 14: 커밋**

```bash
git add templates tools/okf-lint/test/templates.test.js
git commit -m "feat(templates): add OKF concept templates for all 10 types"
```

---

### Task 7: okf-init — 프로젝트 번들 스캐폴드

**파일:**
- 생성: `tools/okf-init/package.json`
- 생성: `tools/okf-init/src/init.js`
- 생성: `tools/okf-init/src/cli.js`
- 테스트: `tools/okf-init/test/init.test.js`

**인터페이스:**
- 소비: 없음(순수 + `node:fs`/`node:path`).
- 생산:
  - `WIKI_FOLDERS: string[]` — `wiki/` 타입 폴더 10개(`FOLDER_TO_TYPE` 의 복수형 폴더명).
  - `initBundle(targetDir: string) -> string[]` — `raw/`, `log/`, `wiki/<type>/`(각각 `.gitkeep` 포함), 루트 `index.md` 카탈로그 스텁을 멱등적으로 생성. 기존 `index.md` 는 **덮어쓰지 않음**. 생성한 디렉터리 목록 반환. **범위 주의:** 프로젝트 소유 디렉터리만 스캐폴드(D5/D13). `commons-wiki/` 상속은 spec §10 열린 질문 #3 으로 의도적 보류.
  - CLI `node src/cli.js [targetDir]` — `initBundle` 실행, `targetDir` 기본값은 현재 디렉터리.

- [ ] **Step 1: `tools/okf-init/package.json` 생성**

```json
{
  "name": "okf-init",
  "version": "0.1.0",
  "description": "Scaffold a project OKF bundle (raw/ wiki/ log/ index.md)",
  "type": "module",
  "bin": {
    "okf-init": "src/cli.js"
  },
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`tools/okf-init/test/init.test.js` 생성:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { initBundle, WIKI_FOLDERS } from '../src/init.js'

test('creates raw, log, wiki type folders, and index.md', () => {
  const dir = mkdtempSync(join(tmpdir(), 'okf-init-'))
  initBundle(dir)
  assert.ok(existsSync(join(dir, 'raw')))
  assert.ok(existsSync(join(dir, 'log')))
  for (const f of WIKI_FOLDERS) {
    assert.ok(existsSync(join(dir, 'wiki', f)), `missing wiki/${f}`)
  }
  assert.ok(existsSync(join(dir, 'index.md')))
})

test('exposes the ten canonical wiki folders', () => {
  assert.deepEqual(WIKI_FOLDERS, [
    'capabilities', 'processes', 'entities', 'queries', 'interfaces',
    'policies', 'decisions', 'infrastructure', 'runbooks', 'references',
  ])
})

test('does not overwrite an existing index.md', () => {
  const dir = mkdtempSync(join(tmpdir(), 'okf-init-'))
  initBundle(dir)
  const indexPath = join(dir, 'index.md')
  writeFileSync(indexPath, '# my catalog\n')
  initBundle(dir)
  assert.equal(readFileSync(indexPath, 'utf8'), '# my catalog\n')
})
```

- [ ] **Step 3: 테스트 실행하여 실패 확인**

실행: `node --test tools/okf-init/test/init.test.js`
기대 결과: 실패 — `Cannot find module '.../tools/okf-init/src/init.js'`.

- [ ] **Step 4: 최소 구현 작성**

`tools/okf-init/src/init.js` 생성:

```js
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export const WIKI_FOLDERS = [
  'capabilities', 'processes', 'entities', 'queries', 'interfaces',
  'policies', 'decisions', 'infrastructure', 'runbooks', 'references',
]

const INDEX_STUB = `# Index — 콘텐츠 카탈로그 (단일 진입점)

> 이 파일은 LLM이 가장 먼저 읽는 진입점이다. ingest마다 갱신한다.
> concept 열거는 이 파일 한 곳에만 둔다 (인덱스 중복 금지 — D13).
> ~100페이지 초과 시 타입별 하위 인덱스(wiki/<type>/_index.md)로 분할한다.

## raw → wiki ingest 기록
| 날짜 | raw 출처 | 생성/갱신 concept |
|---|---|---|

## capabilities

## processes

## entities

## queries

## interfaces

## policies

## decisions

## infrastructure

## runbooks

## references
`

/**
 * Idempotently scaffold a project OKF bundle.
 * Creates project-owned dirs only; commons inheritance is deferred (spec §10 #3).
 * @param {string} targetDir
 * @returns {string[]} directories created (relative)
 */
export function initBundle(targetDir) {
  const created = []
  const mk = (rel) => {
    mkdirSync(join(targetDir, rel), { recursive: true })
    created.push(rel)
  }

  mk('raw')
  writeFileSync(join(targetDir, 'raw', '.gitkeep'), '')
  mk('log')
  writeFileSync(join(targetDir, 'log', '.gitkeep'), '')

  for (const folder of WIKI_FOLDERS) {
    mk(join('wiki', folder))
    writeFileSync(join(targetDir, 'wiki', folder, '.gitkeep'), '')
  }

  const indexPath = join(targetDir, 'index.md')
  if (!existsSync(indexPath)) writeFileSync(indexPath, INDEX_STUB)

  return created
}
```

- [ ] **Step 5: 테스트 실행하여 통과 확인**

실행: `node --test tools/okf-init/test/init.test.js`
기대 결과: 통과 — `# pass 3`, `# fail 0`.

- [ ] **Step 6: CLI 작성**

`tools/okf-init/src/cli.js` 생성:

```js
#!/usr/bin/env node
import { argv } from 'node:process'
import { resolve } from 'node:path'
import { initBundle } from './init.js'

const targetDir = resolve(argv[2] ?? '.')
const created = initBundle(targetDir)
console.log(`okf-init: scaffolded OKF bundle at ${targetDir}`)
console.log(`  created: ${created.join(', ')}`)
```

- [ ] **Step 7: CLI 를 스크래치패드 대상으로 end-to-end 검증**

실행: `node tools/okf-init/src/cli.js "C:/Users/simje/AppData/Local/Temp/claude/C--Users-simje-Ai-pi-dev-harness-Wiki-Based-HarnessEngineering/07b6ae3b-0cbd-4e69-bed9-dd61fe12b2a1/scratchpad/okf-smoke"`
기대 결과: `okf-init: scaffolded OKF bundle at ...okf-smoke` 와 생성 디렉터리 목록 출력.

이어서, 갓 스캐폴드한(빈) 번들을 lint 하여 두 도구가 조립됨을 확인:
실행: `node tools/okf-lint/src/cli.js "C:/Users/simje/AppData/Local/Temp/claude/C--Users-simje-Ai-pi-dev-harness-Wiki-Based-HarnessEngineering/07b6ae3b-0cbd-4e69-bed9-dd61fe12b2a1/scratchpad/okf-smoke/wiki"`
기대 결과: `okf-lint: OK` (빈 번들에는 concept 이 없으므로 finding 없음), 종료 코드 0.

- [ ] **Step 8: 커밋**

```bash
git add tools/okf-init/package.json tools/okf-init/src/init.js tools/okf-init/src/cli.js tools/okf-init/test/init.test.js
git commit -m "feat(okf-init): scaffold project OKF bundle skeleton + index.md stub"
```

---

## 자체 검토 (Self-Review)

**1. spec 커버리지 (sub-project A 범위):**
- §5 공통 frontmatter + 필수 필드 → Task 2(`validateFrontmatter`, `REQUIRED_FIELDS`). ✓
- §5 type/status/layer enum → Task 2(verbatim 상수, 단언으로 검증). ✓
- §5 `id` = 파일명, `type` = 폴더 → Task 2. ✓
- D7 sources 필수 + `path` 보유 → Task 2. ✓
- §8 okf-lint = 필수 frontmatter + 링크 유효성 + OKF 적합성 → Task 2–5. ✓
- §5 교차링크 `[[folder/id]]` 유효성 → Task 3 + Task 4. ✓
- §5 타입별 본문 템플릿(10개) → Task 6. ✓
- §3 스캐폴드 `raw/ wiki/ log/` + §3/D13 단일 `index.md` 카탈로그 → Task 7. ✓
- D5 `raw/` 불변 → 준수(어떤 도구도 `raw/` 안에 쓰지 않음; `okf-init` 은 디렉터리 + `.gitkeep` 만 생성). ✓
- §8 야간 검사(모순, orphan, raw 파일 존재) → **의도적 범위 밖**(sub-project F, OQ#5 로 보류). 여기 okf-lint 는 구조적 source 검사(존재 + `path` 보유)만 하고, raw 파일 on-disk 존재 검사는 하지 않음. ✓
- 열린 질문으로 보류되어 올바르게 제외됨: drift-check/PR 게이트(B, OQ#1), 화면 스키마 직렬화(C, OQ#2), commons 상속 메커니즘(Task 7 범위 주의, OQ#3), SDD 자동/수동 경계(D, OQ#4), 모순 알고리즘(F, OQ#5).

**2. placeholder 스캔:** "TBD"/"엣지 케이스 처리"/"Task N 과 유사"/"위 내용에 대한 테스트 작성" 류 없음. 모든 코드 step 은 완전하고 실행 가능한 코드, 모든 실행 step 은 정확한 명령 + 기대 결과 제공. 템플릿 *본문* 의 `…`/`<...>` 는 작성 가이드(마크다운 내용)이지 코드 placeholder 가 아니며, 템플릿 frontmatter 값은 구체적이고 깔끔히 파싱됨(Task 6 단언으로 검증).

**3. 타입 정합성:** `parseDocument` 는 `{frontmatter, body, error}` 반환 — Task 4·6 에서 동일 형태로 소비. `validateFrontmatter(fm, {id, folder})` 시그니처가 Task 2 정의와 Task 4 호출에서 일치. `lintBundle({wikiRoot, linkRoots})` / `lintFile(absPath, {wikiRoot, linkRoots})` 가 Task 4 정의와 Task 5 CLI 호출에서 일치. `Finding` 형태 `{file, level, rule, message}` 가 Task 4–5 에서 일관. `WIKI_FOLDERS`(Task 7)는 `FOLDER_TO_TYPE` 키(Task 2)와 동일한 복수형 폴더명 사용. `extractLinks(fm, body)` / `resolveLink(target, roots)` 가 Task 3 과 Task 4 에서 일치.

---

## 실행 인계 (Execution Handoff)

**계획 완료, `docs/superpowers/plans/2026-06-26-okf-foundation-templates-lint.md` 에 저장됨. 실행 옵션 두 가지:**

**1. Subagent-Driven (권장)** — task 마다 새 subagent 를 띄우고 task 사이에 리뷰, 빠른 반복.

**2. Inline Execution** — executing-plans 로 이 세션에서 체크포인트 단위 일괄 실행.

**어느 쪽으로 진행할까요?**
