import { defineApplication } from "@towerjs/blueprint";

export default defineApplication({
  framework: "next",
  database: {
    provider: "postgres",
  },
  auth: {
    provider: "better-auth",
  },
  realtime: {
    provider: "ably",
  },
  storage: {
    provider: "s3",
  },
});
