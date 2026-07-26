import { input, select, checkbox } from '@inquirer/prompts'
import type { Framework, ProjectState, ProviderMap } from './state.js'

const MODULE_CHOICES = [
  { name: 'Vault', value: 'vault' },
  { name: 'Gatehouse', value: 'gatehouse' },
  { name: 'Archive', value: 'archive' },
  { name: 'Beacon', value: 'beacon' },
  { name: 'Crane', value: 'crane' },
  { name: 'Courier', value: 'courier' },
  { name: 'Treasury', value: 'treasury' },
  { name: 'Observatory', value: 'observatory' },
]

const VAULT_BRAND_CHOICES = [
  { name: 'Neon', value: 'neon' as const },
  { name: 'Supabase', value: 'supabase' as const },
  { name: 'Railway', value: 'railway' as const },
  { name: 'Other PostgreSQL provider', value: 'other' as const },
]

const GATEHOUSE_PROVIDER_CHOICES = [
  { name: 'Better Auth', value: 'better-auth' as const },
  { name: 'Clerk', value: 'clerk' as const },
]

const BEACON_PROVIDER_CHOICES = [
  { name: 'Ably', value: 'ably' as const },
  { name: 'Pusher', value: 'pusher' as const },
]

const FRAMEWORK_CHOICES: { name: string; value: Framework }[] = [{ name: 'Next.js', value: 'next' }]

const DEPLOYMENT_CHOICES = [
  { name: 'Vercel', value: 'vercel' as const },
  { name: 'Fly.io', value: 'fly' as const },
  { name: 'AWS', value: 'aws' as const },
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

async function promptModules(): Promise<string[]> {
  return checkbox({
    message: 'Which Tower modules do you want?',
    choices: MODULE_CHOICES,
  })
}

async function promptVaultProvider(): Promise<{ provider: 'neon' | 'pg'; brand: string }> {
  const brand = await select({
    message: 'PostgreSQL provider',
    choices: VAULT_BRAND_CHOICES,
  })
  return resolveVaultProvider(brand)
}

async function promptGatehouseProvider(): Promise<'better-auth' | 'clerk'> {
  return select({
    message: 'Authentication provider',
    choices: GATEHOUSE_PROVIDER_CHOICES,
  })
}

async function promptGatehouseFeatures(): Promise<Record<string, unknown>> {
  const features = await checkbox({
    message: 'Auth features to enable',
    choices: [
      { name: 'Email/password', value: 'credentials', checked: true },
      { name: 'Social login (Google, GitHub, etc.)', value: 'social' },
      { name: 'Magic link (passwordless email)', value: 'magicLinks' },
      { name: 'Email OTP', value: 'emailOtp' },
      { name: 'Two-factor authentication (TOTP + backup codes)', value: 'twoFactor' },
      { name: 'Organizations (teams, invitations, roles)', value: 'organization' },
      { name: 'Passkeys (biometric/hardware key login)', value: 'passkeys' },
      { name: 'Phone number authentication', value: 'phoneNumber' },
      { name: 'Admin panel (user management)', value: 'admin' },
      { name: 'API key authentication', value: 'apiKey' },
    ],
  })
  const cfg: Record<string, unknown> = {}
  for (const f of features) {
    if (f === 'credentials') cfg[f] = true
    else if (f === 'social') cfg[f] = { google: {}, github: {} }
    else if (f === 'phoneNumber') cfg[f] = true
    else if (f === 'admin') cfg[f] = true
    else if (f === 'apiKey') cfg[f] = true
    else cfg[f] = true
  }
  return cfg
}

async function promptBeaconProvider(): Promise<'ably' | 'pusher'> {
  return select({
    message: 'Realtime provider',
    choices: BEACON_PROVIDER_CHOICES,
  })
}

async function promptDeployment(): Promise<'vercel' | 'fly' | 'aws' | undefined> {
  return select({
    message: 'Deployment platform',
    choices: DEPLOYMENT_CHOICES,
  })
}

async function promptModuleProviders(enabled: string[]): Promise<ProviderMap> {
  const modules: ProviderMap = {}

  for (const name of enabled) {
    switch (name) {
      case 'vault': {
        const { provider, brand } = await promptVaultProvider()
        modules.vault = { provider, brand }
        break
      }
      case 'gatehouse': {
        const features = await promptGatehouseFeatures()
        modules.gatehouse = { provider: await promptGatehouseProvider(), ...features }
        break
      }
      case 'beacon':
        modules.beacon = { provider: await promptBeaconProvider() }
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
  const selected = await promptModules()
  const modules = selected.length > 0 ? await promptModuleProviders(selected) : {}
  const deployment = await promptDeployment()

  console.log('')

  return {
    projectName,
    framework,
    modules,
    deployment,
    frameworkAnswers: {},
  }
}
