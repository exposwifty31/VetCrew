import { eq } from "drizzle-orm";

import type { Db } from "./db/client.js";
import { tenants } from "./db/schema/index.js";

const PILOT_SLUG = "pilot";

/** v1 has exactly one hospital; the data model stays SaaS-shaped (CLAUDE.md §7). */
export async function ensurePilotTenant(db: Db): Promise<string> {
  const existing = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, PILOT_SLUG));
  const first = existing[0];
  if (first !== undefined) return first.id;
  const inserted = await db
    .insert(tenants)
    .values({ slug: PILOT_SLUG, name: "Pilot Hospital" })
    .returning({ id: tenants.id });
  const row = inserted[0];
  if (row === undefined) throw new Error("failed to create pilot tenant");
  return row.id;
}
