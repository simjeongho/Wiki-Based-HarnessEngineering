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
