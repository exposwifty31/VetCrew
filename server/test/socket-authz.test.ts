import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { LIVE_EVENTS } from "@vetcrew/shared";
import express from "express";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { and, eq } from "drizzle-orm";

import { createReadAuthFromToken, isAuthEnabled } from "../auth.js";
import { createDb } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { roleStations, scenarios, simSessions } from "../db/schema/index.js";
import { RoomRegistry } from "../live/room-registry.js";
import { attachLiveSocket, STATION_SCENARIO_SLUG } from "../live/socket.js";
import { ensurePilotTenant } from "../tenancy.js";
import { loadScenarioFiles, syncScenarios } from "../scenarios.js";

const TEST_DATABASE_URL =
  process.env["TEST_DATABASE_URL"] ?? "postgres://localhost:5432/vetcrew_test";

const ORIGINAL_TEST_AUTH = process.env.VETCREW_TEST_AUTH;

function testToken(userId: string, role: "manager" | "instructor" | "trainee"): string {
  return `test:${userId}:${role}`;
}

function connectWithToken(baseUrl: string, token?: string): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const client = ioClient(baseUrl, {
      path: "/socket.io",
      transports: ["websocket"],
      forceNew: true,
      auth: token !== undefined ? { token } : {},
    });
    client.on("connect", () => resolve(client));
    client.on("connect_error", reject);
  });
}

/**
 * Production-shaped socket: allowDevBypass=false requires auth + role_stations binding.
 */
describe("live socket authz (no bypass)", () => {
  let pool: ReturnType<typeof createDb>["pool"];
  let db: ReturnType<typeof createDb>["db"];
  let tenantId: string;
  let baseUrl: string;
  let registry: RoomRegistry;
  let httpServer: ReturnType<typeof createServer>;

  beforeAll(async () => {
    process.env.VETCREW_TEST_AUTH = "1";
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
      db,
      authEnabled: isAuthEnabled(false),
      readAuthFromToken: createReadAuthFromToken(undefined),
      allowDevBypass: false,
      corsOrigin: false,
    });
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => resolve());
    });
    baseUrl = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    if (ORIGINAL_TEST_AUTH === undefined) {
      delete process.env.VETCREW_TEST_AUTH;
    } else {
      process.env.VETCREW_TEST_AUTH = ORIGINAL_TEST_AUTH;
    }
    registry.disposeAll();
    await new Promise<void>((resolve, reject) => {
      httpServer.close((err) => (err ? reject(err) : resolve()));
    });
    await pool.end();
  });

  async function createBoundSession(
    traineeId: string,
    instructorId: string | null = null,
  ): Promise<string> {
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
        traineeId,
        traineeTimeInTrainingDays: 7,
      })
      .returning({ id: simSessions.id });
    const sessionId = inserted[0]?.id;
    if (sessionId === undefined) throw new Error("insert failed");

    await db.insert(roleStations).values([
      {
        tenantId,
        sessionId,
        role: "technician",
        assignedUserId: traineeId,
      },
      ...(instructorId !== null
        ? [
            {
              tenantId,
              sessionId,
              role: "instructor",
              assignedUserId: instructorId,
            },
          ]
        : []),
    ]);
    return sessionId;
  }

  test("join is rejected with auth code when no token is provided", async () => {
    const sessionId = await createBoundSession("authz-trainee");
    const socket = await connectWithToken(baseUrl);

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

  test("join is rejected when user is not assigned to the role station", async () => {
    process.env.VETCREW_TEST_AUTH = "1";
    const sessionId = await createBoundSession("bound-trainee");
    const socket = await connectWithToken(baseUrl, testToken("other-trainee", "trainee"));

    try {
      const reject = await new Promise<{ code: string; message: string }>((resolve, rejectPromise) => {
        const timer = setTimeout(() => rejectPromise(new Error("reject timeout")), 5000);
        socket.on(LIVE_EVENTS.reject, (raw) => {
          clearTimeout(timer);
          resolve(raw as { code: string; message: string });
        });
        socket.emit(LIVE_EVENTS.join, {
          sessionId,
          stationKind: "trainee",
          role: "technician",
        });
      });
      expect(reject.code).toBe("auth");
      expect(reject.message).toMatch(/not assigned/i);
    } finally {
      socket.disconnect();
      registry.dispose(sessionId);
    }
  });

  test("bound trainee receives snapshot and server-stamped actorId", async () => {
    process.env.VETCREW_TEST_AUTH = "1";
    const traineeId = "bound-self";
    const sessionId = await createBoundSession(traineeId);
    const socket = await connectWithToken(baseUrl, testToken(traineeId, "trainee"));

    try {
      const { snapshot, presence } = await new Promise<{
        snapshot: { kind: string; seq: number };
        presence: { connected: { actorId: string }[] };
      }>((resolve, rejectPromise) => {
        const timer = setTimeout(() => rejectPromise(new Error("join timeout")), 5000);
        let snapshotFrame: { kind: string; seq: number } | null = null;
        let presenceFrame: { connected: { actorId: string }[] } | null = null;
        const maybeDone = () => {
          if (snapshotFrame !== null && presenceFrame !== null) {
            clearTimeout(timer);
            resolve({ snapshot: snapshotFrame, presence: presenceFrame });
          }
        };
        socket.on(LIVE_EVENTS.snapshot, (frame) => {
          snapshotFrame = frame as { kind: string; seq: number };
          maybeDone();
        });
        socket.on(LIVE_EVENTS.presence, (raw) => {
          presenceFrame = raw as { connected: { actorId: string }[] };
          maybeDone();
        });
        socket.emit(LIVE_EVENTS.join, {
          sessionId,
          stationKind: "trainee",
          role: "technician",
          actorId: "client-spoofed-id",
        });
      });
      expect(snapshot.kind).toBe("trainee");
      expect(snapshot.seq).toBe(0);
      expect(presence.connected.some((m) => m.actorId === traineeId)).toBe(true);
      expect(presence.connected.some((m) => m.actorId === "client-spoofed-id")).toBe(false);
    } finally {
      socket.disconnect();
      registry.dispose(sessionId);
    }
  });

  test("bound instructor can join with test bearer token", async () => {
    process.env.VETCREW_TEST_AUTH = "1";
    const instructorId = "inst-bound";
    const sessionId = await createBoundSession("inst-trainee", instructorId);
    const socket = await connectWithToken(baseUrl, testToken(instructorId, "instructor"));

    try {
      const snapshot = await new Promise<{ kind: string }>((resolve, rejectPromise) => {
        const timer = setTimeout(() => rejectPromise(new Error("snapshot timeout")), 5000);
        socket.on(LIVE_EVENTS.snapshot, (frame) => {
          clearTimeout(timer);
          resolve(frame as { kind: string });
        });
        socket.emit(LIVE_EVENTS.join, {
          sessionId,
          stationKind: "instructor",
          role: "instructor",
        });
      });
      expect(snapshot.kind).toBe("instructor");
    } finally {
      socket.disconnect();
      registry.dispose(sessionId);
    }
  });
});
