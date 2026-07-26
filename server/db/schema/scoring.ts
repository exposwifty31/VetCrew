import { integer, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { vcTable } from "./_table.js";
import { simSessions } from "./sessions.js";
import { tenants } from "./tenancy.js";

/**
 * Non-technical (ANTS) ratings — stored separately from technical scoring
 * (CLAUDE.md §4). evidence_event_seqs keeps every rating traceable to the
 * event log (§2.3); a rating with no evidence link is a bug, not a score.
 * Formative only until the 3-rater bar is met (§2.2).
 */
export const antsRatings = vcTable("ants_ratings", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  sessionId: uuid("session_id").notNull().references(() => simSessions.id),
  raterId: text("rater_id").notNull(),
  domain: text("domain").notNull(),
  score: integer("score").notNull(),
  evidenceEventSeqs: integer("evidence_event_seqs").array().notNull(),
  /** Log head at rating time — tamper-evident bind (migration 0006). */
  logHeadSeq: integer("log_head_seq").notNull(),
  logHeadHash: text("log_head_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
