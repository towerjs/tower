export * from '@towerjs/courier'

import type { CourierModule } from '@towerjs/courier'
import { createLazyModule } from './lazy-module'

export const courier = createLazyModule<CourierModule>('courier')
