/**
 * Test-authoring helpers for Gatehouse providers.
 *
 * Deliberately NOT exported from the package root: these modules import
 * vitest, which must never enter an application's bundle. Import them from
 * `@towerjs/gatehouse/testing` in your own test files only.
 */
export { defineGatehouseProviderContract } from './provider-contract.js'
export type { ProviderContractHarness } from './provider-contract.js'

export { defineSocialProviderContract } from './social-contract.js'
export type { SocialProviderContractHarness } from './social-contract.js'
