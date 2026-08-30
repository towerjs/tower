import { createGatehouseHandlers } from '@towerjs/gatehouse/next'

import tower from '../../../../../tower.config'

export const { GET, POST } = createGatehouseHandlers(tower)
