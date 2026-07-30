# VetCrew — Project Context (moved)

The authoritative project context now lives at the **repository root**: [`../CLAUDE.md`](../CLAUDE.md).

It was promoted to the root so Claude Code auto-loads it at session start. Edit the root
file, not this stub. This pointer remains only so links to `docs/CLAUDE.md` don't dead-end.

Related:
- `docs/VETCREW-RESEARCH-PATCH-2026-07-23.md` — the research patch applied to the root doc on 2026-07-23.
- The governing architecture/scoring/UI doctrines are **installed plugin skills**, not files in
  this repo: `anthropic-skills:vetcrew-sim-architecture`, `:vetcrew-scenario-authoring`,
  `:vetcrew-realtime-ui` (invoke via the Skill tool). They are **not vendored here** — a fresh
  clone cannot read them.
- **`:vetcrew-readiness-scoring` did not load at all in a clean checkout**, so its doctrine has
  been exported and is now versioned in this repo: **[`doctrines/readiness-scoring.md`](doctrines/readiness-scoring.md)**.
  [`doctrines/event-taxonomy.md`](doctrines/event-taxonomy.md) governs what may enter the event log.
  Those two files are authoritative; the remaining architecture/UI doctrine still lives in the
  plugin skills plus `CLAUDE.md §3–4`.
