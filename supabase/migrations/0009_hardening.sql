-- Security hardening from supabase advisors (applied to the live project as
-- 0008/0009; mirrored here so repo == remote).
-- 1. Pin search_path on all public functions (function_search_path_mutable).
alter function public.set_updated_at() set search_path = public;
alter function public.check_task_parent_cycle() set search_path = public;
alter function public.forbid_habit_type_change() set search_path = public;
alter function public.next_occurrence(jsonb, date, date) set search_path = public;
alter function public.complete_task(uuid, uuid, boolean) set search_path = public;
alter function public.apply_sync_ops(jsonb) set search_path = public;
alter function public.compute_streak(jsonb, jsonb, date, integer) set search_path = public;
alter function public._streak_scheduled(text, integer[], date) set search_path = public;
alter function public._streak_paused(jsonb, date) set search_path = public;
alter function public._streak_week_of(date, integer) set search_path = public;
alter function public.pull_table_deltas(text, timestamptz, uuid, integer) set search_path = public;
alter function public.pull_task_label_deltas(timestamptz, integer) set search_path = public;

-- 2. Trigger-only and job-only functions must not be client-callable at all.
--    (Triggers execute as the table owner; no caller EXECUTE needed.)
revoke execute on function public.add_owner_membership() from public, authenticated;
revoke execute on function public.handle_new_user() from public, authenticated;
revoke execute on function public.poke_synced_row() from public, authenticated;
revoke execute on function public.poke_user(uuid, text) from public, authenticated;
revoke execute on function public.set_updated_at() from public, authenticated;
revoke execute on function public.check_task_parent_cycle() from public, authenticated;
revoke execute on function public.forbid_habit_type_change() from public, authenticated;
revoke execute on function public.dispatch_task_reminders() from public, authenticated;
revoke execute on function public.dispatch_habit_reminders() from public, authenticated;
revoke execute on function public.dispatch_daily_agenda() from public, authenticated;
revoke execute on function public.refresh_habit_stats(uuid) from public, authenticated;

-- 3. RLS helper predicates and client RPCs: authenticated keeps EXECUTE
--    (policies and clients need them); anon gets nothing. The anon role only
--    exists on Supabase, hence the guard.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    return;
  end if;
  revoke execute on function public.is_project_member(uuid) from anon;
  revoke execute on function public.is_project_owner(uuid) from anon;
  revoke execute on function public.is_workspace_member(uuid) from anon;
  revoke execute on function public.complete_task(uuid, uuid, boolean) from anon;
  revoke execute on function public.apply_sync_ops(jsonb) from anon;
  revoke execute on function public.pull_table_deltas(text, timestamptz, uuid, integer) from anon;
  revoke execute on function public.pull_task_label_deltas(timestamptz, integer) from anon;
  revoke execute on function public.next_occurrence(jsonb, date, date) from anon;
  revoke execute on function public.compute_streak(jsonb, jsonb, date, integer) from anon;
  revoke execute on function public.add_owner_membership() from anon;
  revoke execute on function public.handle_new_user() from anon;
  revoke execute on function public.poke_synced_row() from anon;
  revoke execute on function public.poke_user(uuid, text) from anon;
  revoke execute on function public.dispatch_task_reminders() from anon;
  revoke execute on function public.dispatch_habit_reminders() from anon;
  revoke execute on function public.dispatch_daily_agenda() from anon;
  revoke execute on function public.refresh_habit_stats(uuid) from anon;
end;
$$;
