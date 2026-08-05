import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { ScenarioDef } from "@vetcrew/engine";
import { authoredScenarioSchema, type AuthoredScenario } from "@vetcrew/shared";

import type { Db } from "./db/client.js";
import { scenarios } from "./db/schema/index.js";

const SCENARIOS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "scenarios");

/** Load + validate every authored scenario file. Invalid files fail boot loudly. */
export function loadScenarioFiles(): AuthoredScenario[] {
  return readdirSync(SCENARIOS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((file) => {
      const raw: unknown = JSON.parse(readFileSync(join(SCENARIOS_DIR, file), "utf8"));
      const parsed = authoredScenarioSchema.safeParse(raw);
      if (!parsed.success) {
        throw new Error(`invalid scenario ${file}: ${parsed.error.message}`);
      }
      return parsed.data;
    });
}

/** Compile the authored form to the engine-consumable ScenarioDef. */
export function compileScenario(authored: AuthoredScenario): ScenarioDef {
  return {
    slug: authored.slug,
    version: authored.version,
    species: authored.species,
    roles: authored.roles,
    injections: authored.injections,
    vitals: authored.engine.vitals,
    triggers: authored.engine.triggers,
    ...(authored.tasks.length > 0 ? { tasks: authored.tasks } : {}),
  };
}

/** Upsert scenario rows on boot; (tenant, slug, version) is the natural key. */
export async function syncScenarios(
  db: Db,
  tenantId: string,
  authoredList: AuthoredScenario[],
): Promise<void> {
  for (const authored of authoredList) {
    await db
      .insert(scenarios)
      .values({
        tenantId,
        slug: authored.slug,
        version: authored.version,
        mode: authored.mode,
        clinicallyReviewed: authored.clinicallyReviewed,
        clinicalReviewer: authored.clinicalReviewer,
        definition: authored,
      })
      .onConflictDoUpdate({
        target: [scenarios.tenantId, scenarios.slug, scenarios.version],
        set: {
          mode: authored.mode,
          clinicallyReviewed: authored.clinicallyReviewed,
          clinicalReviewer: authored.clinicalReviewer,
          definition: authored,
        },
      });
  }
}
