# VetCrew

Crew trainer for veterinary ER / internal-medicine staff — event-sourced sim, Hebrew-first UI, evidence for hiring conversations (not a verdict).

## Stack

TypeScript end-to-end · pure engine reducer · Express + Socket.IO · Postgres/Drizzle · Vite/React · Clerk · Railway.

See `CLAUDE.md` for frozen product/engineering decisions.

## Local

```bash
pnpm install
# .env — copy from .env.example; `clerk env pull --file .env` after `clerk auth login`
pnpm dev:server   # :3001
pnpm dev          # Vite :5173, proxies /api + /socket.io
```

Omit Clerk keys in `.env` for server/socket **dev-bypass** (loud; not for pitch).

## Tests

```bash
pnpm typecheck
pnpm test
pnpm test:integration   # needs TEST_DATABASE_URL (name must contain "test")
pnpm i18n:check
pnpm guard:deps
```

## Deploy (Railway)

- Project serves SPA + API from one `web` service; Postgres via `${{Postgres.DATABASE_URL}}`.
- **Build-time:** `VITE_CLERK_PUBLISHABLE_KEY` must be present during `pnpm build` (baked into the client).
- **Runtime:** `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `DATABASE_URL`, `NODE_ENV=production`, `PORT`.
- Optional: `CORS_ORIGIN=https://<your-domain>` (defaults to `https://$RAILWAY_PUBLIC_DOMAIN`).
- Health: `GET /api/health` (503 while DB is starting).

## Product posture

- Two scoring axes: technical checklist/tasks + ANTS (formative until three raters).
- Cross-person readiness bands withheld (`cohort_insufficient`) until cohort N exists.
- Unreviewed scenarios (`clinically_reviewed: false`) are internal-testing only.
