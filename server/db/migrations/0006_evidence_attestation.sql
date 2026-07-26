-- Tamper-evident ANTS binding: freeze log head (seq + hash) at rating time.
-- Historical rows get a legacy sentinel; new ratings always set both columns.

alter table vc_ants_ratings
  add column if not exists log_head_seq integer,
  add column if not exists log_head_hash text;

update vc_ants_ratings
set
  log_head_seq = 0,
  log_head_hash = 'legacy-unattested'
where log_head_seq is null or log_head_hash is null;

alter table vc_ants_ratings
  alter column log_head_seq set not null,
  alter column log_head_hash set not null;

alter table vc_ants_ratings
  drop constraint if exists vc_ants_ratings_log_head_seq_nonneg;

alter table vc_ants_ratings
  add constraint vc_ants_ratings_log_head_seq_nonneg check (log_head_seq >= 0);

alter table vc_ants_ratings
  drop constraint if exists vc_ants_ratings_log_head_hash_nonempty;

alter table vc_ants_ratings
  add constraint vc_ants_ratings_log_head_hash_nonempty check (length(log_head_hash) > 0);
