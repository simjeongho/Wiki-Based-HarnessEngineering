import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
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

test('raw/ source backlinks in body are not treated as concept links', () => {
  const root = mkdtempSync(join(tmpdir(), 'okf-rawlink-'))
  mkdirSync(join(root, 'entities'), { recursive: true })
  // body has a [[raw/...]] source backlink; raw/ is NOT part of the wiki bundle.
  // okf-lint must treat it as a source backlink (Obsidian-navigable), not a concept edge → no broken-link finding.
  writeFileSync(
    join(root, 'entities', 'order.md'),
    '---\nid: order\ntype: entity\ntitle: 주문\nstatus: confirmed\nsources:\n  - path: raw/data-models/order.md\n---\n## 출처\n- [[raw/data-models/order]]\n')
  assert.deepEqual(lintBundle({ wikiRoot: root }), [])
})

test('non-raw broken concept links are still flagged', () => {
  const root = mkdtempSync(join(tmpdir(), 'okf-rawlink2-'))
  mkdirSync(join(root, 'entities'), { recursive: true })
  writeFileSync(
    join(root, 'entities', 'order.md'),
    '---\nid: order\ntype: entity\ntitle: 주문\nstatus: confirmed\nsources:\n  - path: raw/x.md\n---\n## 관계\n- [[entities/ghost]]\n')
  const findings = lintBundle({ wikiRoot: root })
  assert.ok(findings.some(f => f.rule === 'links' && f.message.includes('entities/ghost')))
})

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
