import { TestSocialProvider } from './providers/social/test-social-provider.js'
import { defineSocialProviderContract } from './social-contract.js'

defineSocialProviderContract({
  label: 'TestSocialProvider (in-memory)',
  async createProvider() {
    return new TestSocialProvider({
      identities: [
        { providerAccountId: 'ext-1', email: { value: 'one@example.com', verified: true }, name: 'One' },
        new Error('upstream down'),
      ],
    })
  },
  async succeedCallback(provider) {
    return provider.callback({ code: 'good-code' })
  },
  async failCallback(provider) {
    return provider.callback({ code: 'bad-code' }).catch((err) => err)
  },
})
