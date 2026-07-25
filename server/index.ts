import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { clerkMiddleware } from "@clerk/express";
import express from "express";

import { createDb } from "./db/client.js";
import { runMigrations } from "./db/migrate.js";
import { loadEnv } from "./env.js";

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

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    auth: clerkEnabled ? "clerk" : "dev-bypass",
    db: env.DATABASE_URL === undefined ? "not-configured" : "configured",
  });
});

// Production: single Railway service serves the built SPA too.
const distDir = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
if (env.NODE_ENV === "production" && existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get("{*splat}", (_req, res) => {
    res.sendFile(join(distDir, "index.html"));
  });
}

async function boot() {
  if (env.DATABASE_URL !== undefined) {
    const { pool } = createDb(env.DATABASE_URL);
    const applied = await runMigrations(pool);
    if (applied.length > 0) {
      console.log(`migrations applied: ${applied.join(", ")}`);
    }
  } else {
    console.warn("DATABASE_URL not set — booting without a database (dev only)");
  }

  app.listen(env.PORT, () => {
    console.log(`vetcrew server listening on :${env.PORT}`);
  });
}

void boot();
