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
    const parsed = parse(match[1]) ?? {}
    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { frontmatter: null, body: match[2], error: 'invalid yaml: frontmatter is not a mapping' }
    }
    return { frontmatter: parsed, body: match[2] }
  } catch (e) {
    return { frontmatter: null, body: match[2], error: `invalid yaml: ${e.message}` }
  }
}
