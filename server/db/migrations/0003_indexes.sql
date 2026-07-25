-- 0003_indexes: index tuning raised in PR review.
-- The unique constraint on (session_id, seq) already provides the index the
-- explicit vc_session_events_session_idx duplicated; drop the duplicate.
drop index if exists vc_session_events_session_idx;

-- Session listing filters by tenant and orders by created_at desc.
create index if not exists vc_sim_sessions_tenant_created_idx
  on vc_sim_sessions (tenant_id, created_at desc);

-- AAR page loads all ratings for a session.
create index if not exists vc_ants_ratings_session_idx
  on vc_ants_ratings (session_id);
