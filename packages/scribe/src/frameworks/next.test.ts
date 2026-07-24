import { describe, expect, it } from "vitest";
import { towerConfig, envExample, capitalize } from "./next.js";
import type { ProjectState } from "../state.js";

const baseState: ProjectState = {
  projectName: "my-app",
  framework: "next",
  modules: {},
  deployment: "vercel",
  frameworkAnswers: { typescript: true, tailwind: true },
};

describe("capitalize", () => {
  it("capitalizes the first letter", () => {
    expect(capitalize("vault")).toBe("Vault");
    expect(capitalize("gatehouse")).toBe("Gatehouse");
  });
});

describe("towerConfig", () => {
  it("generates config with no modules", () => {
    const result = towerConfig(baseState);

    expect(result).toContain('import { defineTower } from "@towerjs/blueprint"');
    expect(result).toContain("modules:");
  });

  it("generates config with vault module", () => {
    const state: ProjectState = {
      ...baseState,
      modules: { vault: { provider: "neon" } },
    };
    const result = towerConfig(state);

    expect(result).toContain("vault: {");
    expect(result).toContain('provider: "neon"');
  });

  it("generates config with gatehouse module", () => {
    const state: ProjectState = {
      ...baseState,
      modules: { gatehouse: {} },
    };
    const result = towerConfig(state);

    expect(result).toContain("gatehouse: {}");
  });

  it("generates config with multiple modules", () => {
    const state: ProjectState = {
      ...baseState,
      modules: {
        vault: { provider: "neon" },
        gatehouse: { provider: "better-auth" },
      },
    };
    const result = towerConfig(state);

    expect(result).toContain("vault:");
    expect(result).toContain("gatehouse:");
    expect(result).toContain('provider: "neon"');
    expect(result).toContain('provider: "better-auth"');
  });

  it("generates config with Tower-shaped gatehouse features", () => {
    const state: ProjectState = {
      ...baseState,
      modules: {
        gatehouse: { provider: "better-auth", credentials: true, social: { google: {} } },
      },
    };
    const result = towerConfig(state);

    expect(result).toContain("credentials: true");
    expect(result).toContain("google");
  });
});

describe("envExample", () => {
  it("returns empty for no modules", () => {
    expect(envExample(baseState)).toBe("\n");
  });

  it("includes DATABASE_URL when vault is enabled", () => {
    const state: ProjectState = {
      ...baseState,
      modules: { vault: { provider: "neon" } },
    };
    const result = envExample(state);

    expect(result).toContain("DATABASE_URL");
  });
});
