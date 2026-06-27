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
