import { towerContext } from "@towerjs/blueprint"
import type { GatehouseInstance } from "./types.js"

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

export function getCurrentGatehouse(): GatehouseInstance | undefined {
  return towerContext.get<GatehouseInstance>("gatehouse")
}
