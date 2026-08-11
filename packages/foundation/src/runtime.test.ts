import { describe, expect, it, beforeEach } from 'vitest'
import { detectRuntime } from './runtime.js'

const OLD_ENV = process.env

beforeEach(() => {
  process.env = { ...OLD_ENV }
  delete process.env.VERCEL
  delete process.env.VERCEL_ENV
  delete process.env.AWS_LAMBDA_FUNCTION_NAME
  delete process.env.AWS_EXECUTION_ENV
  delete process.env.NETLIFY
  delete process.env.CLOUDFLARE_WORKER
})

describe('detectRuntime', () => {
  it('detects node-server by default', () => {
    const runtime = detectRuntime()

    expect(runtime).toEqual({ name: 'node-server', isServerless: false })
  })

  it('detects vercel-serverless when VERCEL is set without VERCEL_ENV=edge', () => {
    process.env.VERCEL = '1'

    const runtime = detectRuntime()
    expect(runtime).toEqual({ name: 'vercel-serverless', isServerless: true })
  })

  it('detects edge when VERCEL_ENV is set to edge', () => {
    process.env.VERCEL = '1'
    process.env.VERCEL_ENV = 'edge'

    const runtime = detectRuntime()
    expect(runtime).toEqual({ name: 'edge', isServerless: true })
  })

  it('detects vercel-serverless for AWS Lambda (not edge)', () => {
    process.env.AWS_LAMBDA_FUNCTION_NAME = 'my-function'

    const runtime = detectRuntime()
    expect(runtime).toEqual({ name: 'vercel-serverless', isServerless: true })
  })

  it('detects vercel-serverless for AWS_EXECUTION_ENV (not edge)', () => {
    process.env.AWS_EXECUTION_ENV = 'AWS_Lambda_nodejs20'

    const runtime = detectRuntime()
    expect(runtime).toEqual({ name: 'vercel-serverless', isServerless: true })
  })

  it('detects vercel-serverless for Netlify (not edge)', () => {
    process.env.NETLIFY = '1'

    const runtime = detectRuntime()
    expect(runtime).toEqual({ name: 'vercel-serverless', isServerless: true })
  })

  it('detects edge for Cloudflare Workers', () => {
    process.env.CLOUDFLARE_WORKER = '1'

    const runtime = detectRuntime()
    expect(runtime).toEqual({ name: 'edge', isServerless: true })
  })

  it('gives VERCEL priority over AWS when both are set', () => {
    process.env.VERCEL = '1'
    process.env.AWS_LAMBDA_FUNCTION_NAME = 'my-function'

    const runtime = detectRuntime()
    expect(runtime).toEqual({ name: 'vercel-serverless', isServerless: true })
  })
})
