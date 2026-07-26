import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { clerkMiddleware } from "@clerk/express";
import express from "express";

import { createReadAuthFromToken, isAuthEnabled, readAuth, requireSignedIn } from "./auth.js";
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

/** Prod CORS: explicit `CORS_ORIGIN`, else Railway public HTTPS origin, else deny reflect-any. */
function resolveCorsOrigin(nodeEnv: string): string | boolean {
  if (nodeEnv !== "production") return true;
  const explicit = process.env["CORS_ORIGIN"];
  if (explicit !== undefined && explicit.length > 0) return explicit;
  const domain = process.env["RAILWAY_PUBLIC_DOMAIN"];
  if (domain !== undefined && domain.length > 0) return `https://${domain}`;
  return false;
}

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
  let dbStatus: "ready" | "starting" | "not-configured";
  if (dbReady) {
    dbStatus = "ready";
  } else if (env.DATABASE_URL === undefined) {
    dbStatus = "not-configured";
  } else {
    dbStatus = "starting";
  }
  const payload = {
    ok: dbReady || env.DATABASE_URL === undefined,
    auth: clerkEnabled ? ("clerk" as const) : ("dev-bypass" as const),
    db: dbStatus,
  };
  // Fail the probe while Postgres is configured but not yet migrated/ready.
  if (env.DATABASE_URL !== undefined && !dbReady) {
    res.status(503).json(payload);
    return;
  }
  res.json(payload);
});

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
    // API routers MUST mount before the SPA catch-all (tech-debt #1).
    // Session REST is hiring-evidence surface — signed-in when Clerk is on.
    // E2E/integration leave Clerk keys unset so requireSignedIn is a no-op.
    const authEnabled = isAuthEnabled(clerkEnabled);
    const signedIn = requireSignedIn(clerkEnabled);
    const allowDevBypass = env.NODE_ENV === "development" && !authEnabled;
    app.use(
      "/api/sessions",
      signedIn,
      createSessionRouter(db, tenantId, { authEnabled, readAuth }),
    );
    // Manager evidence is employee-performance PII — signed-in when Clerk is on.
    app.use(
      "/api",
      createManagerRouter(db, tenantId, { authEnabled, clerkEnabled, readAuth }),
    );

    const registry = new RoomRegistry(db);
    attachLiveSocket(httpServer, {
      tenantId,
      registry,
      db,
      authEnabled,
      readAuthFromToken: createReadAuthFromToken(secretKey),
      allowDevBypass,
      corsOrigin: resolveCorsOrigin(env.NODE_ENV),
    });
    dbReady = true;
  } else {
    console.warn("DATABASE_URL not set — booting without a database (dev only, no session API)");
  }

  // Production: SPA after APIs so GET /api/* is never swallowed by index.html.
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

  httpServer.listen(env.PORT, () => {
    console.log(`vetcrew server listening on :${env.PORT}`);
  });
}

boot().catch((error: unknown) => {
  console.error("boot failed:", error);
  process.exit(1);
});
