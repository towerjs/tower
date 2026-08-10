---
'@towerjs/vault': patch
---

Honor `sslmode=disable` (and `prefer`) in the `DATABASE_URL` connection string so production builds (`NODE_ENV=production`) can connect to a local Postgres without SSL. Previously production always forced SSL, causing `next start` to fail against databases that don't support it.
