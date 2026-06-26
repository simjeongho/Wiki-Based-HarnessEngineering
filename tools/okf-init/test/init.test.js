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
