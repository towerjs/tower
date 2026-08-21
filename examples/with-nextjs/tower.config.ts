import { courier } from '@towerjs/courier'
import { gatehouse } from '@towerjs/gatehouse'
import { defineTower } from '@towerjs/tower'
import { vault } from '@towerjs/vault'

export default defineTower({
  modules: [
    vault(),

    courier({
      email: {
        provider: 'console',
        from: 'Tower <no-reply@example.com>',
      },
    }),

    gatehouse({
      provider: 'better-auth',

      appName: 'Tower Example',

      credentials: {
        enabled: true,
        autoSignIn: true,
      },

      magicLinks: true,

      emailVerification: {
        method: 'otp',
        sendOnSignUp: true,
        autoSignInAfterVerification: true,
      },

      social: {
        ...(process.env.GOOGLE_CLIENT_ID
          ? { google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET! } }
          : {}),
        ...(process.env.GITHUB_CLIENT_ID
          ? { github: { clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET! } }
          : {}),
      },

      passkeys: true,
      twoFactor: true,
      organization: true,
    }),
  ],
})
