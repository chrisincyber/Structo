-- Sync spine tests — apply_sync_ops() + complete_task() (blueprint §11.14/§12.3).
-- Covers: create via upsert, recurring complete-and-roll, idempotent replay,
-- partial update, tombstone delete, and RLS enforcement through the op path.
-- Runs in one rolled-back transaction.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000aaaa', 'owner@test.structo'),
  ('00000000-0000-0000-0000-00000000bbbb', 'stranger@test.structo');

insert into public.projects (id, workspace_id, owner_id, name)
select '00000000-0000-0000-0000-000000000001', w.id, '00000000-0000-0000-0000-00000000aaaa', 'Owner Project'
from public.workspaces w where w.owner_id = '00000000-0000-0000-0000-00000000aaaa';

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000aaaa","role":"authenticated"}';

do $$
declare
  res jsonb;
begin
  -- create a recurring task (every Saturday, due 2026-07-04) through the op path
  res := public.apply_sync_ops('[
    {"op_id":"10000000-0000-0000-0000-000000000001","verb":"upsert","table":"tasks",
     "row":{"id":"20000000-0000-0000-0000-000000000001",
            "project_id":"00000000-0000-0000-0000-000000000001",
            "author_id":"00000000-0000-0000-0000-00000000aaaa",
            "title":"water plants","due_date":"2026-07-04",
            "recurrence":{"v":1,"freq":"weekly","interval":1,"weekdays":[6],
                          "anchor":"2026-07-04","mode":"fixed"}}}
  ]'::jsonb);
  assert res ->> 'applied' = '1', 'upsert create applied';
  assert (select count(*) from public.tasks
          where id = '20000000-0000-0000-0000-000000000001') = 1, 'task created';

  -- completing a recurring task rolls the due date, does not complete (§11.1)
  res := public.apply_sync_ops('[
    {"op_id":"10000000-0000-0000-0000-000000000002","verb":"complete_task",
     "task_id":"20000000-0000-0000-0000-000000000001"}
  ]'::jsonb);
  assert res -> 'results' -> 0 ->> 'status' = 'rolled', 'recurring completion rolls';
  assert (select due_date from public.tasks
          where id = '20000000-0000-0000-0000-000000000001') = date '2026-07-11',
    'due date rolled to next Saturday';
  assert (select completed_at from public.tasks
          where id = '20000000-0000-0000-0000-000000000001') is null,
    'recurring task not permanently completed';

  -- replaying the same op is deduped and changes nothing (§11.14 idempotency)
  res := public.apply_sync_ops('[
    {"op_id":"10000000-0000-0000-0000-000000000002","verb":"complete_task",
     "task_id":"20000000-0000-0000-0000-000000000001"}
  ]'::jsonb);
  assert res ->> 'deduped' = '1', 'replayed op deduped';
  assert (select due_date from public.tasks
          where id = '20000000-0000-0000-0000-000000000001') = date '2026-07-11',
    'replay did not roll again';

  -- partial update touches only the provided columns
  res := public.apply_sync_ops('[
    {"op_id":"10000000-0000-0000-0000-000000000003","verb":"upsert","table":"tasks",
     "row":{"id":"20000000-0000-0000-0000-000000000001","title":"water all plants"}}
  ]'::jsonb);
  assert (select title from public.tasks
          where id = '20000000-0000-0000-0000-000000000001') = 'water all plants',
    'partial update applied title';
  assert (select due_date from public.tasks
          where id = '20000000-0000-0000-0000-000000000001') = date '2026-07-11',
    'partial update kept due date';

  -- delete tombstones, never hard-deletes (§11.9)
  res := public.apply_sync_ops('[
    {"op_id":"10000000-0000-0000-0000-000000000004","verb":"delete","table":"tasks",
     "id":"20000000-0000-0000-0000-000000000001"}
  ]'::jsonb);
  assert (select deleted_at from public.tasks
          where id = '20000000-0000-0000-0000-000000000001') is not null,
    'delete tombstoned the row';

  -- permanent completion of a recurring task (§8.5 "complete forever")
  res := public.apply_sync_ops('[
    {"op_id":"10000000-0000-0000-0000-000000000005","verb":"upsert","table":"tasks",
     "row":{"id":"20000000-0000-0000-0000-000000000009",
            "project_id":"00000000-0000-0000-0000-000000000001",
            "author_id":"00000000-0000-0000-0000-00000000aaaa",
            "title":"recurring forever-done","due_date":"2026-07-04",
            "recurrence":{"v":1,"freq":"daily","interval":1,"mode":"fixed"}}},
    {"op_id":"10000000-0000-0000-0000-000000000006","verb":"complete_task",
     "task_id":"20000000-0000-0000-0000-000000000009","permanent":true}
  ]'::jsonb);
  assert (select completed_at from public.tasks
          where id = '20000000-0000-0000-0000-000000000009') is not null,
    'permanent completion completes a recurring task';
end;
$$;

-- ---------------------------------------------------------------------------
-- STRANGER: the op path enforces RLS exactly like direct writes
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000bbbb","role":"authenticated"}';

do $$
declare
  blocked boolean := false;
begin
  begin
    perform public.apply_sync_ops('[
      {"op_id":"10000000-0000-0000-0000-000000000007","verb":"upsert","table":"tasks",
       "row":{"id":"20000000-0000-0000-0000-000000000099",
              "project_id":"00000000-0000-0000-0000-000000000001",
              "author_id":"00000000-0000-0000-0000-00000000bbbb","title":"intrusion"}}
    ]'::jsonb);
  exception when insufficient_privilege then
    blocked := true;
  end;
  assert blocked, 'stranger sync-write into owner project is blocked by RLS';

  begin
    perform public.apply_sync_ops('[
      {"op_id":"10000000-0000-0000-0000-000000000008","verb":"upsert","table":"sync_ops",
       "row":{"id":"20000000-0000-0000-0000-000000000098"}}
    ]'::jsonb);
    blocked := false;
  exception when others then
    blocked := true;
  end;
  assert blocked, 'non-whitelisted table is rejected';
end;
$$;

rollback;
select 'sync op tests passed' as result;
