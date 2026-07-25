-- Manager evidence list: filter scored/archived sessions by trainee within a tenant.
create index if not exists vc_sim_sessions_tenant_trainee_phase_idx
  on vc_sim_sessions (tenant_id, trainee_id, phase);
