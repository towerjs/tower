#!/usr/bin/env node
// Bumps every publishable Tower package to the same version and moves the
// CHANGELOG [Unreleased] section under the new version header. Never commits,
// tags, pushes, or publishes — Git operations belong to scripts/release.mjs
// and the release workflow.
//
// Usage:
//   node scripts/version-packages.mjs patch|minor|major   (relative bump)
//   node scripts/version-packages.mjs 0.2.0-beta.1        (explicit version)
import { execSync } from 'node:child_process'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = resolve(import.meta.dirname, '..')

const EXPLICIT_VERSION = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/

export async function findPublishablePackages() {
  const files = ['package.json']
  for (const workspace of ['packages', 'examples']) {
    try {
      for (const entry of await readdir(resolve(root, workspace), { withFileTypes: true })) {
        if (entry.isDirectory()) files.push(`${workspace}/${entry.name}/package.json`)
      }
    } catch {
      // Workspace directory does not exist
    }
  }
  const packages = []
  for (const file of files) {
    const pkg = JSON.parse(await readFile(resolve(root, file), 'utf8'))
    if (!pkg.private && (pkg.name?.startsWith('@towerjs/') || pkg.name === 'towerjs' || pkg.name === 'create-tower')) {
      packages.push({ file, pkg })
    }
  }
  if (packages.length === 0) throw new Error('No publishable Tower packages were discovered')
  return packages
}

export function nextVersion(current, bump) {
  const [major, minor, patch] = current.split('.').map(Number)
  if (bump === 'major') return `${major + 1}.0.0`
  if (bump === 'minor') return `${major}.${minor + 1}.0`
  if (bump === 'patch') return `${major}.${minor}.${patch + 1}`
  throw new Error(`Unknown bump: ${bump}`)
}

async function main() {
  const arg = process.argv[2]
  if (!arg) {
    console.error(
      'Usage: node scripts/version-packages.mjs patch|minor|major   or   node scripts/version-packages.mjs <x.y.z>'
    )
    process.exit(1)
  }

  const packages = await findPublishablePackages()
  const current = packages[0].pkg.version
  const versions = new Set(packages.map(({ pkg }) => pkg.version))
  if (versions.size !== 1) {
    console.error(`Expected all publishable packages to share one version, found ${versions.size}:`)
    for (const { pkg } of packages) console.error(`  ${pkg.name} ${pkg.version}`)
    process.exit(1)
  }

  const target = EXPLICIT_VERSION.test(arg) ? arg : nextVersion(current, arg)
  if (target === current) {
    console.error(`Target version ${target} is the current version`)
    process.exit(1)
  }

  const changelogFile = resolve(root, 'CHANGELOG.md')
  const changelog = await readFile(changelogFile, 'utf8')
  if (!changelog.includes('## [Unreleased]')) {
    throw new Error('CHANGELOG.md has no "## [Unreleased]" section to promote')
  }

  for (const { file, pkg } of packages) {
    pkg.version = target
    await writeFile(resolve(root, file), `${JSON.stringify(pkg, null, 2)}\n`)
  }

  const date = new Date().toISOString().slice(0, 10)
  await writeFile(changelogFile, changelog.replace('## [Unreleased]', `## [${target}] - ${date}`))

  execSync('pnpm install', { cwd: root, stdio: 'inherit' })

  const updated = await findPublishablePackages()
  const mismatches = updated.filter(({ pkg }) => pkg.version !== target)
  if (mismatches.length > 0) {
    console.error(`Expected all publishable packages to be ${target}, but found:`)
    for (const { pkg } of mismatches) console.error(`  ${pkg.name} ${pkg.version}`)
    process.exit(1)
  }

  console.log(`Versioning Tower\n\n  ${current} → ${target}\n`)
  for (const { pkg } of updated) console.log(`  ${pkg.name.padEnd(28)} ${pkg.version}`)
  console.log(`\nDone. Review the diff, then open a release/v${target} PR.`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
