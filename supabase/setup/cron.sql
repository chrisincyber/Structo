-- pg_cron schedules — apply ONCE on a real Supabase project (Dashboard SQL
-- editor or `psql -f`), NOT part of the migration chain: vanilla CI Postgres
-- has no pg_cron, and cron.schedule() is idempotent-by-name so re-running
-- this file is safe.
--
-- Blueprint §12.3: per-minute reminder sweep, nightly stats rollup, 30-day
-- purge of tombstoned rows.

create extension if not exists pg_cron;

select cron.schedule(
  'dispatch-task-reminders', '* * * * *',
  $$select public.dispatch_task_reminders()$$
);

select cron.schedule(
  'dispatch-habit-reminders', '* * * * *',
  $$select public.dispatch_habit_reminders()$$
);

select cron.schedule(
  'dispatch-daily-agenda', '* * * * *',
  $$select public.dispatch_daily_agenda()$$
);

-- Nightly habit stats rollup. Runs hourly rather than nightly so "nightly in
-- the user's timezone" needs no zone bookkeeping — recompute is cheap and
-- idempotent (§11.5: derived data, recompute never merge).
select cron.schedule(
  'refresh-habit-stats', '15 * * * *',
  $$select public.refresh_habit_stats()$$
);

-- Hard-purge tombstones older than 30 days (§11.9).
select cron.schedule(
  'purge-tombstones', '45 3 * * *',
  $$
  do $purge$
  declare t text;
  begin
    foreach t in array array[
      'tasks', 'sections', 'projects', 'labels', 'saved_views',
      'habits', 'habit_logs', 'reminders', 'comments', 'attachments'
    ] loop
      execute format(
        'delete from public.%I where deleted_at < now() - interval ''30 days''', t);
    end loop;
    delete from public.sync_ops where applied_at < now() - interval '90 days';
  end
  $purge$
  $$
);
