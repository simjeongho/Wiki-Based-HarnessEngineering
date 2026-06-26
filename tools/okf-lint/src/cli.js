#!/usr/bin/env node
import { argv, exit } from 'node:process'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { lintBundle } from './lint.js'

function main() {
  const args = argv.slice(2)
  const positional = args.filter((a) => !a.startsWith('--'))
  const wikiRoot = resolve(positional[0] ?? 'wiki')

  if (!existsSync(wikiRoot)) {
    console.error(`okf-lint: bundle root not found: ${wikiRoot}`)
    exit(2)
  }

  const linkRoots = [wikiRoot]
  const ci = args.indexOf('--commons')
  if (ci !== -1 && args[ci + 1]) linkRoots.push(resolve(args[ci + 1]))

  const findings = lintBundle({ wikiRoot, linkRoots })
  for (const f of findings) {
    console.error(`${f.level.toUpperCase()} ${f.file} [${f.rule}] ${f.message}`)
  }

  const errors = findings.filter((f) => f.level === 'error').length
  if (errors > 0) {
    console.error(`okf-lint: ${errors} error(s)`)
    exit(1)
  }
  console.log('okf-lint: OK')
  exit(0)
}

main()
