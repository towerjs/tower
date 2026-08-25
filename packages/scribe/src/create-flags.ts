import type { DeploymentTarget } from './state.js'

export interface CreateFlags {
  name?: string
  typescript?: boolean
  tailwind?: boolean
  deployment?: DeploymentTarget
  modules?: string[]
  vault?: 'neon' | 'supabase' | 'railway' | 'other' | 'skip'
  features?: string[]
  email?: 'resend' | 'smtp' | 'ses' | 'skip'
  sms?: 'twilio' | 'skip'
  template?: string
}

const DEPLOYMENTS: DeploymentTarget[] = ['vercel', 'cloudflare', 'other']
const VAULT_BRANDS: CreateFlags['vault'][] = ['neon', 'supabase', 'railway', 'other', 'skip']
const GATEHOUSE_FEATURES = ['credentials', 'social', 'magicLinks', 'twoFactor', 'organization', 'phoneNumber']
const EMAIL_PROVIDERS: CreateFlags['email'][] = ['resend', 'smtp', 'ses', 'skip']
export const TEMPLATES = ['auth']
const SMS_PROVIDERS: CreateFlags['sms'][] = ['twilio', 'skip']

function takeValue(args: string[], index: number): { value: string | undefined; next: number } {
  const value = args[index + 1]
  if (value === undefined || value.startsWith('--')) return { value: undefined, next: index }
  return { value, next: index + 1 }
}

function splitList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Parses `tower create` CLI args into structured flags. */
export function parseCreateFlags(args: string[]): CreateFlags {
  const flags: CreateFlags = {}

  let i = 0
  while (i < args.length) {
    const arg = args[i]
    switch (arg) {
      case '--template': {
        const { value, next } = takeValue(args, i)
        if (value === undefined) throw new Error(`Missing value for ${arg}`)
        flags.template = value
        i = next + 1
        break
      }
      case '--name':
      case '--project-name': {
        const { value, next } = takeValue(args, i)
        if (value === undefined) throw new Error(`Missing value for ${arg}`)
        flags.name = value
        i = next + 1
        break
      }
      case '--tailwind':
        flags.tailwind = true
        i++
        break
      case '--no-tailwind':
        flags.tailwind = false
        i++
        break
      case '--ts':
        flags.typescript = true
        i++
        break
      case '--no-ts':
      case '--js':
        flags.typescript = false
        i++
        break
      case '--deployment': {
        const { value, next } = takeValue(args, i)
        if (value === undefined) throw new Error('Missing value for --deployment')
        if (!DEPLOYMENTS.includes(value as DeploymentTarget)) {
          throw new Error(`Unknown deployment: ${value}`)
        }
        flags.deployment = value as DeploymentTarget
        i = next + 1
        break
      }
      case '--modules': {
        const { value, next } = takeValue(args, i)
        if (value === undefined) throw new Error('Missing value for --modules')
        flags.modules = splitList(value)
        i = next + 1
        break
      }
      case '--vault': {
        const { value, next } = takeValue(args, i)
        if (value === undefined) throw new Error('Missing value for --vault')
        if (!VAULT_BRANDS.includes(value as CreateFlags['vault'])) {
          throw new Error(`Unknown vault provider: ${value}`)
        }
        flags.vault = value as CreateFlags['vault']
        i = next + 1
        break
      }
      case '--features': {
        const { value, next } = takeValue(args, i)
        if (value === undefined) throw new Error('Missing value for --features')
        for (const feature of splitList(value)) {
          if (!GATEHOUSE_FEATURES.includes(feature)) throw new Error(`Unknown auth feature: ${feature}`)
        }
        flags.features = splitList(value)
        i = next + 1
        break
      }
      case '--email': {
        const { value, next } = takeValue(args, i)
        if (value === undefined) throw new Error('Missing value for --email')
        if (!EMAIL_PROVIDERS.includes(value as CreateFlags['email'])) {
          throw new Error(`Unknown email provider: ${value}`)
        }
        flags.email = value as CreateFlags['email']
        i = next + 1
        break
      }
      case '--sms': {
        const { value, next } = takeValue(args, i)
        if (value === undefined) throw new Error('Missing value for --sms')
        if (!SMS_PROVIDERS.includes(value as CreateFlags['sms'])) {
          throw new Error(`Unknown sms provider: ${value}`)
        }
        flags.sms = value as CreateFlags['sms']
        i = next + 1
        break
      }
      default:
        if (!arg.startsWith('-') && flags.name === undefined) {
          flags.name = arg
        } else {
          throw new Error(`Unknown flag: ${arg}`)
        }
        i++
    }
  }

  return flags
}
