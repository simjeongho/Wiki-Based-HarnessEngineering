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
