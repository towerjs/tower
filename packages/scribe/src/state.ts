export type Framework = 'next'

export type DeploymentTarget = 'vercel' | 'cloudflare' | 'other'

export type Runtime = 'node' | 'edge'

export type ProviderMap = Record<string, Record<string, unknown>>

export type ProjectState = {
  projectName: string
  framework: Framework
  modules: ProviderMap
  frameworkAnswers: Record<string, unknown>
  deployment: DeploymentTarget
  runtime: Runtime
  /** Opt-in scaffold template (e.g. 'auth'). None unless --template is passed. */
  template?: string
  /** Visual-development mode: no auth gating, no database required. */
  previewUi?: boolean
}
