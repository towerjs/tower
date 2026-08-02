---
'@towerjs/scribe': minor
---

Add `tower migrate`, `tower migrate --seed`, `tower seed`, and `tower seed --skip-migrate` commands. The CLI now reads the project's `tower.config.ts`, runs Kysely migrations for Vault and Gatehouse tables, and executes seed files. The `tower` binary also installs `@towerjs/scribe` in newly scaffolded projects.
