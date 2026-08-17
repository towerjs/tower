import { defineConfig } from 'vitest/config'

import { aliases } from './vitest.aliases.js'

export default defineConfig({
  resolve: {
    alias: aliases,
  },
  test: {
    include: ['tests/build/**/*.test.ts'],
    testTimeout: 180_000,
  },
})
