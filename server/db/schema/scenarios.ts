import { boolean, jsonb, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { vcTable } from "./_table.js";
import { tenants } from "./tenancy.js";

/**
 * Scenarios are data, versioned independently of the engine (CLAUDE.md §4).
 * clinically_reviewed is a liability boundary (§2.5): unreviewed scenarios
 * are internal-testing only and must never feed a readiness decision.
 */
export const scenarios = vcTable(
  "scenarios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    slug: text("slug").notNull(),
    version: text("version").notNull(),
    clinicallyReviewed: boolean("clinically_reviewed").notNull().default(false),
    clinicalReviewer: text("clinical_reviewer"),
    definition: jsonb("definition").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("vc_scenarios_tenant_slug_version").on(table.tenantId, table.slug, table.version)],
);
