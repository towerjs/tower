import { defineTower } from 'towerjs/blueprint'

export default defineTower({
  modules: {
    vault: {},

    courier: {
      email: {
        provider: 'resend',
        from: 'Tower <no-reply@example.com>',
      },
    },

    gatehouse: {
      provider: 'better-auth',

      appName: 'Tower Example',

      credentials: {
        enabled: true,
        autoSignIn: true,
      },

      emailVerification: {
        sendOnSignUp: true,
      },

      social: {
        ...(process.env.GOOGLE_CLIENT_ID ? { google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET! } } : {}),
        ...(process.env.GITHUB_CLIENT_ID ? { github: { clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET! } } : {}),
      },

      passkeys: true,
      twoFactor: true,
      organization: true,
    },
  },
})
