-- Dispatcher tests — dispatch_task_reminders / dispatch_habit_reminders /
-- dispatch_daily_agenda (blueprint §11.4) + poke triggers smoke.
-- Runs in one rolled-back transaction; fixtures run as service role, and
-- dispatchers are called as service role too (clients have execute revoked).

begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000aaaa', 'owner@test.planoa');

-- Profile timezone is UTC (default), so local_* == now() in assertions.
insert into public.projects (id, workspace_id, owner_id, name)
select '00000000-0000-0000-0000-000000000001', w.id, '00000000-0000-0000-0000-00000000aaaa', 'P'
from public.workspaces w where w.owner_id = '00000000-0000-0000-0000-00000000aaaa';

insert into public.tasks (id, project_id, author_id, title, due_date, due_time)
values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-00000000aaaa', 'Call dentist', current_date, '10:00');

insert into public.reminders (id, owner_id, task_id, kind, remind_at)
values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000aaaa',
        '20000000-0000-0000-0000-000000000001', 'absolute', now() - interval '1 minute');

-- habit with a reminder inside the current firing window, not yet logged
insert into public.habits (id, owner_id, name, type, schedule, reminder_time)
values ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000aaaa',
        'Read', 'binary', '{"kind":"daily"}',
        (case when (now() at time zone 'UTC')::time < time '00:06'
              then time '00:00'
              else ((now() at time zone 'UTC')::time - interval '5 minutes')::time end));

-- second habit already completed today -> must NOT remind
insert into public.habits (id, owner_id, name, type, schedule, reminder_time)
values ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000aaaa',
        'Meditate', 'binary', '{"kind":"daily"}',
        (case when (now() at time zone 'UTC')::time < time '00:06'
              then time '00:00'
              else ((now() at time zone 'UTC')::time - interval '5 minutes')::time end));
insert into public.habit_logs (id, habit_id, user_id, logged_for, value)
values (gen_random_uuid(), '40000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-00000000aaaa', (now() at time zone 'UTC')::date, 1);

-- agenda opted in, window open
update public.user_preferences
   set agenda_time = (case when (now() at time zone 'UTC')::time < time '00:06'
              then time '00:00'
              else ((now() at time zone 'UTC')::time - interval '5 minutes')::time end)
 where user_id = '00000000-0000-0000-0000-00000000aaaa';

do $$
declare
  n integer;
begin
  -- task reminder fires once
  n := public.dispatch_task_reminders();
  assert n = 1, 'one task reminder dispatched';
  assert (select fired_at from public.reminders
          where id = '30000000-0000-0000-0000-000000000001') is not null,
    'reminder marked fired';
  assert (select count(*) from public.notifications where kind = 'task_reminder') = 1,
    'task reminder notification written';

  n := public.dispatch_task_reminders();
  assert n = 0, 'fired reminder does not re-dispatch';

  -- habit reminder: fires for the unlogged habit, skips the completed one
  n := public.dispatch_habit_reminders();
  assert n = 1, 'exactly one habit reminder dispatched';
  assert (select count(*) from public.notifications
          where kind = 'habit_reminder'
            and payload ->> 'habit_id' = '40000000-0000-0000-0000-000000000001') = 1,
    'unlogged habit reminded';
  assert (select count(*) from public.notifications
          where payload ->> 'habit_id' = '40000000-0000-0000-0000-000000000002') = 0,
    'completed habit not reminded (§3.8)';

  n := public.dispatch_habit_reminders();
  assert n = 0, 'habit reminder dedupes within the day';

  -- daily agenda fires once with correct counts
  n := public.dispatch_daily_agenda();
  assert n = 1, 'agenda dispatched';
  assert (select payload ->> 'tasks_due' from public.notifications
          where kind = 'daily_agenda') = '1', 'agenda counts due tasks';
  assert (select payload ->> 'habits_scheduled' from public.notifications
          where kind = 'daily_agenda') = '2', 'agenda counts scheduled habits';

  n := public.dispatch_daily_agenda();
  assert n = 0, 'agenda dedupes within the day';

  -- completing the task silences a future reminder
  update public.reminders set fired_at = null, remind_at = now() - interval '1 second'
   where id = '30000000-0000-0000-0000-000000000001';
  update public.tasks set completed_at = now()
   where id = '20000000-0000-0000-0000-000000000001';
  n := public.dispatch_task_reminders();
  assert n = 0, 'completed task reminder not dispatched';
end;
$$;

rollback;
select 'dispatch tests passed' as result;
