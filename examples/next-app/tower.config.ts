import { defineTower } from "@towerjs/blueprint";

export default defineTower({
  modules: {
    vault: { provider: "neon" },
    gatehouse: {
      provider: "better-auth",
      credentials: true,
      social: { google: {}, github: {} },
    },
  },
});
