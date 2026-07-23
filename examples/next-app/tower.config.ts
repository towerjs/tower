import { defineTower } from "@towerjs/blueprint";

export default defineTower({
  framework: "next",
  modules: {
    vault: { provider: "neon" },
    gatehouse: {},
  },
});
