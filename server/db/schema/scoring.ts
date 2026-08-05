import { integer, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { vcTable } from "./_table.js";
import { simSessions } from "./sessions.js";
import { tenants } from "./tenancy.js";

/**
 * Non-technical (ANTS) ratings — stored separately from technical scoring
 * (CLAUDE.md §4). evidence_event_seqs keeps every rating traceable to the
 * event log (§2.3); a rating with no evidence link is a bug, not a score.
 * Formative only until the 3-rater bar is met (§2.2).
 */
export const antsRatings = vcTable(
  "ants_ratings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    sessionId: uuid("session_id").notNull().references(() => simSessions.id),
    /** Whose judgment this is — must be an assigned rater (vc_session_raters). */
    raterId: text("rater_id").notNull(),
    /**
     * Who physically entered it; equals rater_id unless proxied. The Reviewer
     * is 65, non-technical and will never log in (CLAUDE.md §1.6), so without
     * this the record would either lose her entirely or name whoever typed for
     * her — a falsehood in the packet's most important claim, introduced by
     * the system's own design and impossible to retrofit later.
     */
    submittedByUserId: text("submitted_by_user_id").notNull(),
    domain: text("domain").notNull(),
    score: integer("score").notNull(),
    evidenceEventSeqs: integer("evidence_event_seqs").array().notNull(),
    /**
     * Log head at rating time — tamper-evident bind (migration 0006).
     * NULL/NULL = historical unattested; new ratings always set both.
     */
    logHeadSeq: integer("log_head_seq"),
    logHeadHash: text("log_head_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // One live rating per (session, rater, domain). Completion counting is a
  // query over these rows, so duplicates would make "all raters complete"
  // unanswerable. A rater correcting themselves before the set completes
  // upserts this row (see the ratings route); an amendment HISTORY is a
  // follow-up (design-alignment §4).
  (table) => [
    unique("vc_ants_ratings_session_rater_domain").on(
      table.sessionId,
      table.raterId,
      table.domain,
    ),
  ],
);
