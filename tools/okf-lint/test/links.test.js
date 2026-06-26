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
