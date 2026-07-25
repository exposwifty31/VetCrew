import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { LIVE_EVENTS } from "@vetcrew/shared";
import express from "express";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { and, eq } from "drizzle-orm";

import { createDb } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { scenarios, simSessions } from "../db/schema/index.js";
import { RoomRegistry } from "../live/room-registry.js";
import { attachLiveSocket, STATION_SCENARIO_SLUG } from "../live/socket.js";
import { createSessionRouter } from "../routes/sessions.js";
import { loadScenarioFiles, syncScenarios } from "../scenarios.js";
import { ensurePilotTenant } from "../tenancy.js";

const TEST_DATABASE_URL =
  process.env["TEST_DATABASE_URL"] ?? "postgres://localhost:5432/vetcrew_test";

let pool: ReturnType<typeof createDb>["pool"];
let db: ReturnType<typeof createDb>["db"];
let tenantId: string;
let baseUrl: string;
let registry: RoomRegistry;
let httpServer: ReturnType<typeof createServer>;

beforeAll(async () => {
  const dbName = new URL(TEST_DATABASE_URL).pathname.replace(/^\//, "");
  if (!/test/i.test(dbName)) {
    throw new Error(`TEST_DATABASE_URL database "${dbName}" does not look like a test database`);
  }
  ({ pool, db } = createDb(TEST_DATABASE_URL));
  await runMigrations(pool);
  tenantId = await ensurePilotTenant(db);
  await syncScenarios(db, tenantId, loadScenarioFiles());

  const app = express();
  app.use(express.json());
  app.use("/api/sessions", createSessionRouter(db, tenantId));
  httpServer = createServer(app);
  registry = new RoomRegistry(db);
  attachLiveSocket(httpServer, {
    tenantId,
    registry,
    allowDevBypass: true,
  });
  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => resolve());
  });
  baseUrl = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
});

afterAll(async () => {
  registry.disposeAll();
  await new Promise<void>((resolve, reject) => {
    httpServer.close((err) => (err ? reject(err) : resolve()));
  });
  await pool.end();
});

async function createSteppedSession(): Promise<string> {
  const scenarioRows = await db
    .select({ id: scenarios.id, version: scenarios.version })
    .from(scenarios)
    .where(and(eq(scenarios.tenantId, tenantId), eq(scenarios.slug, STATION_SCENARIO_SLUG)));
  const scenario = scenarioRows[0];
  if (scenario === undefined) throw new Error("stepped scenario missing");
  const inserted = await db
    .insert(simSessions)
    .values({
      tenantId,
      scenarioId: scenario.id,
      scenarioVersion: scenario.version,
      seed: 7,
      traineeId: "socket-trainee",
      traineeTimeInTrainingDays: 14,
    })
    .returning({ id: simSessions.id });
  const id = inserted[0]?.id;
  if (id === undefined) throw new Error("session insert failed");
  return id;
}

function connectClient(): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(baseUrl, {
      path: "/socket.io",
      transports: ["websocket"],
      forceNew: true,
    });
    socket.on("connect", () => resolve(socket));
    socket.on("connect_error", reject);
  });
}

describe("live socket", () => {
  test("join → snapshot; intent without seq advances roleView.seq", async () => {
    const sessionId = await createSteppedSession();
    const socket = await connectClient();
    try {
      const snapshot = await new Promise<{ seq: number; roleView: { seq: number; phase: string } }>(
        (resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("snapshot timeout")), 5000);
          socket.on(LIVE_EVENTS.snapshot, (frame) => {
            clearTimeout(timer);
            resolve(frame as { seq: number; roleView: { seq: number; phase: string } });
          });
          socket.emit(LIVE_EVENTS.join, {
            sessionId,
            role: "technician",
            actorId: "socket-trainee",
          });
        },
      );
      expect(snapshot.roleView.phase).toBe("draft");
      expect(snapshot.seq).toBe(0);

      const after = await new Promise<{ seq: number; roleView: { phase: string; seq: number } }>(
        (resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("intent snapshot timeout")), 5000);
          socket.on(LIVE_EVENTS.snapshot, (frame) => {
            const typed = frame as { seq: number; roleView: { phase: string; seq: number } };
            if (typed.roleView.phase === "briefing") {
              clearTimeout(timer);
              resolve(typed);
            }
          });
          socket.emit(LIVE_EVENTS.intent, { type: "phase_change", phase: "briefing" });
        },
      );
      expect(after.seq).toBe(1);
      expect(after.roleView.seq).toBe(1);
    } finally {
      socket.disconnect();
      registry.dispose(sessionId);
    }
  });

  test("intent with seq is rejected", async () => {
    const sessionId = await createSteppedSession();
    const socket = await connectClient();
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("join timeout")), 5000);
        socket.on(LIVE_EVENTS.snapshot, () => {
          clearTimeout(timer);
          resolve();
        });
        socket.emit(LIVE_EVENTS.join, { sessionId, role: "technician" });
      });

      const reject = await new Promise<{ code: string; message: string }>((resolve, rejectPromise) => {
        const timer = setTimeout(() => rejectPromise(new Error("reject timeout")), 5000);
        socket.on(LIVE_EVENTS.reject, (raw) => {
          clearTimeout(timer);
          resolve(raw as { code: string; message: string });
        });
        socket.emit(LIVE_EVENTS.intent, { type: "phase_change", phase: "briefing", seq: 99 });
      });
      expect(reject.code).toBe("validation");
      expect(reject.message).toMatch(/seq/);
    } finally {
      socket.disconnect();
      registry.dispose(sessionId);
    }
  });

  test("join on demo scenario is rejected", async () => {
    const scenarioRows = await db
      .select({ id: scenarios.id, version: scenarios.version })
      .from(scenarios)
      .where(and(eq(scenarios.tenantId, tenantId), eq(scenarios.slug, "base-rung-resp-distress")));
    const scenario = scenarioRows[0];
    if (scenario === undefined) throw new Error("demo scenario missing");
    const inserted = await db
      .insert(simSessions)
      .values({
        tenantId,
        scenarioId: scenario.id,
        scenarioVersion: scenario.version,
        seed: 1,
        traineeTimeInTrainingDays: 1,
      })
      .returning({ id: simSessions.id });
    const sessionId = inserted[0]?.id;
    if (sessionId === undefined) throw new Error("insert failed");

    const socket = await connectClient();
    try {
      const reject = await new Promise<{ code: string }>((resolve, rejectPromise) => {
        const timer = setTimeout(() => rejectPromise(new Error("reject timeout")), 5000);
        socket.on(LIVE_EVENTS.reject, (raw) => {
          clearTimeout(timer);
          resolve(raw as { code: string });
        });
        socket.emit(LIVE_EVENTS.join, { sessionId, role: "technician" });
      });
      expect(reject.code).toBe("scenario");
    } finally {
      socket.disconnect();
    }
  });
});
