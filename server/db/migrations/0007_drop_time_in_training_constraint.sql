-- Time-in-training was unfrozen on 2026-08-05 (CLAUDE.md §4, D1): a candidate
-- takes a single assessment session, so there is no longitudinal axis and no
-- metric to gate on. The scored-needs-TiT check constraint (added in 0002)
-- otherwise makes every session unscorable once the column stops being
-- populated, so it must go together with the read-path removal.
--
-- The column trainee_time_in_training_days itself is KEPT (nullable, dormant):
-- dropping it would destroy captured data for no benefit, and no code reads or
-- writes it anymore. Its harmless >= 0 column check from 0001 also stays.
alter table vc_sim_sessions
  drop constraint if exists vc_sim_sessions_scored_needs_time_in_training;
