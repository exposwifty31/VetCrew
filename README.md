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
- **Builder:** `RAILPACK` via [`railway.json`](railway.json) is canonical; [`Dockerfile`](Dockerfile) is backup only.
- **Build-time (Railway service variables):** `VITE_CLERK_PUBLISHABLE_KEY` must be set before `pnpm build` runs — Vite bakes it into the SPA bundle at build time, not at runtime.
- **Runtime:** `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `DATABASE_URL`, `NODE_ENV=production`, `PORT`.
- Optional: `CORS_ORIGIN=https://<your-domain>` (defaults to `https://$RAILWAY_PUBLIC_DOMAIN`).
- Health: `GET /api/health` (503 while DB is starting).

### Auth & pitch-only env

| Variable | Where | Purpose |
|---|---|---|
| `VETCREW_TEST_AUTH=1` | CI / local e2e only | Enables `Authorization: Bearer test:<userId>:<role>` where `<role>` is `manager`, `instructor`, or `trainee`. **Never set in production Railway.** |
| `VETCREW_ALLOW_UNREVIEWED_SCORES=1` | CI / local pitch demos | Allows ratings on scenarios with `clinically_reviewed: false`. Unset in production — server returns 403 `scenario_not_clinically_reviewed`. |

Production roles: Clerk `user.publicMetadata.vetcrewRole` (`manager` \| `instructor` \| `trainee`). Live socket join is allowlisted by `role_stations.assigned_user_id`.

## Product posture

- Two scoring axes: technical checklist/tasks + ANTS (formative until three raters).
- Cross-person readiness bands withheld (`cohort_insufficient`) until cohort N exists.
- Unreviewed scenarios (`clinically_reviewed: false`) are internal-testing only.
