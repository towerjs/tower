import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@towerjs\/gatehouse\/next-js$/, replacement: resolve('packages/gatehouse/src/frameworks/next-js.ts') },
      { find: /^@towerjs\/blueprint$/, replacement: resolve('packages/blueprint/src/index.ts') },
      { find: /^@towerjs\/foundation$/, replacement: resolve('packages/foundation/src/index.ts') },
      { find: /^@towerjs\/vault$/, replacement: resolve('packages/vault/src/index.ts') },
      { find: /^@towerjs\/gatehouse$/, replacement: resolve('packages/gatehouse/src/index.ts') },
      { find: /^@towerjs\/courier$/, replacement: resolve('packages/courier/src/index.ts') },
    ],
  },
  test: {
    include: ['packages/*/src/**/*.test.ts'],
  },
})
