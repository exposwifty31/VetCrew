import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { clerkMiddleware } from "@clerk/express";
import express from "express";

import { requireSignedIn } from "./auth.js";
import { createDb } from "./db/client.js";
import { runMigrations } from "./db/migrate.js";
import { loadEnv } from "./env.js";
import { RoomRegistry } from "./live/room-registry.js";
import { attachLiveSocket } from "./live/socket.js";
import { createManagerRouter } from "./routes/manager.js";
import { createSessionRouter } from "./routes/sessions.js";
import { loadScenarioFiles, syncScenarios } from "./scenarios.js";
import { ensurePilotTenant } from "./tenancy.js";

const env = loadEnv();
const app = express();
app.use(express.json());

const secretKey = env.CLERK_SECRET_KEY;
const publishableKey = env.CLERK_PUBLISHABLE_KEY;
const clerkEnabled = secretKey !== undefined && publishableKey !== undefined;
if (secretKey !== undefined && publishableKey !== undefined) {
  app.use(clerkMiddleware({ secretKey, publishableKey }));
} else if (env.NODE_ENV !== "development") {
  throw new Error("Clerk keys are required outside development");
}

let dbReady = false;

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    auth: clerkEnabled ? "clerk" : "dev-bypass",
    db: dbReady ? "ready" : env.DATABASE_URL === undefined ? "not-configured" : "starting",
  });
});

// Production: single Railway service serves the built SPA too.
const distDir = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
if (env.NODE_ENV === "production") {
  if (!existsSync(distDir)) {
    throw new Error("production boot without dist/ — client build missing");
  }
  app.use(express.static(distDir));
  app.get("{*splat}", (_req, res) => {
    res.sendFile(join(distDir, "index.html"));
  });
}

async function boot() {
  const httpServer = createServer(app);

  if (env.DATABASE_URL !== undefined) {
    const { pool, db } = createDb(env.DATABASE_URL);
    const applied = await runMigrations(pool);
    if (applied.length > 0) {
      console.log(`migrations applied: ${applied.join(", ")}`);
    }
    const tenantId = await ensurePilotTenant(db);
    await syncScenarios(db, tenantId, loadScenarioFiles());
    app.use("/api/sessions", createSessionRouter(db, tenantId));
    // Manager evidence is employee-performance PII — signed-in when Clerk is on.
    app.use("/api", createManagerRouter(db, tenantId, requireSignedIn(clerkEnabled)));

    const registry = new RoomRegistry(db);
    attachLiveSocket(httpServer, {
      tenantId,
      registry,
      // Clerk keys may be present for SPA/manager auth while role_stations
      // binding is still open — keep the loud join bypass in development only.
      allowDevBypass: env.NODE_ENV === "development",
    });
    dbReady = true;
  } else {
    console.warn("DATABASE_URL not set — booting without a database (dev only, no session API)");
  }

  httpServer.listen(env.PORT, () => {
    console.log(`vetcrew server listening on :${env.PORT}`);
  });
}

boot().catch((error: unknown) => {
  console.error("boot failed:", error);
  process.exit(1);
});
