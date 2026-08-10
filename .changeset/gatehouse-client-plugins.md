---
'@towerjs/gatehouse': patch
---

Wire the Better Auth client plugins (admin, email OTP, magic link, organizations, phone number, two-factor) into the Gatehouse client, make `can()` permission checks fail closed when no organization or permission is set, and fix the expired API key deletion action to be exposed under `apiKeys.deleteAllExpired`.
