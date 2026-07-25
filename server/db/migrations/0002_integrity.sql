-- 0002_integrity: constraints raised in PR review.
-- 1) Tenant-composite FKs: a child row can never reference a parent from
--    another tenant (audit/liability boundary, CLAUDE.md §2.3).
-- 2) clinically_reviewed=true requires an identifiable reviewer (§2.5/§8).
-- 3) Seed constrained to u32 range: drizzle bigint mode "number" is only
--    safe below 2^53, and the engine PRNG consumes a u32 anyway.
-- 4) A scored session must carry time-in-training (§4: the axis cannot be
--    backfilled).

alter table vc_scenarios
  add constraint vc_scenarios_tenant_id_unique unique (tenant_id, id);
alter table vc_sim_sessions
  add constraint vc_sim_sessions_tenant_id_unique unique (tenant_id, id);

alter table vc_sim_sessions
  add constraint vc_sim_sessions_scenario_same_tenant
  foreign key (tenant_id, scenario_id) references vc_scenarios (tenant_id, id);
alter table vc_role_stations
  add constraint vc_role_stations_session_same_tenant
  foreign key (tenant_id, session_id) references vc_sim_sessions (tenant_id, id);
alter table vc_session_events
  add constraint vc_session_events_session_same_tenant
  foreign key (tenant_id, session_id) references vc_sim_sessions (tenant_id, id);
alter table vc_ants_ratings
  add constraint vc_ants_ratings_session_same_tenant
  foreign key (tenant_id, session_id) references vc_sim_sessions (tenant_id, id);

alter table vc_scenarios
  add constraint vc_scenarios_reviewer_required
  check (not clinically_reviewed
         or (clinical_reviewer is not null and length(trim(clinical_reviewer)) > 0));

alter table vc_sim_sessions
  add constraint vc_sim_sessions_seed_u32
  check (seed >= 0 and seed < 4294967296);

alter table vc_sim_sessions
  add constraint vc_sim_sessions_scored_needs_time_in_training
  check (phase <> 'scored' or trainee_time_in_training_days is not null);
