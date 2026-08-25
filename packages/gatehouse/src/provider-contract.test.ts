import { defineGatehouseProviderContract } from './provider-contract.js'
import { TestProvider } from './providers/test-provider.js'

defineGatehouseProviderContract({
  label: 'TestProvider (in-memory)',
  supportsAuthenticatedSpecs: true,
  async createProvider() {
    return new TestProvider()
  },
  authHeaders(token: string) {
    return new Headers({ cookie: `gh_test_session=${token}` })
  },
})
