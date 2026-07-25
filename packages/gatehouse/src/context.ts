import { towerContext } from "@towerjs/blueprint"
import type { GatehouseInstance } from "./types.js"

/**
 * Thrown when a gatehouse method is called outside of a request context.
 *
 * This happens when using the `gatehouse` proxy without first creating
 * a per-request instance via `gatehouse.from()` or wrapping the handler
 * in `action()` / `withGatehouse()`.
 */
export class ContextRequiredError extends Error {
  constructor(message?: string) {
    super(message ?? (
      "No request context available.\n\n" +
      "gatehouse methods require a request context. " +
      "Use gatehouse.from() directly in route handlers."
    ))
    this.name = "ContextRequiredError"
  }
}

/** Returns the current request-scoped gatehouse instance from the ALS context, if one is active. */
export function getCurrentGatehouse(): GatehouseInstance | undefined {
  return towerContext.get<GatehouseInstance>("gatehouse")
}
