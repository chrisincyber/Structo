-- Account lifecycle (§3.9 MVP: data export + account deletion).
--
-- export_account_data(): SECURITY INVOKER — RLS scopes every sub-select to the
-- caller, so the export is exactly what the user can see.
--
-- delete_account(): SECURITY DEFINER — deletes the caller's content in
-- FK-safe order, then the auth user (cascades profile -> workspace ->
-- projects -> remaining project content). Fixes the ordering caveat found in
-- live E2E: tasks.author_id / completed_by / project_members.invited_by /
-- activity_log.actor_id reference profiles without cascade.

create or replace function public.export_account_data()
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) - 'id' from public.profiles p where p.id = auth.uid()),
    'preferences', (select to_jsonb(up) from public.user_preferences up where up.user_id = auth.uid()),
    'projects', coalesce((select jsonb_agg(to_jsonb(x) order by x.rank) from public.projects x where x.deleted_at is null), '[]'::jsonb),
    'sections', coalesce((select jsonb_agg(to_jsonb(x)) from public.sections x where x.deleted_at is null), '[]'::jsonb),
    'tasks', coalesce((select jsonb_agg(to_jsonb(x) - 'search') from public.tasks x where x.deleted_at is null), '[]'::jsonb),
    'labels', coalesce((select jsonb_agg(to_jsonb(x)) from public.labels x where x.deleted_at is null), '[]'::jsonb),
    'task_labels', coalesce((select jsonb_agg(to_jsonb(x)) from public.task_labels x where x.deleted_at is null), '[]'::jsonb),
    'saved_views', coalesce((select jsonb_agg(to_jsonb(x)) from public.saved_views x where x.deleted_at is null), '[]'::jsonb),
    'habits', coalesce((select jsonb_agg(to_jsonb(x)) from public.habits x where x.deleted_at is null), '[]'::jsonb),
    'habit_logs', coalesce((select jsonb_agg(to_jsonb(x)) from public.habit_logs x where x.deleted_at is null), '[]'::jsonb),
    'reminders', coalesce((select jsonb_agg(to_jsonb(x)) from public.reminders x where x.deleted_at is null), '[]'::jsonb),
    'dashboard_layouts', coalesce((select jsonb_agg(to_jsonb(x)) from public.dashboard_layouts x), '[]'::jsonb)
  )
$$;

create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  -- content that blocks the profile cascade, in FK-safe order
  delete from public.habit_logs where user_id = uid;
  delete from public.habits where owner_id = uid;
  delete from public.reminders where owner_id = uid;
  delete from public.attachments where uploader_id = uid;
  delete from public.comments where author_id = uid;
  update public.tasks set completed_by = null where completed_by = uid;
  update public.tasks set assignee_id = null where assignee_id = uid;
  delete from public.tasks where author_id = uid;
  update public.project_members set invited_by = null where invited_by = uid;
  delete from public.activity_log where actor_id = uid;
  delete from public.sync_ops where user_id = uid;

  -- cascades: profile -> workspaces -> projects -> sections/memberships/etc.
  delete from auth.users where id = uid;
end;
$$;

revoke execute on function public.export_account_data() from public;
revoke execute on function public.delete_account() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function public.export_account_data() from anon;
    revoke execute on function public.delete_account() from anon;
  end if;
end;
$$;
