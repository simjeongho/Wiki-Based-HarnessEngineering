import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export const WIKI_FOLDERS = [
  'capabilities', 'processes', 'entities', 'queries', 'interfaces',
  'policies', 'decisions', 'infrastructure', 'runbooks', 'references',
]

const INDEX_STUB = `# Index — 콘텐츠 카탈로그 (단일 진입점)

> 이 파일은 LLM이 가장 먼저 읽는 진입점이다. ingest마다 갱신한다.
> concept 열거는 이 파일 한 곳에만 둔다 (인덱스 중복 금지 — D13).
> ~100페이지 초과 시 타입별 하위 인덱스(wiki/<type>/_index.md)로 분할한다.

## raw → wiki ingest 기록
| 날짜 | raw 출처 | 생성/갱신 concept |
|---|---|---|

## capabilities

## processes

## entities

## queries

## interfaces

## policies

## decisions

## infrastructure

## runbooks

## references
`

/**
 * Idempotently scaffold a project OKF bundle.
 * Creates project-owned dirs only; commons inheritance is deferred (spec §10 #3).
 * @param {string} targetDir
 * @returns {string[]} directories created (relative)
 */
export function initBundle(targetDir) {
  const created = []
  const mk = (rel) => {
    mkdirSync(join(targetDir, rel), { recursive: true })
    created.push(rel)
  }

  mk('raw')
  writeFileSync(join(targetDir, 'raw', '.gitkeep'), '')
  mk('log')
  writeFileSync(join(targetDir, 'log', '.gitkeep'), '')

  for (const folder of WIKI_FOLDERS) {
    mk(join('wiki', folder))
    writeFileSync(join(targetDir, 'wiki', folder, '.gitkeep'), '')
  }

  const indexPath = join(targetDir, 'index.md')
  if (!existsSync(indexPath)) writeFileSync(indexPath, INDEX_STUB)

  return created
}
