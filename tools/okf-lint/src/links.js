import { existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Collect every [[folder/id]] target from frontmatter.related/supersedes/superseded_by and the body.
 * 검사 내역
 * 1. 본문, related의 [[폴더/id]] 교차 링크가 실제 존재하는 파일을 가리키는가?(가리키고 있는 파일이 없어지거나 할루시네이션은 아닌가?)
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
  const scanField = (v) => {
    if (Array.isArray(v)) v.forEach(scan)
    else scan(v)
  }
  if (fm) {
    scanField(fm.related)
    scanField(fm.supersedes)
    scanField(fm.superseded_by)
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
