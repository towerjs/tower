import { describe, expect, it } from 'vitest'

import { PolicyRegistry, definePolicy } from './policies.js'
import { AuthenticationError, AuthorizationError, type GatehouseUser } from './types.js'

function makeUser(id = 'u1'): GatehouseUser {
  return {
    id,
    name: 'Test',
    email: `${id}@example.com`,
    emailVerified: true,
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

class Project {
  constructor(
    readonly ownerId: string,
    readonly organizationId?: string
  ) {}
}

const projectPolicy = definePolicy<Project>({
  view: (user, project) => project.ownerId === user.id,
  update: (user, project) => project.ownerId === user.id,
  async destroy(user, project) {
    if (project.ownerId === user.id) return true
    // simulate a db-backed membership check
    return project.organizationId === `org-admin-${user.id}`
  },
})

describe('PolicyRegistry', () => {
  it('allows and denies with synchronous decisions', async () => {
    const registry = new PolicyRegistry()
    registry.register(Project, projectPolicy)

    const owner = makeUser('u1')
    const other = makeUser('u2')

    expect(await registry.can(owner, new Project('u1'), 'view')).toBe(true)
    expect(await registry.can(other, new Project('u1'), 'view')).toBe(false)
  })

  it('normalizes asynchronous decisions', async () => {
    const registry = new PolicyRegistry()
    registry.register(Project, projectPolicy)

    const admin = makeUser('boss')
    expect(await registry.can(admin, new Project('someone-else', 'org-admin-boss'), 'destroy')).toBe(true)
    expect(await registry.can(makeUser('nope'), new Project('someone-else', 'org-admin-boss'), 'destroy')).toBe(false)
  })

  it('supports class-based policies', async () => {
    class DocPolicy {
      edit(user: GatehouseUser, doc: { ownerId: string }) {
        return doc.ownerId === user.id
      }
    }

    class Doc {
      constructor(readonly ownerId: string) {}
    }

    const registry = new PolicyRegistry()
    registry.register(Doc, new DocPolicy())

    expect(await registry.can(makeUser(), new Doc('u1'), 'edit')).toBe(true)
  })

  it('supports string-keyed resources', async () => {
    const registry = new PolicyRegistry()
    registry.register('Settings', {
      read: (user: GatehouseUser) => user.role === 'admin',
    })

    const admin = { ...makeUser(), role: 'admin' }
    const member = makeUser()

    expect(await registry.can(admin, 'Settings', 'read')).toBe(true)
    expect(await registry.can(member, 'Settings', 'read')).toBe(false)
  })

  it('resolves policies through the prototype chain for subclasses', async () => {
    class SpecialProject extends Project {}

    const registry = new PolicyRegistry()
    registry.register(Project, projectPolicy)

    expect(await registry.can(makeUser('u9'), new SpecialProject('u9'), 'update')).toBe(true)
  })

  it('returns false for an unauthenticated user without throwing on can()', async () => {
    const registry = new PolicyRegistry()
    registry.register(Project, projectPolicy)

    expect(await registry.can(null, new Project('u1'), 'view')).toBe(false)
    expect(await registry.can(undefined, new Project('u1'), 'view')).toBe(false)
  })

  it('authorize throws AuthenticationError when unauthenticated', async () => {
    const registry = new PolicyRegistry()
    registry.register(Project, projectPolicy)

    await expect(registry.authorize(null, new Project('u1'), 'view')).rejects.toThrow(AuthenticationError)
  })

  it('authorize throws AuthorizationError — distinct from authentication failure — when denied', async () => {
    const registry = new PolicyRegistry()
    registry.register(Project, projectPolicy)

    // authenticated but not the owner -> authorization failure, not authn
    await expect(registry.authorize(makeUser('u2'), new Project('u1'), 'update')).rejects.toThrow(AuthorizationError)
    await expect(registry.authorize(makeUser('u2'), new Project('u1'), 'update')).rejects.not.toThrow(
      AuthenticationError
    )
    // allowed -> resolves
    await expect(registry.authorize(makeUser('u1'), new Project('u1'), 'update')).resolves.toBeUndefined()
  })

  it('throws for unregistered resource types and unknown actions', async () => {
    const registry = new PolicyRegistry()
    registry.register(Project, projectPolicy)

    class Unregistered {}
    await expect(registry.can(makeUser(), new Unregistered(), 'view')).rejects.toThrow('No policy registered')
    await expect(registry.can(makeUser(), new Project('u1'), 'nonexistent')).rejects.toThrow('not defined')
  })
})
