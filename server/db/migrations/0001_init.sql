-- 0001_init: tenancy, scenarios, sessions, append-only event log, ANTS ratings.

create table if not exists vc_tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists vc_scenarios (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references vc_tenants(id),
  slug text not null,
  version text not null,
  clinically_reviewed boolean not null default false,
  clinical_reviewer text,
  definition jsonb not null,
  created_at timestamptz not null default now(),
  constraint vc_scenarios_tenant_slug_version unique (tenant_id, slug, version)
);

create table if not exists vc_sim_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references vc_tenants(id),
  scenario_id uuid not null references vc_scenarios(id),
  scenario_version text not null,
  seed bigint not null,
  phase text not null default 'draft'
    check (phase in ('draft','briefing','running','paused','debrief','scored','archived')),
  trainee_id text,
  trainee_time_in_training_days integer check (trainee_time_in_training_days >= 0),
  started_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists vc_role_stations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references vc_tenants(id),
  session_id uuid not null references vc_sim_sessions(id),
  role text not null,
  assigned_user_id text,
  created_at timestamptz not null default now()
);

-- The source of truth. Append-only is enforced, not assumed.
create table if not exists vc_session_events (
  id bigserial primary key,
  tenant_id uuid not null references vc_tenants(id),
  session_id uuid not null references vc_sim_sessions(id),
  seq integer not null check (seq > 0),
  type text not null,
  role text,
  actor_id text,
  payload jsonb not null default '{}',
  recorded_at timestamptz not null default now(),
  constraint vc_session_events_session_seq unique (session_id, seq)
);

create index if not exists vc_session_events_session_idx
  on vc_session_events (session_id, seq);

create or replace function vc_forbid_mutation() returns trigger as $$
begin
  raise exception 'vc_session_events is append-only: % is forbidden', tg_op;
end;
$$ language plpgsql;

drop trigger if exists vc_session_events_append_only on vc_session_events;
create trigger vc_session_events_append_only
  before update or delete on vc_session_events
  for each row execute function vc_forbid_mutation();

create table if not exists vc_ants_ratings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references vc_tenants(id),
  session_id uuid not null references vc_sim_sessions(id),
  rater_id text not null,
  domain text not null
    check (domain in ('task_management','team_working','situation_awareness','decision_making')),
  score integer not null check (score between 1 and 5),
  -- Traceability (CLAUDE.md §2.3): a rating must point at its source events.
  evidence_event_seqs integer[] not null check (cardinality(evidence_event_seqs) > 0),
  created_at timestamptz not null default now()
);
