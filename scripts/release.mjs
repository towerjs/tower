#!/usr/bin/env node
// Prepares a Tower release end to end: validates the repo state, creates the
// release/vX.Y.Z branch, bumps every package and the CHANGELOG (via
// version-packages.mjs), commits, pushes, and opens the release PR titled
// vX.Y.Z. Publishing happens later in CI when the PR merges.
//
// Usage:
//   node scripts/release.mjs patch|minor|major
import { execSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

import { nextVersion } from './version-packages.mjs'

const root = resolve(import.meta.dirname, '..')

function run(command, capture = false) {
  const result = execSync(command, { cwd: root, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit' })
  return capture ? result.trim() : ''
}

function fail(message) {
  console.error(`Cannot create release: ${message}`)
  process.exit(1)
}

const bump = process.argv[2]
if (!['patch', 'minor', 'major'].includes(bump)) {
  console.error('Usage: pnpm release:patch|minor|major')
  process.exit(1)
}

const dirty = run('git status --porcelain', true)
if (dirty) {
  fail(`the working tree has uncommitted changes:\n${dirty}\nCommit or stash them first.`)
}

const branch = run('git branch --show-current', true)
if (branch !== 'main') {
  fail(`current branch is "${branch}", expected "main"`)
}

run('git fetch origin main')
if (run('git rev-parse HEAD', true) !== run('git rev-parse origin/main', true)) {
  fail('main is not up to date with origin/main — pull or push first')
}

const current = JSON.parse(await readFile(resolve(root, 'packages/towerjs/package.json'), 'utf8')).version
const target = nextVersion(current, bump)
const releaseBranch = `release/v${target}`

if (
  run(`git rev-parse --verify -q ${releaseBranch} || true`, true) ||
  run(`git ls-remote --heads origin ${releaseBranch}`, true)
) {
  fail(`branch "${releaseBranch}" already exists`)
}

const prs = JSON.parse(run(`gh pr list --head ${releaseBranch} --state open --json url`, true))
if (prs.length > 0) {
  fail(`a PR for "${releaseBranch}" is already open: ${prs[0].url}`)
}

run(`git checkout -b ${releaseBranch}`)
try {
  run(`node scripts/version-packages.mjs ${bump}`)
  run('pnpm format')
  run('git add -A')
  run(`git commit -m "v${target}"`)
} catch (error) {
  run('git checkout -q main')
  run(`git branch -q -D ${releaseBranch}`)
  fail(
    `versioning failed (${
      String(error.stderr ?? error.message)
        .trim()
        .split('\n')[0]
    }); restored main`
  )
}

try {
  run(`git push -u origin ${releaseBranch}`)
  const notes = run(`node scripts/release-notes.mjs ${target}`, true)
  const dir = mkdtempSync(resolve(tmpdir(), 'tower-release-'))
  const bodyFile = resolve(dir, 'body.md')
  writeFileSync(
    bodyFile,
    `## Release v${target}\n\nVersion all Tower packages to \`${target}\` and promote the CHANGELOG [Unreleased] section.\n\n### Release notes\n\n${notes}\n`
  )
  const prUrl = run(`gh pr create --title "v${target}" --body-file "${bodyFile}"`, true)
  rmSync(dir, { recursive: true, force: true })
  console.log(`\nRelease prepared: ${prUrl}\nMerge the PR to trigger the Release workflow.`)
} catch (error) {
  console.error(error.stderr ?? error.message)
  fail(`push or PR creation failed — branch "${releaseBranch}" is left in place for manual recovery`)
}
