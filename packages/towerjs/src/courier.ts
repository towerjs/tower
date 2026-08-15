import type { CourierModule } from '@towerjs/courier'

import { createLazyModule } from './lazy-module.js'

/**
 * Lazy courier proxy.
 *
 * First access triggers tower initialization. Delegates to the
 * initialized `@towerjs/courier` module.
 *
 * @example
 * ```ts
 * import { courier } from 'towerjs/courier'
 * await courier.email.send({ to, subject, text })
 * ```
 */
export const courier = createLazyModule<CourierModule>('courier')
export type { CourierModule } from '@towerjs/courier'
