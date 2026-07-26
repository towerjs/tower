export * from '@towerjs/vault'

import type { VaultModule } from '@towerjs/vault'
import { createLazyModule } from './lazy-module'

export const vault = createLazyModule<VaultModule>('vault')
