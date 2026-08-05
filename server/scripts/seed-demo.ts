import type { EngineEventBody } from "@vetcrew/shared";
import { and, eq } from "drizzle-orm";

import { createDb } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { scenarios, simSessions } from "../db/schema/index.js";
import { loadEnv } from "../env.js";
import { appendSessionEvents } from "../live/event-append.js";
import { loadScenarioFiles, syncScenarios } from "../scenarios.js";
import { ensurePilotTenant } from "../tenancy.js";

/**
 * Seeds a complete demo run of the base-rung scenario so the AAR has real
 * content before the trainee station exists (Sprint 3). The run is imperfect
 * on purpose: the trainee attempts IV access BEFORE checking airway/pulses
 * (the recorded priority-inversion floor failure) — so the checklist shows a
 * failed item with evidence, which is the whole point of the surface.
 */

const DEMO_SEED = 20260725;

function buildDemoBodies(): EngineEventBody[] {
  const bodies: EngineEventBody[] = [];
  let timeMs = 0;
  const tick = (upToMs: number) => {
    while (timeMs < upToMs) {
      bodies.push({ type: "tick", dtMs: 5000 });
      timeMs += 5000;
    }
  };
  const act = (action: string) => {
    bodies.push({ type: "action", role: "technician", actorId: "demo-trainee", action });
  };

  bodies.push({ type: "phase_change", phase: "briefing" });
  bodies.push({ type: "phase_change", phase: "running" });
  tick(10_000);
  act("vitals_callout");
  tick(25_000);
  act("oxygen_on");
  tick(45_000);
  act("iv_access_attempt"); // priority inversion: airway/pulses not yet checked
  tick(55_000);
  act("airway_pulses_check");
  tick(60_000);
  bodies.push({ type: "injection", injection: "monitor_artifact" });
  tick(90_000);
  act("give_drug_sc");
  tick(120_000);
  bodies.push({ type: "phase_change", phase: "debrief" });
  return bodies;
}

async function main() {
  const env = loadEnv();
  if (env.DATABASE_URL === undefined) {
    throw new Error("DATABASE_URL required for seeding");
  }
  const { pool, db } = createDb(env.DATABASE_URL);
  await runMigrations(pool);
  const tenantId = await ensurePilotTenant(db);
  const scenarioFiles = loadScenarioFiles();
  await syncScenarios(db, tenantId, scenarioFiles);

  // Prefer the demo real-time scenario for the AAR seed (not the stepped station).
  const authored =
    scenarioFiles.find((s) => s.slug === "base-rung-resp-distress") ?? scenarioFiles[0];
  if (authored === undefined) throw new Error("no scenarios found");

  const scenarioRows = await db
    .select({ id: scenarios.id })
    .from(scenarios)
    .where(
      and(
        eq(scenarios.tenantId, tenantId),
        eq(scenarios.slug, authored.slug),
        eq(scenarios.version, authored.version),
      ),
    );
  const scenarioRow = scenarioRows[0];
  if (scenarioRow === undefined) throw new Error("scenario row missing after sync");

  const inserted = await db
    .insert(simSessions)
    .values({
      tenantId,
      scenarioId: scenarioRow.id,
      scenarioVersion: authored.version,
      seed: DEMO_SEED,
      phase: "draft",
      traineeId: "demo-trainee",
      startedAt: new Date(),
    })
    .returning({ id: simSessions.id });
  const session = inserted[0];
  if (session === undefined) throw new Error("failed to create session");

  const bodies = buildDemoBodies();
  const result = await appendSessionEvents(db, {
    tenantId,
    sessionId: session.id,
    bodies,
  });
  if (result.kind !== "ok") throw new Error("failed to append demo events");

  console.log(`demo session seeded: ${session.id} (${result.events.length} events)`);
  console.log(`AAR: http://localhost:5173/#/aar/${session.id}`);
  await pool.end();
}

void main();
