import { describe, expect, it } from "vitest";
import { ServiceContainer } from "./container";

describe("ServiceContainer", () => {
  it("registers and retrieves an instance", () => {
    const container = new ServiceContainer();
    container.register("db", { query: "SELECT 1" });

    expect(container.get("db")).toEqual({ query: "SELECT 1" });
  });

  it("returns the same instance on repeated get", () => {
    const container = new ServiceContainer();
    const instance = { id: 1 };
    container.register("service", instance);

    expect(container.get("service")).toBe(instance);
  });

  it("throws when getting an unregistered service", () => {
    const container = new ServiceContainer();

    expect(() => container.get("missing")).toThrow(
      'Service "missing" is not registered',
    );
  });

  it("registers and resolves a factory lazily", () => {
    const container = new ServiceContainer();
    const factory = () => ({ createdAt: Date.now() });
    container.registerFactory("lazy", factory);

    const result = container.get<{ createdAt: number }>("lazy");
    expect(result.createdAt).toBeGreaterThan(0);
  });

  it("caches the factory result", () => {
    const container = new ServiceContainer();
    container.registerFactory("single", () => ({ rand: Math.random() }));

    const a = container.get<{ rand: number }>("single");
    const b = container.get<{ rand: number }>("single");

    expect(a).toBe(b);
    expect(a.rand).toBe(b.rand);
  });

  it("returns false for has when not registered", () => {
    const container = new ServiceContainer();

    expect(container.has("nothing")).toBe(false);
  });

  it("returns true for has when registered as instance", () => {
    const container = new ServiceContainer();
    container.register("exists", 42);

    expect(container.has("exists")).toBe(true);
  });

  it("returns true for has when registered as factory", () => {
    const container = new ServiceContainer();
    container.registerFactory("exists", () => 42);

    expect(container.has("exists")).toBe(true);
  });

  it("does not call the factory on has", () => {
    let called = false;
    const container = new ServiceContainer();
    container.registerFactory("lazy", () => {
      called = true;
      return 42;
    });

    container.has("lazy");
    expect(called).toBe(false);
  });

  it("overwrites a previously registered instance", () => {
    const container = new ServiceContainer();
    container.register("key", "first");
    container.register("key", "second");
    expect(container.get("key")).toBe("second");
  });

  it("overwrites a previously registered factory", () => {
    const container = new ServiceContainer();
    container.registerFactory("key", () => "first");
    container.registerFactory("key", () => "second");
    expect(container.get("key")).toBe("second");
  });

  it("caches factory result even when undefined", () => {
    const container = new ServiceContainer();
    let callCount = 0;
    container.registerFactory("maybe", () => {
      callCount++;
      return undefined as any;
    });

    expect(container.get("maybe")).toBeUndefined();
    expect(callCount).toBe(1);
    expect(container.get("maybe")).toBeUndefined();
    expect(callCount).toBe(1);
  });
});
