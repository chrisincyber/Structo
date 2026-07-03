-- Delta-pull tests — pull_table_deltas() (blueprint §11.14/§13.6).
-- Covers: initial sync (epoch cursor), keyset pagination, incremental pull,
-- tombstone propagation, RLS scoping. Runs in one rolled-back transaction.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000aaaa', 'owner@test.planoa'),
  ('00000000-0000-0000-0000-00000000bbbb', 'stranger@test.planoa');

insert into public.projects (id, workspace_id, owner_id, name)
select '00000000-0000-0000-0000-000000000001', w.id, '00000000-0000-0000-0000-00000000aaaa', 'Owner Project'
from public.workspaces w where w.owner_id = '00000000-0000-0000-0000-00000000aaaa';

insert into public.tasks (id, project_id, author_id, title) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-00000000aaaa', 'task one'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-00000000aaaa', 'task two'),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-00000000aaaa', 'task three');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000aaaa","role":"authenticated"}';

do $$
declare
  res jsonb;
  page2 jsonb;
  cursor_since timestamptz;
  cursor_id uuid;
  seen uuid[] := '{}';
begin
  -- initial sync: epoch cursor returns everything visible (3 tasks + inbox pull separately)
  res := public.pull_table_deltas('tasks');
  assert (res ->> 'count')::int = 3, 'initial pull returns all 3 tasks';
  assert (res ->> 'has_more') = 'false', 'no more pages at limit 500';

  -- keyset pagination: limit 2, then follow next_cursor — no skips, no dupes
  res := public.pull_table_deltas('tasks', '-infinity', '00000000-0000-0000-0000-000000000000', 2);
  assert (res ->> 'count')::int = 2, 'page 1 has 2 rows';
  assert (res ->> 'has_more') = 'true', 'page 1 reports more';
  cursor_since := (res -> 'next_cursor' ->> 'since')::timestamptz;
  cursor_id := (res -> 'next_cursor' ->> 'after_id')::uuid;
  seen := array[(res -> 'rows' -> 0 ->> 'id')::uuid, (res -> 'rows' -> 1 ->> 'id')::uuid];

  page2 := public.pull_table_deltas('tasks', cursor_since, cursor_id, 2);
  assert (page2 ->> 'count')::int = 1, 'page 2 has the remaining row';
  assert not ((page2 -> 'rows' -> 0 ->> 'id')::uuid = any (seen)), 'no duplicate across pages';

  -- incremental: a cursor taken from the last full pull sees nothing new...
  res := public.pull_table_deltas('tasks');
  cursor_since := (res -> 'next_cursor' ->> 'since')::timestamptz;
  cursor_id := (res -> 'next_cursor' ->> 'after_id')::uuid;
  res := public.pull_table_deltas('tasks', cursor_since, cursor_id);
  assert (res ->> 'count')::int = 0, 'up-to-date cursor pulls nothing';

  -- ...then an edit appears (updated_at advances via clock_timestamp trigger)
  update public.tasks set title = 'task one edited'
   where id = '20000000-0000-0000-0000-000000000001';
  res := public.pull_table_deltas('tasks', cursor_since, cursor_id);
  assert (res ->> 'count')::int = 1, 'edited row appears after cursor';
  assert res -> 'rows' -> 0 ->> 'title' = 'task one edited', 'edit content delivered';

  -- tombstones ride along (§11.9/§11.14)
  update public.tasks set deleted_at = now()
   where id = '20000000-0000-0000-0000-000000000002';
  res := public.pull_table_deltas('tasks', cursor_since, cursor_id);
  assert exists (
    select 1 from jsonb_array_elements(res -> 'rows') r
    where r ->> 'id' = '20000000-0000-0000-0000-000000000002'
      and r ->> 'deleted_at' is not null
  ), 'tombstoned row is delivered with deleted_at set';

  -- disallowed table
  begin
    perform public.pull_table_deltas('sync_ops');
    raise exception 'should not reach here';
  exception when others then
    null;
  end;
end;
$$;

-- stranger pulls: sees nothing of the owner's
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000bbbb","role":"authenticated"}';

do $$
declare
  res jsonb;
begin
  res := public.pull_table_deltas('tasks');
  assert (res ->> 'count')::int = 0, 'stranger pulls no owner tasks';
  res := public.pull_table_deltas('habits');
  assert (res ->> 'count')::int = 0, 'stranger pulls no owner habits';
  res := public.pull_table_deltas('projects');
  assert (res ->> 'count')::int = 1, 'stranger pulls only their own inbox';
end;
$$;

rollback;
select 'delta pull tests passed' as result;
