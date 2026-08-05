import { sql } from "drizzle-orm";
import { bigint, integer, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { vcTable } from "./_table.js";
import { scenarios } from "./scenarios.js";
import { tenants } from "./tenancy.js";

/**
 * One authoritative engine per session; lifecycle is an explicit FSM
 * (draft→briefing→running⇄paused→debrief→scored→archived, CLAUDE.md §4).
 * seed is stored so replay reproduces every PRNG draw.
 * trainee_time_in_training_days is a dormant nullable column: the metric was
 * unfrozen on 2026-08-05 (§4, D1 — a candidate takes one session, so there is
 * no longitudinal axis). No code reads or writes it. The column is retained
 * (rather than dropped) so no data is destroyed and the removal stays a pure
 * read-path change; the scored-needs-TiT check constraint is dropped in 0007.
 */
export const simSessions = vcTable("sim_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  scenarioId: uuid("scenario_id").notNull().references(() => scenarios.id),
  scenarioVersion: text("scenario_version").notNull(),
  seed: bigint("seed", { mode: "number" }).notNull(),
  phase: text("phase").notNull().default("draft"),
  /**
   * Mode resolved from the scenario at creation and FROZEN here, like
   * scenario_version. Scenario rows are re-upserted from disk on every boot,
   * so reading mode from the live scenario row would let a file edit restate
   * the mode of every past session that used it — and mode is what the whole
   * "the examiner could not intervene" claim rests on.
   */
  mode: text("mode").notNull().default("practice"),
  traineeId: text("trainee_id"),
  traineeTimeInTrainingDays: integer("trainee_time_in_training_days"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Per-session rater assignment (CLAUDE.md §1.6). "All three raters submitted"
 * is uncheckable against `ants_ratings.rater_id` alone — it is free text, so a
 * bare distinct-count would admit any three people, including the mentor whose
 * exclusion is the entire point of the separation of duties. The roster names
 * which three.
 *
 * Amendable while phase < debrief (founder decision 2026-08-05). The invariant
 * that matters — scored requires three distinct assigned raters with complete
 * sets — is enforced at scoring time and is untouched by when the roster is
 * set. Freezing it at creation only bought a permanently unscorable session
 * the first time a rater went on leave, with a re-sit for the candidate.
 *
 * Amendments are retained rather than overwritten: a removed rater keeps its
 * row with `removedAt` set. Swapping a rater is the sanctioned alternative to
 * archiving an assessment unscored, and that is only defensible if the swap
 * leaves a trace — who was dropped, who did it, and when. **The live roster is
 * `removedAt IS NULL`**; every read must say so.
 *
 * Mentor exclusion is procedural, not API-enforced (§1.6).
 */
export const sessionRaters = vcTable(
  "session_raters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    sessionId: uuid("session_id").notNull().references(() => simSessions.id),
    /** Clerk subject id of the assigned rater. */
    raterUserId: text("rater_user_id").notNull(),
    /** Mandatory: an unattributed roster change cannot be audited. */
    assignedByUserId: text("assigned_by_user_id").notNull(),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    /** DB-checked to be present exactly when `removedAt` is. */
    removedByUserId: text("removed_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // Partial unique on the LIVE rows only — a rater may be removed and later
  // re-added, which a whole-table constraint would reject.
  (table) => [
    uniqueIndex("vc_session_raters_live")
      .on(table.sessionId, table.raterUserId)
      .where(sql`${table.removedAt} is null`),
  ],
);

/** Role stations are thin clients with genuinely partial views (§4). */
export const roleStations = vcTable("role_stations", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  sessionId: uuid("session_id").notNull().references(() => simSessions.id),
  role: text("role").notNull(),
  assignedUserId: text("assigned_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
