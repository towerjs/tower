import type { GatehouseUser } from './types.js'
import { AuthenticationError, AuthorizationError } from './types.js'

/**
 * Tower policies: application authorization logic.
 *
 * A policy answers "is this user allowed to perform this action on this
 * resource?" It is deliberately not an RBAC framework and deliberately
 * independent of the authentication provider — the authenticated Tower user
 * is an input, never something a policy fetches itself. That keeps policies
 * pure application code that unit tests without request context:
 *
 * ```ts
 * class ProjectPolicy {
 *   view(user: GatehouseUser, project: Project) {
 *     return project.ownerId === user.id
 *   }
 *   async update(user: GatehouseUser, project: Project) {
 *     if (project.ownerId === user.id) return true
 *     return isOrganizationAdmin(project.organizationId, user.id) // db-backed, async
 *   }
 * }
 *
 * const projectPolicy = definePolicyRegistration(Project, new ProjectPolicy())
 *
 * await gatehouse.can(project, 'update')        // boolean
 * await gatehouse.authorize(project, 'update')  // throws when denied
 * ```
 */

/** A policy decision: sync or async. The engine normalizes both. */
export type PolicyDecision = boolean | Promise<boolean>

/**
 * A policy for one resource type. Keys are action names; values receive the
 * authenticated Tower user and the resource being authorized.
 */
export interface Policy<TResource = any, TUser extends GatehouseUser = GatehouseUser> {
  [action: string]: (user: TUser, resource: TResource, ...extra: unknown[]) => PolicyDecision
}

type AnyPolicy = Policy<any, any>

/** A policy and its resource identity, ready for application composition. */
export interface PolicyRegistration<TResource = any> {
  target: object | string
  policy: Policy<TResource>
}

function resolvePolicyFor(registry: PolicyRegistry, resource: object | string): AnyPolicy | undefined {
  if (typeof resource === 'string') {
    return registry.byKey.get(resource)
  }
  // Walk the prototype chain so subclasses inherit their base class's policy.
  let proto: object | null = Object.getPrototypeOf(resource)
  while (proto) {
    const ctor = (proto as any).constructor
    const found = registry.byConstructor.get(ctor) ?? registry.byConstructor.get(proto)
    if (found) return found
    proto = Object.getPrototypeOf(proto)
  }
  return undefined
}

/**
 * Registry mapping resource types to policies and evaluating decisions.
 *
 * Two levels live here on purpose:
 * - `can` / pure evaluation — safe to call with any user (including none).
 * - `authorize` — enforces authentication first, then the decision.
 */
export class PolicyRegistry {
  /** @internal */ readonly byConstructor = new WeakMap<object, AnyPolicy>()
  /** @internal */ readonly byKey = new Map<string, AnyPolicy>()

  /** Registers a policy for a resource constructor or a string key. */
  register(target: object | string, policy: AnyPolicy): void {
    if (typeof target === 'string') {
      this.byKey.set(target, policy)
      return
    }
    this.byConstructor.set(target, policy)
  }

  /** Returns the registered policy for a resource, if any. */
  policyFor(resource: object | string): AnyPolicy | undefined {
    return resolvePolicyFor(this, resource)
  }

  /**
   * Evaluates a policy action. An unauthenticated user yields `false`
   * without throwing — use {@link authorize} when absence of a user should
   * be an authentication failure rather than a denial.
   */
  async can(
    user: GatehouseUser | null | undefined,
    resource: object | string,
    action: string,
    ...args: unknown[]
  ): Promise<boolean> {
    if (!user) return false
    const policy = resolvePolicyFor(this, resource)
    if (!policy) {
      throw new Error(
        `No policy registered for ${typeof resource === 'string' ? `"${resource}"` : resource.constructor?.name}. ` +
          `Add it to the Gatehouse policies configuration before authorizing.`
      )
    }
    const handler = policy[action]
    if (typeof handler !== 'function') {
      throw new Error(`Policy action "${action}" is not defined for ${typeof resource}.`)
    }
    return Boolean(await handler(user, resource as any, ...args))
  }

  /**
   * Evaluates a policy action and throws when it is denied.
   *
   * Unauthenticated requests fail with AuthenticationError (who are you?);
   * authenticated-but-forbidden requests fail with AuthorizationError
   * (not allowed). The two cases are intentionally distinct errors.
   */
  async authorize(
    user: GatehouseUser | null | undefined,
    resource: object | string,
    action: string,
    ...args: unknown[]
  ): Promise<void> {
    if (!user) throw new AuthenticationError('Authentication required')
    const allowed = await this.can(user, resource, action, ...args)
    if (!allowed) {
      throw new AuthorizationError(`Not allowed to perform "${action}" on this resource`)
    }
  }
}

/** Type helper for declaring a policy for a specific resource shape. */
export function definePolicy<TResource>(policy: Policy<TResource>): Policy<TResource> {
  return policy
}

/** Declares a policy registration for `gatehouse({ policies: [...] })`. */
export function definePolicyRegistration<TResource>(
  target: object | string,
  policy: Policy<TResource>
): PolicyRegistration<TResource> {
  return { target, policy }
}
