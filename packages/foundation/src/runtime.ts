import type { TowerRuntime } from './types.js'

function hasProcessEnv(key: string): boolean {
  return typeof process !== 'undefined' && process.env?.[key] !== undefined
}

function getProcessEnv(key: string): string | undefined {
  return typeof process !== 'undefined' ? process.env?.[key] : undefined
}

/** Detects the deployment environment from platform-specific env vars (Vercel, AWS, Netlify, Cloudflare). */
export function detectRuntime(): TowerRuntime {
  if (hasProcessEnv('VERCEL')) {
    const env = getProcessEnv('VERCEL_ENV')

    if (env === 'edge') {
      return { name: 'edge', isServerless: true }
    }

    return { name: 'vercel-serverless', isServerless: true }
  }

  if (hasProcessEnv('CLOUDFLARE_WORKER')) {
    return { name: 'edge', isServerless: true }
  }

  if (
    hasProcessEnv('AWS_LAMBDA_FUNCTION_NAME') ||
    hasProcessEnv('AWS_EXECUTION_ENV') ||
    hasProcessEnv('NETLIFY')
  ) {
    return { name: 'vercel-serverless', isServerless: true }
  }

  return { name: 'node-server', isServerless: false }
}
