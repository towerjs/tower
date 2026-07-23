export type TowerUser = {
  id: string;
  name: string;
  email: string;
};

export type VaultModule = {
  users: {
    findMany(): Promise<TowerUser[]>;
  };
};

/** Creates the first Vault module placeholder with mock user data. */
export function createVault(): VaultModule {
  return {
    users: {
      async findMany() {
        return [
          { id: "user_1", name: "Ada Lovelace", email: "ada@example.com" },
          { id: "user_2", name: "Grace Hopper", email: "grace@example.com" },
        ];
      },
    },
  };
}
