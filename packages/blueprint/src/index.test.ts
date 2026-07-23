import { describe, expect, it } from "vitest";
import { defineTower, registerModule, getModuleFactory } from "./index";

describe("defineTower", () => {
  it("returns the config as-is", () => {
    const config = defineTower({
      framework: "next",
      modules: { vault: { provider: "neon" } },
    });

    expect(config).toEqual({
      framework: "next",
      modules: { vault: { provider: "neon" } },
    });
  });

  it("accepts an empty modules object", () => {
    const config = defineTower({
      framework: "next",
      modules: {},
    });

    expect(config.modules).toEqual({});
  });
});

describe("module registry", () => {
  it("stores and retrieves a module factory", () => {
    const factory = () => ({ name: "test", init: async () => {} });
    registerModule("test", factory);

    expect(getModuleFactory("test")).toBe(factory);
  });

  it("returns undefined for an unregistered module", () => {
    expect(getModuleFactory("nonexistent")).toBeUndefined();
  });

  it("overwrites a factory when registered twice", () => {
    const factory1 = () => ({ name: "test", init: async () => {} });
    const factory2 = () => ({ name: "test", init: async () => {} });
    registerModule("test", factory1);
    registerModule("test", factory2);

    expect(getModuleFactory("test")).toBe(factory2);
  });
});
