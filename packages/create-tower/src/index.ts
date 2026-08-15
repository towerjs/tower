#!/usr/bin/env node
import { createCommand } from '@towerjs/scribe'

await createCommand(process.argv.slice(2))
