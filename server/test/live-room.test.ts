import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { createDb } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { RoomRegistry } from "../live/room-registry.js";
import { loadScenarioFiles, syncScenarios } from "../scenarios.js";
import { ensurePilotTenant } from "../tenancy.js";
import { and, eq } from "drizzle-orm";

import { scenarios, simSessions } from "../db/schema/index.js";

const TEST_DATABASE_URL =
  process.env["TEST_DATABASE_URL"] ?? "postgres://localhost:5432/vetcrew_test";

const SCENARIO_SLUG = "base-rung-stepped-tasks";

let pool: ReturnType<typeof createDb>["pool"];
let db: ReturnType<typeof createDb>["db"];
let tenantId: string;
let registry: RoomRegistry;

beforeAll(async () => {
  const dbName = new URL(TEST_DATABASE_URL).pathname.replace(/^\//, "");
  if (!/test/i.test(dbName)) {
    throw new Error(`TEST_DATABASE_URL database "${dbName}" does not look like a test database`);
  }
  ({ pool, db } = createDb(TEST_DATABASE_URL));
  // Schema already set up by integration suite when run together; recreate if empty.
  await runMigrations(pool);
  tenantId = await ensurePilotTenant(db);
  await syncScenarios(db, tenantId, loadScenarioFiles());
  registry = new RoomRegistry(db);
});

afterAll(async () => {
  registry.disposeAll();
  await pool.end();
});

async function createSteppedSession(): Promise<string> {
  const scenarioRows = await db
    .select({ id: scenarios.id, version: scenarios.version })
    .from(scenarios)
    .where(and(eq(scenarios.tenantId, tenantId), eq(scenarios.slug, SCENARIO_SLUG)));
  const scenario = scenarioRows[0];
  if (scenario === undefined) throw new Error("stepped scenario missing — Dev-1 gate failed");
  const inserted = await db
    .insert(simSessions)
    .values({
      tenantId,
      scenarioId: scenario.id,
      scenarioVersion: scenario.version,
      seed: 42,
      traineeId: "live-trainee",
      traineeTimeInTrainingDays: 30,
    })
    .returning({ id: simSessions.id });
  const id = inserted[0]?.id;
  if (id === undefined) throw new Error("failed to create session");
  return id;
}

describe("SessionRoom", () => {
  test("hydrate + intents: server stamps seq, roleView strips expected answers", async () => {
    const sessionId = await createSteppedSession();
    const room = await registry.getOrCreate(tenantId, sessionId);
    expect(room).not.toBeNull();
    if (room === null) return;

    // Batch through running → task_start → paused so the tick loop never races seq.
    const { events } = await room.applyIntent([
      { type: "phase_change", phase: "briefing" },
      { type: "phase_change", phase: "running" },
      {
        type: "task_start",
        role: "technician",
        actorId: "live-trainee",
        taskId: "t1",
      },
      { type: "phase_change", phase: "paused" },
    ]);
    expect(events).toHaveLength(4);
    expect(events.every((e, i) => e.seq === i + 1)).toBe(true);
    expect(room.phase).toBe("paused");

    const view = room.project("technician");
    expect(view.seq).toBe(4);
    expect(view.scenarioSlug).toBe(SCENARIO_SLUG);
    const t1 = view.tasks.find((t) => t.id === "t1");
    expect(t1?.lifecycle).toBe("in_progress");
    // Leak gate: expected ranges must never appear in the projected body.
    expect(JSON.stringify(t1?.body)).not.toMatch(/expectedMin|expectedMax/);

    registry.dispose(sessionId);
  });

  test("re-hydrate yields the same appliedSeq as the live room left", async () => {
    const sessionId = await createSteppedSession();
    const room = await registry.getOrCreate(tenantId, sessionId);
    if (room === null) throw new Error("room missing");
    await room.applyIntent([
      { type: "phase_change", phase: "briefing" },
      { type: "phase_change", phase: "running" },
      {
        type: "task_start",
        role: "technician",
        actorId: "live-trainee",
        taskId: "t1",
      },
      { type: "phase_change", phase: "paused" },
    ]);
    const seq = room.appliedSeq;
    registry.dispose(sessionId);

    const again = await registry.getOrCreate(tenantId, sessionId);
    expect(again?.appliedSeq).toBe(seq);
    expect(again?.phase).toBe("paused");
    registry.dispose(sessionId);
  });
});
