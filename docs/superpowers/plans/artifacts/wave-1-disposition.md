# Wave 1 disposition (PRs #14–#15)

Source: CodeRabbit inline comments on merged PR #14 (7 findings). PR #15 had **no** CodeRabbit review comments (`NONE`).

| Finding | Verdict |
|---|---|
| `CLAUDE.md` — async multi-rater path | **Fixed** |
| `README.md` — async multi-rater path | **Fixed** |
| `scripts/copy-server-assets.mjs` — clean migrations dest | **Fixed** |
| `server/index.ts` — nested ternary | **Fixed** |
| `server/test/auth.test.ts` — signed-in positive path | **Fixed** |
| `src/App.tsx` — stale session race | **Fixed** |
| `server/test/socket-authz.test.ts` — `@vetcrew/shared` resolve | **Skipped** — later package exports/`development` condition; integration CI green on current `master` |
