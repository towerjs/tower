import { defineTower, vault, gatehouse } from "towerjs";

export default defineTower({
  framework: "next",
  modules: [
    vault({ provider: "neon" }),
    gatehouse(),
  ],
});
