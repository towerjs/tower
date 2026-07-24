import { describe, expect, it, beforeAll } from "vitest";
import { registerModule } from "@towerjs/blueprint";
import { createTowerApp } from "./app";

beforeAll(() => {
  registerModule("mock", () => ({
    name: "mock",
    async init(ctx) {
      ctx.container.register("mock", { value: 42 });
    },
  }));
});

describe("createTowerApp", () => {
  it("initializes configured modules", async () => {
    const app = await createTowerApp({
      modules: { mock: {} },
    });

    expect(app.container.get("mock")).toEqual({ value: 42 });
  });

  it("exposes the config on the app", async () => {
    const app = await createTowerApp({
      modules: { mock: {} },
    });

    expect(app.config).toEqual({
      modules: { mock: {} },
    });
  });

  it("calls shutdown in reverse order", async () => {
    const order: number[] = [];

    registerModule("alpha", () => ({
      name: "alpha",
      async shutdown() {
        order.push(1);
      },
    }));

    registerModule("beta", () => ({
      name: "beta",
      async shutdown() {
        order.push(2);
      },
    }));

    const app = await createTowerApp({
      modules: { alpha: {}, beta: {}, mock: {} },
    });

    await app.shutdown();

    expect(order).toEqual([2, 1]);
  });

  it("throws for an unknown module", async () => {
    await expect(
      createTowerApp({
        modules: { nonexistent: {} },
      }),
    ).rejects.toThrow("Unknown module \"nonexistent\"");
  });

  it("detects and exposes the runtime", async () => {
    const app = await createTowerApp({
      modules: { mock: {} },
    });

    expect(app.runtime.name).toBe("node-server");
    expect(app.runtime.isServerless).toBe(false);
  });
});
