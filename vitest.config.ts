import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@towerjs/blueprint": resolve("packages/blueprint/src/index.ts"),
      "@towerjs/foundation": resolve("packages/foundation/src/index.ts"),
      "@towerjs/vault": resolve("packages/vault/src/index.ts"),
      "@towerjs/gatehouse": resolve("packages/gatehouse/src/index.ts"),
      "@towerjs/courier": resolve("packages/courier/src/index.ts"),
    },
  },
  test: {
    include: ["packages/*/src/**/*.test.ts"],
  },
});
