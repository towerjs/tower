import { resolve } from 'node:path'

import { defaultExclude, defineConfig } from 'vitest/config'

const aliases = [
  { find: /^@towerjs\/gatehouse\/next$/, replacement: resolve('packages/gatehouse/src/frameworks/next.ts') },
  { find: /^@towerjs\/gatehouse\/client$/, replacement: resolve('packages/gatehouse/src/client.ts') },
  { find: /^@towerjs\/blueprint\/internal$/, replacement: resolve('packages/blueprint/src/internal.ts') },
  { find: /^@towerjs\/blueprint$/, replacement: resolve('packages/blueprint/src/index.ts') },
  { find: /^@towerjs\/foundation$/, replacement: resolve('packages/foundation/src/index.ts') },
  { find: /^@towerjs\/vault$/, replacement: resolve('packages/vault/src/index.ts') },
  { find: /^@towerjs\/gatehouse$/, replacement: resolve('packages/gatehouse/src/index.ts') },
  { find: /^@towerjs\/courier$/, replacement: resolve('packages/courier/src/index.ts') },
  { find: /^@towerjs\/edge$/, replacement: resolve('packages/edge/src/index.ts') },
  { find: /^@towerjs\/tower$/, replacement: resolve('packages/tower/src/index.ts') },
]

export default defineConfig({
  resolve: {
    alias: aliases,
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['packages/*/src/**/*.test.ts', 'tests/**/*.test.ts'],
          exclude: [...defaultExclude, 'tests/integration/**', 'tests/build/**'],
          testTimeout: 120_000,
        },
      },
      {
        extends: true,
        test: {
          name: 'build',
          include: ['tests/build/**/*.test.ts'],
          testTimeout: 180_000,
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          globalSetup: ['tests/integration/global-setup.ts'],
          testTimeout: 120_000,
        },
      },
    ],
  },
})
