-- RLS persona tests — blueprint §12.5: "No policy merges without its tests."
-- Personas: OWNER (creates data), STRANGER (must see nothing of the owner's).
-- V1 adds a MEMBER persona when sharing ships.
--
-- Plain-SQL assert style (raises on failure), runnable on any Postgres with
-- the auth shim: psql -v ON_ERROR_STOP=1 -f helpers/auth_shim.sql -f ... -f this.
-- Migrate to pgTAP when the suite runs under `supabase test db`.
--
-- The whole file runs in one rolled-back transaction: no state leaks.

begin;

-- Fixtures: two signups; the signup trigger bootstraps workspace/inbox/prefs/layouts.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000aaaa', 'owner@test.planoa'),
  ('00000000-0000-0000-0000-00000000bbbb', 'stranger@test.planoa');

do $$
begin
  assert (select count(*) from public.profiles) = 2, 'signup creates profiles';
  assert (select count(*) from public.workspaces) = 2, 'signup creates personal workspaces';
  assert (select count(*) from public.projects where is_inbox) = 2, 'signup creates inboxes';
  assert (select count(*) from public.project_members) = 2, 'inbox owner memberships exist';
  assert (select count(*) from public.dashboard_layouts) = 4, 'phone+desktop default layouts';
  assert (select count(*) from public.user_preferences) = 2, 'default preferences';
end;
$$;

-- Owner data (created in service context, bypassing RLS, as fixtures)
insert into public.projects (id, workspace_id, owner_id, name)
select '00000000-0000-0000-0000-000000000001', w.id, '00000000-0000-0000-0000-00000000aaaa', 'Owner Project'
from public.workspaces w where w.owner_id = '00000000-0000-0000-0000-00000000aaaa';

insert into public.tasks (id, project_id, author_id, title)
values ('00000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-00000000aaaa', 'Owner task');

insert into public.habits (id, owner_id, name, type, schedule, target_value, unit)
values ('00000000-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-00000000aaaa',
        'Water', 'quantity', '{"kind":"daily"}', 8, 'glasses');

insert into public.habit_logs (id, habit_id, user_id, logged_for, value)
values ('00000000-0000-0000-0000-000000000004',
        '00000000-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-00000000aaaa', current_date, 3);

-- ---------------------------------------------------------------------------
-- OWNER persona
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000aaaa","role":"authenticated"}';

do $$
begin
  assert (select count(*) from public.projects where id = '00000000-0000-0000-0000-000000000001') = 1,
    'owner sees own project';
  assert (select count(*) from public.tasks) = 1, 'owner sees own task';
  assert (select count(*) from public.habits) = 1, 'owner sees own habit';
  assert (select count(*) from public.habit_logs) = 1, 'owner sees own logs';
  assert (select count(*) from public.projects where is_inbox) = 1,
    'owner sees exactly their own inbox';
  assert (select count(*) from public.dashboard_layouts) = 2, 'owner sees own layouts only';
  assert (select count(*) from public.user_preferences) = 1, 'owner sees own prefs only';
end;
$$;

-- ---------------------------------------------------------------------------
-- STRANGER persona: the §11.11 personal-space guarantee
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000bbbb","role":"authenticated"}';

do $$
declare
  blocked boolean := false;
begin
  assert (select count(*) from public.projects where id = '00000000-0000-0000-0000-000000000001') = 0,
    'stranger cannot see owner project';
  assert (select count(*) from public.tasks) = 0, 'stranger cannot see owner tasks';
  assert (select count(*) from public.habits) = 0, 'stranger sees no owner habits — no exceptions ever';
  assert (select count(*) from public.habit_logs) = 0, 'stranger sees no owner habit logs';
  assert (select count(*) from public.projects) = 1, 'stranger sees only their own inbox';

  -- write intrusion must raise 42501
  begin
    insert into public.tasks (id, project_id, author_id, title)
    values (gen_random_uuid(), '00000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-00000000bbbb', 'intrusion');
  exception when insufficient_privilege then
    blocked := true;
  end;
  assert blocked, 'stranger insert into owner project is blocked by RLS';

  -- update intrusion must be a silent no-op (row invisible)
  update public.projects set name = 'hijacked'
   where id = '00000000-0000-0000-0000-000000000001';
  assert not found, 'stranger update of owner project matches no rows';
end;
$$;

rollback;
select 'RLS persona tests passed' as result;
