import { input, select, checkbox as featureCheckbox } from '@inquirer/prompts'
import { checkbox as modulesCheckbox } from './checkbox.js'
import type { Framework, ProjectState, ProviderMap, DeploymentTarget, Runtime } from './state.js'

const MODULE_CHOICES = [
  { name: 'Vault — Database ORM (Postgres, Neon)', value: 'vault' },
  { name: 'Gatehouse — Authentication (Better Auth)', value: 'gatehouse' },
  { name: 'Courier — Email, SMS, Push', value: 'courier' },
]

const VAULT_BRAND_CHOICES = [
  { name: 'Neon', value: 'neon' as const },
  { name: 'Supabase', value: 'supabase' as const },
  { name: 'Railway', value: 'railway' as const },
  { name: 'Other PostgreSQL provider', value: 'other' as const },
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
  { name: "I'll configure later", value: 'skip' },
]

const SMS_PROVIDER_CHOICES = [
  { name: 'Twilio', value: 'twilio' },
  { name: "I'll configure later", value: 'skip' },
]

const FRAMEWORK_CHOICES: { name: string; value: Framework }[] = [{ name: 'Next.js', value: 'next' }]

const DEPLOYMENT_CHOICES: { name: string; value: DeploymentTarget }[] = [
  { name: 'Vercel', value: 'vercel' },
  { name: 'Cloudflare Workers', value: 'cloudflare' },
  { name: 'Other / self-hosted', value: 'other' },
]

const RUNTIME_CHOICES: { name: string; value: Runtime }[] = [
  { name: 'Serverless Node.js (recommended)', value: 'node' },
  { name: 'Serverless Vercel Edge', value: 'edge' },
]

function resolveVaultProvider(brand: string): { provider: 'neon' | 'pg'; brand: string } {
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

async function promptFramework(): Promise<Framework> {
  return select({
    message: 'Select framework',
    choices: FRAMEWORK_CHOICES,
  })
}

async function promptTypeScript(): Promise<boolean> {
  return select({
    message: 'TypeScript?',
    choices: [
      { name: 'Yes', value: true },
      { name: 'No', value: false },
    ],
  })
}

async function promptTailwind(): Promise<boolean> {
  return select({
    message: 'Tailwind CSS?',
    choices: [
      { name: 'Yes', value: true },
      { name: 'No', value: false },
    ],
  })
}

async function promptDeployment(): Promise<DeploymentTarget> {
  return select({
    message: 'Deployment target',
    choices: DEPLOYMENT_CHOICES,
  })
}

async function promptRuntime(deployment: DeploymentTarget): Promise<Runtime> {
  if (deployment === 'cloudflare') return 'edge'
  if (deployment === 'other') return 'node'

  return select({
    message: 'Runtime',
    choices: RUNTIME_CHOICES,
  })
}

async function promptModules(): Promise<string[]> {
  return modulesCheckbox({
    message: 'Which Tower modules do you want?',
    choices: MODULE_CHOICES,
    link: { gatehouse: ['courier'] },
  })
}

async function promptVaultProvider(): Promise<{ provider: 'neon' | 'pg'; brand: string }> {
  const brand = await select({
    message: 'PostgreSQL provider',
    choices: VAULT_BRAND_CHOICES,
  })
  return resolveVaultProvider(brand)
}

async function promptGatehouseFeatures(): Promise<Record<string, unknown>> {
  const features = await featureCheckbox({
    message: 'Auth features to enable',
    choices: GATEHOUSE_FEATURE_CHOICES,
  })
  const cfg: Record<string, unknown> = {}
  for (const f of features) {
    if (f === 'credentials') cfg[f] = true
    else if (f === 'social') cfg[f] = { google: {}, github: {} }
    else if (f === 'phoneNumber') cfg[f] = true
    else cfg[f] = true
  }
  return cfg
}

async function promptCourierProvider(needsSms: boolean): Promise<Record<string, unknown> | undefined> {
  const cfg: Record<string, unknown> = {}

  const email = await select({
    message: 'Email provider',
    choices: EMAIL_PROVIDER_CHOICES,
  })
  if (email !== 'skip') {
    cfg.email = { provider: email, from: 'My App <onboarding@resend.dev>' }
  }

  if (needsSms) {
    const sms = await select({
      message: 'SMS provider',
      choices: SMS_PROVIDER_CHOICES,
    })
    if (sms !== 'skip') {
      cfg.sms = { provider: sms }
    }
  }

  return Object.keys(cfg).length > 0 ? cfg : undefined
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
        const { provider, brand } = await promptVaultProvider()
        modules.vault = { provider, brand }
        break
      }
      case 'courier': {
        const needsSms = gatehouseFeatures?.phoneNumber === true
        const cfg = await promptCourierProvider(needsSms)
        if (cfg) modules.courier = cfg
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
  const framework = await promptFramework()
  const typescript = await promptTypeScript()
  const tailwind = await promptTailwind()
  const deployment = await promptDeployment()
  const runtime = await promptRuntime(deployment)
  const selected = await promptModules()
  const modules = selected.length > 0 ? await promptModuleProviders(selected) : {}
  console.log('')

  return {
    projectName,
    framework,
    modules,
    frameworkAnswers: { typescript, tailwind },
    deployment,
    runtime,
  }
}
