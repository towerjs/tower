import { defaultExclude, defineConfig } from 'vitest/config'

import { aliases } from './vitest.aliases.js'

export default defineConfig({
  resolve: {
    alias: aliases,
  },
  test: {
    include: ['packages/*/src/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: [...defaultExclude, 'tests/integration/**', 'tests/build/**'],
    testTimeout: 120_000,
  },
})
