import { collectProjectState } from '../prompts.js'
import { generateProject } from '../generators/project.js'
import { detectPackageManager, devCommand, migrateCommand } from '../package-manager.js'

/** CLI handler for `tower create` — prompts for project settings and scaffolds a new app. */
export async function createCommand(): Promise<void> {
  const state = await collectProjectState()
  const cwd = process.cwd()
  const pm = detectPackageManager()

  process.stdout.write('  Creating Tower application...')

  try {
    await generateProject(state, cwd)
  } catch (err) {
    process.stdout.write(' failed\n')
    throw err
  }

  process.stdout.write(' done\n\n')
  console.log(`  cd ${state.projectName}`)
  console.log(`  Review .env and fill in any provider credentials.`)
  if (state.modules.vault) console.log(`  ${migrateCommand(pm)}`)
  console.log(`  ${devCommand(pm)}\n`)
}
