import { resolve } from 'node:path'

export const aliases = [
  { find: /^@towerjs\/gatehouse\/next$/, replacement: resolve('packages/gatehouse/src/frameworks/next.ts') },
  { find: /^@towerjs\/gatehouse\/client$/, replacement: resolve('packages/gatehouse/src/client.ts') },
  { find: /^@towerjs\/blueprint\/internal$/, replacement: resolve('packages/blueprint/src/internal.ts') },
  { find: /^@towerjs\/blueprint$/, replacement: resolve('packages/blueprint/src/index.ts') },
  { find: /^@towerjs\/foundation$/, replacement: resolve('packages/foundation/src/index.ts') },
  { find: /^@towerjs\/vault$/, replacement: resolve('packages/vault/src/index.ts') },
  { find: /^@towerjs\/gatehouse$/, replacement: resolve('packages/gatehouse/src/index.ts') },
  { find: /^@towerjs\/courier$/, replacement: resolve('packages/courier/src/index.ts') },
  { find: /^@towerjs\/edge$/, replacement: resolve('packages/edge/src/index.ts') },
  { find: /^towerjs$/, replacement: resolve('packages/towerjs/src/index.ts') },
]
