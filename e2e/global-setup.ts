import { createDb } from "../server/db/client.js";
import { runMigrations } from "../server/db/migrate.js";
import { ensurePilotTenant } from "../server/tenancy.js";
import { seedAssessmentScenario } from "../server/test/fixtures/assessment-scenario.js";

/**
 * Seed an assessment-mode scenario into the e2e database.
 *
 * The scored path IS the hiring path, so leaving it the one flow with no
 * browser coverage would be the wrong place to be thin. But practice sessions
 * never reach `scored` (CLAUDE.md §4), and both shipped scenario files are
 * practice — so the e2e database needs assessment content from somewhere.
 *
 * It is inserted here rather than added to `scenarios/` deliberately: a fixture
 * in that directory would be loaded by every production boot, and an assessment
 * scenario nobody authored on purpose is exactly the content that should not
 * exist in a hiring tool. `seed-demo.ts` already establishes writing straight to
 * the database as a legitimate seeding path.
 */
export default async function globalSetup(): Promise<void> {
  const databaseUrl = process.env["DATABASE_URL"];
  if (databaseUrl === undefined || databaseUrl.length === 0) {
    throw new Error("e2e global setup requires DATABASE_URL");
  }
  const { pool, db } = createDb(databaseUrl);
  try {
    // The API server runs migrations on boot too; this is idempotent and makes
    // the setup order between the two irrelevant.
    await runMigrations(pool);
    const tenantId = await ensurePilotTenant(db);
    await seedAssessmentScenario(db, tenantId);
  } finally {
    await pool.end();
  }
}
