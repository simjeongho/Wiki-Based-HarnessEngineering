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
  assert.match(error, /^invalid yaml: .+/)
})

test('handles CRLF line endings', () => {
  const { frontmatter, error } = parseDocument('---\r\nid: x\r\n---\r\nbody\r\n')
  assert.equal(error, undefined)
  assert.equal(frontmatter.id, 'x')
})

test('treats a scalar frontmatter block as invalid', () => {
  const { frontmatter, error } = parseDocument('---\njust a string\n---\nbody\n')
  assert.equal(frontmatter, null)
  assert.match(error, /^invalid yaml: .+/)
})
