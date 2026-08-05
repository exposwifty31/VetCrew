-- Unit B: mode, rater roster, and submission rules (CLAUDE.md §1.1/§1.6, D2/D3).

-- Mode is declared on the scenario file and mirrored here so policy can filter
-- in SQL. 'practice' is the default because the locked assessment mode must
-- never be something content falls into by omission.
alter table vc_scenarios
  add column if not exists mode text not null default 'practice';
alter table vc_scenarios
  drop constraint if exists vc_scenarios_mode_known;
alter table vc_scenarios
  add constraint vc_scenarios_mode_known
  check (mode in ('assessment','practice','tutorial'));

-- The session's copy is RESOLVED AT CREATION AND FROZEN, exactly as
-- scenario_version already is. syncScenarios upserts scenario rows from disk on
-- every boot, so reading mode from the live scenario row would let an edit to a
-- file silently restate the mode of every past session that used it — and mode
-- is what the "the examiner could not intervene" claim rests on. This does not
-- weaken D3: mode is still declared on the scenario, never chosen per session.
alter table vc_sim_sessions
  add column if not exists mode text not null default 'practice';
alter table vc_sim_sessions
  drop constraint if exists vc_sim_sessions_mode_known;
alter table vc_sim_sessions
  add constraint vc_sim_sessions_mode_known
  check (mode in ('assessment','practice','tutorial'));

-- Per-session rater assignment. "All three raters submitted" is uncheckable
-- against ants_ratings.rater_id alone — it is free text, so a bare
-- distinct-count would admit any three people including the mentor, whose
-- exclusion is the whole point of the separation of duties (§1.6).
-- Amendments are RETAINED, not overwritten. The roster is amendable until
-- debrief precisely so a stuck assessment can be fixed by swapping a rater
-- instead of being archived unscored — but that is only a defensible
-- alternative if the swap leaves a trace. A removed rater keeps its row with
-- removed_at set, so who was dropped, who replaced them, and when all stay
-- answerable. Only rows with removed_at IS NULL are the live roster.
create table if not exists vc_session_raters (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references vc_tenants(id),
  session_id uuid not null references vc_sim_sessions(id),
  rater_user_id text not null,
  assigned_by_user_id text,
  removed_at timestamptz,
  removed_by_user_id text,
  created_at timestamptz not null default now()
);

create index if not exists vc_session_raters_session_idx
  on vc_session_raters (session_id);

-- Partial: a rater may be removed and later re-added, which would collide with
-- a plain unique constraint over the whole table.
create unique index if not exists vc_session_raters_live
  on vc_session_raters (session_id, rater_user_id)
  where removed_at is null;

-- Proxied entry, recorded honestly (founder decision 2026-08-05). The Reviewer
-- is 65, non-technical, and will never log in (§1.6). Without this column the
-- only outcomes were "the three-rater model never runs" or "the record names
-- whoever typed for her" — a falsehood in the packet's most important claim.
-- Backfilled to rater_id: every rating that already exists was self-entered.
alter table vc_ants_ratings
  add column if not exists submitted_by_user_id text;
update vc_ants_ratings
  set submitted_by_user_id = rater_id
  where submitted_by_user_id is null;
alter table vc_ants_ratings
  alter column submitted_by_user_id set not null;

-- One live rating per (session, rater, domain): completion counting is a query
-- over these rows, so duplicates make "every assigned rater is complete"
-- unanswerable.
--
-- Superseded rows are ARCHIVED, never dropped. These are hiring records: the
-- score, the evidence seqs it cited, and the log-head attestation that binds it
-- are the whole defensibility story, and a migration that deletes them removes
-- the ability to audit an assessment after the fact. The archive keeps them
-- readable while the live table gets a plain unique constraint.
create table if not exists vc_ants_ratings_archive (
  id uuid primary key,
  tenant_id uuid not null,
  session_id uuid not null,
  rater_id text not null,
  submitted_by_user_id text,
  domain text not null,
  score integer not null,
  evidence_event_seqs integer[] not null,
  log_head_seq integer,
  log_head_hash text,
  created_at timestamptz not null,
  archived_at timestamptz not null default now(),
  archived_reason text not null
);

create index if not exists vc_ants_ratings_archive_session_idx
  on vc_ants_ratings_archive (session_id);

insert into vc_ants_ratings_archive
  (id, tenant_id, session_id, rater_id, submitted_by_user_id, domain, score,
   evidence_event_seqs, log_head_seq, log_head_hash, created_at, archived_reason)
select a.id, a.tenant_id, a.session_id, a.rater_id, a.submitted_by_user_id, a.domain,
       a.score, a.evidence_event_seqs, a.log_head_seq, a.log_head_hash, a.created_at,
       'superseded by 0008 one-live-rating-per-(session,rater,domain)'
  from vc_ants_ratings a
  where exists (
    select 1 from vc_ants_ratings b
     where a.session_id = b.session_id
       and a.rater_id = b.rater_id
       and a.domain = b.domain
       and (a.created_at, a.id) < (b.created_at, b.id)
  )
on conflict (id) do nothing;

delete from vc_ants_ratings a
  using vc_ants_ratings b
  where a.session_id = b.session_id
    and a.rater_id = b.rater_id
    and a.domain = b.domain
    and (a.created_at, a.id) < (b.created_at, b.id);

alter table vc_ants_ratings
  drop constraint if exists vc_ants_ratings_session_rater_domain;
alter table vc_ants_ratings
  add constraint vc_ants_ratings_session_rater_domain
  unique (session_id, rater_id, domain);
