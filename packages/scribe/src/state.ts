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
}
