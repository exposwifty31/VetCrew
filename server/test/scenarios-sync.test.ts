import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { createDb } from "../db/client.js";
import { scenarios } from "../db/schema/index.js";
import { runMigrations } from "../db/migrate.js";
import { loadScenarioFiles, syncScenarios } from "../scenarios.js";
import { ensurePilotTenant } from "../tenancy.js";

const TEST_DATABASE_URL =
  process.env["TEST_DATABASE_URL"] ?? "postgres://localhost:5432/vetcrew_test";

let pool: ReturnType<typeof createDb>["pool"];
let db: ReturnType<typeof createDb>["db"];
let tenantId: string;

beforeAll(async () => {
  const dbName = new URL(TEST_DATABASE_URL).pathname.replace(/^\//, "");
  if (!/test/i.test(dbName)) {
    throw new Error(
      `TEST_DATABASE_URL database "${dbName}" does not look like a test database (must contain "test")`,
    );
  }
  ({ pool, db } = createDb(TEST_DATABASE_URL));
  await pool.query("drop schema public cascade");
  await pool.query("create schema public");
  await runMigrations(pool);
  tenantId = await ensurePilotTenant(db);
});

afterAll(async () => {
  await pool.end();
});

describe("syncScenarios upsert", () => {
  test("inserts a row on first sync", async () => {
    const authored = loadScenarioFiles().find((s) => s.slug === "base-rung-resp-distress");
    if (authored === undefined) throw new Error("fixture scenario missing");

    await syncScenarios(db, tenantId, [authored]);

    const rows = await db
      .select()
      .from(scenarios)
      .where(eq(scenarios.tenantId, tenantId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.clinicallyReviewed).toBe(false);
    expect(rows[0]?.definition).toMatchObject({ title: authored.title });
  });

  test("updates definition and clinicallyReviewed on re-sync (no duplicate rows)", async () => {
    const authored = loadScenarioFiles().find((s) => s.slug === "base-rung-resp-distress");
    if (authored === undefined) throw new Error("fixture scenario missing");

    await syncScenarios(db, tenantId, [authored]);

    const updated = {
      ...authored,
      title: "Updated title for upsert test",
      titleHe: "כותרת מעודכנת",
      clinicallyReviewed: true,
      clinicalReviewer: "Dr. Test Reviewer",
    };
    await syncScenarios(db, tenantId, [updated]);

    const rows = await db
      .select()
      .from(scenarios)
      .where(eq(scenarios.tenantId, tenantId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.clinicallyReviewed).toBe(true);
    expect(rows[0]?.clinicalReviewer).toBe("Dr. Test Reviewer");
    expect(rows[0]?.definition).toMatchObject({
      title: "Updated title for upsert test",
      titleHe: "כותרת מעודכנת",
    });
  });
});
