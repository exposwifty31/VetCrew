# Parallel worktrees — conventions

One git vault, many isolated checkouts: every agent (and the human, when parallel)
works in its own git worktree with its own ports, databases, and `.env`, so the full
verification pyramid — typecheck, unit, integration, e2e, dev servers — runs
concurrently across worktrees with zero collisions.

## Commands

```bash
pnpm worktree new <name>            # create ../vetcrew-<name> + branch + .env + DBs
pnpm worktree list                  # slots, ports, DBs, liveness
pnpm worktree rm  <name>            # remove worktree, then drop its DBs, prune, delete branch
pnpm worktree rm  <name> --force    # same, discarding uncommitted work
pnpm worktree rm  <name> --orphan   # DBs only, for a worktree already removed by hand
```

**`rm` removes the worktree *before* it drops any database, and aborts if that
fails.** The order is deliberate: dropping first meant a worktree with uncommitted
work lost its databases and *then* had the removal refused, leaving a checkout that
existed but could never run. If `rm` refuses, nothing has been deleted — commit,
stash, or pass `--force`.

`rm` also refuses a name with no registered worktree, so a typo cannot reach
another worktree's data. Cleaning up databases whose worktree is already gone is a
real need but a different operation: that is what `--orphan` is for.

**`new` rolls itself back.** If database creation or `pnpm install` fails, the
worktree, branch, `.env`, and any database *this run created* are removed, so the
obvious retry (`worktree new <same name>`) works instead of failing on "already
exists". A stale database it merely reused is left alone — it was not this run's to
delete.

## Shared vs isolated

| Shared (one per machine) | Isolated (one per worktree) |
|---|---|
| git object store (`.git` in the main checkout) | working tree + branch |
| pnpm content-addressable store | `node_modules/` |
| one Postgres **server** | two **databases**: `vetcrew_test_<slug>` (integration; schema dropped per run) + `vetcrew_e2e_test_<slug>` (dev/e2e) |
| Playwright browsers | ports: API `3001+slot`, web `5173+slot` |
| | `.env`, `dist/`, `dist-server/`, `test-results/`, `playwright-report/` |

The main checkout is implicitly **slot 0** on the defaults (3001/5173,
`vetcrew_test` / `vetcrew_e2e_test`) and belongs to the human.

## Lifecycle

1. `pnpm worktree new <name>` — branch-per-worktree; the branch and the worktree are
   born and die together.
2. Work entirely inside the worktree; open the PR from its branch.
3. After merge: `pnpm worktree rm <name>`.
4. Never plain `git worktree remove` — it orphans the two databases. If you did,
   `pnpm worktree rm <name> --orphan` cleans them up.

## Rules for agents

- **Always `cd` into your worktree before any command.** Every path, port, and DB
  binding comes from the worktree's own `.env`.
- Never edit another worktree's files, and never edit `PORT`, `VETCREW_WEB_PORT`,
  `DATABASE_URL`, `TEST_DATABASE_URL`, or `VETCREW_SLOT` in your `.env` — slot
  allocation depends on them.
- The integration suite drops *your* schema only; running it concurrently with other
  worktrees is the designed, tested case.
- New event types or scenario actions: `docs/doctrines/event-taxonomy.md`, same
  commit, no exceptions — worktrees isolate files, not vocabulary.

## Deliberate blind spot: auth

Worktree `.env` files are generated **keyless** — the server boots in its loud
dev-bypass mode and no worktree ever exercises the real Clerk auth path. This is
intentional (agents don't hold secrets; e2e uses the `VETCREW_TEST_AUTH` seam that
Playwright sets for its own spawned servers). Consequence: **any auth-touching change
must be verified once against a real-keys environment before merge** — the main
checkout after `clerk env pull`, or CI's e2e job. Saying "e2e passed in my worktree"
is not evidence about real Clerk behavior.

## Failure modes

- **Postgres down** — `worktree new` preflights the admin connection
  (`VETCREW_ADMIN_DATABASE_URL`, default `postgres://postgres@127.0.0.1:5432/postgres`)
  and exits before touching git; nothing to clean up.
- **Port already bound** — Vite runs with `strictPort` and fails loudly rather than
  silently hopping to another worktree's port; `pnpm worktree list` shows what's
  listening.
- **Stale worktree** (directory deleted by hand) — `list` flags it; `worktree rm`
  recovers (DB drop + prune).
- **Stale DBs** (worktree removed via raw git) — the next `new` with the same name
  warns "stale, reusing"; the integration suite drops the schema anyway.
- **Concurrent `new` race** — slot allocation holds an atomic `mkdir` lock under the
  main `.git/`; if a crashed run left the lock behind, the error message names the
  directory to delete.
