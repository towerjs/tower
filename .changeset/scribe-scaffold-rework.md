---
'@towerjs/scribe': minor
---

Rework the `tower create` scaffold flow: prompts now ask for a deployment target (Vercel, Cloudflare, other) and runtime (Node or Edge), the active package manager is detected instead of assuming pnpm, and generated projects only install `@towerjs/edge` when the Edge runtime is selected.
