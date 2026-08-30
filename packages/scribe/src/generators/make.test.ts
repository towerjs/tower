import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  factoryTemplate,
  jobTemplate,
  kebab,
  makeCommand,
  migrationTemplate,
  modelTemplate,
  pluralize,
  policyTemplate,
} from './make.js'

describe('naming helpers', () => {
  it('kebab-cases pascal and camel names', () => {
    expect(kebab('Project')).toBe('project')
    expect(kebab('TeamInvite')).toBe('team-invite')
    expect(kebab('APIKey')).toBe('api-key')
  })

  it('pluralizes table names', () => {
    expect(pluralize('project')).toBe('projects')
    expect(pluralize('category')).toBe('categories')
    expect(pluralize('box')).toBe('boxes')
    expect(pluralize('day')).toBe('days')
  })
})

describe('templates', () => {
  it('model template targets src/models with a pluralized table', () => {
    const { file, content } = modelTemplate('TeamInvite')
    expect(file).toBe(join('src', 'models', 'team-invite.ts'))
    expect(content).toContain('export class TeamInvite extends Model<TeamInviteRow>')
    expect(content).toContain("static table = 'team-invites'")
  })

  it('policy template includes registration guidance', () => {
    const { file, content } = policyTemplate('Project')
    expect(file).toBe(join('src', 'policies', 'project.ts'))
    expect(content).toContain('definePolicy<ProjectRecord>')
    expect(content).toContain("definePolicyRegistration('project', ProjectPolicy)")
  })

  it('factory template imports the sibling model', () => {
    const { content } = factoryTemplate('Project')
    expect(content).toContain("from '../models/project.js'")
    expect(content).toContain('defineFactory(Project')
  })

  it('job template emits a kebab-named async entry point', () => {
    const { file, content } = jobTemplate('SendReminder')
    expect(file).toBe(join('src', 'jobs', 'send-reminder.ts'))
    expect(content).toContain('export async function sendReminder(')
  })

  it('migration template numbers files sequentially', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tower-make-'))
    const first = migrationTemplate(dir, 'project')

    expect(first.file).toBe(join('src', 'vault', 'migrations', '0001_project.ts'))

    // Write it so the counter sees an existing migration.
    writeFileSync(join(dir, '0001_project.ts'), first.content)

    const second = migrationTemplate(dir, 'task')
    expect(second.file).toBe(join('src', 'vault', 'migrations', '0002_task.ts'))
    expect(second.content).toContain(".createTable('tasks')")
  })
})

describe('makeCommand', () => {
  let cwd: string
  const oldCwd = process.cwd()

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'tower-make-cmd-'))
    process.chdir(cwd)
  })

  afterEach(() => {
    process.chdir(oldCwd)
  })

  it('writes the generated file under src/ and reports its path', () => {
    const lines = makeCommand(['model', 'Project'])
    const target = join(cwd, 'src', 'models', 'project.ts')

    expect(lines[0]).toContain('Created src/models/project.ts')
    expect(existsSync(target)).toBe(true)
    expect(readFileSync(target, 'utf8')).toContain('export class Project extends Model<ProjectRow>')
  })

  it('rejects unknown generators and missing names', () => {
    expect(() => makeCommand(['widget', 'X'])).toThrow('Unknown generator "widget"')
    expect(() => makeCommand(['model'])).toThrow('Usage: tower make model <Name>')
    expect(() => makeCommand(['model', '9bad'])).toThrow('Invalid name')
  })
})
