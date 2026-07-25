-- 0004_seq_authority (architecture audit R1): the event log is the evidence
-- record (CLAUDE.md §2.2/§2.3). Append-only alone does not protect it — a
-- retroactive INSERT at a low seq silently changes the replay of an already
-- scored session. Enforce that every insert continues the sequence with no
-- gaps and no backfill: seq must be exactly max(seq)+1 for its session.
-- Concurrent writers that race past this check still collide on the existing
-- unique (session_id, seq) constraint.

create or replace function vc_enforce_seq_contiguity() returns trigger as $$
declare
  current_max integer;
begin
  select coalesce(max(seq), 0) into current_max
    from vc_session_events
   where session_id = new.session_id;
  if new.seq <> current_max + 1 then
    raise exception
      'vc_session_events seq % is not contiguous for session % (expected %)',
      new.seq, new.session_id, current_max + 1;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists vc_session_events_seq_contiguity on vc_session_events;
create trigger vc_session_events_seq_contiguity
  before insert on vc_session_events
  for each row execute function vc_enforce_seq_contiguity();
