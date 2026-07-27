# Tower + Next.js

A reference Next.js application demonstrating all Tower modules:

- **Vault** — PostgreSQL database with Kysely
- **Gatehouse** — Full auth (credentials, magic links, OTP, passkeys, 2FA, organizations, API keys)
- **Courier** — Email, SMS, and push notifications

## Getting started

```bash
cp .env.example .env
# Fill in your environment variables
pnpm install
pnpm dev
```

## Architecture

- `tower.config.ts` — Central Tower configuration
- `src/proxy.ts` — Auth middleware (Next.js proxy)
- `src/app/actions.ts` — Server actions wrapping Gatehouse and Courier
- `src/app/api/auth/[...all]/route.ts` — Auth API routes
- `src/app/dashboard/` — Protected dashboard pages
- `src/components/` — UI components and forms
