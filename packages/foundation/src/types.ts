import type { TowerBlueprint } from "@towerjs/blueprint";

export type RuntimeName = "vercel-serverless" | "node-server" | "edge" | "unknown";

export interface TowerRuntime {
  name: RuntimeName;
  isServerless: boolean;
}

export type TowerConfig = TowerBlueprint;
