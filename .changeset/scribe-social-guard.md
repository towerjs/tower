---
'@towerjs/scribe': patch
---

Emit social provider config in generated `tower.config.ts` guarded by env var checks (`...(process.env.GOOGLE_CLIENT_ID ? ... : {})`) so a scaffolded app boots without requiring OAuth credentials, and add the matching `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (etc.) placeholders to the generated `.env.example`.
