import { createGatehouse } from '@towerjs/gatehouse/react-server'

import tower from '../../tower.config'

export const gatehouse = createGatehouse(tower)
