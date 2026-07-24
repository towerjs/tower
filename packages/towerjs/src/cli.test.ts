import { describe, it, expect, vi, beforeEach } from "vitest";

const mockMigrate = vi.fn();
const mockSeed = vi.fn();
const mockClose = vi.fn();
const mockApp = {
  container: {
    has: vi.fn(() => true),
    get: vi.fn((name: string) => {
      if (name === "vault" || name === "module.vault") {
        return { migrate: mockMigrate, seed: mockSeed, close: mockClose };
      }
      if (name === "gatehouse" || name === "module.gatehouse") {
        return { migrate: vi.fn() };
      }
      return undefined;
    }),
  },
};

vi.mock("@towerjs/foundation", () => ({
  createTowerApp: vi.fn(() => Promise.resolve(mockApp)),
}));

vi.mock("jiti", () => ({
  createJiti: vi.fn(() => ({
    import: vi.fn(() => Promise.resolve({ modules: {} })),
  })),
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal() as typeof import("node:fs");
  return { ...actual, existsSync: vi.fn(() => true) };
});

import { run, helpText, findConfig, loadApp } from "./cli";

describe("help", () => {
  it("returns help text for no command", async () => {
    const result = await run(undefined, []);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Usage: tower <command>");
  });

  it("returns help text for help command", async () => {
    const result = await run("help", []);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Usage: tower <command>");
  });

  it("returns help text for --help", async () => {
    const result = await run("--help", []);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Usage: tower <command>");
  });

  it("returns helpText()", () => {
    const lines = helpText();
    expect(lines[1]).toBe("Usage: tower <command>");
  });
});

describe("unknown command", () => {
  it("returns error for unknown command", async () => {
    const result = await run("wat", []);
    expect(result.exitCode).toBe(1);
    expect(result.stderr[0]).toBe("Unknown command: wat");
  });
});

describe("migrate", () => {
  beforeEach(() => {
    mockMigrate.mockReset();
    mockSeed.mockReset();
    mockClose.mockReset();
  });

  it("runs vault and gatehouse migrations", async () => {
    const result = await run("migrate", [], "/fake/tower.config.ts");
    expect(result.exitCode).toBe(0);
    expect(mockMigrate).toHaveBeenCalled();
    expect(result.stdout).toContain("Done.");
  });

  it("runs seeds when --seed flag is passed", async () => {
    const result = await run("migrate", ["--seed"], "/fake/tower.config.ts");
    expect(result.exitCode).toBe(0);
    expect(mockSeed).toHaveBeenCalled();
  });

  it("runs seeds when -s flag is passed", async () => {
    const result = await run("migrate", ["-s"], "/fake/tower.config.ts");
    expect(result.exitCode).toBe(0);
    expect(mockSeed).toHaveBeenCalled();
  });
});

describe("seed", () => {
  beforeEach(() => {
    mockMigrate.mockReset();
    mockSeed.mockReset();
    mockClose.mockReset();
  });

  it("runs seeds with migrations", async () => {
    const result = await run("seed", [], "/fake/tower.config.ts");
    expect(result.exitCode).toBe(0);
    expect(mockMigrate).toHaveBeenCalled();
    expect(mockSeed).toHaveBeenCalled();
  });

  it("skips migrations with --skip-migrate", async () => {
    const result = await run("seed", ["--skip-migrate"], "/fake/tower.config.ts");
    expect(result.exitCode).toBe(0);
    expect(mockMigrate).not.toHaveBeenCalled();
    expect(mockSeed).toHaveBeenCalled();
  });
});

describe("findConfig", () => {
  it("throws when no config found", () => {
    expect(() => findConfig("/tmp")).toThrow("Could not find tower.config.ts");
  });
});
