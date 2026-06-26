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
