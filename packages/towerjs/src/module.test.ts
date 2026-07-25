import { describe, it, expect, vi, beforeEach } from "vitest"

const mockCreateTower = vi.fn()
const mockCreateAuthClient = vi.fn()

vi.mock("@towerjs/foundation", () => ({
  createTower: mockCreateTower,
  TowerInstance: class {},
}))

vi.mock("@towerjs/blueprint", () => ({
  defineTower: vi.fn((c: any) => c),
  TowerBlueprint: class {},
}))

vi.mock("@towerjs/vault", () => ({}))
vi.mock("@towerjs/gatehouse", () => ({}))
vi.mock("@towerjs/courier", () => ({}))

vi.mock("better-auth/react", () => ({
  createAuthClient: mockCreateAuthClient,
}))

describe("tower singleton", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateTower.mockResolvedValue({
      vault: { query: vi.fn() },
      gatehouse: {},
      courier: {},
      runtime: { name: "node-server", isServerless: false },
    })
  })

  it("calls createTower on module load", async () => {
    await import("./index.js")
    expect(mockCreateTower).toHaveBeenCalledOnce()
    expect(mockCreateTower).toHaveBeenCalledWith()
  })
})

describe("tower singleton shape", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateTower.mockResolvedValue({
      vault: { query: vi.fn() },
      gatehouse: {},
      courier: {},
      runtime: { name: "node-server", isServerless: false },
    })
  })

  it("has runtime, vault, gatehouse, courier properties", async () => {
    const mod = await import("./index.js")
    expect(mod.tower).toBeDefined()
    expect(mod.tower.runtime.name).toBe("node-server")
    const vault = mod.tower.vault as any
    expect(vault.query).toBeDefined()
  })
})

describe("re-exports", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateTower.mockResolvedValue({
      vault: {},
      gatehouse: {},
      courier: {},
      runtime: { name: "node-server", isServerless: false },
    })
  })

  it("re-exports defineTower from blueprint", async () => {
    const mod = await import("./index.js")
    expect(typeof mod.defineTower).toBe("function")
  })

  it("re-exports createTower from foundation", async () => {
    const mod = await import("./index.js")
    expect(mod.createTower).toBe(mockCreateTower)
  })
})

describe("authClient", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("creates auth client on module load", async () => {
    const fakeClient = { signIn: vi.fn() }
    mockCreateAuthClient.mockReturnValue(fakeClient)

    const mod = await import("./client.js")

    expect(mod.authClient).toBe(fakeClient)
    expect(mockCreateAuthClient).toHaveBeenCalledWith({
      baseURL: undefined,
    })
  })

  it("detects base URL from window when available", async () => {
    vi.resetModules()
    vi.restoreAllMocks()

    const fakeClient = { signIn: vi.fn() }
    mockCreateAuthClient.mockReturnValue(fakeClient)

    Object.defineProperty(globalThis, "window", {
      value: { location: { origin: "http://localhost:3000" } },
      configurable: true,
      writable: true,
    })

    const mod = await import("./client.js")

    expect(mockCreateAuthClient).toHaveBeenCalledWith({
      baseURL: "http://localhost:3000",
    })

    delete (globalThis as any).window
  })

  it("has expected authClient methods", async () => {
    vi.resetModules()
    vi.restoreAllMocks()

    const fakeClient = { signIn: vi.fn(), signUp: vi.fn(), signOut: vi.fn() }
    mockCreateAuthClient.mockReturnValue(fakeClient)

    const mod = await import("./client.js")

    expect(typeof mod.authClient.signIn).toBe("function")
    expect(typeof mod.authClient.signUp).toBe("function")
    expect(typeof mod.authClient.signOut).toBe("function")
  })
})
