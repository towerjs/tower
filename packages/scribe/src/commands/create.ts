import { collectProjectState } from '../prompts.js'
import { generateProject } from '../generators/project.js'

/** CLI handler for `tower create` — prompts for project settings and scaffolds a new app. */
export async function createCommand(): Promise<void> {
  const state = await collectProjectState()
  const cwd = process.cwd()

  process.stdout.write('  Creating Tower application...')

  try {
    await generateProject(state, cwd)
  } catch (err) {
    process.stdout.write(' failed\n')
    throw err
  }

  process.stdout.write(' done\n\n')
  console.log(`  cd ${state.projectName}`)
  console.log('  pnpm dev\n')
}
