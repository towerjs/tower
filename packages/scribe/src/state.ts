export type Framework = 'next'

export type ProviderMap = Record<string, Record<string, unknown>>

export type ProjectState = {
  projectName: string
  framework: Framework
  modules: ProviderMap
  frameworkAnswers: Record<string, unknown>
}
