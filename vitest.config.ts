import { resolve } from 'node:path'

import { defaultExclude, defineConfig } from 'vitest/config'

const aliases = [
  { find: /^@towerjs\/gatehouse\/next$/, replacement: resolve('packages/gatehouse/src/frameworks/next.ts') },
  { find: /^@towerjs\/gatehouse\/client$/, replacement: resolve('packages/gatehouse/src/client.ts') },
  { find: /^@towerjs\/gatehouse\/testing$/, replacement: resolve('packages/gatehouse/src/testing.ts') },
  { find: /^@towerjs\/blueprint\/internal$/, replacement: resolve('packages/tower/src/blueprint/internal.ts') },
  { find: /^@towerjs\/blueprint$/, replacement: resolve('packages/tower/src/blueprint/index.ts') },
  { find: /^@towerjs\/foundation$/, replacement: resolve('packages/tower/src/foundation/index.ts') },
  { find: /^@towerjs\/vault$/, replacement: resolve('packages/vault/src/index.ts') },
  { find: /^@towerjs\/gatehouse$/, replacement: resolve('packages/gatehouse/src/index.ts') },
  { find: /^@towerjs\/courier$/, replacement: resolve('packages/courier/src/index.ts') },
  { find: /^@towerjs\/edge$/, replacement: resolve('packages/edge/src/index.ts') },
  { find: /^@towerjs\/tower$/, replacement: resolve('packages/tower/src/index.ts') },
  { find: /^@towerjs\/tower\/foundation$/, replacement: resolve('packages/tower/src/foundation/index.ts') },
  { find: /^@towerjs\/tower\/blueprint$/, replacement: resolve('packages/tower/src/blueprint/index.ts') },
  { find: /^@towerjs\/tower\/runtime$/, replacement: resolve('packages/tower/src/runtime.ts') },
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
          // Files run serially: multiple files trigger provider migrations
          // against the same database, and concurrent DDL races Postgres.
          fileParallelism: false,
          testTimeout: 120_000,
        },
      },
    ],
  },
})
