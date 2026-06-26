#!/usr/bin/env node
import { argv } from 'node:process'
import { resolve } from 'node:path'
import { initBundle } from './init.js'

const targetDir = resolve(argv[2] ?? '.')
const created = initBundle(targetDir)
console.log(`okf-init: scaffolded OKF bundle at ${targetDir}`)
console.log(`  created: ${created.join(', ')}`)
