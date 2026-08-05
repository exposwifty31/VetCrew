import { bigint, integer, text, timestamp, uuid } from "drizzle-orm/pg-core";

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
  traineeId: text("trainee_id"),
  traineeTimeInTrainingDays: integer("trainee_time_in_training_days"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Role stations are thin clients with genuinely partial views (§4). */
export const roleStations = vcTable("role_stations", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  sessionId: uuid("session_id").notNull().references(() => simSessions.id),
  role: text("role").notNull(),
  assignedUserId: text("assigned_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
