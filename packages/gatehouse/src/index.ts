export type GatehouseModule = {
  provider: "better-auth";
};

/** Creates the first Gatehouse auth placeholder. */
export function createGatehouse(): GatehouseModule {
  return { provider: "better-auth" };
}
