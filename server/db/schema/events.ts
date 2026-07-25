import { bigserial, integer, jsonb, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { vcTable } from "./_table.js";
import { simSessions } from "./sessions.js";
import { tenants } from "./tenancy.js";

/**
 * THE source of truth (CLAUDE.md §4): append-only, role-attributed,
 * timestamped. All state is derived from this log; every score must trace
 * back to rows here. UPDATE/DELETE are blocked by trigger in the migration.
 */
export const sessionEvents = vcTable(
  "session_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    sessionId: uuid("session_id").notNull().references(() => simSessions.id),
    seq: integer("seq").notNull(),
    type: text("type").notNull(),
    role: text("role"),
    actorId: text("actor_id"),
    payload: jsonb("payload").notNull().default({}),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("vc_session_events_session_seq").on(table.sessionId, table.seq)],
);
