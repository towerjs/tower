---
'@towerjs/foundation': patch
'towerjs': patch
---

Fix module initialization order when gatehouse and courier are both configured. The towerjs meta-package now resolves gatehouse's dependency on courier from the actual config, so courier's email/SMS/push services are registered before gatehouse initializes. Without this, courier-powered auth emails (verification, password reset, magic links) silently never sent. Foundation now awaits the register phase so service registration completes before any module initializes.
