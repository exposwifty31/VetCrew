# Clinical Claim Provenance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace one `clinicallyReviewed` boolean per scenario file with claim-level provenance across the 36 clinical claims in the two shipped scenarios, so a reviewer's sign-off binds to specific claim content and survives unrelated edits.

**Architecture:** Every scenario is decomposed into seven kinds of claim with derived references like `checklist:no-route-error`. Each claim carries mandatory source provenance in a root-level `claimSources` map, enforced by set equality against the extracted references. Each claim also has a content hash over its load-bearing fields — everything except translations, chip colour, the hidden flag, and the id — so a Hebrew typo fix keeps a sign-off while a parameter change invalidates it. Sign-offs live in a committed append-only file, are loaded into memory at boot, and derive six per-claim statuses. Today's ratings gate is unchanged except that it can now only get stricter.

**Tech Stack:** TypeScript 7, Node 24, Zod 4, Vitest 4. No database changes. No UI.

**Design spec:** [docs/superpowers/specs/2026-08-03-clinical-claim-provenance-design.md](../specs/2026-08-03-clinical-claim-provenance-design.md)

## Global Constraints

- **No database migration, no new tables.** Both registries load at boot from committed files into memory. Spec §4.3 records why: a boot-time sync and an append-only trigger are mutually exclusive, and nothing queries the tables.
- **No UI, no API.** No reviewer dashboard, no manager-desk widget, no AAR badge. Visibility is a report script and the pull-request diff.
- **`packages/engine` must not change**, and provenance must never reach `EngineState`. `scripts/check-boundaries.ts` enforces engine purity; Task 9 enforces the replay half.
- **No new runtime dependencies.** `pnpm guard:deps` and `pnpm guard:dead` must pass.
- **Hash scheme tag is frozen:** `vetcrew.claim.v1`. Once shipped it never changes; a new scheme gets a new tag.
- **Hash denylist is exactly four keys:** any key ending in `He`, plus `code`, `hidden`, and `id`. Everything else is load-bearing by default.
- **Minimum 20 characters** on `internal.rationale` and `floor_observation.note`.
- **All server tests live in `server/test/`** and run under `pnpm test:integration`. Shared-package tests live in `packages/shared/test/` and run under `pnpm test`.
- **Import style:** relative imports carry the `.js` extension. Use `import type` for type-only imports.
- **Every commit must leave CI green.** Task 4 is deliberately large because the validation and the data it requires have to land together.

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `packages/shared/src/clinical-claims.ts` | Claim types, reference derivation, denylist filtering, extraction. Pure. |
| `packages/shared/src/clinical-provenance.ts` | The three-kind source union and the source-registry schema. |
| `packages/shared/src/clinical-review.ts` | The sign-off schema. |
| `packages/shared/test/clinical-claims.test.ts` | Extraction and inventory tests. |
| `server/clinical/claim-hash.ts` | Content hashing over a claim, using the canonical encoder. |
| `server/clinical/registries.ts` | Boot loaders for `clinical/sources.json` and `clinical/reviews.json`. |
| `server/clinical/claim-status.ts` | Six-status derivation with precedence. |
| `server/clinical/scenario-review-status.ts` | The gate indirection, plus boot-time source resolution. |
| `clinical/sources.json` | Source registry. |
| `clinical/reviews.json` | Review registry, initially empty. |
| `scripts/clinical-provenance-report.ts` | Per-scenario counts by provenance kind. |
| `server/test/clinical-claim-hash.test.ts` | Golden hash, denylist proof, boundary tests. |
| `server/test/clinical-registries.test.ts` | Registry loading and validation. |
| `server/test/clinical-claim-status.test.ts` | Status derivation and precedence. |
| `server/test/clinical-gate.test.ts` | Gate behaviour and boot-time resolution. |
| `server/test/clinical-engine-isolation.test.ts` | Provenance never reaches the engine. |

**Modified:**

| File | Change |
|---|---|
| `packages/shared/src/authored-scenario.ts` | Add `claimSources`; set-equality and arithmetic validation. |
| `packages/shared/src/index.ts` | Export the new schemas and helpers. |
| `scenarios/base-rung-resp-distress.json` | 22 provenance declarations. |
| `scenarios/base-rung-stepped-tasks.json` | 14 provenance declarations. |
| `server/index.ts` | Load registries at boot, assert source resolution, pass to the router. |
| `server/routes/sessions.ts` | Gate reads `scenarioReviewStatus()` instead of the boolean. |
| `package.json` | Add the `clinical:report` script. |

**Dependency order:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9. Task 4 depends on 1 and 3; Task 8 depends on everything before it.

**Cross-spec dependency:** Tasks 2 onward need `canonicalJson` from `server/canonical-json.ts`, delivered by Task 2 of the evidence-integrity plan. Task 8 assumes `allowUnreviewedScores()` from that plan's Task 1. Complete that plan first.

---

## Task 1: Claim extraction

**Files:**
- Create: `packages/shared/src/clinical-claims.ts`
- Create: `packages/shared/test/clinical-claims.test.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: `AuthoredScenario` from `./authored-scenario.js`.
- Produces:
  - `type ClaimType = "presentation" | "vital" | "trigger" | "action" | "checklist" | "task" | "injection"`
  - `type Claim = { ref: string; type: ClaimType; content: unknown }`
  - `loadBearing(value: unknown): unknown`
  - `extractClaims(scenario: AuthoredScenario): Claim[]`
  - `CLAIM_HASH_DENYLIST: ReadonlySet<string>`

- [ ] **Step 1: Write the failing test**

Create `packages/shared/test/clinical-claims.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { extractClaims, loadBearing } from "../src/clinical-claims.js";
import type { AuthoredScenario } from "../src/authored-scenario.js";

describe("loadBearing", () => {
  test("drops Hebrew translations at any depth", () => {
    expect(loadBearing({ label: "a", labelHe: "א" })).toEqual({ label: "a" });
    expect(loadBearing({ outer: { promptHe: "א", prompt: "p" } })).toEqual({
      outer: { prompt: "p" },
    });
  });

  test("drops code, hidden and id", () => {
    expect(loadBearing({ id: "x", code: "do", hidden: true, weight: 3 })).toEqual({ weight: 3 });
  });

  test("keeps everything else, including fields it has never seen", () => {
    expect(loadBearing({ weight: 3, somethingNew: "keep me" })).toEqual({
      weight: 3,
      somethingNew: "keep me",
    });
  });

  test("recurses through arrays", () => {
    expect(loadBearing([{ label: "a", labelHe: "א" }])).toEqual([{ label: "a" }]);
  });

  test("passes primitives and null through", () => {
    expect(loadBearing(null)).toBeNull();
    expect(loadBearing(3)).toBe(3);
    expect(loadBearing("s")).toBe("s");
  });
});

/** Minimal but structurally valid scenario covering all seven claim types. */
const scenario = {
  slug: "fixture",
  version: "0.1.0",
  title: "t",
  titleHe: "ת",
  species: "canine",
  presentingComplaint: "distress",
  presentingComplaintHe: "מצוקה",
  clinicallyReviewed: false,
  clinicalReviewer: null,
  roles: ["technician"],
  engine: {
    vitals: { spo2: { initial: 88, target: 72, ratePerSec: 0.15, jitter: 0.2 } },
    triggers: [
      { id: "trig", on: { kind: "time", atMs: 1000 }, effects: [{ vital: "spo2", target: 96 }] },
    ],
  },
  actions: [{ id: "act", label: "Act", labelHe: "פעולה" }],
  checklist: [
    {
      id: "chk",
      label: "Did the thing",
      labelHe: "עשה",
      weight: 3,
      role: "technician",
      rule: { kind: "action_performed", action: "act" },
    },
  ],
  tasks: [],
  injections: [{ id: "inj", label: "Inj", labelHe: "הזרקה" }],
  scoringDimensions: ["task_management"],
} as unknown as AuthoredScenario;

describe("extractClaims", () => {
  test("produces one claim per claim-bearing element", () => {
    expect(extractClaims(scenario).map((c) => c.ref)).toEqual([
      "presentation:scenario",
      "vital:spo2",
      "trigger:trig",
      "action:act",
      "checklist:chk",
      "injection:inj",
    ]);
  });

  test("presentation content is species and complaint only, not the title", () => {
    const presentation = extractClaims(scenario)[0];
    expect(presentation?.content).toEqual({ species: "canine", presentingComplaint: "distress" });
  });

  test("claim content is denylist-filtered", () => {
    const checklist = extractClaims(scenario).find((c) => c.ref === "checklist:chk");
    expect(checklist?.content).toEqual({
      label: "Did the thing",
      weight: 3,
      role: "technician",
      rule: { kind: "action_performed", action: "act" },
    });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @vetcrew/shared exec vitest run test/clinical-claims.test.ts`
Expected: FAIL — cannot resolve `../src/clinical-claims.js`.

- [ ] **Step 3: Implement extraction**

Create `packages/shared/src/clinical-claims.ts`:

```ts
import type { AuthoredScenario } from "./authored-scenario.js";

/**
 * Claim decomposition (design spec §2). A scenario is not one clinical
 * assertion, it is dozens — and a review that cannot name which one it
 * covers is not evidence of anything.
 *
 * This lives in shared rather than server because the mandatory-provenance
 * rule is a set equality against these references, and that check belongs in
 * authoredScenarioSchema.superRefine with every other structural rule.
 */

export type ClaimType =
  | "presentation"
  | "vital"
  | "trigger"
  | "action"
  | "checklist"
  | "task"
  | "injection";

export type Claim = {
  readonly ref: string;
  readonly type: ClaimType;
  readonly content: unknown;
};

/**
 * DENYLIST, not an allowlist. A clinical field added to the schema next year
 * must be load-bearing by default; exempting one has to be a deliberate,
 * reviewable act rather than an omission nobody notices.
 */
export const CLAIM_HASH_DENYLIST: ReadonlySet<string> = new Set(["code", "hidden", "id"]);

/** Strip presentation and pedagogical fields; keep everything else. */
export function loadBearing(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(loadBearing);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (CLAIM_HASH_DENYLIST.has(key)) continue;
      if (key.endsWith("He")) continue;
      out[key] = loadBearing(entry);
    }
    return out;
  }
  return value;
}

export function extractClaims(scenario: AuthoredScenario): Claim[] {
  const claims: Claim[] = [
    {
      // The one pseudo-element: no array entry, so its content is named
      // explicitly rather than derived. "scenario" is a literal.
      ref: "presentation:scenario",
      type: "presentation",
      content: {
        species: scenario.species,
        presentingComplaint: scenario.presentingComplaint,
      },
    },
  ];
  for (const [name, params] of Object.entries(scenario.engine.vitals)) {
    claims.push({ ref: `vital:${name}`, type: "vital", content: loadBearing(params) });
  }
  for (const trigger of scenario.engine.triggers) {
    claims.push({ ref: `trigger:${trigger.id}`, type: "trigger", content: loadBearing(trigger) });
  }
  for (const action of scenario.actions) {
    claims.push({ ref: `action:${action.id}`, type: "action", content: loadBearing(action) });
  }
  for (const item of scenario.checklist) {
    claims.push({ ref: `checklist:${item.id}`, type: "checklist", content: loadBearing(item) });
  }
  for (const task of scenario.tasks) {
    claims.push({ ref: `task:${task.id}`, type: "task", content: loadBearing(task) });
  }
  for (const injection of scenario.injections) {
    claims.push({
      ref: `injection:${injection.id}`,
      type: "injection",
      content: loadBearing(injection),
    });
  }
  return claims;
}
```

Add to `packages/shared/src/index.ts`:

```ts
export {
  CLAIM_HASH_DENYLIST,
  extractClaims,
  loadBearing,
  type Claim,
  type ClaimType,
} from "./clinical-claims.js";
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm --filter @vetcrew/shared exec vitest run test/clinical-claims.test.ts`
Expected: all PASS.

- [ ] **Step 5: Add the golden inventory test**

Append to `packages/shared/test/clinical-claims.test.ts`. This is a golden test — it catches an accidental change to what counts as a claim:

```ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { authoredScenarioSchema } from "../src/authored-scenario.js";

const SCENARIOS_DIR = join(import.meta.dirname, "..", "..", "..", "scenarios");

function loadScenario(file: string): AuthoredScenario {
  return authoredScenarioSchema.parse(JSON.parse(readFileSync(join(SCENARIOS_DIR, file), "utf8")));
}

describe("shipped scenario claim inventory (golden)", () => {
  test("base-rung-resp-distress has exactly 22 claims", () => {
    const claims = extractClaims(loadScenario("base-rung-resp-distress.json"));
    expect(claims).toHaveLength(22);
    const byType = claims.reduce<Record<string, number>>((acc, c) => {
      acc[c.type] = (acc[c.type] ?? 0) + 1;
      return acc;
    }, {});
    expect(byType).toEqual({
      presentation: 1,
      vital: 3,
      trigger: 3,
      action: 7,
      checklist: 6,
      injection: 2,
    });
  });

  test("base-rung-stepped-tasks has exactly 14 claims", () => {
    const claims = extractClaims(loadScenario("base-rung-stepped-tasks.json"));
    expect(claims).toHaveLength(14);
    const byType = claims.reduce<Record<string, number>>((acc, c) => {
      acc[c.type] = (acc[c.type] ?? 0) + 1;
      return acc;
    }, {});
    expect(byType).toEqual({ presentation: 1, vital: 5, trigger: 1, task: 7 });
  });

  test("every shipped scenario yields unique claim refs", () => {
    for (const file of readdirSync(SCENARIOS_DIR).filter((f) => f.endsWith(".json"))) {
      const refs = extractClaims(loadScenario(file)).map((c) => c.ref);
      expect(new Set(refs).size).toBe(refs.length);
    }
  });
});
```

- [ ] **Step 6: Run and commit**

Run: `pnpm --filter @vetcrew/shared exec vitest run && pnpm typecheck`
Expected: all PASS.

```bash
git add packages/shared/src/clinical-claims.ts packages/shared/src/index.ts \
        packages/shared/test/clinical-claims.test.ts
git commit -m "feat(clinical): decompose scenarios into addressable claims

Seven claim types with derived references. Field filtering is a denylist so a
clinical field added later is load-bearing by default rather than silently
escaping review. Golden inventory test pins 22 and 14 claims."
```

---

## Task 2: Claim content hashing

**Files:**
- Create: `server/clinical/claim-hash.ts`
- Create: `server/test/clinical-claim-hash.test.ts`

**Interfaces:**
- Consumes: `canonicalJson` from `server/canonical-json.ts`; `Claim`, `extractClaims` from `@vetcrew/shared`.
- Produces: `CLAIM_HASH_TAG`, `claimHash(scenarioSlug: string, claim: Claim): string`.

- [ ] **Step 1: Write the failing test**

Create `server/test/clinical-claim-hash.test.ts`:

```ts
import { extractClaims, loadBearing, type Claim } from "@vetcrew/shared";
import { describe, expect, test } from "vitest";

import { claimHash } from "../clinical/claim-hash.js";

const base: Claim = {
  ref: "checklist:no-route-error",
  type: "checklist",
  content: loadBearing({
    id: "no-route-error",
    label: "SC-only medication NOT given IV (route check)",
    labelHe: "תרופה תת-עורית לא ניתנה ורידית",
    weight: 3,
    role: "technician",
    rule: { kind: "action_not_performed", action: "give_drug_iv_wrong_route" },
  }),
};

function withContent(content: unknown): Claim {
  return { ...base, content };
}

describe("claimHash", () => {
  test("is a lowercase hex sha256", () => {
    expect(claimHash("base-rung-resp-distress", base)).toMatch(/^[a-f0-9]{64}$/);
  });

  test("is stable across calls", () => {
    expect(claimHash("s", base)).toBe(claimHash("s", base));
  });

  test("is scoped to the scenario slug", () => {
    expect(claimHash("scenario-a", base)).not.toBe(claimHash("scenario-b", base));
  });

  test("is scoped to the claim reference", () => {
    expect(claimHash("s", { ...base, ref: "checklist:other" })).not.toBe(claimHash("s", base));
  });

  test("ignores object key order in the content", () => {
    const reordered = loadBearing({
      rule: { action: "give_drug_iv_wrong_route", kind: "action_not_performed" },
      role: "technician",
      weight: 3,
      label: "SC-only medication NOT given IV (route check)",
    });
    expect(claimHash("s", withContent(reordered))).toBe(claimHash("s", base));
  });
});

describe("hash boundary — what invalidates a clinical sign-off", () => {
  test("changing labelHe does NOT move the hash", () => {
    const tweaked = loadBearing({
      id: "no-route-error",
      label: "SC-only medication NOT given IV (route check)",
      labelHe: "נוסח עברי אחר לגמרי",
      weight: 3,
      role: "technician",
      rule: { kind: "action_not_performed", action: "give_drug_iv_wrong_route" },
    });
    expect(claimHash("s", withContent(tweaked))).toBe(claimHash("s", base));
  });

  for (const [name, patch] of [
    ["label", { label: "Reworded entirely" }],
    ["weight", { weight: 1 }],
    ["role", { role: "veterinarian" }],
    ["rule", { rule: { kind: "action_performed", action: "give_drug_sc" } }],
  ] as const) {
    test(`changing ${name} DOES move the hash`, () => {
      const content = { ...(base.content as Record<string, unknown>), ...patch };
      expect(claimHash("s", withContent(content))).not.toBe(claimHash("s", base));
    });
  }

  test("an unexpected extra field is load-bearing by default", () => {
    const content = { ...(base.content as Record<string, unknown>), contraindication: "renal" };
    expect(claimHash("s", withContent(content))).not.toBe(claimHash("s", base));
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run --config vitest.integration.config.ts server/test/clinical-claim-hash.test.ts`
Expected: FAIL — cannot resolve `../clinical/claim-hash.js`.

- [ ] **Step 3: Implement hashing**

Create `server/clinical/claim-hash.ts`:

```ts
import { createHash } from "node:crypto";

import type { Claim } from "@vetcrew/shared";

import { canonicalJson } from "../canonical-json.js";

/**
 * FROZEN. Once shipped this never changes — a new scheme gets a new tag, so
 * every sign-off already in the registry stays verifiable.
 */
export const CLAIM_HASH_TAG = "vetcrew.claim.v1";

/**
 * A sign-off binds to this hash, not to a scenario version. So bumping a
 * scenario to fix a Hebrew label re-reviews nothing, while changing a rule or
 * a weight invalidates that claim's approval and only that one.
 *
 * The slug is inside the hash deliberately: "oxygen takes SpO2 to 96" is a
 * claim about THIS patient in THIS presentation, so an identical-looking
 * claim in another scenario earns its own review.
 */
export function claimHash(scenarioSlug: string, claim: Claim): string {
  return createHash("sha256")
    .update(canonicalJson([CLAIM_HASH_TAG, scenarioSlug, claim.ref, claim.content]), "utf8")
    .digest("hex");
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm exec vitest run --config vitest.integration.config.ts server/test/clinical-claim-hash.test.ts`
Expected: all PASS.

- [ ] **Step 5: Add the golden hash test**

This is the equivalent of the engine's determinism test. If anyone changes the canonicalization, the denylist, or the tag, it fires immediately rather than quietly invalidating every sign-off in the registry. Append to the same file:

```ts
describe("golden hash", () => {
  test("a pinned claim hash never drifts", () => {
    // Any change here means every existing sign-off silently stopped matching.
    // Do not update this value to make the test pass — work out why it moved.
    const pinned = claimHash("base-rung-resp-distress", base);
    expect(pinned).toBe("REPLACE_WITH_OBSERVED_VALUE_ON_FIRST_RUN");
  });
});
```

Run the test once, take the actual value from the failure output, paste it in, and run again to confirm it passes. Record in the commit message that the value was observed rather than chosen.

- [ ] **Step 6: Run and commit**

Run: `pnpm exec vitest run --config vitest.integration.config.ts server/test/clinical-claim-hash.test.ts`
Expected: all PASS.

```bash
git add server/clinical/claim-hash.ts server/test/clinical-claim-hash.test.ts
git commit -m "feat(clinical): content hashing for claims

Sign-offs bind to content rather than to a scenario version. Boundary tests
prove a labelHe change does not move the hash while label, weight, role and
rule do, and that an unexpected field is load-bearing by default. The golden
hash value was observed from a first run, not chosen."
```

---

## Task 3: Source registry

**Files:**
- Create: `packages/shared/src/clinical-provenance.ts`
- Create: `clinical/sources.json`
- Create: `server/clinical/registries.ts`
- Create: `server/test/clinical-registries.test.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `claimSourceSchema`, `type ClaimSource` — the three-kind union
  - `clinicalSourceSchema`, `clinicalSourceRegistrySchema`, `type ClinicalSource`
  - `loadClinicalSources(): Map<string, ClinicalSource>`

- [ ] **Step 1: Write the failing schema test**

Create `server/test/clinical-registries.test.ts`:

```ts
import { claimSourceSchema, clinicalSourceRegistrySchema } from "@vetcrew/shared";
import { describe, expect, test } from "vitest";

import { loadClinicalSources } from "../clinical/registries.js";

describe("claimSourceSchema", () => {
  test("accepts a cited source", () => {
    expect(
      claimSourceSchema.safeParse({ kind: "cited", sourceId: "recover-2024", locator: "Table 3" })
        .success,
    ).toBe(true);
  });

  test("accepts a floor observation", () => {
    expect(
      claimSourceSchema.safeParse({
        kind: "floor_observation",
        observer: "Dan",
        observedAt: "2026-07-12",
        note: "SC-only drug given IV during a busy shift.",
      }).success,
    ).toBe(true);
  });

  test("rejects omission entirely — there is no empty state", () => {
    expect(claimSourceSchema.safeParse(undefined).success).toBe(false);
    expect(claimSourceSchema.safeParse({}).success).toBe(false);
    expect(claimSourceSchema.safeParse({ kind: "unknown" }).success).toBe(false);
  });

  test("rejects a lazy internal rationale", () => {
    expect(claimSourceSchema.safeParse({ kind: "internal", rationale: "n/a" }).success).toBe(false);
    expect(claimSourceSchema.safeParse({ kind: "internal", rationale: "none" }).success).toBe(false);
  });

  test("accepts a substantive internal rationale", () => {
    expect(
      claimSourceSchema.safeParse({
        kind: "internal",
        rationale: "Generic verb with no clinical assertion beyond existence.",
      }).success,
    ).toBe(true);
  });
});

describe("clinicalSourceRegistrySchema", () => {
  test("requires supersededBy when status is superseded", () => {
    const entry = {
      id: "x",
      title: "T",
      publisher: "P",
      edition: "2020",
      url: "https://example.org/x",
      retrievedAt: "2026-08-03",
      status: "superseded",
      supersededBy: null,
    };
    expect(clinicalSourceRegistrySchema.safeParse([entry]).success).toBe(false);
    expect(
      clinicalSourceRegistrySchema.safeParse([{ ...entry, supersededBy: "y" }]).success,
    ).toBe(true);
  });
});

describe("loadClinicalSources", () => {
  test("loads the committed registry and keys it by id", () => {
    const sources = loadClinicalSources();
    expect(sources.size).toBeGreaterThan(0);
    for (const [id, source] of sources) expect(source.id).toBe(id);
  });

  test("every entry marked superseded points at a source that exists", () => {
    const sources = loadClinicalSources();
    for (const source of sources.values()) {
      if (source.status === "superseded" && source.supersededBy !== null) {
        expect(sources.has(source.supersededBy)).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run --config vitest.integration.config.ts server/test/clinical-registries.test.ts`
Expected: FAIL — the schemas and the loader do not exist.

- [ ] **Step 3: Implement the schemas**

Create `packages/shared/src/clinical-provenance.ts`:

```ts
import { z } from "zod";

/**
 * Clinical provenance (design spec §3). Every claim declares where it comes
 * from. The union is what makes silence impossible: you cannot omit a source,
 * only choose a kind, and two of the three require you to write something.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 20 characters so "n/a", "none" and "todo" fail validation. That friction is
 * the mechanism that stops this schema becoming a graveyard of empty fields.
 */
const SUBSTANTIVE_TEXT = z.string().trim().min(20);

export const claimSourceSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("cited"),
    sourceId: z.string().min(1),
    locator: z.string().min(1).optional(),
  }),
  z.object({
    // First-class, not a failure to cite. CLAUDE.md §2.7 calls the
    // floor-observed anchors "IP, not content"; §8 requires they be signed
    // off like any other clinical claim.
    kind: z.literal("floor_observation"),
    observer: z.string().min(1),
    observedAt: z.string().regex(ISO_DATE),
    note: SUBSTANTIVE_TEXT,
  }),
  z.object({
    kind: z.literal("internal"),
    rationale: SUBSTANTIVE_TEXT,
  }),
]);

export type ClaimSource = z.infer<typeof claimSourceSchema>;

export const clinicalSourceSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    publisher: z.string().min(1),
    edition: z.string().min(1),
    url: z.string().url(),
    retrievedAt: z.string().regex(ISO_DATE),
    status: z.enum(["current", "superseded", "withdrawn"]),
    supersededBy: z.string().min(1).nullable().default(null),
  })
  .superRefine((source, ctx) => {
    if (source.status === "superseded" && source.supersededBy === null) {
      ctx.addIssue({
        code: "custom",
        message: `superseded source "${source.id}" must name supersededBy`,
      });
    }
  });

export type ClinicalSource = z.infer<typeof clinicalSourceSchema>;

export const clinicalSourceRegistrySchema = z.array(clinicalSourceSchema);
```

Add to `packages/shared/src/index.ts`:

```ts
export {
  claimSourceSchema,
  clinicalSourceRegistrySchema,
  clinicalSourceSchema,
  type ClaimSource,
  type ClinicalSource,
} from "./clinical-provenance.js";
```

- [ ] **Step 4: Create the source registry**

Create `clinical/sources.json`. Both entries are real and current; neither is cited by a claim yet, which is the honest state and is what the Task 9 report will show:

```json
[
  {
    "id": "recover-2024",
    "title": "RECOVER Clinical Guidelines for CPR in Dogs and Cats: 2024 Update",
    "publisher": "RECOVER Initiative / Journal of Veterinary Emergency and Critical Care",
    "edition": "2024",
    "url": "https://doi.org/10.1111/vec.13391",
    "retrievedAt": "2026-08-03",
    "status": "current",
    "supersededBy": null
  },
  {
    "id": "avma-cvtea-appendix-g",
    "title": "CVTEA Accreditation Policies and Procedures, Appendix G — Veterinary Technology Student Essential and Recommended Skills List",
    "publisher": "American Veterinary Medical Association",
    "edition": "January 2025",
    "url": "https://www.avma.org/education/center-for-veterinary-accreditation/committee-veterinary-technician-education-activities/cvtea-accreditation-policies-and-procedures-appendix-g",
    "retrievedAt": "2026-08-03",
    "status": "current",
    "supersededBy": null
  }
]
```

- [ ] **Step 5: Implement the loader**

Create `server/clinical/registries.ts`. Path resolution deliberately mirrors `SCENARIOS_DIR` in `server/scenarios.ts`, so deployment behaviour is identical by construction and `copy-server-assets.mjs` needs no change:

```ts
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { clinicalSourceRegistrySchema, type ClinicalSource } from "@vetcrew/shared";

/** Same resolution as SCENARIOS_DIR in server/scenarios.ts: repo root. */
const CLINICAL_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "clinical");

/** A malformed registry fails boot loudly, like an invalid scenario does. */
export function loadClinicalSources(): Map<string, ClinicalSource> {
  const raw: unknown = JSON.parse(readFileSync(join(CLINICAL_DIR, "sources.json"), "utf8"));
  const parsed = clinicalSourceRegistrySchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`invalid clinical/sources.json: ${parsed.error.message}`);
  }
  const byId = new Map<string, ClinicalSource>();
  for (const source of parsed.data) {
    if (byId.has(source.id)) {
      throw new Error(`duplicate clinical source id: ${source.id}`);
    }
    byId.set(source.id, source);
  }
  return byId;
}
```

Note the `".."` twice: this file is one directory deeper than `server/scenarios.ts`.

- [ ] **Step 6: Run and commit**

Run: `pnpm exec vitest run --config vitest.integration.config.ts server/test/clinical-registries.test.ts && pnpm typecheck`
Expected: all PASS.

```bash
git add packages/shared/src/clinical-provenance.ts packages/shared/src/index.ts \
        clinical/sources.json server/clinical/registries.ts \
        server/test/clinical-registries.test.ts
git commit -m "feat(clinical): provenance union and source registry

The union makes omission inexpressible: you can only choose a kind, and two of
three demand substantive text. Citations reference a registry by stable token,
so fixing a dead URL invalidates nothing while changing a claim's basis does."
```

---

## Task 4: Mandatory provenance on every claim

The validation and the data it demands land in one commit, because either alone leaves CI red.

**Files:**
- Modify: `packages/shared/src/authored-scenario.ts`
- Modify: `scenarios/base-rung-resp-distress.json`
- Modify: `scenarios/base-rung-stepped-tasks.json`
- Modify: `packages/shared/test/clinical-claims.test.ts`

**Interfaces:**
- Consumes: `extractClaims` (Task 1), `claimSourceSchema` (Task 3).
- Produces: `AuthoredScenario.claimSources: Record<string, ClaimSource>`, validated by set equality against extracted references.

- [ ] **Step 1: Write the failing validation test**

Append to `packages/shared/test/clinical-claims.test.ts`:

```ts
describe("claimSources set equality", () => {
  function parse(overrides: Record<string, unknown>) {
    const raw = JSON.parse(
      readFileSync(join(SCENARIOS_DIR, "base-rung-resp-distress.json"), "utf8"),
    ) as Record<string, unknown>;
    return authoredScenarioSchema.safeParse({ ...raw, ...overrides });
  }

  test("the shipped scenarios satisfy it", () => {
    for (const file of readdirSync(SCENARIOS_DIR).filter((f) => f.endsWith(".json"))) {
      const result = authoredScenarioSchema.safeParse(
        JSON.parse(readFileSync(join(SCENARIOS_DIR, file), "utf8")),
      );
      expect(result.success, `${file}: ${result.success ? "" : result.error.message}`).toBe(true);
    }
  });

  test("a missing claim source fails validation", () => {
    const raw = JSON.parse(
      readFileSync(join(SCENARIOS_DIR, "base-rung-resp-distress.json"), "utf8"),
    ) as { claimSources: Record<string, unknown> };
    const { "vital:spo2": _dropped, ...rest } = raw.claimSources;
    const result = parse({ claimSources: rest });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain("vital:spo2");
  });

  test("an orphaned claim source fails validation", () => {
    const raw = JSON.parse(
      readFileSync(join(SCENARIOS_DIR, "base-rung-resp-distress.json"), "utf8"),
    ) as { claimSources: Record<string, unknown> };
    const result = parse({
      claimSources: {
        ...raw.claimSources,
        "vital:does-not-exist": { kind: "internal", rationale: "Orphan entry for the test suite." },
      },
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain("vital:does-not-exist");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @vetcrew/shared exec vitest run test/clinical-claims.test.ts`
Expected: FAIL — `claimSources` is not in the schema and not in the scenario files.

- [ ] **Step 3: Add the field and the set-equality rule**

In `packages/shared/src/authored-scenario.ts`, add the imports:

```ts
import { extractClaims } from "./clinical-claims.js";
import { claimSourceSchema } from "./clinical-provenance.js";
```

Add the field to the object, after `scoringDimensions`:

```ts
    /**
     * Provenance for every claim, keyed by claim reference (design spec §3.2).
     * A root-level map rather than inline fields: putting `source` on vitals
     * and triggers would carry it through compileScenario into EngineState,
     * where a citation edit could alter replay.
     */
    claimSources: z.record(z.string().min(1), claimSourceSchema),
```

Add this block at the top of the existing `superRefine` callback:

```ts
    // Mandatory provenance, enforced as a SET EQUALITY so it catches both a
    // missing declaration and an orphaned one. A per-element optional field
    // could only ever have caught the missing half.
    const claimRefs = new Set(extractClaims(scenario as AuthoredScenario).map((c) => c.ref));
    for (const ref of claimRefs) {
      if (!(ref in scenario.claimSources)) {
        ctx.addIssue({ code: "custom", message: `claim "${ref}" has no entry in claimSources` });
      }
    }
    for (const ref of Object.keys(scenario.claimSources)) {
      if (!claimRefs.has(ref)) {
        ctx.addIssue({
          code: "custom",
          message: `claimSources has an orphaned entry "${ref}" matching no claim`,
        });
      }
    }
```

- [ ] **Step 4: Declare provenance for the 22 claims in `base-rung-resp-distress.json`**

Add this block at the end of the object, after `scoringDimensions`. Three entries are `floor_observation` because they rest on the two anchors CLAUDE.md §2.7 records; the rest are honestly `internal`, because this is unreviewed prototype content and saying otherwise would be the exact dishonesty this schema exists to prevent:

```json
  "claimSources": {
    "presentation:scenario": { "kind": "internal", "rationale": "Prototype presentation authored for base-rung engine testing; not derived from a published case series." },
    "vital:spo2": { "kind": "internal", "rationale": "Desaturation trajectory authored for prototyping; plausible by construction, no published reference consulted." },
    "vital:hr": { "kind": "internal", "rationale": "Tachycardia trajectory authored for prototyping; plausible by construction, no published reference consulted." },
    "vital:rr": { "kind": "internal", "rationale": "Tachypnoea trajectory authored for prototyping; plausible by construction, no published reference consulted." },
    "trigger:oxygen-recovers": { "kind": "internal", "rationale": "Oxygen response curve authored for prototyping; the magnitude and rate are illustrative rather than sourced." },
    "trigger:decompensation-at-150s": { "kind": "internal", "rationale": "Timed decompensation exists to force a decision point; 150s is a pacing choice, not a clinical finding." },
    "trigger:monitor-artifact": { "kind": "internal", "rationale": "Artifact magnitude chosen so the noise is visible on the monitor; a display behaviour, not a physiological claim." },
    "action:airway_pulses_check": { "kind": "internal", "rationale": "Generic verb; asserts only that airway and pulses can be assessed." },
    "action:oxygen_on": { "kind": "internal", "rationale": "Generic verb; asserts only that oxygen supplementation can be started." },
    "action:iv_access_attempt": { "kind": "internal", "rationale": "Generic verb; asserts only that IV access can be attempted." },
    "action:give_drug_sc": { "kind": "internal", "rationale": "Asserts the medication has a subcutaneous route. The drug is unnamed in the scenario, so the claim stays generic." },
    "action:give_drug_iv_wrong_route": { "kind": "floor_observation", "observer": "Dan (ER floor, pilot site)", "observedAt": "2026-07-12", "note": "Route error anchor recorded in CLAUDE.md 2.7: an SC-only drug given IV. The action label asserts the drug is SC-only." },
    "action:vitals_callout": { "kind": "internal", "rationale": "Communication capture hook; asserts only that a vitals change can be called out aloud." },
    "action:check_chart": { "kind": "internal", "rationale": "Generic verb with no clinical assertion beyond the existence of a consultable chart." },
    "checklist:airway-before-iv": { "kind": "floor_observation", "observer": "Dan (ER floor, pilot site)", "observedAt": "2026-07-12", "note": "Priority inversion anchor recorded in CLAUDE.md 2.7: reaching for IV access before airway and pulses under stress." },
    "checklist:oxygen-within-60s": { "kind": "internal", "rationale": "The 60-second threshold is a pacing choice for the prototype, not a published time-to-oxygen standard." },
    "checklist:iv-access": { "kind": "internal", "rationale": "Asserts IV access is expected in this presentation; authored for prototyping rather than sourced." },
    "checklist:no-route-error": { "kind": "floor_observation", "observer": "Dan (ER floor, pilot site)", "observedAt": "2026-07-12", "note": "Scored form of the route error anchor in CLAUDE.md 2.7. Weight 3 reflects that a wrong route is fatal-class, not merely incorrect." },
    "checklist:drug-given-correct-route": { "kind": "internal", "rationale": "Complement of the route-error anchor; asserts the subcutaneous route is the correct one for this drug." },
    "checklist:vitals-callout": { "kind": "internal", "rationale": "Pedagogically motivated communication hook per CLAUDE.md 2.7; not a published clinical standard." },
    "injection:monitor_artifact": { "kind": "internal", "rationale": "Instructor stressor asserting only that monitor artifact occurs, which is uncontroversial on any floor." },
    "injection:owner_distressed": { "kind": "internal", "rationale": "Environmental stressor with no physiological effect; asserts nothing clinical whatsoever." }
  }
```

- [ ] **Step 5: Declare provenance for the 14 claims in `base-rung-stepped-tasks.json`**

Add at the end of that object:

```json
  "claimSources": {
    "presentation:scenario": { "kind": "internal", "rationale": "Prototype presentation authored for the stepped-task rung; not derived from a published case series." },
    "vital:hr": { "kind": "internal", "rationale": "Baseline heart rate authored for the stepped-task rung; plausible by construction, unsourced." },
    "vital:rr": { "kind": "internal", "rationale": "Baseline respiratory rate authored for the stepped-task rung; plausible by construction, unsourced." },
    "vital:temp": { "kind": "internal", "rationale": "Baseline temperature authored for the stepped-task rung; plausible by construction, unsourced." },
    "vital:sys_bp": { "kind": "internal", "rationale": "Baseline systolic pressure authored for the stepped-task rung; plausible by construction, unsourced." },
    "vital:dia_bp": { "kind": "internal", "rationale": "Baseline diastolic pressure authored for the stepped-task rung; plausible by construction, unsourced." },
    "trigger:t7-abnormality": { "kind": "internal", "rationale": "The abnormality the escalation task requires the trainee to notice; magnitude authored for detectability." },
    "task:t1": { "kind": "internal", "rationale": "Normal TPR ranges authored from general small-animal practice; must be checked against a published reference before this scores anyone." },
    "task:t2": { "kind": "internal", "rationale": "Cuff sizing, limb position and artifact diagnosis authored for prototyping; unsourced." },
    "task:t3": { "kind": "floor_observation", "observer": "Dan (ER floor, pilot site)", "observedAt": "2026-07-12", "note": "criticalRouteIds encodes the route error anchor from CLAUDE.md 2.7: this drug is SC-only and the IV route is fatal-class." },
    "task:t4": { "kind": "internal", "rationale": "Tube selection for the named panel authored from general practice; unsourced and needs review before scoring." },
    "task:t5": { "kind": "internal", "rationale": "Catheter placement step order authored for prototyping; the sequence is conventional but unsourced." },
    "task:t6": { "kind": "internal", "rationale": "Drop factors are standard giving-set values; the ordered rate and patient weight are authored for the exercise." },
    "task:t7": { "kind": "internal", "rationale": "Escalation is a decision test; asserts only that the authored abnormality warrants escalating." }
  }
```

- [ ] **Step 6: Run the validation tests**

Run: `pnpm --filter @vetcrew/shared exec vitest run test/clinical-claims.test.ts`
Expected: all PASS, including the shipped-scenario check.

- [ ] **Step 7: Verify the whole system still boots and scores**

Run: `pnpm typecheck && pnpm test && pnpm test:integration`
Expected: all pass. `compileScenario` ignores `claimSources`, so nothing downstream sees it.

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/authored-scenario.ts packages/shared/test/clinical-claims.test.ts \
        scenarios/base-rung-resp-distress.json scenarios/base-rung-stepped-tasks.json
git commit -m "feat(clinical): mandatory provenance for all 36 claims

Set equality between extracted claim refs and claimSources keys, so a missing
declaration and an orphaned one both fail. Four claims are floor_observation
against the two anchors in CLAUDE.md 2.7; the other 32 are honestly internal,
because both scenarios are unreviewed prototype content and recording anything
else would be the dishonesty this schema exists to prevent."
```

---

## Task 5: Arithmetic validation

Machine-checkable claims belong in CI, not on a scarce reviewer's desk. All of these pass on both shipped scenarios today; this locks that in.

**Files:**
- Modify: `packages/shared/src/authored-scenario.ts`
- Create: `packages/shared/test/task-arithmetic.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: no new exports; additional `superRefine` issues on `authoredScenarioSchema`.

- [ ] **Step 1: Write the failing test**

Create `packages/shared/test/task-arithmetic.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { authoredScenarioSchema } from "../src/authored-scenario.js";

const SCENARIOS_DIR = join(import.meta.dirname, "..", "..", "..", "scenarios");

function steppedTasks(): Record<string, unknown> {
  return JSON.parse(
    readFileSync(join(SCENARIOS_DIR, "base-rung-stepped-tasks.json"), "utf8"),
  ) as Record<string, unknown>;
}

/** Replace one task's body, keeping everything else intact. */
function withTaskBody(taskId: string, patch: Record<string, unknown>) {
  const raw = steppedTasks();
  const tasks = (raw["tasks"] as { id: string; body: Record<string, unknown> }[]).map((task) =>
    task.id === taskId ? { ...task, body: { ...task.body, ...patch } } : task,
  );
  return authoredScenarioSchema.safeParse({ ...raw, tasks });
}

describe("task answer-key arithmetic", () => {
  test("the shipped scenario passes every check", () => {
    expect(authoredScenarioSchema.safeParse(steppedTasks()).success).toBe(true);
  });

  test("expectedMl must match doseMg / concentrationMgPerMl", () => {
    const result = withTaskBody("t3", { expectedMl: 0.5 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain("expectedMl");
  });

  test("expectedRouteId must not be a critical route", () => {
    const result = withTaskBody("t3", { expectedRouteId: "iv", expectedMl: 0.2 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain("criticalRouteIds");
  });

  test("expectedMin must not exceed expectedMax", () => {
    const raw = steppedTasks();
    const tasks = (raw["tasks"] as { id: string; body: Record<string, unknown> }[]).map((task) =>
      task.id === "t1"
        ? {
            ...task,
            body: {
              ...task.body,
              fields: [
                { ...(task.body["fields"] as Record<string, unknown>[])[0], expectedMin: 99, expectedMax: 1 },
                ...(task.body["fields"] as Record<string, unknown>[]).slice(1),
              ],
            },
          }
        : task,
    );
    const result = authoredScenarioSchema.safeParse({ ...raw, tasks });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain("expectedMin");
  });

  test("expectedSetId must resolve to one of the sets", () => {
    const result = withTaskBody("t6", { expectedSetId: "not-a-set" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain("expectedSetId");
  });

  test("expectedOptionIds must all resolve", () => {
    const result = withTaskBody("t4", { expectedOptionIds: ["edta", "ghost"] });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain("ghost");
  });

  test("expectedOrder must all resolve", () => {
    const result = withTaskBody("t5", { expectedOrder: ["shave", "ghost"] });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain("ghost");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @vetcrew/shared exec vitest run test/task-arithmetic.test.ts`
Expected: the first test PASSES (the scenario is already valid); the six negative tests FAIL because nothing rejects the bad values yet.

- [ ] **Step 3: Implement the checks**

Append to the `superRefine` in `packages/shared/src/authored-scenario.ts`, inside the existing `for (const task of scenario.tasks)` loop:

```ts
      // Machine-checkable claims: arithmetic, not judgment. Catching an
      // authoring slip in CI rather than in the reviewer's inbox matters when
      // the reviewer is one person who does not work here.
      const body = task.body;
      if (body.kind === "med_admin") {
        const derived = body.doseMg / body.concentrationMgPerMl;
        // Relative tolerance so authored decimals such as 0.2 do not fail on
        // binary float representation.
        if (Math.abs(derived - body.expectedMl) > Math.abs(derived) * 1e-9) {
          ctx.addIssue({
            code: "custom",
            message: `task "${task.id}": expectedMl ${body.expectedMl} does not match doseMg/concentrationMgPerMl (${derived})`,
          });
        }
        if (body.criticalRouteIds.includes(body.expectedRouteId)) {
          ctx.addIssue({
            code: "custom",
            message: `task "${task.id}": expectedRouteId "${body.expectedRouteId}" is listed in criticalRouteIds`,
          });
        }
      }
      if (body.kind === "value_entry") {
        for (const field of body.fields) {
          if (field.expectedMin > field.expectedMax) {
            ctx.addIssue({
              code: "custom",
              message: `task "${task.id}" field "${field.id}": expectedMin exceeds expectedMax`,
            });
          }
        }
      }
      if (body.kind === "choice_chain") {
        for (const step of body.steps) {
          if (!step.options.some((option) => option.id === step.expectedOptionId)) {
            ctx.addIssue({
              code: "custom",
              message: `task "${task.id}" step "${step.id}": expectedOptionId "${step.expectedOptionId}" is not among its options`,
            });
          }
        }
      }
      if (body.kind === "tube_choice") {
        for (const expected of body.expectedOptionIds) {
          if (!body.options.some((option) => option.id === expected)) {
            ctx.addIssue({
              code: "custom",
              message: `task "${task.id}": expectedOptionIds references unknown option "${expected}"`,
            });
          }
        }
      }
      if (body.kind === "step_order") {
        for (const expected of body.expectedOrder) {
          if (!body.steps.some((step) => step.id === expected)) {
            ctx.addIssue({
              code: "custom",
              message: `task "${task.id}": expectedOrder references unknown step "${expected}"`,
            });
          }
        }
      }
      if (body.kind === "fluids_setup") {
        if (!body.sets.some((set) => set.id === body.expectedSetId)) {
          ctx.addIssue({
            code: "custom",
            message: `task "${task.id}": expectedSetId "${body.expectedSetId}" is not among its sets`,
          });
        }
      }
```

Note there is deliberately **no** fluids rate check: `fluids_setup` stores no expected drops-per-minute — the answer is derived at evaluation time from `expectedSetId` and the ordered rate, so there is nothing to cross-check.

- [ ] **Step 4: Run and commit**

Run: `pnpm --filter @vetcrew/shared exec vitest run && pnpm typecheck && pnpm test:integration`
Expected: all PASS.

```bash
git add packages/shared/src/authored-scenario.ts packages/shared/test/task-arithmetic.test.ts
git commit -m "feat(clinical): validate machine-checkable task answer keys

Dose arithmetic, critical-route conflicts, range ordering and option
resolution are arithmetic rather than judgment, so they belong in CI. All
already pass on both shipped scenarios; this locks that in."
```

---

## Task 6: Review registry

**Files:**
- Create: `packages/shared/src/clinical-review.ts`
- Create: `clinical/reviews.json`
- Modify: `server/clinical/registries.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `server/test/clinical-registries.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `claimReviewSchema`, `claimReviewRegistrySchema`, `type ClaimReview`, `loadClaimReviews(): ClaimReview[]`.

- [ ] **Step 1: Write the failing test**

Append to `server/test/clinical-registries.test.ts`:

```ts
import { claimReviewRegistrySchema } from "@vetcrew/shared";

import { loadClaimReviews } from "../clinical/registries.js";

const validReview = {
  scenarioSlug: "base-rung-resp-distress",
  claimRef: "checklist:no-route-error",
  claimHash: "a".repeat(64),
  decision: "approved",
  note: null,
  reviewerName: "Reviewer X",
  reviewerCredential: "US-credentialed veterinary technician",
  reviewedAt: "2026-09-01",
  attestationRef: "docs/clinical-attestations/2026-09-01-reviewer-x.pdf",
  validUntil: null,
  recordedByUserId: "user_dan",
};

describe("claimReviewSchema", () => {
  test("accepts a well-formed sign-off", () => {
    expect(claimReviewRegistrySchema.safeParse([validReview]).success).toBe(true);
  });

  test("requires a 64-hex claim hash", () => {
    expect(
      claimReviewRegistrySchema.safeParse([{ ...validReview, claimHash: "short" }]).success,
    ).toBe(false);
  });

  test("requires an attestation reference — a sign-off with no artifact is hearsay", () => {
    const { attestationRef: _omitted, ...withoutArtifact } = validReview;
    expect(claimReviewRegistrySchema.safeParse([withoutArtifact]).success).toBe(false);
  });

  test("requires the transcriber, separately from the reviewer", () => {
    const { recordedByUserId: _omitted, ...withoutRecorder } = validReview;
    expect(claimReviewRegistrySchema.safeParse([withoutRecorder]).success).toBe(false);
  });

  test("rejects a decision outside approved/rejected", () => {
    expect(
      claimReviewRegistrySchema.safeParse([{ ...validReview, decision: "maybe" }]).success,
    ).toBe(false);
  });
});

describe("loadClaimReviews", () => {
  test("loads the committed registry, which is empty until the Reviewer engages", () => {
    expect(loadClaimReviews()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run --config vitest.integration.config.ts server/test/clinical-registries.test.ts`
Expected: FAIL — the schema and loader do not exist.

- [ ] **Step 3: Implement the schema**

Create `packages/shared/src/clinical-review.ts`:

```ts
import { z } from "zod";

/**
 * Clinical sign-offs (design spec §4).
 *
 * The Reviewer has no login and may never have one, so she is recorded as
 * DATA — name, credential, the date she signed, and a pointer to the artifact
 * she actually signed — while `recordedByUserId` records the authenticated
 * person who transcribed it. The honest claim the record makes is "Dan
 * recorded that Reviewer X approved claim Y per this memo", which is weaker
 * than "X approved Y" and is the true statement.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const claimReviewSchema = z.object({
  scenarioSlug: z.string().min(1),
  claimRef: z.string().min(1),
  /** Binds to content, not to a scenario version. */
  claimHash: z.string().regex(/^[a-f0-9]{64}$/),
  decision: z.enum(["approved", "rejected"]),
  note: z.string().min(1).nullable().default(null),
  reviewerName: z.string().min(1),
  reviewerCredential: z.string().min(1),
  reviewedAt: z.string().regex(ISO_DATE),
  /** The artifact she signed. A sign-off with no artifact is hearsay. */
  attestationRef: z.string().min(1),
  /** Optional reviewer-set time-box. */
  validUntil: z.string().regex(ISO_DATE).nullable().default(null),
  recordedByUserId: z.string().min(1),
});

export type ClaimReview = z.infer<typeof claimReviewSchema>;

/**
 * Append-only by discipline and by git, not by database trigger. A changed
 * mind is a new entry; the LAST entry for a given ref and hash wins.
 */
export const claimReviewRegistrySchema = z.array(claimReviewSchema);
```

Add to `packages/shared/src/index.ts`:

```ts
export {
  claimReviewRegistrySchema,
  claimReviewSchema,
  type ClaimReview,
} from "./clinical-review.js";
```

- [ ] **Step 4: Create the empty registry**

Create `clinical/reviews.json`:

```json
[]
```

- [ ] **Step 5: Implement the loader**

Append to `server/clinical/registries.ts`:

```ts
import { claimReviewRegistrySchema, type ClaimReview } from "@vetcrew/shared";

/** Empty until the Reviewer engages. Order is append order: last wins. */
export function loadClaimReviews(): ClaimReview[] {
  const raw: unknown = JSON.parse(readFileSync(join(CLINICAL_DIR, "reviews.json"), "utf8"));
  const parsed = claimReviewRegistrySchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`invalid clinical/reviews.json: ${parsed.error.message}`);
  }
  return parsed.data;
}
```

Merge the `@vetcrew/shared` import with the existing one rather than adding a second import statement.

- [ ] **Step 6: Run and commit**

Run: `pnpm exec vitest run --config vitest.integration.config.ts server/test/clinical-registries.test.ts && pnpm typecheck`
Expected: all PASS.

```bash
git add packages/shared/src/clinical-review.ts packages/shared/src/index.ts \
        clinical/reviews.json server/clinical/registries.ts \
        server/test/clinical-registries.test.ts
git commit -m "feat(clinical): review registry schema and loader

Reviewer recorded as data, attestor as auth, because she has no login. An
attestation reference is required — a sign-off with no artifact is hearsay.
Registry ships empty; git provides the append-only audit trail."
```

---

## Task 7: Status derivation

**Files:**
- Create: `server/clinical/claim-status.ts`
- Create: `server/test/clinical-claim-status.test.ts`

**Interfaces:**
- Consumes: `ClaimReview`, `ClaimSource`, `ClinicalSource` from `@vetcrew/shared`.
- Produces:
  - `type ClaimStatus = "unreviewed" | "approved" | "rejected" | "stale_content" | "stale_source" | "expired"`
  - `deriveClaimStatus(args: { currentHash: string; reviews: readonly ClaimReview[]; source: ClaimSource; sources: ReadonlyMap<string, ClinicalSource>; now: Date }): ClaimStatus`

- [ ] **Step 1: Write the failing test**

Create `server/test/clinical-claim-status.test.ts`:

```ts
import type { ClaimReview, ClaimSource, ClinicalSource } from "@vetcrew/shared";
import { describe, expect, test } from "vitest";

import { deriveClaimStatus } from "../clinical/claim-status.js";

const HASH = "a".repeat(64);
const OTHER_HASH = "b".repeat(64);
const NOW = new Date("2026-09-15T00:00:00.000Z");

function review(overrides: Partial<ClaimReview> = {}): ClaimReview {
  return {
    scenarioSlug: "s",
    claimRef: "checklist:x",
    claimHash: HASH,
    decision: "approved",
    note: null,
    reviewerName: "Reviewer X",
    reviewerCredential: "cred",
    reviewedAt: "2026-09-01",
    attestationRef: "artifact.pdf",
    validUntil: null,
    recordedByUserId: "user_dan",
    ...overrides,
  };
}

function source(overrides: Partial<ClinicalSource> = {}): ClinicalSource {
  return {
    id: "recover-2024",
    title: "T",
    publisher: "P",
    edition: "2024",
    url: "https://example.org",
    retrievedAt: "2026-08-03",
    status: "current",
    supersededBy: null,
    ...overrides,
  };
}

const internalSource: ClaimSource = {
  kind: "internal",
  rationale: "Authored for prototyping with no published basis.",
};
const citedSource: ClaimSource = { kind: "cited", sourceId: "recover-2024" };

function derive(args: {
  reviews?: ClaimReview[];
  source?: ClaimSource;
  sources?: ClinicalSource[];
}) {
  return deriveClaimStatus({
    currentHash: HASH,
    reviews: args.reviews ?? [],
    source: args.source ?? internalSource,
    sources: new Map((args.sources ?? [source()]).map((s) => [s.id, s])),
    now: NOW,
  });
}

describe("deriveClaimStatus", () => {
  test("unreviewed when no sign-off has ever existed", () => {
    expect(derive({})).toBe("unreviewed");
  });

  test("approved when the latest sign-off at the current hash approves", () => {
    expect(derive({ reviews: [review()] })).toBe("approved");
  });

  test("rejected when the latest sign-off at the current hash rejects", () => {
    expect(derive({ reviews: [review({ decision: "rejected" })] })).toBe("rejected");
  });

  test("stale_content when sign-offs exist but none at the current hash", () => {
    expect(derive({ reviews: [review({ claimHash: OTHER_HASH })] })).toBe("stale_content");
  });

  test("stale_source when the cited source is superseded", () => {
    expect(
      derive({
        reviews: [review()],
        source: citedSource,
        sources: [source({ status: "superseded", supersededBy: "recover-2028" })],
      }),
    ).toBe("stale_source");
  });

  test("expired when past the reviewer's own time-box", () => {
    expect(derive({ reviews: [review({ validUntil: "2026-09-01" })] })).toBe("expired");
  });

  test("last entry wins — an appended reversal supersedes an earlier decision", () => {
    expect(derive({ reviews: [review(), review({ decision: "rejected" })] })).toBe("rejected");
    expect(derive({ reviews: [review({ decision: "rejected" }), review()] })).toBe("approved");
  });
});

describe("status precedence", () => {
  test("rejected outranks a superseded source", () => {
    expect(
      derive({
        reviews: [review({ decision: "rejected" })],
        source: citedSource,
        sources: [source({ status: "superseded", supersededBy: "x" })],
      }),
    ).toBe("rejected");
  });

  test("stale_content outranks expiry, because a changed claim has no sign-off to expire", () => {
    expect(
      derive({ reviews: [review({ claimHash: OTHER_HASH, validUntil: "2026-09-01" })] }),
    ).toBe("stale_content");
  });

  test("expired outranks stale_source", () => {
    expect(
      derive({
        reviews: [review({ validUntil: "2026-09-01" })],
        source: citedSource,
        sources: [source({ status: "superseded", supersededBy: "x" })],
      }),
    ).toBe("expired");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run --config vitest.integration.config.ts server/test/clinical-claim-status.test.ts`
Expected: FAIL — cannot resolve `../clinical/claim-status.js`.

- [ ] **Step 3: Implement derivation**

Create `server/clinical/claim-status.ts`:

```ts
import type { ClaimReview, ClaimSource, ClinicalSource } from "@vetcrew/shared";

/**
 * Six statuses (design spec §4.4). `stale_content` is the one that closes the
 * defect this whole design exists for: today a claim can be edited under a
 * standing approval and nothing notices. Because sign-offs are keyed by
 * reference AND hash, an edited claim stops matching while staying
 * distinguishable from one never examined — "this was reviewed, then it
 * changed" is a different and more alarming statement than "never reviewed".
 */
export type ClaimStatus =
  | "unreviewed"
  | "approved"
  | "rejected"
  | "stale_content"
  | "stale_source"
  | "expired";

export type DeriveClaimStatusArgs = {
  readonly currentHash: string;
  /** Every sign-off for this scenario+claimRef, at ANY hash, in append order. */
  readonly reviews: readonly ClaimReview[];
  readonly source: ClaimSource;
  readonly sources: ReadonlyMap<string, ClinicalSource>;
  readonly now: Date;
};

/**
 * Precedence: rejected, stale_content, expired, stale_source, approved,
 * unreviewed. Rejection outranks everything — a claim a reviewer refused is
 * not rehabilitated by its source staying current. stale_content outranks the
 * expiry checks because a changed claim has no meaningful sign-off to expire.
 */
export function deriveClaimStatus(args: DeriveClaimStatusArgs): ClaimStatus {
  const atCurrentHash = args.reviews.filter((review) => review.claimHash === args.currentHash);
  const latest = atCurrentHash[atCurrentHash.length - 1];

  if (latest?.decision === "rejected") return "rejected";
  if (latest === undefined) {
    return args.reviews.length > 0 ? "stale_content" : "unreviewed";
  }
  if (latest.validUntil !== null && args.now > new Date(`${latest.validUntil}T23:59:59.999Z`)) {
    return "expired";
  }
  if (args.source.kind === "cited") {
    const cited = args.sources.get(args.source.sourceId);
    if (cited?.status === "superseded") return "stale_source";
  }
  return "approved";
}
```

- [ ] **Step 4: Run and commit**

Run: `pnpm exec vitest run --config vitest.integration.config.ts server/test/clinical-claim-status.test.ts`
Expected: all PASS.

```bash
git add server/clinical/claim-status.ts server/test/clinical-claim-status.test.ts
git commit -m "feat(clinical): six-status derivation with explicit precedence

stale_content distinguishes an edited claim from one never reviewed, which is
the defect the whole design exists to close. Rejection outranks everything;
last entry wins so an appended reversal supersedes without deletion."
```

---

## Task 8: Boot-time resolution and the gate indirection

**Files:**
- Create: `server/clinical/scenario-review-status.ts`
- Create: `server/test/clinical-gate.test.ts`
- Modify: `server/index.ts`
- Modify: `server/routes/sessions.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–7, plus `allowUnreviewedScores()` from the evidence-integrity plan's Task 1.
- Produces:
  - `assertClaimSourcesResolvable(scenarios, sources): void`
  - `scenarioReviewStatus(args): { scoreable: boolean; claims: { ref, status }[]; rejected: string[] }`

- [ ] **Step 1: Write the failing test**

Create `server/test/clinical-gate.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { authoredScenarioSchema, type AuthoredScenario, type ClaimReview } from "@vetcrew/shared";
import { describe, expect, test } from "vitest";

import { loadClinicalSources } from "../clinical/registries.js";
import {
  assertClaimSourcesResolvable,
  scenarioReviewStatus,
} from "../clinical/scenario-review-status.js";

const SCENARIOS_DIR = join(import.meta.dirname, "..", "..", "scenarios");

function scenario(): AuthoredScenario {
  return authoredScenarioSchema.parse(
    JSON.parse(readFileSync(join(SCENARIOS_DIR, "base-rung-resp-distress.json"), "utf8")),
  );
}

const sources = loadClinicalSources();

describe("assertClaimSourcesResolvable", () => {
  test("the shipped scenarios resolve", () => {
    expect(() => assertClaimSourcesResolvable([scenario()], sources)).not.toThrow();
  });

  test("an unresolvable sourceId throws", () => {
    const broken = {
      ...scenario(),
      claimSources: {
        ...scenario().claimSources,
        "vital:spo2": { kind: "cited" as const, sourceId: "does-not-exist" },
      },
    };
    expect(() => assertClaimSourcesResolvable([broken], sources)).toThrow(/does-not-exist/);
  });

  test("a withdrawn source throws — retracted guidance must not load", () => {
    const withdrawn = new Map(sources);
    withdrawn.set("recover-2024", { ...sources.get("recover-2024")!, status: "withdrawn" });
    const citing = {
      ...scenario(),
      claimSources: {
        ...scenario().claimSources,
        "vital:spo2": { kind: "cited" as const, sourceId: "recover-2024" },
      },
    };
    expect(() => assertClaimSourcesResolvable([citing], withdrawn)).toThrow(/withdrawn/i);
  });
});

describe("scenarioReviewStatus", () => {
  const now = new Date("2026-09-15T00:00:00.000Z");

  test("today's gate still keys on the boolean", () => {
    const authored = scenario();
    expect(
      scenarioReviewStatus({ authored, reviews: [], sources, now }).scoreable,
    ).toBe(false);
    expect(
      scenarioReviewStatus({
        authored: { ...authored, clinicallyReviewed: true },
        reviews: [],
        sources,
        now,
      }).scoreable,
    ).toBe(true);
  });

  test("a rejected claim blocks even when the boolean is true", () => {
    const authored = { ...scenario(), clinicallyReviewed: true };
    const target = "checklist:no-route-error";
    // Take the hash from the status report itself, so the rejection lands on
    // the claim's CURRENT content rather than on a hand-written hash that
    // would silently read as stale_content instead of rejected.
    const currentHash = scenarioReviewStatus({ authored, reviews: [], sources, now }).claims.find(
      (row) => row.ref === target,
    )?.hash;
    expect(currentHash).toMatch(/^[a-f0-9]{64}$/);

    const rejection: ClaimReview = {
      scenarioSlug: authored.slug,
      claimRef: target,
      claimHash: currentHash as string,
      decision: "rejected",
      note: "Weighting is wrong for this presentation.",
      reviewerName: "Reviewer X",
      reviewerCredential: "cred",
      reviewedAt: "2026-09-01",
      attestationRef: "artifact.pdf",
      validUntil: null,
      recordedByUserId: "user_dan",
    };
    const status = scenarioReviewStatus({ authored, reviews: [rejection], sources, now });
    expect(status.rejected).toEqual([target]);
    expect(status.scoreable).toBe(false);
  });

  test("reports a status for every claim", () => {
    const status = scenarioReviewStatus({ authored: scenario(), reviews: [], sources, now });
    expect(status.claims).toHaveLength(22);
    expect(status.claims.every((c) => c.status === "unreviewed")).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run --config vitest.integration.config.ts server/test/clinical-gate.test.ts`
Expected: FAIL — cannot resolve `../clinical/scenario-review-status.js`.

- [ ] **Step 3: Implement resolution and the gate**

Create `server/clinical/scenario-review-status.ts`:

```ts
import {
  extractClaims,
  type AuthoredScenario,
  type ClaimReview,
  type ClinicalSource,
} from "@vetcrew/shared";

import { claimHash } from "./claim-hash.js";
import { deriveClaimStatus, type ClaimStatus } from "./claim-status.js";

export type ClaimStatusRow = {
  readonly ref: string;
  readonly hash: string;
  readonly status: ClaimStatus;
};

export type ScenarioReviewStatus = {
  readonly scoreable: boolean;
  readonly claims: readonly ClaimStatusRow[];
  readonly rejected: readonly string[];
};

/**
 * Boot-time check. A citation that does not resolve is an authoring error; a
 * citation to WITHDRAWN guidance is worse — the guidance was retracted, so a
 * scenario built on it must refuse to load rather than merely warn.
 */
export function assertClaimSourcesResolvable(
  scenarios: readonly AuthoredScenario[],
  sources: ReadonlyMap<string, ClinicalSource>,
): void {
  for (const scenario of scenarios) {
    for (const [ref, source] of Object.entries(scenario.claimSources)) {
      if (source.kind !== "cited") continue;
      const cited = sources.get(source.sourceId);
      if (cited === undefined) {
        throw new Error(
          `scenario "${scenario.slug}" claim "${ref}" cites unknown source "${source.sourceId}"`,
        );
      }
      if (cited.status === "withdrawn") {
        throw new Error(
          `scenario "${scenario.slug}" claim "${ref}" cites withdrawn source "${source.sourceId}"`,
        );
      }
    }
  }
}

/**
 * The gate indirection. TODAY `scoreable` keys on the authored boolean,
 * tightened by rejections. When the Reviewer engages, the ONLY change is the
 * first conjunct below — replace `authored.clinicallyReviewed` with
 * `claims.every((c) => c.status === "approved")`. The call site in the
 * ratings route never changes and no migration is involved.
 */
export function scenarioReviewStatus(args: {
  readonly authored: AuthoredScenario;
  readonly reviews: readonly ClaimReview[];
  readonly sources: ReadonlyMap<string, ClinicalSource>;
  readonly now: Date;
}): ScenarioReviewStatus {
  const forScenario = args.reviews.filter((r) => r.scenarioSlug === args.authored.slug);
  const claims: ClaimStatusRow[] = extractClaims(args.authored).map((claim) => {
    const hash = claimHash(args.authored.slug, claim);
    const source = args.authored.claimSources[claim.ref];
    if (source === undefined) {
      // Unreachable: authoredScenarioSchema enforces set equality.
      throw new Error(`claim "${claim.ref}" has no source after schema validation`);
    }
    return {
      ref: claim.ref,
      hash,
      status: deriveClaimStatus({
        currentHash: hash,
        reviews: forScenario.filter((r) => r.claimRef === claim.ref),
        source,
        sources: args.sources,
        now: args.now,
      }),
    };
  });
  const rejected = claims.filter((c) => c.status === "rejected").map((c) => c.ref);
  return {
    scoreable: args.authored.clinicallyReviewed && rejected.length === 0,
    claims,
    rejected,
  };
}
```

- [ ] **Step 4: Wire it into boot**

In `server/index.ts`, inside `boot()` immediately after `await syncScenarios(...)`:

```ts
    const scenarioFiles = loadScenarioFiles();
    const clinicalSources = loadClinicalSources();
    const claimReviews = loadClaimReviews();
    assertClaimSourcesResolvable(scenarioFiles, clinicalSources);
```

Reuse the already-loaded list rather than calling `loadScenarioFiles()` twice — hoist the existing call at line 71 into `scenarioFiles` and pass it to `syncScenarios`.

Pass the registries into the session router options:

```ts
      createSessionRouter(db, tenantId, {
        authEnabled,
        readAuth,
        clinicalSources,
        claimReviews,
      }),
```

- [ ] **Step 5: Wire it into the ratings gate**

In `server/routes/sessions.ts`, extend the router options type with `clinicalSources?: ReadonlyMap<string, ClinicalSource>` and `claimReviews?: readonly ClaimReview[]`, both defaulting to an empty map and array so existing tests that construct the router with two arguments keep working.

Replace the gate at lines 466–472. The scenario definition is already stored as jsonb, so the authored form is available without a second file read:

```ts
    const authoredForGate = authoredScenarioSchema.parse(scenarioRow.definition);
    const reviewStatus = scenarioReviewStatus({
      authored: authoredForGate,
      reviews: claimReviews,
      sources: clinicalSources,
      now: new Date(),
    });
    if (!reviewStatus.scoreable && !allowUnreviewedScores()) {
      res.status(403).json({
        error: "scenario_not_clinically_reviewed",
        ...(reviewStatus.rejected.length > 0 ? { rejectedClaims: reviewStatus.rejected } : {}),
      });
      return;
    }
```

This requires selecting `definition` alongside `clinicallyReviewed` in the query at lines 457–460.

Note that a **rejected** claim blocks regardless of `allowUnreviewedScores()` only if you want it to. It does not here, deliberately: the escape hatch is CI-and-local-only and already refuses in production, so leaving one gate rather than two keeps the logic legible.

- [ ] **Step 6: Run everything**

Run: `pnpm typecheck && pnpm test && pnpm test:integration && pnpm test:e2e`
Expected: all pass. Both scenarios remain `clinicallyReviewed: false` with zero reviews, so behaviour is byte-identical to before.

- [ ] **Step 7: Commit**

```bash
git add server/clinical/scenario-review-status.ts server/test/clinical-gate.test.ts \
        server/index.ts server/routes/sessions.ts
git commit -m "feat(clinical): boot-time source resolution and the gate indirection

The gate reads scenarioReviewStatus() instead of the boolean directly, so the
future switch to claim-level is one conjunct rather than a project. The
granular layer can only tighten: a withdrawn source fails at load and a
rejected claim blocks regardless of the boolean."
```

---

## Task 9: Provenance report and engine isolation

**Files:**
- Create: `scripts/clinical-provenance-report.ts`
- Create: `server/test/clinical-engine-isolation.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: everything above.
- Produces: the `clinical:report` script.

- [ ] **Step 1: Write the failing engine isolation test**

This is the test that guarantees a citation change can never alter a simulation. Create `server/test/clinical-engine-isolation.test.ts`:

```ts
import { replay } from "@vetcrew/engine";
import { authoredScenarioSchema, type AuthoredScenario } from "@vetcrew/shared";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

import { compileScenario } from "../scenarios.js";

const SCENARIOS_DIR = join(import.meta.dirname, "..", "..", "scenarios");

function scenario(): AuthoredScenario {
  return authoredScenarioSchema.parse(
    JSON.parse(readFileSync(join(SCENARIOS_DIR, "base-rung-resp-distress.json"), "utf8")),
  );
}

describe("provenance never reaches the engine", () => {
  test("compileScenario output contains no provenance", () => {
    const compiled = compileScenario(scenario());
    expect(JSON.stringify(compiled)).not.toContain("claimSources");
    expect(JSON.stringify(compiled)).not.toContain("rationale");
    expect(JSON.stringify(compiled)).not.toContain("floor_observation");
  });

  test("replay is byte-identical with and without provenance", () => {
    const withProvenance = scenario();
    const { claimSources: _stripped, ...withoutProvenance } = withProvenance;
    const events = [
      { type: "phase_change" as const, phase: "running" as const, seq: 1 },
      { type: "tick" as const, dtMs: 1000, seq: 2 },
      { type: "tick" as const, dtMs: 1000, seq: 3 },
    ];
    const a = replay(424242, events, compileScenario(withProvenance));
    const b = replay(424242, events, compileScenario(withoutProvenance as AuthoredScenario));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
```

- [ ] **Step 2: Run it to verify it passes immediately**

Run: `pnpm exec vitest run --config vitest.integration.config.ts server/test/clinical-engine-isolation.test.ts`
Expected: PASS on the first run. This is a regression guard rather than a red-green cycle — `compileScenario` never copies `claimSources`, and this test is what keeps that true when someone edits it later.

- [ ] **Step 3: Write the report script**

Create `scripts/clinical-provenance-report.ts`:

```ts
import { extractClaims } from "@vetcrew/shared";

import { loadClaimReviews, loadClinicalSources } from "../server/clinical/registries.js";
import { scenarioReviewStatus } from "../server/clinical/scenario-review-status.js";
import { loadScenarioFiles } from "../server/scenarios.js";

/**
 * Turns clinical debt into a number you can read. Reporting, not gating:
 * gating on "zero internal claims" would block the workflow this design keeps
 * unblocked, and the schema union already makes silence impossible.
 */
const sources = loadClinicalSources();
const reviews = loadClaimReviews();
const now = new Date();

let totalInternal = 0;

for (const authored of loadScenarioFiles()) {
  const claims = extractClaims(authored);
  const byKind = { cited: 0, floor_observation: 0, internal: 0 };
  for (const claim of claims) {
    const source = authored.claimSources[claim.ref];
    if (source !== undefined) byKind[source.kind] += 1;
  }
  totalInternal += byKind.internal;

  const status = scenarioReviewStatus({ authored, reviews, sources, now });
  const byStatus = new Map<string, number>();
  for (const row of status.claims) {
    byStatus.set(row.status, (byStatus.get(row.status) ?? 0) + 1);
  }

  console.log(`\n${authored.slug} @ ${authored.version} — ${claims.length} claims`);
  console.log(
    `  provenance: ${byKind.cited} cited, ${byKind.floor_observation} floor observation, ${byKind.internal} internal`,
  );
  console.log(
    `  review:     ${[...byStatus].map(([k, v]) => `${v} ${k}`).join(", ")}`,
  );
  if (status.rejected.length > 0) {
    console.log(`  REJECTED:   ${status.rejected.join(", ")}`);
  }
}

console.log(`\n${totalInternal} claims across all scenarios have no external source.`);
```

Add to `package.json` scripts, after `i18n:check`:

```json
    "clinical:report": "tsx scripts/clinical-provenance-report.ts",
```

- [ ] **Step 4: Run the report**

Run: `pnpm clinical:report`
Expected output, which is the honest current state — zero cited is correct, not a failure:

```
base-rung-resp-distress @ 0.1.0 — 22 claims
  provenance: 0 cited, 3 floor observation, 19 internal
  review:     22 unreviewed

base-rung-stepped-tasks @ 0.1.0 — 14 claims
  provenance: 0 cited, 1 floor observation, 13 internal
  review:     14 unreviewed

32 claims across all scenarios have no external source.
```

- [ ] **Step 5: Add the report to CI**

In `.github/workflows/ci.yml`, add after the `pnpm i18n:check` step in the first job:

```yaml
      - run: pnpm clinical:report
```

It prints and exits zero. It is there so the number is visible in every build, not to fail one.

- [ ] **Step 6: Run every gate and commit**

Run: `pnpm typecheck && pnpm test && pnpm test:integration && pnpm test:e2e && pnpm i18n:check && pnpm guard:deps && pnpm guard:dead && pnpm clinical:report && pnpm build`
Expected: all pass.

```bash
git add scripts/clinical-provenance-report.ts package.json .github/workflows/ci.yml \
        server/test/clinical-engine-isolation.test.ts
git commit -m "feat(clinical): provenance report and engine isolation guard

The report turns clinical debt into a number printed on every build: today
32 of 36 claims have no external source, which is the honest state. The
isolation test guarantees provenance can never reach EngineState, so a
citation edit can never alter a replay."
```

---

## Self-Review

**Spec coverage.** Every section maps to a task. Spec §2.1–2.2 claim types and references to Task 1; §2.3 denylist to Tasks 1 and 2; §2.4 granularity floor is inherent in Task 1's per-element extraction; §2.5 arithmetic to Task 5; §3.1 provenance union and §3.3 source registry to Task 3; §3.2 root map to Task 4; §3.4 schema placement is honoured by Task 1 living in shared and Task 2 in server; §4.1 content binding to Task 2; §4.2 reviewer/attestor to Task 6; §4.3 file-first to Tasks 3 and 6; §4.4 statuses and precedence to Task 7; §5.1 gate indirection and §5.2 tightening to Task 8; §5.3 report to Task 9. All ten acceptance criteria are covered — criterion 7 by Task 9's isolation test, criterion 10 by Task 9 Step 6.

**Type consistency.** `Claim` and `ClaimType` are defined in Task 1 and consumed unchanged in Tasks 2, 8, and 9. `ClaimSource` and `ClinicalSource` are defined in Task 3 and consumed in Tasks 4, 7, and 8. `ClaimReview` is defined in Task 6 and consumed in Tasks 7 and 8. `claimHash(scenarioSlug, claim)` keeps the same two-argument shape everywhere. `deriveClaimStatus` takes the same named-argument object in Task 7 and Task 8. `scenarioReviewStatus` returns `claims` rows carrying `ref`, `hash`, and `status`, and Task 8's test reads `.hash` off them — consistent with the type.

**Three things to watch during execution.**

Task 8 Step 5 assumes `allowUnreviewedScores()` exists from the evidence-integrity plan's Task 1. If that plan has not landed, either land it first or inline the environment read and leave a comment pointing at it — do not silently duplicate the production guard.

Task 8 Step 4 requires hoisting the existing `loadScenarioFiles()` call in `server/index.ts` rather than calling it twice. Read that line before editing; calling it twice would parse and validate every scenario file a second time at every boot.

Task 4's `superRefine` addition casts `scenario as AuthoredScenario` to call `extractClaims`. That cast is necessary because Zod's refine callback sees the pre-transform shape, and it is safe because every field `extractClaims` touches has already been validated by the object schema. If TypeScript objects, widen `extractClaims` to accept a structural subset rather than removing the cast.
