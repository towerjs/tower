import { parseCreateFlags } from '../create-flags.js'
import { generateProject } from '../generators/project.js'
import { detectPackageManager, devCommand, migrateCommand } from '../package-manager.js'
import { collectProjectState, collectProjectStateFromFlags } from '../prompts.js'

/** CLI handler for `tower create` — scaffolds a new app, interactively or from flags. */
export async function createCommand(flags: string[] = []): Promise<void> {
  const state =
    flags.length > 0 ? await collectProjectStateFromFlags(parseCreateFlags(flags)) : await collectProjectState()
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
