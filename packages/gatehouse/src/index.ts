import type { TowerModule, TowerInitContext } from "@towerjs/blueprint";
import { registerModule } from "@towerjs/blueprint";

export type TowerUser = {
  id: string;
  name: string;
  email: string;
};

export type GatehouseConfig = Record<string, never>;

export type GatehouseModule = {
  users: {
    list(): Promise<TowerUser[]>;
  };
};

export function gatehouse(_options?: GatehouseConfig): TowerModule {
  return {
    name: "gatehouse",
    async init(ctx: TowerInitContext) {
      const instance: GatehouseModule = {
        users: {
          async list() {
            return [
              { id: "user_1", name: "Ada Lovelace", email: "ada@example.com" },
              { id: "user_2", name: "Grace Hopper", email: "grace@example.com" },
            ];
          },
        },
      };
      ctx.container.register("gatehouse", instance);
    },
  };
}

registerModule("gatehouse", (config) => gatehouse(config as GatehouseConfig));
