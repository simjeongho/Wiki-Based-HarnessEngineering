import { existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Collect every [[folder/id]] target from frontmatter.related and the body.
 * @param {object|null} fm
 * @param {string} body
 * @returns {string[]} unique targets, [[ ]] stripped
 */
export function extractLinks(fm, body) {
  const targets = new Set()
  const scan = (text) => {
    if (typeof text !== 'string') return
    const re = /\[\[([^\]]+)\]\]/g
    let m
    while ((m = re.exec(text)) !== null) targets.add(m[1].trim())
  }
  if (fm && Array.isArray(fm.related)) {
    for (const r of fm.related) scan(r)
  }
  scan(body)
  return [...targets]
}

/**
 * @param {string} target  e.g. "entities/member" or "entities/member#attrs"
 * @param {string[]} roots bundle roots to resolve against
 * @returns {boolean}
 */
export function resolveLink(target, roots) {
  const clean = target.split('#')[0].trim()
  return roots.some((root) => existsSync(join(root, `${clean}.md`)))
}
