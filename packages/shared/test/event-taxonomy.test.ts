import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import { engineEventBodySchema } from "../src/event-bodies.js";

/**
 * Doctrine parity: docs/doctrines/event-taxonomy.md is the authoritative registry
 * of what may enter the event log; engineEventBodySchema is the runtime gate.
 * Worktrees isolate files, not vocabulary — this test is what makes a divergence
 * between the two a CI failure instead of a silent doctrine break.
 * Same idiom as scripts/check-i18n-parity.ts, placed as a package test so it runs
 * under `pnpm test` with zero CI workflow changes.
 */

const DOC_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../docs/doctrines/event-taxonomy.md",
);

function documentedEventTypes(markdown: string): string[] {
  const section = markdown.split("## Engine event types")[1]?.split("\n## ")[0];
  if (section === undefined) return [];
  return [...section.matchAll(/^- `([a-z_]+)`/gm)].map((m) => m[1] as string);
}

function runtimeEventTypes(): string[] {
  return engineEventBodySchema.options.map(
    (option) => option.shape.type.value as string,
  );
}

describe("event taxonomy doctrine parity", () => {
  test("the doc's registry and the runtime schema agree exactly", () => {
    const doc = documentedEventTypes(readFileSync(DOC_PATH, "utf8"));
    const runtime = runtimeEventTypes();
    expect(doc.length).toBeGreaterThan(0);
    // Sorted set equality both ways, so the failure message names the drifted side.
    expect([...doc].sort()).toEqual([...runtime].sort());
  });

  test("no duplicate registrations in the doc", () => {
    const doc = documentedEventTypes(readFileSync(DOC_PATH, "utf8"));
    expect(new Set(doc).size).toBe(doc.length);
  });
});
