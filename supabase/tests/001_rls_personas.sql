-- pgTAP RLS persona tests — blueprint §12.5: "No policy merges without its tests."
-- Personas: OWNER (creates data), STRANGER (must see nothing). V1 adds MEMBER.
-- Run: supabase test db
--
-- This file is the harness skeleton with the first assertions; every table in
-- 0002_rls.sql needs its allow/deny rows here before M1 exit (backlog M0-3).

begin;
select plan(12);

-- ---------------------------------------------------------------------------
-- Fixtures: two auth users; signup trigger builds workspace/inbox/prefs/layouts.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-00000000aaaa', 'owner@test.planoa'),
  ('00000000-0000-0000-0000-00000000bbbb', 'stranger@test.planoa');

-- Owner data, created as service role (bypasses RLS for fixture setup)
insert into public.projects (id, workspace_id, owner_id, name)
select '00000000-0000-0000-0000-000000000001', w.id, '00000000-0000-0000-0000-00000000aaaa', 'Owner Project'
from public.workspaces w where w.owner_id = '00000000-0000-0000-0000-00000000aaaa';

insert into public.tasks (id, project_id, author_id, title)
values ('00000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-00000000aaaa',
        'Owner task');

insert into public.habits (id, owner_id, name, type, schedule)
values ('00000000-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-00000000aaaa',
        'Water', 'quantity', '{"kind":"daily"}');
update public.habits set target_value = 8, unit = 'glasses'
  where id = '00000000-0000-0000-0000-000000000003';

-- ---------------------------------------------------------------------------
-- Helper to impersonate a user
-- ---------------------------------------------------------------------------
create or replace function test_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end;
$$;

-- ---------------------------------------------------------------------------
-- OWNER persona: sees own data
-- ---------------------------------------------------------------------------
select test_as('00000000-0000-0000-0000-00000000aaaa');

select is(
  (select count(*)::int from public.projects where id = '00000000-0000-0000-0000-000000000001'),
  1, 'owner sees own project');

select is(
  (select count(*)::int from public.tasks where id = '00000000-0000-0000-0000-000000000002'),
  1, 'owner sees own task');

select is(
  (select count(*)::int from public.habits where id = '00000000-0000-0000-0000-000000000003'),
  1, 'owner sees own habit');

select is(
  (select count(*)::int from public.projects where is_inbox),
  1, 'owner sees exactly one inbox (signup trigger)');

select is(
  (select count(*)::int from public.dashboard_layouts),
  2, 'owner has phone + desktop default layouts');

select is(
  (select count(*)::int from public.user_preferences),
  1, 'owner sees own preferences');

-- ---------------------------------------------------------------------------
-- STRANGER persona: sees NOTHING of owner's (the §11.11 personal-space guarantee)
-- ---------------------------------------------------------------------------
select test_as('00000000-0000-0000-0000-00000000bbbb');

select is(
  (select count(*)::int from public.projects where id = '00000000-0000-0000-0000-000000000001'),
  0, 'stranger cannot see owner project');

select is(
  (select count(*)::int from public.tasks where id = '00000000-0000-0000-0000-000000000002'),
  0, 'stranger cannot see owner task');

select is(
  (select count(*)::int from public.habits where id = '00000000-0000-0000-0000-000000000003'),
  0, 'stranger cannot see owner habits — no exceptions ever');

select throws_ok(
  $$ insert into public.tasks (id, project_id, author_id, title)
     values (gen_random_uuid(), '00000000-0000-0000-0000-000000000001',
             '00000000-0000-0000-0000-00000000bbbb', 'intrusion') $$,
  '42501', null,
  'stranger cannot insert into owner project');

select throws_ok(
  $$ update public.projects set name = 'hijacked'
     where id = '00000000-0000-0000-0000-000000000001' $$,
  null, null,
  'stranger update of owner project is a no-op or error'
);

select is(
  (select count(*)::int from public.habit_logs
   where habit_id = '00000000-0000-0000-0000-000000000003'),
  0, 'stranger cannot see owner habit logs');

select * from finish();
rollback;
