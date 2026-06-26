import { readdirSync, readFileSync } from 'node:fs'
import { join, basename, relative, sep } from 'node:path'
import { parseDocument } from './frontmatter.js'
import { validateFrontmatter } from './schema.js'
import { extractLinks, resolveLink } from './links.js'

/**
 * Lint a single concept file.
 * @param {string} absPath
 * @param {{wikiRoot: string, linkRoots: string[]}} ctx
 * @returns {Array<{file:string,level:string,rule:string,message:string}>}
 */
export function lintFile(absPath, { wikiRoot, linkRoots }) {
  const findings = []
  const rel = relative(wikiRoot, absPath)
  const folder = rel.split(sep)[0]
  const id = basename(absPath, '.md')
  const push = (rule, message) => findings.push({ file: rel, level: 'error', rule, message })

  const text = readFileSync(absPath, 'utf8')
  const { frontmatter, body, error } = parseDocument(text)
  if (error) {
    push('frontmatter', error)
    return findings
  }

  for (const msg of validateFrontmatter(frontmatter, { id, folder })) {
    push('schema', msg)
  }
  for (const target of extractLinks(frontmatter, body)) {
    if (!resolveLink(target, linkRoots)) push('links', `broken link: [[${target}]]`)
  }
  return findings
}

/**
 * Walk a bundle and lint every concept file under it.
 * @param {{wikiRoot: string, linkRoots?: string[]}} opts
 */
export function lintBundle({ wikiRoot, linkRoots }) {
  const roots = linkRoots ?? [wikiRoot]
  const findings = []
  for (const file of walk(wikiRoot)) {
    findings.push(...lintFile(file, { wikiRoot, linkRoots: roots }))
  }
  return findings
}

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...walk(full))
    } else if (entry.name.endsWith('.md') && !entry.name.startsWith('_')) {
      out.push(full)
    }
  }
  return out
}
