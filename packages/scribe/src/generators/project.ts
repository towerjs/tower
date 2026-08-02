import type { ProjectState } from '../state.js'
import type { FrameworkAdapter } from '../frameworks/adapter.js'
import { nextAdapter } from '../frameworks/next.js'

const adapters: Record<string, FrameworkAdapter> = {
  next: nextAdapter,
}

/** Generates a full project scaffold from a resolved state. */
export async function generateProject(state: ProjectState, targetDir: string): Promise<void> {
  const adapter = adapters[state.framework]

  if (!adapter) {
    throw new Error(`Unsupported framework: "${state.framework}". ` + 'Only Next.js is supported in this version.')
  }

  await adapter.generate(state, targetDir)
}
