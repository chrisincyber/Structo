-- Notification dispatch + Realtime poke — blueprint §11.4 / §12.6.
--
-- Three dispatcher functions, designed to be driven by pg_cron every minute
-- (schedules live in supabase/setup/cron.sql — applied only on real Supabase,
-- since vanilla CI Postgres has no pg_cron). Each writes to the notifications
-- table, whose (user_id, dedupe_key) unique index makes every dispatcher
-- idempotent and missed-tick tolerant: firing windows are wide, dedupe keys
-- make each logical notification fire exactly once. Push delivery (APNs/web
-- push) is a separate Edge Function that drains unread notifications — DB
-- truth first, transport second.
--
-- All dispatchers are SECURITY DEFINER (they act across users) and revoked
-- from clients.

-- ---------------------------------------------------------------------------
-- Task reminders: absolute remind_at reached -> notification + fired_at.
-- ---------------------------------------------------------------------------
create or replace function public.dispatch_task_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select rem.id, rem.owner_id, rem.task_id, rem.remind_at, t.title
    from public.reminders rem
    join public.tasks t on t.id = rem.task_id
    where rem.fired_at is null
      and rem.deleted_at is null
      and rem.remind_at is not null
      and rem.remind_at <= now()
      and rem.remind_at > now() - interval '1 day'   -- never spam ancient backlog
      and t.deleted_at is null
      and t.completed_at is null                     -- completing silences the reminder
    order by rem.remind_at
    limit 500
    for update of rem skip locked
  loop
    insert into public.notifications (user_id, kind, payload, dedupe_key)
    values (
      r.owner_id,
      'task_reminder',
      jsonb_build_object('task_id', r.task_id, 'title', r.title,
                         'remind_at', r.remind_at),
      'reminder:' || r.id || ':' || to_char(r.remind_at, 'YYYYMMDDHH24MI')
    )
    on conflict (user_id, dedupe_key) do nothing;

    update public.reminders set fired_at = now() where id = r.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Habit reminders: habits.reminder_time, evaluated in the user's timezone on
-- scheduled days only; skipped when the day is already complete (§3.8: the
-- app never nags about something you already did).
-- Firing window is 15 minutes wide; the per-day dedupe key fires it once.
-- ---------------------------------------------------------------------------
create or replace function public.dispatch_habit_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select h.id, h.owner_id, h.name, h.type, h.target_value, h.schedule,
           h.reminder_time,
           (now() at time zone coalesce(p.timezone, 'UTC'))::date as local_today,
           (now() at time zone coalesce(p.timezone, 'UTC'))::time as local_time
    from public.habits h
    join public.profiles p on p.id = h.owner_id
    where h.reminder_time is not null
      and h.is_paused = false
      and h.archived_at is null
      and h.deleted_at is null
  loop
    -- inside the firing window?
    continue when r.local_time < r.reminder_time
             or r.local_time >= r.reminder_time + interval '15 minutes';

    -- scheduled today? (weekdays schedules only constrain binary/quantity;
    -- frequency habits accept any day)
    continue when r.schedule ->> 'kind' = 'weekdays'
      and not (r.schedule -> 'days') @> to_jsonb(extract(isodow from r.local_today)::int);

    -- already complete today?
    continue when exists (
      select 1
      from public.habit_logs hl
      where hl.habit_id = r.id
        and hl.logged_for = r.local_today
        and hl.deleted_at is null
      having sum(hl.value) >= case when r.type = 'quantity'
                                   then r.target_value else 1 end
    );

    insert into public.notifications (user_id, kind, payload, dedupe_key)
    values (
      r.owner_id,
      'habit_reminder',
      jsonb_build_object('habit_id', r.id, 'name', r.name),
      'habit:' || r.id || ':' || r.local_today
    )
    on conflict (user_id, dedupe_key) do nothing;
    if found then
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Daily agenda (opt-in, §3.8): "Your day: N tasks, M habits" at the user's
-- chosen local time.
-- ---------------------------------------------------------------------------
create or replace function public.dispatch_daily_agenda()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n integer := 0;
  task_count integer;
  habit_count integer;
begin
  for r in
    select up.user_id, up.agenda_time,
           (now() at time zone coalesce(p.timezone, 'UTC'))::date as local_today,
           (now() at time zone coalesce(p.timezone, 'UTC'))::time as local_time
    from public.user_preferences up
    join public.profiles p on p.id = up.user_id
    where up.agenda_time is not null
  loop
    continue when r.local_time < r.agenda_time
             or r.local_time >= r.agenda_time + interval '15 minutes';

    select count(*) into task_count
    from public.tasks t
    join public.projects pr on pr.id = t.project_id
    where pr.owner_id = r.user_id
      and t.deleted_at is null and t.completed_at is null
      and t.due_date is not null and t.due_date <= r.local_today;

    select count(*) into habit_count
    from public.habits h
    where h.owner_id = r.user_id
      and h.archived_at is null and h.deleted_at is null and h.is_paused = false
      and (h.schedule ->> 'kind' <> 'weekdays'
           or (h.schedule -> 'days') @> to_jsonb(extract(isodow from r.local_today)::int));

    insert into public.notifications (user_id, kind, payload, dedupe_key)
    values (
      r.user_id,
      'daily_agenda',
      jsonb_build_object('date', r.local_today,
                         'tasks_due', task_count, 'habits_scheduled', habit_count),
      'agenda:' || r.local_today
    )
    on conflict (user_id, dedupe_key) do nothing;
    if found then
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;

revoke execute on function
  public.dispatch_task_reminders(),
  public.dispatch_habit_reminders(),
  public.dispatch_daily_agenda()
from public, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime poke (§12.6): "something changed, pull deltas" — one channel per
-- user, payload is just the table name. On real Supabase this broadcasts via
-- realtime.send(); on vanilla Postgres (CI/local) it falls back to pg_notify,
-- so the trigger path is exercised everywhere.
-- ---------------------------------------------------------------------------
create or replace function public.poke_user(p_user_id uuid, p_table text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return;
  end if;
  if to_regproc('realtime.send') is not null then
    perform realtime.send(
      jsonb_build_object('table', p_table),
      'sync_poke',                 -- event
      'user:' || p_user_id,       -- topic (each client subscribes to its own)
      true                         -- private channel; RLS on realtime.messages
    );
  else
    perform pg_notify('structo_poke',
      jsonb_build_object('user_id', p_user_id, 'table', p_table)::text);
  end if;
end;
$$;

create or replace function public.poke_synced_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
begin
  if tg_op = 'DELETE' then
    rec := old;
  else
    rec := new;
  end if;

  case tg_table_name
    when 'tasks', 'sections' then
      -- project-scoped: poke every member (owner-only until V1 sharing)
      perform public.poke_user(pm.user_id, tg_table_name)
      from public.project_members pm
      where pm.project_id = rec.project_id;
    when 'projects' then
      perform public.poke_user(pm.user_id, tg_table_name)
      from public.project_members pm
      where pm.project_id = rec.id;
    when 'habits', 'labels', 'saved_views' then
      perform public.poke_user(rec.owner_id, tg_table_name);
    when 'habit_logs' then
      perform public.poke_user(rec.user_id, tg_table_name);
    when 'reminders' then
      perform public.poke_user(rec.owner_id, tg_table_name);
    when 'dashboard_layouts' then
      perform public.poke_user(rec.user_id, tg_table_name);
    else
      null;
  end case;
  return null; -- AFTER trigger
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'projects', 'sections', 'tasks', 'labels', 'saved_views',
    'habits', 'habit_logs', 'reminders', 'dashboard_layouts'
  ]
  loop
    execute format(
      'create trigger %I_poke after insert or update or delete on public.%I
         for each row execute function public.poke_synced_row()',
      t, t
    );
  end loop;
end;
$$;
