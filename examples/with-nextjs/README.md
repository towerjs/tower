# Tower + Next.js

A reference Next.js application demonstrating all Tower modules:

- **Vault** — PostgreSQL database with Kysely
- **Gatehouse** — Full auth (credentials, magic links, OTP, passkeys, 2FA, organizations, API keys)
- **Courier** — Email, SMS, and push notifications

## Getting started

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

Requires PostgreSQL. Start one with Docker:

```bash
docker compose up postgres
```

The app uses the Courier **console** email provider, which logs emails to stdout.
No external email credentials are needed for development.

## E2E tests

The E2E suite uses Playwright to verify the Tower stack end-to-end:

```
✓ unauthenticated user redirected to sign in
✓ user can sign up
✓ email is verified after sign up
✓ user can sign out
✓ user can sign in after sign out
✓ session persists after reload
```

Run the tests:

```bash
# Terminal 1: start PostgreSQL
docker compose up postgres

# Terminal 2: run the tests
pnpm test:e2e
```

Playwright's global setup automatically resets the database (drops and recreates the schema, runs migrations) before each test run. The Next.js dev server starts via the Playwright webServer config.

The `console` email provider logs to stdout — no external credentials needed.
Each test generates a unique email (`test-${Date.now()}@example.com`) to avoid state conflicts across tests.

To manually reset the database:

```bash
docker compose down -v && docker compose up postgres
```

OAuth tests (`e2e/oauth.spec.ts`) are skipped unless `GOOGLE_CLIENT_ID` / `GITHUB_CLIENT_ID` are set.

## Architecture

- `tower.config.ts` — Central Tower configuration
- `src/proxy.ts` — Auth middleware (Next.js proxy)
- `src/actions/` — Application-specific server actions (Courier demo)
- `towerjs/gatehouse/actions` — Pre-built Gatehouse auth server actions (imported directly)
- `src/app/api/auth/[...all]/route.ts` — Auth API routes
- `src/app/dashboard/` — Protected dashboard pages
- `src/components/` — UI components and forms
