-- Tamper-evident ANTS binding: optional log head (seq + sha256 hex) at rating time.
-- NULL/NULL = historical unattested row (never pretend it was attested).
-- Expand → NOT VALID check → VALIDATE (avoids long exclusive locks on large tables).

alter table vc_ants_ratings
  add column if not exists log_head_seq integer,
  add column if not exists log_head_hash text;

alter table vc_ants_ratings
  drop constraint if exists vc_ants_ratings_log_head_seq_nonneg;

alter table vc_ants_ratings
  drop constraint if exists vc_ants_ratings_log_head_hash_nonempty;

alter table vc_ants_ratings
  drop constraint if exists vc_ants_ratings_log_head_pair;

alter table vc_ants_ratings
  add constraint vc_ants_ratings_log_head_pair
  check (
    (log_head_seq is null and log_head_hash is null)
    or (
      log_head_seq is not null
      and log_head_seq >= 0
      and log_head_hash ~ '^[a-f0-9]{64}$'
    )
  ) not valid;

alter table vc_ants_ratings
  validate constraint vc_ants_ratings_log_head_pair;
