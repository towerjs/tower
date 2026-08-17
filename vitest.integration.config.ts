import { defineConfig } from 'vitest/config'

import { aliases } from './vitest.aliases.js'

export default defineConfig({
  resolve: {
    alias: aliases,
  },
  test: {
    include: ['tests/integration/**/*.test.ts'],
    globalSetup: ['tests/integration/global-setup.ts'],
    testTimeout: 120_000,
  },
})
