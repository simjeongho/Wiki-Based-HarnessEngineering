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
