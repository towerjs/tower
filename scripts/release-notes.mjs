#!/usr/bin/env node
// Prints the CHANGELOG section for a version, for use as GitHub Release notes.
//
// Usage:
//   node scripts/release-notes.mjs [x.y.z]
// Omitting the version reads the current version from packages/tower.
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')

let version = process.argv[2]
if (!version) {
  const pkg = JSON.parse(await readFile(resolve(root, 'packages/tower/package.json'), 'utf8'))
  version = pkg.version
}

const changelog = await readFile(resolve(root, 'CHANGELOG.md'), 'utf8')
for (const section of changelog.split(/^## /m).slice(1)) {
  const header = section.split('\n')[0]
  if (header.startsWith(`[${version}] - `)) {
    console.log(section.slice(header.length).trim())
    process.exit(0)
  }
}

console.log(`Placeholder release notes for v${version}: no CHANGELOG entry found`)
