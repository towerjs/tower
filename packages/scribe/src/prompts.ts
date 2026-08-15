import { checkbox as featureCheckbox, input, select } from '@inquirer/prompts'

import { checkbox as modulesCheckbox } from './checkbox.js'
import type { CreateFlags } from './create-flags.js'
import type { DeploymentTarget, ProjectState, ProviderMap, Runtime } from './state.js'

const MODULE_CHOICES = [
  { name: 'Vault — Database ORM (Postgres, Neon)', value: 'vault' },
  { name: 'Gatehouse — Authentication (Better Auth)', value: 'gatehouse' },
  { name: 'Courier — Email, SMS, Push', value: 'courier' },
]

const MODULE_LINKS: Record<string, string[]> = {
  // Gatehouse persists sessions and users in the Vault database and
  // sends auth emails through Courier — both are required.
  gatehouse: ['vault', 'courier'],
}

const VAULT_BRAND_CHOICES = [
  { name: 'Neon', value: 'neon' as const },
  { name: 'Supabase', value: 'supabase' as const },
  { name: 'Railway', value: 'railway' as const },
  { name: 'Other PostgreSQL provider', value: 'other' as const },
  { name: 'Configure later', value: 'skip' as const },
]

const GATEHOUSE_FEATURE_CHOICES = [
  { name: 'Email/password', value: 'credentials', checked: true },
  { name: 'Social login (Google, GitHub, etc.)', value: 'social' },
  { name: 'Magic link (passwordless email)', value: 'magicLinks' },
  { name: 'Two-factor authentication (TOTP + backup codes)', value: 'twoFactor' },
  { name: 'Organizations (teams, invitations, roles)', value: 'organization' },
  { name: 'Phone number authentication', value: 'phoneNumber' },
]

const EMAIL_PROVIDER_CHOICES = [
  { name: 'Resend', value: 'resend' },
  { name: 'SMTP', value: 'smtp' },
  { name: 'SES (AWS)', value: 'ses' },
  { name: 'Configure later', value: 'skip' },
]

const SMS_PROVIDER_CHOICES = [
  { name: 'Twilio', value: 'twilio' },
  { name: 'Configure later', value: 'skip' },
]

const DEPLOYMENT_CHOICES: { name: string; value: DeploymentTarget }[] = [
  { name: 'Vercel', value: 'vercel' },
  { name: 'Cloudflare', value: 'cloudflare' },
  { name: 'Self-hosted', value: 'other' },
]

/** Next.js is currently the only supported framework. */
const DEFAULT_FRAMEWORK = 'next'

/** Derives the runtime from the deployment target instead of asking. */
function deriveRuntime(deployment: DeploymentTarget): Runtime {
  if (deployment === 'cloudflare') return 'edge'
  return 'node'
}

function resolveVaultProvider(brand: string): { provider: 'neon' | 'pg'; brand: string } | undefined {
  if (brand === 'skip') return undefined
  if (brand === 'neon') return { provider: 'neon', brand: 'neon' }
  return { provider: 'pg', brand }
}

async function promptProjectName(): Promise<string> {
  return input({
    message: 'Project name',
    default: 'my-app',
    validate(value) {
      if (!value) return 'Project name is required'
      if (!/^[a-z0-9-]+$/.test(value)) return 'Use lowercase letters, numbers, and hyphens'
      return true
    },
  })
}

async function promptTailwind(): Promise<boolean> {
  return select({
    message: 'Tailwind CSS',
    choices: [
      { name: 'Yes', value: true },
      { name: 'No', value: false },
    ],
  })
}

async function promptDeployment(): Promise<DeploymentTarget> {
  return select({
    message: 'Deployment',
    choices: DEPLOYMENT_CHOICES,
  })
}

async function promptModules(): Promise<string[]> {
  return modulesCheckbox({
    message: 'What should your application include',
    choices: MODULE_CHOICES,
    link: MODULE_LINKS,
  })
}

async function promptVaultProvider(): Promise<{ provider: 'neon' | 'pg'; brand: string } | undefined> {
  const brand = await select({
    message: 'Database provider',
    choices: VAULT_BRAND_CHOICES,
  })
  return resolveVaultProvider(brand)
}

async function promptGatehouseFeatures(): Promise<Record<string, unknown>> {
  const features = await featureCheckbox({
    message: 'Auth features',
    choices: GATEHOUSE_FEATURE_CHOICES,
  })
  return resolveGatehouseFeatures(features)
}

function resolveGatehouseFeatures(features: string[]): Record<string, unknown> {
  const cfg: Record<string, unknown> = {}
  for (const f of features) {
    if (f === 'credentials') cfg[f] = true
    else if (f === 'social') cfg[f] = { google: {}, github: {} }
    else if (f === 'phoneNumber') cfg[f] = true
    else cfg[f] = true
  }
  return cfg
}

async function promptCourierProvider(needsSms: boolean): Promise<Record<string, unknown>> {
  const email = await select({
    message: 'Email provider',
    choices: EMAIL_PROVIDER_CHOICES,
  })

  let sms: string | undefined
  if (needsSms) {
    sms = await select({
      message: 'SMS provider',
      choices: SMS_PROVIDER_CHOICES,
    })
  }

  return resolveCourierProvider(email, sms)
}

function resolveCourierProvider(email: string, sms: string | undefined): Record<string, unknown> {
  const cfg: Record<string, unknown> = {}

  if (email !== 'skip') {
    cfg.email = { provider: email, from: 'My App <onboarding@resend.dev>' }
  }

  if (sms && sms !== 'skip') {
    cfg.sms = { provider: sms }
  }

  return cfg
}

async function promptModuleProviders(enabled: string[]): Promise<ProviderMap> {
  const modules: ProviderMap = {}

  let gatehouseFeatures: Record<string, unknown> | undefined
  if (enabled.includes('gatehouse')) {
    gatehouseFeatures = await promptGatehouseFeatures()
    modules.gatehouse = gatehouseFeatures
  }

  for (const name of enabled) {
    switch (name) {
      case 'vault': {
        // A selected module is always kept; deferring the provider just
        // leaves the module enabled with a default configuration.
        modules.vault = (await promptVaultProvider()) ?? {}
        break
      }
      case 'courier': {
        const needsSms = gatehouseFeatures?.phoneNumber === true
        modules.courier = await promptCourierProvider(needsSms)
        break
      }
      case 'gatehouse':
        break
      default:
        modules[name] = {}
    }
  }

  return modules
}

/** Collects the full project state through interactive CLI prompts. */
export async function collectProjectState(): Promise<ProjectState> {
  console.log('\n  Tower — Create application\n')

  const projectName = await promptProjectName()
  const tailwind = await promptTailwind()
  const deployment = await promptDeployment()
  const runtime = deriveRuntime(deployment)
  const selected = await promptModules()
  const modules = selected.length > 0 ? await promptModuleProviders(selected) : {}
  console.log('')

  return {
    projectName,
    framework: DEFAULT_FRAMEWORK,
    modules,
    frameworkAnswers: { tailwind },
    deployment,
    runtime,
  }
}

/** Collects the full project state from CLI flags, without prompting. */
export async function collectProjectStateFromFlags(flags: CreateFlags): Promise<ProjectState> {
  const projectName = flags.name ?? 'my-app'
  const deployment = flags.deployment ?? 'vercel'
  const runtime = deriveRuntime(deployment)
  const tailwind = flags.tailwind ?? false
  const modules: ProviderMap = {}

  const selected = flags.modules ?? []
  let gatehouseFeatures: Record<string, unknown> | undefined
  if (selected.includes('gatehouse')) {
    gatehouseFeatures = resolveGatehouseFeatures(flags.features ?? [])
    modules.gatehouse = gatehouseFeatures
  }

  for (const name of selected) {
    switch (name) {
      case 'vault':
        modules.vault = resolveVaultProvider(flags.vault ?? 'skip') ?? {}
        break
      case 'courier': {
        const needsSms = gatehouseFeatures?.phoneNumber === true
        modules.courier = resolveCourierProvider(flags.email ?? 'skip', needsSms ? flags.sms : undefined)
        break
      }
      case 'gatehouse':
        break
      default:
        modules[name] = {}
    }
  }

  return {
    projectName,
    framework: DEFAULT_FRAMEWORK,
    modules,
    frameworkAnswers: { tailwind },
    deployment,
    runtime,
  }
}
