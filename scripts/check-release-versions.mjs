import { readFile } from 'node:fs/promises'
import { access, readdir } from 'node:fs/promises'

const packageFiles = ['package.json']
for (const workspace of ['packages', 'examples']) {
  try {
    await access(workspace)
  } catch {
    continue
  }
  for (const entry of await readdir(workspace, { withFileTypes: true })) {
    if (entry.isDirectory()) packageFiles.push(`${workspace}/${entry.name}/package.json`)
  }
}

const packages = []
for (const file of packageFiles) {
  const pkg = JSON.parse(await readFile(file, 'utf8'))
  if (!pkg.private && (pkg.name?.startsWith('@towerjs/') || pkg.name === 'towerjs' || pkg.name === 'create-tower')) {
    packages.push({ file, name: pkg.name, version: pkg.version })
  }
}

if (packages.length === 0) throw new Error('No publishable Tower packages were discovered')

const versions = new Set(packages.map((pkg) => pkg.version))
if (versions.size !== 1) {
  console.error('Publishable Tower packages have divergent versions:')
  for (const pkg of packages) console.error(`  ${pkg.name}: ${pkg.version}`)
  process.exit(1)
}

const [version] = versions
if (process.argv.includes('--initial') && version !== '0.1.0') {
  throw new Error(`Initial Tower release must be 0.1.0, found ${version}`)
}

console.log(`Publishable Tower packages: ${packages.length}`)
for (const pkg of packages) console.log(`${pkg.name} ${pkg.version}`)
console.log(`Lockstep version: ${version}`)
