# Evidence Spine Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the VetCrew event log tamper-evident with a per-event hash chain, and make it impossible to boot a production server with an authentication or clinical-review bypass enabled.

**Architecture:** Every row in `vc_session_events` stores `prev_hash` and `event_hash`. The application computes both inside the existing single-writer transaction in `appendSessionEventsTx`; a database trigger independently enforces that each row's `prev_hash` matches the previous row's `event_hash`, mirroring the existing seq-contiguity trigger. Content correctness is checked by a pure TypeScript verifier, which attestation calls before it will freeze a rating's log head. Separately, two environment flags that bypass auth and clinical review are refused at boot in production and at their use sites.

**Tech Stack:** TypeScript 7, Node 24, Express 5, Drizzle ORM + Postgres, Zod 4, Vitest 4. Plain numbered SQL migrations applied on boot by `server/db/migrate.ts`.

**Design spec:** [docs/superpowers/specs/2026-08-02-evidence-spine-integrity-design.md](../specs/2026-08-02-evidence-spine-integrity-design.md)

## Global Constraints

- **No new runtime dependencies.** The canonical encoder is written locally (spec §2.4). `pnpm guard:deps` and `pnpm guard:dead` must pass.
- **`packages/engine` must not change.** It has zero runtime dependencies and that is enforced by `scripts/check-boundaries.ts` ("engine-is-pure").
- **The event log is append-only.** Never `UPDATE` or `DELETE` `vc_session_events` from application code. A trigger from `0001_init.sql` blocks it.
- **No verdict may enter the event log.** Hashes are metadata about a record, not judgments about a performance.
- **Chain scheme tags are frozen strings:** `vetcrew.chain-genesis.v1` and `vetcrew.event.v1`. Once shipped they are never changed; a new scheme gets a new tag.
- **Hash format is lowercase hex SHA-256,** matching `^[a-f0-9]{64}$`.
- **Every user-facing string goes through `src/i18n`,** in both `he.json` and `en.json`. `pnpm i18n:check` must pass.
- **All server tests live in `server/test/`** and run under `pnpm test:integration`. `pnpm test` covers only `packages/engine` and `packages/shared`.
- **Every commit must leave CI green.** This is why the migration is split across Tasks 4 and 6: the trigger cannot land before the write path populates the columns.
- **Import style:** relative imports carry the `.js` extension (ESM/NodeNext). Use `import type` for type-only imports.

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `server/canonical-json.ts` | RFC 8785 canonical JSON serialization. Nothing else. |
| `server/event-chain.ts` | Genesis and per-event hash derivation. Owns the frozen scheme tags. |
| `server/event-chain-verify.ts` | Pure verification of an ordered chain. Depends on `event-chain.ts`. |
| `server/db/migrations/0007_event_hash_chain.sql` | Adds the two columns and the format CHECK. |
| `server/db/migrations/0008_event_chain_trigger.sql` | Adds the linkage trigger. |
| `server/test/env.test.ts` | Boot-gate tests for the bypass flags. |
| `server/test/canonical-json.test.ts` | Encoder tests, including throw-cases. |
| `server/test/event-chain.test.ts` | Hash derivation tests. |
| `server/test/event-chain-append.test.ts` | DB-backed round-trip and linkage tests for the write path. |
| `server/test/event-chain-trigger.test.ts` | DB-backed tamper tests against the trigger. |
| `server/test/event-chain-verify.test.ts` | Verifier tests over fixtures. |

**Modified:**

| File | Change |
|---|---|
| `server/env.ts` | Refuse to boot in production with either bypass flag set. |
| `server/auth.ts` | `isTestAuthEnabled()` returns false in production; export it. |
| `server/routes/sessions.ts` | Extract `allowUnreviewedScores()`; pass session identity to attestation; handle the broken-chain outcome. |
| `server/index.ts` | Health endpoint reports `test` as an auth mode. |
| `server/db/schema/events.ts` | Add `prevHash` and `eventHash` columns. |
| `server/live/event-append.ts` | Compute the chain inside the existing transaction. |
| `server/evidence-attest.ts` | Head hash comes from the chain; refuse to attest an unverifiable chain. |
| `src/App.tsx` | `Health.auth` union gains `"test"`. |
| `src/i18n/he.json`, `src/i18n/en.json` | Add `shell.server.auth.test`; reword `manager.evidence.logHead`. |
| `.env.example`, `README.md`, `docs/doctrines/readiness-scoring.md`, `CLAUDE.md` | Documentation. |

**Dependency order:** Task 1 is independent and lands first because it closes a live security hole. Tasks 2 → 3 → 4 → 5 → 6 → 7 → 8 form a chain where each depends on the previous.

---

## Task 1: Lock the bypass flags out of production

`VETCREW_TEST_AUTH=1` in production currently makes `Authorization: Bearer test:anyone:manager` authenticate as a manager, because `parseTestBearer` runs before Clerk in both readers and `isTestAuthEnabled()` has no environment guard. `VETCREW_ALLOW_UNREVIEWED_SCORES=1` bypasses the clinical-review gate. Both are documented as forbidden in production in three places and enforced in none.

**Files:**
- Create: `server/test/env.test.ts`
- Modify: `server/env.ts`
- Modify: `server/auth.ts:17-19`
- Modify: `server/routes/sessions.ts:466-472`
- Modify: `server/index.ts:45-52`
- Modify: `src/App.tsx:38-42`
- Modify: `src/i18n/he.json`, `src/i18n/en.json`
- Modify: `server/test/auth-roles.test.ts`
- Modify: `.env.example:19-24`, `README.md:45`, `docs/doctrines/readiness-scoring.md:80-83`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `isTestAuthEnabled(): boolean` exported from `server/auth.ts`.

- [ ] **Step 1: Write the failing boot-gate tests**

Create `server/test/env.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { loadEnv } from "../env.js";

const PRODUCTION_BASE = {
  NODE_ENV: "production",
  DATABASE_URL: "postgres://user:pass@localhost:5432/vetcrew",
  CLERK_SECRET_KEY: "sk_test_x",
  CLERK_PUBLISHABLE_KEY: "pk_test_x",
} satisfies NodeJS.ProcessEnv;

describe("loadEnv production bypass gate", () => {
  test("boots in production when no bypass flag is set", () => {
    expect(() => loadEnv({ ...PRODUCTION_BASE })).not.toThrow();
  });

  test("refuses to boot in production with VETCREW_TEST_AUTH=1", () => {
    expect(() => loadEnv({ ...PRODUCTION_BASE, VETCREW_TEST_AUTH: "1" })).toThrow(
      /VETCREW_TEST_AUTH/,
    );
  });

  test("refuses to boot in production with VETCREW_ALLOW_UNREVIEWED_SCORES=1", () => {
    expect(() =>
      loadEnv({ ...PRODUCTION_BASE, VETCREW_ALLOW_UNREVIEWED_SCORES: "1" }),
    ).toThrow(/VETCREW_ALLOW_UNREVIEWED_SCORES/);
  });

  test("names both flags when both are set", () => {
    expect(() =>
      loadEnv({
        ...PRODUCTION_BASE,
        VETCREW_TEST_AUTH: "1",
        VETCREW_ALLOW_UNREVIEWED_SCORES: "1",
      }),
    ).toThrow(/VETCREW_TEST_AUTH, VETCREW_ALLOW_UNREVIEWED_SCORES/);
  });

  test("allows the flags outside production — this is what keeps CI working", () => {
    expect(() =>
      loadEnv({ NODE_ENV: "development", VETCREW_TEST_AUTH: "1" }),
    ).not.toThrow();
    expect(() => loadEnv({ NODE_ENV: "test", VETCREW_TEST_AUTH: "1" })).not.toThrow();
  });

  test("still requires production secrets", () => {
    expect(() => loadEnv({ NODE_ENV: "production" })).toThrow(/Missing required production/);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run --config vitest.integration.config.ts server/test/env.test.ts`
Expected: the four bypass tests FAIL because `loadEnv` does not yet reject the flags. The "boots when no flag is set" and "still requires production secrets" tests should already PASS.

- [ ] **Step 3: Implement the boot gate**

In `server/env.ts`, add both flags to the schema and reject them in production. Replace the whole file body below the imports:

```ts
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url().optional(),
  CLERK_SECRET_KEY: z.string().min(1).optional(),
  CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
  // Declared so the production gate below can see them. Both are CI/local
  // escape hatches; either one in production is a complete bypass.
  VETCREW_TEST_AUTH: z.string().optional(),
  VETCREW_ALLOW_UNREVIEWED_SCORES: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/** Escape hatches that must never be live in production (spec §4). */
const BYPASS_FLAGS = ["VETCREW_TEST_AUTH", "VETCREW_ALLOW_UNREVIEWED_SCORES"] as const;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.message}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === "production") {
    const missing = (["DATABASE_URL", "CLERK_SECRET_KEY", "CLERK_PUBLISHABLE_KEY"] as const).filter(
      (key) => env[key] === undefined,
    );
    if (missing.length > 0) {
      throw new Error(`Missing required production env vars: ${missing.join(", ")}`);
    }
    // Refuse to start rather than start compromised: VETCREW_TEST_AUTH makes
    // `Bearer test:anyone:manager` authenticate, and
    // VETCREW_ALLOW_UNREVIEWED_SCORES lets an unreviewed scenario score a
    // real person (CLAUDE.md §2.5).
    const enabled = BYPASS_FLAGS.filter((key) => env[key] === "1");
    if (enabled.length > 0) {
      throw new Error(
        `Refusing to boot: production must never enable a bypass. Unset: ${enabled.join(", ")}`,
      );
    }
  }
  return env;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run --config vitest.integration.config.ts server/test/env.test.ts`
Expected: all six PASS.

- [ ] **Step 5: Write the failing use-site test**

Append to `server/test/auth-roles.test.ts` (the file already has an `afterEach` that restores `VETCREW_TEST_AUTH`; add a matching `NODE_ENV` restore at the top of your new describe block):

```ts
describe("test auth is inert in production", () => {
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

  afterEach(() => {
    if (ORIGINAL_NODE_ENV === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = ORIGINAL_NODE_ENV;
    }
  });

  test("parseTestBearer returns null in production even with the flag set", () => {
    process.env.VETCREW_TEST_AUTH = "1";
    process.env.NODE_ENV = "production";
    expect(parseTestBearer("Bearer test:user-1:manager")).toBeNull();
  });

  test("readAuthFromToken ignores a test bearer in production", async () => {
    process.env.VETCREW_TEST_AUTH = "1";
    process.env.NODE_ENV = "production";
    await expect(readAuthFromToken("test:user-1:manager")).resolves.toEqual({
      isAuthenticated: false,
      userId: null,
      role: null,
    });
  });

  test("parseTestBearer still works outside production", () => {
    process.env.VETCREW_TEST_AUTH = "1";
    process.env.NODE_ENV = "test";
    expect(parseTestBearer("Bearer test:user-1:manager")).toEqual({
      isAuthenticated: true,
      userId: "user-1",
      role: "manager",
    });
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `pnpm exec vitest run --config vitest.integration.config.ts server/test/auth-roles.test.ts`
Expected: the two production tests FAIL — `parseTestBearer` currently returns a snapshot regardless of `NODE_ENV`.

- [ ] **Step 7: Implement the use-site gates**

In `server/auth.ts`, replace lines 17–19:

```ts
/**
 * Defence in depth. `loadEnv` refuses to boot production with this flag set,
 * but `parseTestBearer` is imported directly by tests and could be reached by
 * a future entry point that never calls `loadEnv` — so the guarantee lives in
 * the module that owns the behaviour, not only at boot.
 */
export function isTestAuthEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.VETCREW_TEST_AUTH === "1";
}
```

In `server/routes/sessions.ts`, add this helper next to the other module-level functions:

```ts
/** CI/local only. Never honoured in production (spec §4). */
function allowUnreviewedScores(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.VETCREW_ALLOW_UNREVIEWED_SCORES === "1";
}
```

and replace the condition at lines 466–469 with:

```ts
    if (!scenarioRow.clinicallyReviewed && !allowUnreviewedScores()) {
```

- [ ] **Step 8: Run the auth tests to verify they pass**

Run: `pnpm exec vitest run --config vitest.integration.config.ts server/test/auth-roles.test.ts`
Expected: all PASS.

- [ ] **Step 9: Report the real auth mode on the health endpoint**

In `server/index.ts`, add `isTestAuthEnabled` to the existing import from `./auth.js`, then replace line 50. Test auth is checked *before* Clerk at request time, so the health endpoint must report the path that actually wins:

```ts
    auth: isTestAuthEnabled()
      ? ("test" as const)
      : clerkEnabled
        ? ("clerk" as const)
        : ("dev-bypass" as const),
```

In `src/App.tsx`, widen the union at line 40:

```ts
  auth: "clerk" | "test" | "dev-bypass";
```

Add the matching string to `src/i18n/en.json` beside `shell.server.auth.dev-bypass`:

```json
  "shell.server.auth.test": "Auth: test bearer",
```

and to `src/i18n/he.json`:

```json
  "shell.server.auth.test": "אימות: טוקן בדיקה",
```

- [ ] **Step 10: Verify typecheck and i18n parity**

Run: `pnpm typecheck && pnpm i18n:check`
Expected: both pass.

- [ ] **Step 11: Update the three documentation locations**

In `.env.example`, replace the comment above `VETCREW_TEST_AUTH` (line 19-20):

```
# CI/E2E only — set to 1 to enable Authorization: Bearer test:<userId>:manager|instructor|trainee
# Enforced: the server refuses to boot when NODE_ENV=production and this is 1
```

and above `VETCREW_ALLOW_UNREVIEWED_SCORES` (line 22-23):

```
# CI/local pitch only — set to 1 to allow ratings on clinically_reviewed:false scenarios
# Enforced: the server refuses to boot when NODE_ENV=production and this is 1
```

In `README.md` line 45, replace `**Never set in production Railway.**` with `**Enforced:** the server refuses to boot when `NODE_ENV=production` and this is set.`

In `docs/doctrines/readiness-scoring.md` lines 82–83, replace "must never be set in production (§2.5, §8)" with "must never be set in production (§2.5, §8) — enforced at boot since 2026-08, so a production server carrying this flag will refuse to start."

- [ ] **Step 12: Run the full server suite**

Run: `pnpm test:integration`
Expected: all pass, including the pre-existing suites that set both flags (`socket-authz`, `sessions-auth`, `manager`, `scenarios-ratings-gate`, `integration`). These run under `NODE_ENV=test`, so nothing changes for them.

- [ ] **Step 13: Commit**

```bash
git add server/env.ts server/auth.ts server/routes/sessions.ts server/index.ts \
        src/App.tsx src/i18n/he.json src/i18n/en.json \
        server/test/env.test.ts server/test/auth-roles.test.ts \
        .env.example README.md docs/doctrines/readiness-scoring.md
git commit -m "fix(security): refuse to boot production with an auth or review bypass

VETCREW_TEST_AUTH was checked before Clerk and had no NODE_ENV guard, so a
production deploy carrying the flag accepted Bearer test:anyone:manager.
VETCREW_ALLOW_UNREVIEWED_SCORES bypassed the clinical-review gate the same way.
Both were documented as forbidden in production and enforced nowhere."
```

---

## Task 2: Canonical JSON encoder

The chain hash is computed at INSERT time from an in-memory object and verified later against the same value read back through Postgres `jsonb`, which reorders object keys. Without a canonical form every verification would fail silently.

**Files:**
- Create: `server/canonical-json.ts`
- Create: `server/test/canonical-json.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `canonicalJson(value: unknown): string`.

- [ ] **Step 1: Write the failing test**

Create `server/test/canonical-json.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { canonicalJson } from "../canonical-json.js";

describe("canonicalJson", () => {
  test("sorts object keys by code unit, not insertion order", () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(canonicalJson({ Z: 1, a: 2 })).toBe('{"Z":1,"a":2}');
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
  });

  test("sorts nested object keys too", () => {
    expect(canonicalJson({ outer: { z: 1, a: 2 } })).toBe('{"outer":{"a":2,"z":1}}');
  });

  test("preserves array order", () => {
    expect(canonicalJson([3, 1, 2])).toBe("[3,1,2]");
  });

  test("emits no insignificant whitespace", () => {
    expect(canonicalJson({ a: [1, { b: 2 }] })).toBe('{"a":[1,{"b":2}]}');
  });

  test("handles empty containers", () => {
    expect(canonicalJson({})).toBe("{}");
    expect(canonicalJson([])).toBe("[]");
  });

  test("formats numbers per ECMA-262", () => {
    expect(canonicalJson(0)).toBe("0");
    expect(canonicalJson(-1)).toBe("-1");
    expect(canonicalJson(0.1)).toBe("0.1");
    expect(canonicalJson(1e21)).toBe("1e+21");
  });

  test("escapes strings, including Hebrew, the same way JSON does", () => {
    expect(canonicalJson("נשימה")).toBe('"נשימה"');
    expect(canonicalJson('a"b\\c')).toBe('"a\\"b\\\\c"');
    expect(canonicalJson("line\nbreak")).toBe('"line\\nbreak"');
  });

  test("handles null and booleans", () => {
    expect(canonicalJson(null)).toBe("null");
    expect(canonicalJson(true)).toBe("true");
    expect(canonicalJson(false)).toBe("false");
  });

  test("drops undefined object values, matching JSON and jsonb", () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe('{"a":1}');
  });

  test("throws rather than coercing values JSON cannot round-trip", () => {
    expect(() => canonicalJson(undefined)).toThrow(TypeError);
    expect(() => canonicalJson(Number.NaN)).toThrow(TypeError);
    expect(() => canonicalJson(Number.POSITIVE_INFINITY)).toThrow(TypeError);
    expect(() => canonicalJson(10n)).toThrow(TypeError);
    expect(() => canonicalJson(() => 1)).toThrow(TypeError);
    expect(() => canonicalJson([undefined])).toThrow(TypeError);
  });

  test("throws on non-plain objects that JSON.stringify would silently reshape", () => {
    expect(() => canonicalJson(new Date(0))).toThrow(TypeError);
    expect(() => canonicalJson(new Map())).toThrow(TypeError);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run --config vitest.integration.config.ts server/test/canonical-json.test.ts`
Expected: FAIL — cannot resolve `../canonical-json.js`.

- [ ] **Step 3: Implement the encoder**

Create `server/canonical-json.ts`:

```ts
/**
 * RFC 8785 (JSON Canonicalization Scheme) serialization for evidence hashing.
 *
 * A chain hash is computed at INSERT time from an in-memory object and
 * verified later against the same value read back through Postgres jsonb,
 * which sorts object keys and normalises whitespace. Without a canonical
 * form the two serializations differ and every verification fails silently.
 *
 * JSON.stringify already implements the two hard parts to specification —
 * ECMA-262 number formatting and JSON string escaping — so this adds key
 * ordering and refuses anything JSON cannot round-trip rather than letting
 * it coerce into a value that hashes differently on the way back.
 */
export function canonicalJson(value: unknown): string {
  if (value === null) return "null";

  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";

    case "number":
      if (!Number.isFinite(value)) {
        throw new TypeError(`canonicalJson: non-finite number ${String(value)}`);
      }
      return JSON.stringify(value);

    case "string":
      return JSON.stringify(value);

    case "object": {
      if (Array.isArray(value)) {
        // JSON.stringify turns a hole or undefined into null; we refuse
        // instead, so an ambiguous value never reaches the log.
        return `[${value.map(canonicalJson).join(",")}]`;
      }
      const proto = Object.getPrototypeOf(value) as unknown;
      if (proto !== Object.prototype && proto !== null) {
        // Date, Map, Set, class instances. JSON.stringify would reshape
        // these (a Date becomes a string, a Map becomes {}), so the
        // round-trip through jsonb would not match. Fail loudly.
        throw new TypeError("canonicalJson: only plain objects, arrays and JSON primitives");
      }
      const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
      const body = entries
        .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
        .join(",");
      return `{${body}}`;
    }

    default:
      throw new TypeError(`canonicalJson: unsupported type ${typeof value}`);
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm exec vitest run --config vitest.integration.config.ts server/test/canonical-json.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add server/canonical-json.ts server/test/canonical-json.test.ts
git commit -m "feat(evidence): canonical JSON encoder for chain hashing

jsonb reorders object keys, so a hash computed in memory at insert time will
not match one recomputed from the database read unless both use a canonical
form. Throws rather than coerces on values JSON cannot round-trip."
```

---

## Task 3: Chain hash primitives

**Files:**
- Create: `server/event-chain.ts`
- Create: `server/test/event-chain.test.ts`

**Interfaces:**
- Consumes: `canonicalJson(value: unknown): string` from `server/canonical-json.ts`.
- Produces:
  - `type SessionIdentity = { tenantId: string; sessionId: string; scenarioId: string; scenarioVersion: string; seed: number }`
  - `type ChainedEventInput = { prevHash: string; sessionId: string; seq: number; type: string; role: string | null; actorId: string | null; recordedAt: Date; payload: unknown }`
  - `genesisHash(identity: SessionIdentity): string`
  - `eventHash(input: ChainedEventInput): string`
  - `CHAIN_GENESIS_TAG`, `CHAIN_EVENT_TAG`

- [ ] **Step 1: Write the failing test**

Create `server/test/event-chain.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import {
  eventHash,
  genesisHash,
  type ChainedEventInput,
  type SessionIdentity,
} from "../event-chain.js";

const identity: SessionIdentity = {
  tenantId: "11111111-1111-1111-1111-111111111111",
  sessionId: "22222222-2222-2222-2222-222222222222",
  scenarioId: "33333333-3333-3333-3333-333333333333",
  scenarioVersion: "0.1.0",
  seed: 424242,
};

const input: ChainedEventInput = {
  prevHash: genesisHash(identity),
  sessionId: identity.sessionId,
  seq: 1,
  type: "action",
  role: "technician",
  actorId: "t1",
  recordedAt: new Date("2026-08-02T12:00:00.000Z"),
  payload: { type: "action", seq: 1, role: "technician", actorId: "t1", action: "oxygen_on" },
};

describe("genesisHash", () => {
  test("is a lowercase hex sha256", () => {
    expect(genesisHash(identity)).toMatch(/^[a-f0-9]{64}$/);
  });

  test("is stable for the same identity", () => {
    expect(genesisHash(identity)).toBe(genesisHash({ ...identity }));
  });

  test("differs per session so a chain cannot be lifted between sessions", () => {
    const other = { ...identity, sessionId: "44444444-4444-4444-4444-444444444444" };
    expect(genesisHash(other)).not.toBe(genesisHash(identity));
  });

  test("differs when the seed differs", () => {
    expect(genesisHash({ ...identity, seed: 1 })).not.toBe(genesisHash(identity));
  });
});

describe("eventHash", () => {
  test("is a lowercase hex sha256", () => {
    expect(eventHash(input)).toMatch(/^[a-f0-9]{64}$/);
  });

  test("is stable for the same input", () => {
    expect(eventHash(input)).toBe(eventHash({ ...input }));
  });

  test("is independent of payload key order", () => {
    const reordered = {
      ...input,
      payload: { action: "oxygen_on", actorId: "t1", role: "technician", seq: 1, type: "action" },
    };
    expect(eventHash(reordered)).toBe(eventHash(input));
  });

  test("changes when the payload changes", () => {
    const mutated = { ...input, payload: { ...(input.payload as object), action: "oxygen_off" } };
    expect(eventHash(mutated)).not.toBe(eventHash(input));
  });

  test("changes when the predecessor changes", () => {
    expect(eventHash({ ...input, prevHash: genesisHash({ ...identity, seed: 7 }) })).not.toBe(
      eventHash(input),
    );
  });

  test("changes when the timestamp changes", () => {
    expect(eventHash({ ...input, recordedAt: new Date("2026-08-02T12:00:00.001Z") })).not.toBe(
      eventHash(input),
    );
  });

  test("binds role and actor separately from the payload", () => {
    expect(eventHash({ ...input, actorId: "t2" })).not.toBe(eventHash(input));
    expect(eventHash({ ...input, role: "vet" })).not.toBe(eventHash(input));
  });

  test("accepts null role and actor for non-human events", () => {
    expect(
      eventHash({ ...input, type: "tick", role: null, actorId: null, payload: { type: "tick", seq: 1, dtMs: 1000 } }),
    ).toMatch(/^[a-f0-9]{64}$/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run --config vitest.integration.config.ts server/test/event-chain.test.ts`
Expected: FAIL — cannot resolve `../event-chain.js`.

- [ ] **Step 3: Implement the primitives**

Create `server/event-chain.ts`:

```ts
import { createHash } from "node:crypto";

import { canonicalJson } from "./canonical-json.js";

/**
 * Per-event hash chain over the evidence log (spec §2.2-§2.3).
 *
 * These tags are FROZEN. Once shipped they are never changed — a new scheme
 * gets a new tag, so an old chain stays verifiable forever.
 */
export const CHAIN_GENESIS_TAG = "vetcrew.chain-genesis.v1";
export const CHAIN_EVENT_TAG = "vetcrew.event.v1";

export type SessionIdentity = {
  readonly tenantId: string;
  readonly sessionId: string;
  readonly scenarioId: string;
  readonly scenarioVersion: string;
  readonly seed: number;
};

export type ChainedEventInput = {
  readonly prevHash: string;
  readonly sessionId: string;
  readonly seq: number;
  readonly type: string;
  readonly role: string | null;
  readonly actorId: string | null;
  readonly recordedAt: Date;
  readonly payload: unknown;
};

function sha256Hex(preimage: string): string {
  return createHash("sha256").update(preimage, "utf8").digest("hex");
}

/**
 * The seq-1 predecessor. Derived from session identity rather than a
 * constant so a valid chain cannot be lifted out of one session and
 * replayed into another.
 */
export function genesisHash(identity: SessionIdentity): string {
  return sha256Hex(
    canonicalJson([
      CHAIN_GENESIS_TAG,
      identity.tenantId,
      identity.sessionId,
      identity.scenarioId,
      identity.scenarioVersion,
      identity.seed,
    ]),
  );
}

/**
 * A canonical JSON array rather than a delimiter-joined string: delimiter
 * safe by construction, so a role or actor id containing a separator cannot
 * forge a different event with the same preimage.
 *
 * recordedAt is serialized with toISOString() — always UTC, always exactly
 * three fractional digits. Verification must re-derive it the same way; a
 * sub-millisecond timestamp would break every subsequent verification.
 */
export function eventHash(input: ChainedEventInput): string {
  return sha256Hex(
    canonicalJson([
      CHAIN_EVENT_TAG,
      input.prevHash,
      input.sessionId,
      input.seq,
      input.type,
      input.role,
      input.actorId,
      input.recordedAt.toISOString(),
      input.payload,
    ]),
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm exec vitest run --config vitest.integration.config.ts server/test/event-chain.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add server/event-chain.ts server/test/event-chain.test.ts
git commit -m "feat(evidence): genesis and per-event chain hash derivation

Genesis binds session identity so a chain cannot be lifted between sessions.
The event preimage is a canonical JSON array rather than a delimiter-joined
string, so a role or actor id containing a separator cannot forge a preimage."
```

---

## Task 4: Migration 0007 — chain columns and format constraint

Columns are nullable and the trigger in Task 6 makes them mandatory for new rows. A truncating migration is rejected: `runMigrations` runs automatically at boot against whatever `DATABASE_URL` points at, and the append-only trigger blocks `DELETE`, so it would have to drop that guard. Nullable plus a trigger gives an identical guarantee with no destructive migration, and matches the `NULL/NULL = historical unattested` precedent from `0006`.

**Files:**
- Create: `server/db/migrations/0007_event_hash_chain.sql`
- Modify: `server/db/schema/events.ts`
- Create: `server/test/event-chain-schema.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `sessionEvents.prevHash` and `sessionEvents.eventHash` Drizzle columns (`text`, nullable).

- [ ] **Step 1: Write the failing schema test**

Create `server/test/event-chain-schema.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { createDb } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";

const TEST_DATABASE_URL =
  process.env["TEST_DATABASE_URL"] ?? "postgres://localhost:5432/vetcrew_test";

let pool: ReturnType<typeof createDb>["pool"];

beforeAll(async () => {
  const dbName = new URL(TEST_DATABASE_URL).pathname.replace(/^\//, "");
  if (!/test/i.test(dbName)) {
    throw new Error(`TEST_DATABASE_URL database "${dbName}" must contain "test"`);
  }
  ({ pool } = createDb(TEST_DATABASE_URL));
  await runMigrations(pool);
});

afterAll(async () => {
  await pool.end();
});

describe("migration 0007 chain columns", () => {
  test("prev_hash and event_hash exist and are nullable", async () => {
    const { rows } = await pool.query<{ column_name: string; is_nullable: string }>(
      `select column_name, is_nullable
         from information_schema.columns
        where table_name = 'vc_session_events'
          and column_name in ('prev_hash', 'event_hash')
        order by column_name`,
    );
    expect(rows).toEqual([
      { column_name: "event_hash", is_nullable: "YES" },
      { column_name: "prev_hash", is_nullable: "YES" },
    ]);
  });

  test("the format constraint exists and is validated", async () => {
    const { rows } = await pool.query<{ convalidated: boolean }>(
      `select convalidated from pg_constraint where conname = 'vc_session_events_hash_format'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.convalidated).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run --config vitest.integration.config.ts server/test/event-chain-schema.test.ts`
Expected: FAIL — the columns and constraint do not exist.

- [ ] **Step 3: Write the migration**

Create `server/db/migrations/0007_event_hash_chain.sql`:

```sql
-- 0007_event_hash_chain: per-event hash chain on the evidence log.
--
-- The prior mechanism (0006) hashed the WHOLE log at rating time and stored
-- the digest on the rating row, in the same database. That detects a change
-- relative to a rating, but there is no per-event linkage, nothing is signed,
-- and an editor with database access can mutate an event, recompute the
-- digest and rewrite the rating row to match. Acceptable when the platform
-- operator is a separate party; not acceptable on an appliance in the
-- assessor's own custody (CLAUDE.md §2.3).
--
-- Columns are NULLABLE on purpose. All existing event data is disposable, so
-- the simple answer would be a truncating migration with NOT NULL — rejected
-- because runMigrations executes at boot against whatever DATABASE_URL points
-- at, and the append-only trigger from 0001 blocks DELETE, so a truncating
-- migration would have to drop that guard. The trigger in 0008 makes both
-- columns mandatory for every new row instead, at no extra cost. A null pair
-- means "unchained", exactly as 0006 uses NULL/NULL for "unattested".

alter table vc_session_events
  add column if not exists prev_hash text,
  add column if not exists event_hash text;

alter table vc_session_events
  drop constraint if exists vc_session_events_hash_format;

alter table vc_session_events
  add constraint vc_session_events_hash_format
  check (
    (prev_hash is null or prev_hash ~ '^[a-f0-9]{64}$')
    and (event_hash is null or event_hash ~ '^[a-f0-9]{64}$')
  ) not valid;

alter table vc_session_events
  validate constraint vc_session_events_hash_format;
```

- [ ] **Step 4: Add the columns to the Drizzle schema**

In `server/db/schema/events.ts`, add two columns after `payload` and before `recordedAt`:

```ts
    payload: jsonb("payload").notNull().default({}),
    /**
     * Per-event hash chain (migration 0007/0008). Nullable in the schema and
     * mandatory in practice — the 0008 trigger rejects a null on insert.
     * A null pair means an unchained legacy row; the verifier reports that as
     * "unchained", never as verified.
     */
    prevHash: text("prev_hash"),
    eventHash: text("event_hash"),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
```

- [ ] **Step 5: Run the schema test to verify it passes**

Run: `pnpm exec vitest run --config vitest.integration.config.ts server/test/event-chain-schema.test.ts`
Expected: both PASS.

- [ ] **Step 6: Verify nothing else broke**

Run: `pnpm typecheck && pnpm test:integration`
Expected: all pass. Nothing writes the new columns yet, and they are nullable, so every existing append still succeeds.

- [ ] **Step 7: Commit**

```bash
git add server/db/migrations/0007_event_hash_chain.sql server/db/schema/events.ts \
        server/test/event-chain-schema.test.ts
git commit -m "feat(evidence): add nullable chain columns to vc_session_events

Columns only. The write path populates them in the next commit and the
linkage trigger lands after that, so every commit leaves CI green."
```

---

## Task 5: Compute the chain in the append path

**Files:**
- Modify: `server/live/event-append.ts:48-79`
- Create: `server/test/event-chain-append.test.ts`

**Interfaces:**
- Consumes: `genesisHash`, `eventHash`, `SessionIdentity` from `server/event-chain.ts`.
- Produces: every row written by `appendSessionEventsTx` carries `prev_hash`, `event_hash`, and an application-set `recorded_at`. The exported signatures of `appendSessionEvents` and `appendSessionEventsTx` are unchanged.

- [ ] **Step 1: Write the failing round-trip test**

This is the highest-value test in the plan. It must be DB-backed: the whole point is what Postgres does to `jsonb`, so an in-memory test would prove nothing.

Create `server/test/event-chain-append.test.ts`:

```ts
import type { EngineEventBody, TaskSubmission } from "@vetcrew/shared";
import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { createDb } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { scenarios, sessionEvents, simSessions } from "../db/schema/index.js";
import { eventHash, genesisHash, type SessionIdentity } from "../event-chain.js";
import { appendSessionEvents } from "../live/event-append.js";
import { loadScenarioFiles, syncScenarios } from "../scenarios.js";
import { ensurePilotTenant } from "../tenancy.js";

const TEST_DATABASE_URL =
  process.env["TEST_DATABASE_URL"] ?? "postgres://localhost:5432/vetcrew_test";
const SCENARIO_SLUG = "base-rung-resp-distress";

let pool: ReturnType<typeof createDb>["pool"];
let db: ReturnType<typeof createDb>["db"];
let tenantId: string;
let scenarioId: string;
let scenarioVersion: string;

beforeAll(async () => {
  const dbName = new URL(TEST_DATABASE_URL).pathname.replace(/^\//, "");
  if (!/test/i.test(dbName)) {
    throw new Error(`TEST_DATABASE_URL database "${dbName}" must contain "test"`);
  }
  ({ pool, db } = createDb(TEST_DATABASE_URL));
  await runMigrations(pool);
  tenantId = await ensurePilotTenant(db);
  await syncScenarios(db, tenantId, loadScenarioFiles());
  const rows = await db
    .select({ id: scenarios.id, version: scenarios.version })
    .from(scenarios)
    .where(eq(scenarios.slug, SCENARIO_SLUG));
  const scenario = rows[0];
  if (scenario === undefined) throw new Error(`scenario ${SCENARIO_SLUG} not synced`);
  scenarioId = scenario.id;
  scenarioVersion = scenario.version;
});

afterAll(async () => {
  await pool.end();
});

async function newSession(seed = 424242): Promise<SessionIdentity> {
  const inserted = await db
    .insert(simSessions)
    .values({ tenantId, scenarioId, scenarioVersion, seed, phase: "running" })
    .returning({ id: simSessions.id });
  const sessionId = inserted[0]?.id;
  if (sessionId === undefined) throw new Error("session insert returned no id");
  return { tenantId, sessionId, scenarioId, scenarioVersion, seed };
}

async function readChain(sessionId: string) {
  return db
    .select({
      seq: sessionEvents.seq,
      type: sessionEvents.type,
      role: sessionEvents.role,
      actorId: sessionEvents.actorId,
      payload: sessionEvents.payload,
      recordedAt: sessionEvents.recordedAt,
      prevHash: sessionEvents.prevHash,
      eventHash: sessionEvents.eventHash,
    })
    .from(sessionEvents)
    .where(eq(sessionEvents.sessionId, sessionId))
    .orderBy(asc(sessionEvents.seq));
}

const SUBMISSIONS: TaskSubmission[] = [
  { kind: "value_entry", values: { hr: 208, spo2: 79 } },
  { kind: "choice_chain", choices: { route: "sc", site: "scruff" } },
  { kind: "med_admin", ml: 0.1, routeId: "sc" },
  { kind: "tube_choice", optionIds: ["edta", "serum"] },
  { kind: "step_order", order: ["clip", "prep", "insert"] },
  { kind: "fluids_setup", setId: "burette", dropsPerMin: 60 },
  { kind: "escalate" },
];

/** Payload shapes that break naive canonicalizers. */
const HOSTILE_PAYLOAD = {
  hebrew: "מצוקה נשימתית",
  zero: 0,
  negative: -12.5,
  fraction: 0.1,
  bigExponent: 1e21,
  emptyObject: {},
  emptyArray: [],
  nested: { z: 1, a: { y: 2, b: 3 } },
  quoted: 'he said "no"',
};

describe("append writes a verifiable chain", () => {
  test("every event type and task submission round-trips through jsonb", async () => {
    const identity = await newSession();
    const bodies: EngineEventBody[] = [
      { type: "tick", dtMs: 1000 },
      { type: "action", role: "technician", actorId: "t1", action: "oxygen_on" },
      { type: "action", role: "technician", actorId: "t1", action: "check_chart", payload: HOSTILE_PAYLOAD },
      { type: "injection", injection: "owner_distressed" },
      { type: "phase_change", phase: "paused" },
      { type: "task_start", role: "technician", actorId: "t1", taskId: "t-1" },
      ...SUBMISSIONS.map((submission, index): EngineEventBody => ({
        type: "task_submit",
        role: "technician",
        actorId: "t1",
        taskId: `t-${index + 1}`,
        submission,
      })),
    ];
    const outcome = await appendSessionEvents(db, {
      tenantId,
      sessionId: identity.sessionId,
      bodies,
    });
    expect(outcome.kind).toBe("ok");

    const rows = await readChain(identity.sessionId);
    expect(rows).toHaveLength(bodies.length);

    let prev = genesisHash(identity);
    for (const row of rows) {
      expect(row.prevHash).toBe(prev);
      // Recompute from what Postgres actually stored. If jsonb reshaped the
      // payload, or the timestamp lost precision, this is where it surfaces.
      const recomputed = eventHash({
        prevHash: prev,
        sessionId: identity.sessionId,
        seq: row.seq,
        type: row.type,
        role: row.role,
        actorId: row.actorId,
        recordedAt: row.recordedAt,
        payload: row.payload,
      });
      expect(recomputed).toBe(row.eventHash);
      prev = row.eventHash as string;
    }
  });

  test("the first event links to the session-derived genesis", async () => {
    const identity = await newSession(777);
    await appendSessionEvents(db, {
      tenantId,
      sessionId: identity.sessionId,
      bodies: [{ type: "tick", dtMs: 1000 }],
    });
    const rows = await readChain(identity.sessionId);
    expect(rows[0]?.prevHash).toBe(genesisHash(identity));
  });

  test("two sessions get different genesis values", async () => {
    const a = await newSession(1);
    const b = await newSession(2);
    expect(genesisHash(a)).not.toBe(genesisHash(b));
  });

  test("a batched append links within the batch, not just to the previous batch", async () => {
    const identity = await newSession();
    await appendSessionEvents(db, {
      tenantId,
      sessionId: identity.sessionId,
      bodies: [
        { type: "tick", dtMs: 1000 },
        { type: "tick", dtMs: 1000 },
        { type: "tick", dtMs: 1000 },
      ],
    });
    const rows = await readChain(identity.sessionId);
    expect(rows).toHaveLength(3);
    expect(rows[1]?.prevHash).toBe(rows[0]?.eventHash);
    expect(rows[2]?.prevHash).toBe(rows[1]?.eventHash);
  });

  test("a second append call links to the previous batch", async () => {
    const identity = await newSession();
    await appendSessionEvents(db, {
      tenantId,
      sessionId: identity.sessionId,
      bodies: [{ type: "tick", dtMs: 1000 }],
    });
    await appendSessionEvents(db, {
      tenantId,
      sessionId: identity.sessionId,
      bodies: [{ type: "tick", dtMs: 1000 }],
    });
    const rows = await readChain(identity.sessionId);
    expect(rows[1]?.prevHash).toBe(rows[0]?.eventHash);
  });

  test("recorded_at is millisecond precision so it re-serializes identically", async () => {
    const identity = await newSession();
    await appendSessionEvents(db, {
      tenantId,
      sessionId: identity.sessionId,
      bodies: [{ type: "tick", dtMs: 1000 }],
    });
    const rows = await readChain(identity.sessionId);
    const recordedAt = rows[0]?.recordedAt;
    expect(recordedAt).toBeInstanceOf(Date);
    expect((recordedAt as Date).getMilliseconds()).toBe((recordedAt as Date).getTime() % 1000);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run --config vitest.integration.config.ts server/test/event-chain-append.test.ts`
Expected: FAIL — `prevHash` and `eventHash` come back `null` because nothing writes them.

- [ ] **Step 3: Implement the chain in the append path**

In `server/live/event-append.ts`, add the imports:

```ts
import { eventHash, genesisHash } from "../event-chain.js";
```

Add these two helpers below `projectPhase`. The same role/actor derivation is now needed twice — once to hash, once to insert — so it is extracted rather than duplicated:

```ts
/** Only human acts carry attribution; ticks and phase changes do not. */
function roleOf(event: EngineEvent): string | null {
  return event.type === "action" || event.type === "task_start" || event.type === "task_submit"
    ? event.role
    : null;
}

function actorIdOf(event: EngineEvent): string | null {
  return event.type === "action" || event.type === "task_start" || event.type === "task_submit"
    ? event.actorId
    : null;
}
```

Replace the body from line 48 (`const maxRows = ...`) through the closing of the insert at line 79 with:

```ts
  // The head read is safe under the session row lock taken above — the same
  // guarantee that makes seq assignment safe.
  const headRows = await tx
    .select({ seq: sessionEvents.seq, eventHash: sessionEvents.eventHash })
    .from(sessionEvents)
    .where(eq(sessionEvents.sessionId, session.id))
    .orderBy(desc(sessionEvents.seq))
    .limit(1);
  const head = headRows[0];
  let nextSeq = (head?.seq ?? 0) + 1;

  let prevHash: string;
  if (head === undefined) {
    prevHash = genesisHash({
      tenantId: args.tenantId,
      sessionId: session.id,
      scenarioId: session.scenarioId,
      scenarioVersion: session.scenarioVersion,
      seed: session.seed,
    });
  } else if (head.eventHash === null) {
    throw new Error(`session ${session.id} has an unchained event log; refusing to append`);
  } else {
    prevHash = head.eventHash;
  }

  // Fold the chain across the batch: each event links to the one before it
  // in THIS call, not only to the previous call.
  const chained = args.bodies.map((body) => {
    const event = { ...body, seq: nextSeq } as EngineEvent;
    nextSeq += 1;
    const recordedAt = new Date();
    const hash = eventHash({
      prevHash,
      sessionId: session.id,
      seq: event.seq,
      type: event.type,
      role: roleOf(event),
      actorId: actorIdOf(event),
      recordedAt,
      payload: event,
    });
    const row = { event, prevHash, eventHash: hash, recordedAt };
    prevHash = hash;
    return row;
  });

  const events: EngineEvent[] = chained.map((row) => row.event);
  const nextPhase = projectPhase(session.phase as SessionPhase, events);
  await tx.insert(sessionEvents).values(
    chained.map((row) => ({
      tenantId: args.tenantId,
      sessionId: session.id,
      seq: row.event.seq,
      type: row.event.type,
      role: roleOf(row.event),
      actorId: actorIdOf(row.event),
      payload: row.event,
      recordedAt: row.recordedAt,
      prevHash: row.prevHash,
      eventHash: row.eventHash,
    })),
  );
```

Leave the phase update and the `return { kind: "ok", events, phase: nextPhase }` below it unchanged.

- [ ] **Step 4: Run the round-trip tests to verify they pass**

Run: `pnpm exec vitest run --config vitest.integration.config.ts server/test/event-chain-append.test.ts`
Expected: all PASS. If the first test fails on a specific event type, the canonical encoder and `jsonb` disagree for that payload shape — fix the encoder, not the test.

- [ ] **Step 5: Verify the rest of the system is unaffected**

Run: `pnpm typecheck && pnpm test:integration`
Expected: all pass. `replay()` is untouched because the chain lives in columns, not in `payload`, and hydration selects only `payload`.

- [ ] **Step 6: Commit**

```bash
git add server/live/event-append.ts server/test/event-chain-append.test.ts
git commit -m "feat(evidence): compute the hash chain in the append path

Folds the chain across a batch inside the existing single-writer transaction.
Round-trip tests cover every event type, every task submission variant, and
payloads with Hebrew, fractional numbers and large exponents, because a
canonicalization mismatch against jsonb would otherwise stay silent until
someone tried to verify an evidence packet."
```

---

## Task 6: Migration 0008 — linkage trigger

**Files:**
- Create: `server/db/migrations/0008_event_chain_trigger.sql`
- Create: `server/test/event-chain-trigger.test.ts`

**Interfaces:**
- Consumes: rows written by Task 5 (every new row has both hashes).
- Produces: database-level rejection of a chain break. No TypeScript surface.

- [ ] **Step 1: Write the failing tamper tests**

A tamper test only means something if it bypasses `appendSessionEventsTx` and inserts directly. It must use a **correct** seq so it clears the contiguity trigger from `0004` and actually exercises the new one.

Create `server/test/event-chain-trigger.test.ts`:

```ts
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { createDb } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { scenarios, simSessions } from "../db/schema/index.js";
import { appendSessionEvents } from "../live/event-append.js";
import { loadScenarioFiles, syncScenarios } from "../scenarios.js";
import { ensurePilotTenant } from "../tenancy.js";

const TEST_DATABASE_URL =
  process.env["TEST_DATABASE_URL"] ?? "postgres://localhost:5432/vetcrew_test";
const SCENARIO_SLUG = "base-rung-resp-distress";
const FAKE_HASH = "f".repeat(64);

let pool: ReturnType<typeof createDb>["pool"];
let db: ReturnType<typeof createDb>["db"];
let tenantId: string;
let scenarioId: string;
let scenarioVersion: string;

beforeAll(async () => {
  const dbName = new URL(TEST_DATABASE_URL).pathname.replace(/^\//, "");
  if (!/test/i.test(dbName)) {
    throw new Error(`TEST_DATABASE_URL database "${dbName}" must contain "test"`);
  }
  ({ pool, db } = createDb(TEST_DATABASE_URL));
  await runMigrations(pool);
  tenantId = await ensurePilotTenant(db);
  await syncScenarios(db, tenantId, loadScenarioFiles());
  const rows = await db
    .select({ id: scenarios.id, version: scenarios.version })
    .from(scenarios)
    .where(eq(scenarios.slug, SCENARIO_SLUG));
  const scenario = rows[0];
  if (scenario === undefined) throw new Error(`scenario ${SCENARIO_SLUG} not synced`);
  scenarioId = scenario.id;
  scenarioVersion = scenario.version;
});

afterAll(async () => {
  await pool.end();
});

async function sessionWithOneEvent(): Promise<string> {
  const inserted = await db
    .insert(simSessions)
    .values({ tenantId, scenarioId, scenarioVersion, seed: 99, phase: "running" })
    .returning({ id: simSessions.id });
  const sessionId = inserted[0]?.id;
  if (sessionId === undefined) throw new Error("session insert returned no id");
  await appendSessionEvents(db, {
    tenantId,
    sessionId,
    bodies: [{ type: "tick", dtMs: 1000 }],
  });
  return sessionId;
}

/** Raw insert at the correct next seq — clears 0004, exercises 0008. */
async function rawInsert(
  sessionId: string,
  seq: number,
  prevHash: string | null,
  eventHash: string | null,
): Promise<void> {
  await pool.query(
    `insert into vc_session_events
       (tenant_id, session_id, seq, type, role, actor_id, payload, prev_hash, event_hash)
     values ($1, $2, $3, 'tick', null, null, $4::jsonb, $5, $6)`,
    [tenantId, sessionId, seq, JSON.stringify({ type: "tick", seq, dtMs: 1000 }), prevHash, eventHash],
  );
}

describe("0008 chain linkage trigger", () => {
  test("rejects a row whose prev_hash does not match the head", async () => {
    const sessionId = await sessionWithOneEvent();
    await expect(rawInsert(sessionId, 2, FAKE_HASH, FAKE_HASH)).rejects.toThrow(/chain break/i);
  });

  test("rejects a null prev_hash", async () => {
    const sessionId = await sessionWithOneEvent();
    await expect(rawInsert(sessionId, 2, null, FAKE_HASH)).rejects.toThrow(/chain hashes/i);
  });

  test("rejects a null event_hash", async () => {
    const sessionId = await sessionWithOneEvent();
    await expect(rawInsert(sessionId, 2, FAKE_HASH, null)).rejects.toThrow(/chain hashes/i);
  });

  test("rejects a malformed hash via the 0007 CHECK constraint", async () => {
    const sessionId = await sessionWithOneEvent();
    await expect(rawInsert(sessionId, 2, "NOTAHASH", FAKE_HASH)).rejects.toThrow(
      /vc_session_events_hash_format/,
    );
  });

  test("the normal append path is unaffected", async () => {
    const sessionId = await sessionWithOneEvent();
    const outcome = await appendSessionEvents(db, {
      tenantId,
      sessionId,
      bodies: [{ type: "tick", dtMs: 1000 }],
    });
    expect(outcome.kind).toBe("ok");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run --config vitest.integration.config.ts server/test/event-chain-trigger.test.ts`
Expected: the first three tests FAIL — the raw inserts currently succeed because no trigger rejects them. The CHECK-constraint test should already PASS from Task 4.

- [ ] **Step 3: Write the trigger migration**

Create `server/db/migrations/0008_event_chain_trigger.sql`:

```sql
-- 0008_event_chain_trigger: the database independently enforces chain linkage.
--
-- Same division of labour as 0004_seq_authority: the application assigns the
-- value, the database enforces the invariant. This catches splicing,
-- reordering and mid-log insertion even from a direct SQL client.
--
-- Two deliberate limits:
--  1. At seq 1 there is no head, so only presence and format are checked.
--     Validating the genesis derivation would need the canonical JSON encoder
--     in plpgsql, which is exactly the duplication this design avoids — a
--     second implementation that must match the TypeScript one byte for byte
--     is how the chain would silently break.
--  2. The trigger never recomputes a content hash. A row whose event_hash
--     does not match its own content is caught by the TypeScript verifier,
--     which attestation calls before freezing a rating's log head.
--
-- Residual risk, unchanged: an actor with direct database access can rewrite
-- a whole tail into a self-consistent fake chain. Closing that needs a signed
-- head and external anchoring, which is the appliance ADR.

create or replace function vc_enforce_event_chain() returns trigger as $$
declare
  head_hash text;
begin
  if new.prev_hash is null or new.event_hash is null then
    raise exception
      'vc_session_events session % seq % is missing chain hashes',
      new.session_id, new.seq;
  end if;

  select event_hash into head_hash
    from vc_session_events
   where session_id = new.session_id
   order by seq desc
   limit 1;

  -- No head: this is the genesis row. Content cannot be validated here.
  if not found then
    return new;
  end if;

  if head_hash is null then
    raise exception
      'cannot extend an unchained log for session %', new.session_id;
  end if;

  if new.prev_hash <> head_hash then
    raise exception
      'vc_session_events chain break at session % seq %: prev_hash does not match head',
      new.session_id, new.seq;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists vc_session_events_chain on vc_session_events;
create trigger vc_session_events_chain
  before insert on vc_session_events
  for each row execute function vc_enforce_event_chain();
```

- [ ] **Step 4: Run the trigger tests to verify they pass**

Run: `pnpm exec vitest run --config vitest.integration.config.ts server/test/event-chain-trigger.test.ts`
Expected: all five PASS.

- [ ] **Step 5: Verify the whole suite**

Run: `pnpm test:integration`
Expected: all pass. Batched appends work because `BEFORE INSERT ... FOR EACH ROW` sees earlier rows from the same transaction — the same property `vc_enforce_seq_contiguity` already relies on.

- [ ] **Step 6: Commit**

```bash
git add server/db/migrations/0008_event_chain_trigger.sql server/test/event-chain-trigger.test.ts
git commit -m "feat(evidence): enforce chain linkage at the database layer

Mirrors 0004_seq_authority: the application assigns, the database enforces.
Catches splicing, reordering and mid-log insertion from a direct SQL client.
Content correctness stays with the TypeScript verifier — a second canonical
encoder in plpgsql is exactly how this would silently break."
```

---

## Task 7: Chain verifier

**Files:**
- Create: `server/event-chain-verify.ts`
- Create: `server/test/event-chain-verify.test.ts`

**Interfaces:**
- Consumes: `genesisHash`, `eventHash`, `SessionIdentity` from `server/event-chain.ts`.
- Produces:
  - `type ChainRow = { seq: number; type: string; role: string | null; actorId: string | null; recordedAt: Date; payload: unknown; prevHash: string | null; eventHash: string | null }`
  - `type ChainVerdict = { kind: "ok"; headSeq: number; headHash: string } | { kind: "empty" } | { kind: "unchained"; seq: number } | { kind: "broken"; seq: number; reason: "genesis" | "link" | "content" }`
  - `verifyChain(rows: readonly ChainRow[], identity: SessionIdentity): ChainVerdict`

- [ ] **Step 1: Write the failing test**

Create `server/test/event-chain-verify.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { eventHash, genesisHash, type SessionIdentity } from "../event-chain.js";
import { verifyChain, type ChainRow } from "../event-chain-verify.js";

const identity: SessionIdentity = {
  tenantId: "11111111-1111-1111-1111-111111111111",
  sessionId: "22222222-2222-2222-2222-222222222222",
  scenarioId: "33333333-3333-3333-3333-333333333333",
  scenarioVersion: "0.1.0",
  seed: 424242,
};

/** Build a well-formed chain of `count` tick rows. */
function chainOf(count: number): ChainRow[] {
  const rows: ChainRow[] = [];
  let prev = genesisHash(identity);
  for (let seq = 1; seq <= count; seq += 1) {
    const recordedAt = new Date(Date.UTC(2026, 7, 2, 12, 0, seq));
    const payload = { type: "tick", seq, dtMs: 1000 };
    const hash = eventHash({
      prevHash: prev,
      sessionId: identity.sessionId,
      seq,
      type: "tick",
      role: null,
      actorId: null,
      recordedAt,
      payload,
    });
    rows.push({
      seq,
      type: "tick",
      role: null,
      actorId: null,
      recordedAt,
      payload,
      prevHash: prev,
      eventHash: hash,
    });
    prev = hash;
  }
  return rows;
}

describe("verifyChain", () => {
  test("verifies a well-formed chain and returns the head", () => {
    const rows = chainOf(3);
    expect(verifyChain(rows, identity)).toEqual({
      kind: "ok",
      headSeq: 3,
      headHash: rows[2]?.eventHash,
    });
  });

  test("reports an empty log distinctly", () => {
    expect(verifyChain([], identity)).toEqual({ kind: "empty" });
  });

  test("reports unchained rather than broken when hashes are null", () => {
    const rows = chainOf(2);
    rows[1] = { ...(rows[1] as ChainRow), prevHash: null, eventHash: null };
    expect(verifyChain(rows, identity)).toEqual({ kind: "unchained", seq: 2 });
  });

  test("detects a mutated payload at the right seq with a content reason", () => {
    const rows = chainOf(3);
    rows[1] = { ...(rows[1] as ChainRow), payload: { type: "tick", seq: 2, dtMs: 9999 } };
    expect(verifyChain(rows, identity)).toEqual({ kind: "broken", seq: 2, reason: "content" });
  });

  test("detects a broken link", () => {
    const rows = chainOf(3);
    rows[2] = { ...(rows[2] as ChainRow), prevHash: "a".repeat(64) };
    expect(verifyChain(rows, identity)).toEqual({ kind: "broken", seq: 3, reason: "link" });
  });

  test("detects a chain lifted from another session as a bad genesis", () => {
    const rows = chainOf(2);
    const other = { ...identity, sessionId: "44444444-4444-4444-4444-444444444444" };
    expect(verifyChain(rows, other)).toEqual({ kind: "broken", seq: 1, reason: "genesis" });
  });

  test("detects a mutated timestamp", () => {
    const rows = chainOf(2);
    rows[0] = { ...(rows[0] as ChainRow), recordedAt: new Date(0) };
    expect(verifyChain(rows, identity)).toEqual({ kind: "broken", seq: 1, reason: "content" });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run --config vitest.integration.config.ts server/test/event-chain-verify.test.ts`
Expected: FAIL — cannot resolve `../event-chain-verify.js`.

- [ ] **Step 3: Implement the verifier**

Create `server/event-chain-verify.ts`:

```ts
import { eventHash, genesisHash, type SessionIdentity } from "./event-chain.js";

export type ChainRow = {
  readonly seq: number;
  readonly type: string;
  readonly role: string | null;
  readonly actorId: string | null;
  readonly recordedAt: Date;
  readonly payload: unknown;
  readonly prevHash: string | null;
  readonly eventHash: string | null;
};

export type ChainVerdict =
  | { readonly kind: "ok"; readonly headSeq: number; readonly headHash: string }
  | { readonly kind: "empty" }
  | { readonly kind: "unchained"; readonly seq: number }
  | {
      readonly kind: "broken";
      readonly seq: number;
      readonly reason: "genesis" | "link" | "content";
    };

/**
 * Covers exactly the gaps the 0008 trigger cannot: genesis derivation and
 * content correctness. Rows must be ordered by seq ascending.
 *
 * "unchained" is deliberately distinct from "broken" — a legacy row with no
 * hashes is not evidence of tampering, and reporting it as such would be a
 * false accusation baked into an evidence packet.
 */
export function verifyChain(
  rows: readonly ChainRow[],
  identity: SessionIdentity,
): ChainVerdict {
  if (rows.length === 0) return { kind: "empty" };

  let expectedPrev = genesisHash(identity);

  for (const [index, row] of rows.entries()) {
    if (row.prevHash === null || row.eventHash === null) {
      return { kind: "unchained", seq: row.seq };
    }
    if (row.prevHash !== expectedPrev) {
      return { kind: "broken", seq: row.seq, reason: index === 0 ? "genesis" : "link" };
    }
    const recomputed = eventHash({
      prevHash: row.prevHash,
      sessionId: identity.sessionId,
      seq: row.seq,
      type: row.type,
      role: row.role,
      actorId: row.actorId,
      recordedAt: row.recordedAt,
      payload: row.payload,
    });
    if (recomputed !== row.eventHash) {
      return { kind: "broken", seq: row.seq, reason: "content" };
    }
    expectedPrev = row.eventHash;
  }

  const head = rows[rows.length - 1] as ChainRow;
  return { kind: "ok", headSeq: head.seq, headHash: head.eventHash as string };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm exec vitest run --config vitest.integration.config.ts server/test/event-chain-verify.test.ts`
Expected: all seven PASS.

- [ ] **Step 5: Commit**

```bash
git add server/event-chain-verify.ts server/test/event-chain-verify.test.ts
git commit -m "feat(evidence): pure verifier for the event hash chain

Covers the two gaps the trigger cannot: genesis derivation and content
correctness. Reports 'unchained' distinctly from 'broken' — a legacy row with
no hashes is not evidence of tampering."
```

---

## Task 8: Attest on the chain, and describe it honestly

`hashEventLog` rehashes the whole log on every attestation. With a chain the head hash *is* the last row's `event_hash`, so that pass disappears and attestation gains a verifier call.

**Files:**
- Modify: `server/evidence-attest.ts`
- Modify: `server/routes/sessions.ts:476-556`
- Modify: `server/test/evidence-attest.test.ts`
- Modify: `server/test/integration.test.ts:11` (drops the `hashEventLog` import)
- Modify: `src/i18n/he.json`, `src/i18n/en.json`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: `verifyChain`, `ChainRow` from `server/event-chain-verify.ts`; `SessionIdentity` from `server/event-chain.ts`.
- Produces:
  - `EventLogRow` gains `recordedAt: Date`, `prevHash: string | null`, `eventHash: string | null`.
  - `attestEvidenceSeqs(rows, evidenceSeqs, identity)` gains a third parameter and a `{ kind: "chain_broken"; detail: string }` outcome.
  - `eventLogPreimage` and `hashEventLog` are **deleted**.

- [ ] **Step 1: Write the failing attestation tests**

Replace the whole of `server/test/evidence-attest.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { attestEvidenceSeqs, type EventLogRow } from "../evidence-attest.js";
import { eventHash, genesisHash, type SessionIdentity } from "../event-chain.js";

const identity: SessionIdentity = {
  tenantId: "11111111-1111-1111-1111-111111111111",
  sessionId: "22222222-2222-2222-2222-222222222222",
  scenarioId: "33333333-3333-3333-3333-333333333333",
  scenarioVersion: "0.1.0",
  seed: 424242,
};

function chain(payloads: readonly { seq: number; type: string; role: string | null; actorId: string | null; payload: unknown }[]): EventLogRow[] {
  const rows: EventLogRow[] = [];
  let prev = genesisHash(identity);
  for (const item of payloads) {
    const recordedAt = new Date(Date.UTC(2026, 7, 2, 12, 0, item.seq));
    const hash = eventHash({
      prevHash: prev,
      sessionId: identity.sessionId,
      seq: item.seq,
      type: item.type,
      role: item.role,
      actorId: item.actorId,
      recordedAt,
      payload: item.payload,
    });
    rows.push({ ...item, recordedAt, prevHash: prev, eventHash: hash });
    prev = hash;
  }
  return rows;
}

const rows = chain([
  { seq: 1, type: "phase_change", role: null, actorId: null, payload: { phase: "briefing" } },
  { seq: 2, type: "phase_change", role: null, actorId: null, payload: { phase: "running" } },
  { seq: 3, type: "action", role: "technician", actorId: "t1", payload: { action: "oxygen_on" } },
]);

/**
 * Engine seed+event determinism lives in packages/engine/test/determinism.test.ts.
 * This file covers attestation only: evidence-seq checks and the chain bind.
 */
describe("evidence attestation", () => {
  test("rejects unknown evidence seqs", () => {
    expect(attestEvidenceSeqs(rows, [3, 999], identity)).toEqual({
      kind: "unknown_evidence",
      seqs: [999],
    });
  });

  test("rejects an empty evidence list", () => {
    expect(attestEvidenceSeqs(rows, [], identity).kind).toBe("empty_evidence");
  });

  test("freezes the chain head rather than a whole-log digest", () => {
    const result = attestEvidenceSeqs(rows, [3], identity);
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.attestation.logHeadSeq).toBe(3);
    expect(result.attestation.logHeadHash).toBe(rows[2]?.eventHash);
  });

  test("refuses to attest a tampered log", () => {
    const tampered = [...rows];
    tampered[1] = { ...(tampered[1] as EventLogRow), payload: { phase: "debrief" } };
    const result = attestEvidenceSeqs(tampered, [3], identity);
    expect(result.kind).toBe("chain_broken");
  });

  test("refuses to attest an unchained log", () => {
    const legacy = [...rows];
    legacy[0] = { ...(legacy[0] as EventLogRow), prevHash: null, eventHash: null };
    const result = attestEvidenceSeqs(legacy, [3], identity);
    expect(result.kind).toBe("chain_broken");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run --config vitest.integration.config.ts server/test/evidence-attest.test.ts`
Expected: FAIL to compile — `attestEvidenceSeqs` takes two arguments and `EventLogRow` has no `prevHash`.

- [ ] **Step 3: Rewrite the attestation module**

Replace the whole of `server/evidence-attest.ts`:

```ts
import { asc, eq } from "drizzle-orm";

import { sessionEvents } from "./db/schema/index.js";
import type { SessionIdentity } from "./event-chain.js";
import { verifyChain, type ChainRow } from "./event-chain-verify.js";
import type { AppendTx } from "./live/event-append.js";

export type EventLogRow = ChainRow;

export type EvidenceAttestation = {
  readonly logHeadSeq: number;
  readonly logHeadHash: string;
};

export type AttestOutcome =
  | { readonly kind: "ok"; readonly attestation: EvidenceAttestation }
  | { readonly kind: "unknown_evidence"; readonly seqs: number[] }
  | { readonly kind: "empty_evidence" }
  | { readonly kind: "chain_broken"; readonly detail: string };

/**
 * Verify every evidence seq exists in this session's log, verify the hash
 * chain, and freeze the chain head for the rating row. Call before appending
 * phase=scored.
 *
 * Attestation REFUSES a log that does not verify. Freezing a head over a
 * broken chain would produce an evidence packet that looks attested and is
 * not, which is worse than declining to attest (CLAUDE.md §2.3).
 */
export function attestEvidenceSeqs(
  rows: readonly EventLogRow[],
  evidenceSeqs: readonly number[],
  identity: SessionIdentity,
): AttestOutcome {
  if (evidenceSeqs.length === 0) {
    return { kind: "empty_evidence" };
  }
  const bySeq = new Map(rows.map((row) => [row.seq, row]));
  const unknown = [...new Set(evidenceSeqs.filter((seq) => !bySeq.has(seq)))];
  if (unknown.length > 0) {
    return { kind: "unknown_evidence", seqs: unknown };
  }
  const verdict = verifyChain(rows, identity);
  switch (verdict.kind) {
    case "ok":
      return {
        kind: "ok",
        attestation: { logHeadSeq: verdict.headSeq, logHeadHash: verdict.headHash },
      };
    case "empty":
      return { kind: "chain_broken", detail: "event log is empty" };
    case "unchained":
      return { kind: "chain_broken", detail: `log is unchained from seq ${verdict.seq}` };
    case "broken":
      return {
        kind: "chain_broken",
        detail: `chain ${verdict.reason} failure at seq ${verdict.seq}`,
      };
    default: {
      const exhaustive: never = verdict;
      throw new Error(`Unhandled verdict: ${JSON.stringify(exhaustive)}`);
    }
  }
}

export async function loadEventLogRows(
  tx: AppendTx,
  sessionId: string,
): Promise<EventLogRow[]> {
  return tx
    .select({
      seq: sessionEvents.seq,
      type: sessionEvents.type,
      role: sessionEvents.role,
      actorId: sessionEvents.actorId,
      recordedAt: sessionEvents.recordedAt,
      payload: sessionEvents.payload,
      prevHash: sessionEvents.prevHash,
      eventHash: sessionEvents.eventHash,
    })
    .from(sessionEvents)
    .where(eq(sessionEvents.sessionId, sessionId))
    .orderBy(asc(sessionEvents.seq));
}
```

- [ ] **Step 4: Run the attestation tests to verify they pass**

Run: `pnpm exec vitest run --config vitest.integration.config.ts server/test/evidence-attest.test.ts`
Expected: all five PASS.

- [ ] **Step 5: Wire the new outcome through the ratings route**

In `server/routes/sessions.ts`, add `chain_broken` to the `RatingsResult` union at lines 476–481:

```ts
    type RatingsResult =
      | { kind: "not_found" }
      | { kind: "wrong_phase"; phase: string }
      | { kind: "no_time_in_training" }
      | { kind: "unknown_evidence"; seqs: number[] }
      | { kind: "chain_broken"; detail: string }
      | { kind: "ok" };
```

Replace the attestation call at lines 501–507 — the locked `session` row already carries every field `SessionIdentity` needs:

```ts
      const attested = attestEvidenceSeqs(logRows, allEvidenceSeqs, {
        tenantId,
        sessionId: session.id,
        scenarioId: session.scenarioId,
        scenarioVersion: session.scenarioVersion,
        seed: session.seed,
      });
      if (attested.kind === "empty_evidence") {
        return { kind: "unknown_evidence", seqs: [] };
      }
      if (attested.kind === "unknown_evidence") {
        return { kind: "unknown_evidence", seqs: attested.seqs };
      }
      if (attested.kind === "chain_broken") {
        return { kind: "chain_broken", detail: attested.detail };
      }
```

Add a case to the response switch before `case "ok"`. This is a 500 because the server's own record is corrupt and no client action can fix it:

```ts
      case "chain_broken":
        res.status(500).json({ error: "event_log_chain_broken", detail: result.detail });
        return;
```

- [ ] **Step 6: Drop the dead import from the integration suite**

`server/test/integration.test.ts` line 11 imports `hashEventLog`, which no longer exists. Remove that import and any assertion using it. If an assertion compared a rating's `logHeadHash` to `hashEventLog(rows)`, replace it with a comparison against the last event's `event_hash`, selected from `vc_session_events`.

- [ ] **Step 7: Run the full server suite**

Run: `pnpm typecheck && pnpm test:integration`
Expected: all pass.

- [ ] **Step 8: Reword the manager evidence desk**

The mechanism is now a chain head, so the label should say so. In `src/i18n/en.json`:

```json
  "manager.evidence.logHead": "chain head {seq}",
```

In `src/i18n/he.json`:

```json
  "manager.evidence.logHead": "ראש שרשרת {seq}",
```

No component change is needed — `ManagerEvidencePage.tsx` already renders this key at lines 354 and 356.

- [ ] **Step 9: Update the doctrine line in CLAUDE.md**

In the "Shipped" paragraph, replace the phrase describing PR #18:

```
tamper-evident ANTS evidence attestation — every rating binds to verified evidence seqs plus a per-event hash chain whose head is frozen into `log_head_seq`/`log_head_hash`, and attestation refuses a log that does not verify ([#18](https://github.com/exposwifty31/VetCrew/pull/18), chain added 2026-08)
```

- [ ] **Step 10: Run every gate**

Run: `pnpm typecheck && pnpm test && pnpm test:integration && pnpm i18n:check && pnpm guard:deps && pnpm guard:dead && pnpm build`
Expected: all pass. `guard:dead` is the one that proves `eventLogPreimage` and `hashEventLog` were genuinely removed rather than orphaned.

- [ ] **Step 11: Run the e2e suite**

Run: `pnpm test:e2e`
Expected: pass. The instructor-to-AAR flow exercises the ratings path end to end, so this is what proves attestation still works against a real run.

- [ ] **Step 12: Commit**

```bash
git add server/evidence-attest.ts server/routes/sessions.ts \
        server/test/evidence-attest.test.ts server/test/integration.test.ts \
        src/i18n/he.json src/i18n/en.json CLAUDE.md
git commit -m "feat(evidence): attest against the chain head and refuse a broken log

The head hash is now the last event's event_hash, so the whole-log rehash on
every attestation is gone. Attestation calls the verifier first and refuses to
freeze a head over a chain that does not verify — an evidence packet that
looks attested and is not is worse than one that declines to attest."
```

---

## Self-Review

**Spec coverage.** Every section of the design spec maps to a task: §2.1 columns and §2.2 genesis to Task 4 and Task 3; §2.3 preimage and the `recorded_at` move to Task 3 and Task 5; §2.4 encoder to Task 2; §3.1 write path to Task 5; §3.2 trigger to Task 6; §3.3 verifier to Task 7; §3.4 attestation to Task 8; §3.5 determinism to Task 5 Step 5; §4 bypass lockdown to Task 1; §5.1 round-trip to Task 5 Step 1; §5.2 to Task 6; §5.3 to Task 7; §5.4 to Task 8; §5.5 to Task 1; §5.6 honoured by omission. All nine acceptance criteria in §6 are covered — criterion 8's full gate list runs in Task 8 Step 10 and Step 11.

**Type consistency.** `SessionIdentity` is defined in Task 3 and consumed unchanged in Tasks 5, 7, and 8. `ChainRow` is defined in Task 7 and re-exported as `EventLogRow` in Task 8 so the existing name keeps working at its call sites. `eventHash` takes the same `ChainedEventInput` shape everywhere. `roleOf` and `actorIdOf` are defined once in Task 5 and used twice in the same file.

**One thing to watch during execution.** Task 8 Step 6 depends on the current contents of `server/test/integration.test.ts`, which imports `hashEventLog` at line 11. Read that file before editing: if it asserts against a whole-log hash, that assertion has to become a comparison against the last row's `event_hash`, not simply be deleted, or the suite loses its coverage of the rating-to-log bind.
