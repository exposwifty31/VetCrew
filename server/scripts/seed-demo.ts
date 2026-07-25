import type { EngineEvent } from "@vetcrew/engine";
import { and, eq } from "drizzle-orm";

import { createDb } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { scenarios, sessionEvents, simSessions } from "../db/schema/index.js";
import { loadEnv } from "../env.js";
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

function buildDemoEvents(): EngineEvent[] {
  const events: EngineEvent[] = [];
  let seq = 0;
  let timeMs = 0;
  const tick = (upToMs: number) => {
    while (timeMs < upToMs) {
      events.push({ seq: ++seq, type: "tick", dtMs: 5000 });
      timeMs += 5000;
    }
  };
  const act = (action: string) => {
    events.push({ seq: ++seq, type: "action", role: "technician", actorId: "demo-trainee", action });
  };

  events.push({ seq: ++seq, type: "phase_change", phase: "briefing" });
  events.push({ seq: ++seq, type: "phase_change", phase: "running" });
  tick(10_000);
  act("vitals_callout");
  tick(25_000);
  act("oxygen_on");
  tick(45_000);
  act("iv_access_attempt"); // priority inversion: airway/pulses not yet checked
  tick(55_000);
  act("airway_pulses_check");
  tick(60_000);
  events.push({ seq: ++seq, type: "injection", injection: "monitor_artifact" });
  tick(90_000);
  act("give_drug_sc");
  tick(120_000);
  events.push({ seq: ++seq, type: "phase_change", phase: "debrief" });
  return events;
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

  const authored = scenarioFiles[0];
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
      phase: "debrief",
      traineeId: "demo-trainee",
      traineeTimeInTrainingDays: 180,
      startedAt: new Date(),
    })
    .returning({ id: simSessions.id });
  const session = inserted[0];
  if (session === undefined) throw new Error("failed to create session");

  const events = buildDemoEvents();
  await db.insert(sessionEvents).values(
    events.map((event) => ({
      tenantId,
      sessionId: session.id,
      seq: event.seq,
      type: event.type,
      role: event.type === "action" ? event.role : null,
      actorId: event.type === "action" ? event.actorId : null,
      payload: event,
    })),
  );

  console.log(`demo session seeded: ${session.id} (${events.length} events)`);
  console.log(`AAR: http://localhost:5173/#/aar/${session.id}`);
  await pool.end();
}

void main();
