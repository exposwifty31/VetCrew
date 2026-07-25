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
import { ensurePilotTenant } from "../tenancy.js";
import { loadScenarioFiles, syncScenarios } from "../scenarios.js";

const TEST_DATABASE_URL =
  process.env["TEST_DATABASE_URL"] ?? "postgres://localhost:5432/vetcrew_test";

/**
 * Production-shaped socket: allowDevBypass=false must reject joins until
 * Clerk → role_stations binding ships (Security veto).
 */
describe("live socket authz (no bypass)", () => {
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
    httpServer = createServer(app);
    registry = new RoomRegistry(db);
    attachLiveSocket(httpServer, {
      tenantId,
      registry,
      allowDevBypass: false,
      corsOrigin: false,
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

  test("join is rejected with auth code when bypass is off", async () => {
    const scenarioRows = await db
      .select({ id: scenarios.id, version: scenarios.version })
      .from(scenarios)
      .where(and(eq(scenarios.tenantId, tenantId), eq(scenarios.slug, STATION_SCENARIO_SLUG)));
    const scenario = scenarioRows[0];
    if (scenario === undefined) throw new Error("scenario missing");
    const inserted = await db
      .insert(simSessions)
      .values({
        tenantId,
        scenarioId: scenario.id,
        scenarioVersion: scenario.version,
        seed: 11,
        traineeId: "authz-trainee",
        traineeTimeInTrainingDays: 7,
      })
      .returning({ id: simSessions.id });
    const sessionId = inserted[0]?.id;
    if (sessionId === undefined) throw new Error("insert failed");

    const socket: ClientSocket = await new Promise((resolve, reject) => {
      const client = ioClient(baseUrl, {
        path: "/socket.io",
        transports: ["websocket"],
        forceNew: true,
      });
      client.on("connect", () => resolve(client));
      client.on("connect_error", reject);
    });

    try {
      const reject = await new Promise<{ code: string }>((resolve, rejectPromise) => {
        const timer = setTimeout(() => rejectPromise(new Error("reject timeout")), 5000);
        socket.on(LIVE_EVENTS.reject, (raw) => {
          clearTimeout(timer);
          resolve(raw as { code: string });
        });
        socket.emit(LIVE_EVENTS.join, {
          sessionId,
          stationKind: "trainee",
          role: "technician",
          actorId: "authz-trainee",
        });
      });
      expect(reject.code).toBe("auth");
    } finally {
      socket.disconnect();
      registry.dispose(sessionId);
    }
  });
});
