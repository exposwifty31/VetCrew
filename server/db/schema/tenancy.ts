import { text, timestamp, uuid } from "drizzle-orm/pg-core";

import { vcTable } from "./_table.js";

/** SaaS-shaped from day one (CLAUDE.md §7) — one hospital exists in v1. */
export const tenants = vcTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
