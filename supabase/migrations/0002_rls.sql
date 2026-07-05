-- Structo RLS v1 — implements STRUCTO_BLUEPRINT.md §12.5.
-- Principles:
--   * Deny-by-default on every table.
--   * ALL project-scoped access routes through is_project_member(), even while
--     membership is always just the owner at MVP — V1 sharing becomes an INSERT,
--     not a policy rewrite.
--   * Personal tables (habits, habit_logs, labels, saved_views, dashboard_layouts,
--     user_preferences, notifications, reminders) are strictly auth.uid()-scoped.
--     This is the enforcement of the §11.11 personal-space guarantee.
--   * No policy merges without pgTAP persona tests (supabase/tests/).

-- ---------------------------------------------------------------------------
-- Canonical membership helper (SECURITY DEFINER so it can read project_members
-- without recursive RLS evaluation).
-- ---------------------------------------------------------------------------
create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = auth.uid()
  );
$$;

create or replace function public.is_project_owner(p_project_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = auth.uid()
      and pm.role = 'owner'
  );
$$;

create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere (deny-by-default)
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.sections enable row level security;
alter table public.tasks enable row level security;
alter table public.labels enable row level security;
alter table public.task_labels enable row level security;
alter table public.saved_views enable row level security;
alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;
alter table public.habit_stats enable row level security;
alter table public.reminders enable row level security;
alter table public.notifications enable row level security;
alter table public.comments enable row level security;
alter table public.attachments enable row level security;
alter table public.dashboard_layouts enable row level security;
alter table public.user_preferences enable row level security;
alter table public.activity_log enable row level security;
alter table public.sync_ops enable row level security;

-- ---------------------------------------------------------------------------
-- profiles — owner full access; V1 adds co-member read of display fields via a view
-- ---------------------------------------------------------------------------
create policy profiles_select on public.profiles
  for select using (id = auth.uid());
create policy profiles_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- workspaces / workspace_members — member read; owner mutate
-- ---------------------------------------------------------------------------
create policy workspaces_select on public.workspaces
  for select using (public.is_workspace_member(id));
create policy workspaces_update on public.workspaces
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy workspace_members_select on public.workspace_members
  for select using (user_id = auth.uid() or public.is_workspace_member(workspace_id));

-- ---------------------------------------------------------------------------
-- projects — membership-routed
-- ---------------------------------------------------------------------------
create policy projects_select on public.projects
  for select using (public.is_project_member(id));
create policy projects_insert on public.projects
  for insert with check (
    owner_id = auth.uid()
    and public.is_workspace_member(workspace_id)
    and is_inbox = false                       -- inbox is created only by the signup trigger
  );
create policy projects_update on public.projects
  for update using (public.is_project_member(id))
  with check (public.is_project_member(id));
create policy projects_delete on public.projects
  for delete using (public.is_project_owner(id) and is_inbox = false);

-- ---------------------------------------------------------------------------
-- project_members — visible to co-members; managed by owners (V1 invite flow
-- goes through an Edge Function; direct grants stay owner-only)
-- ---------------------------------------------------------------------------
create policy project_members_select on public.project_members
  for select using (user_id = auth.uid() or public.is_project_member(project_id));
create policy project_members_insert on public.project_members
  for insert with check (public.is_project_owner(project_id));
create policy project_members_delete on public.project_members
  for delete using (
    public.is_project_owner(project_id)
    or user_id = auth.uid()                    -- a member may leave
  );

-- ---------------------------------------------------------------------------
-- sections / tasks / comments / attachments — inherit project membership
-- ---------------------------------------------------------------------------
create policy sections_all on public.sections
  for all using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

create policy tasks_all on public.tasks
  for all using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

create policy comments_select on public.comments
  for select using (exists (
    select 1 from public.tasks t
    where t.id = task_id and public.is_project_member(t.project_id)
  ));
create policy comments_insert on public.comments
  for insert with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.tasks t
      where t.id = task_id and public.is_project_member(t.project_id)
    )
  );
create policy comments_update on public.comments
  for update using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy comments_delete on public.comments
  for delete using (author_id = auth.uid());

create policy attachments_select on public.attachments
  for select using (exists (
    select 1 from public.tasks t
    where t.id = task_id and public.is_project_member(t.project_id)
  ));
create policy attachments_insert on public.attachments
  for insert with check (
    uploader_id = auth.uid()
    and exists (
      select 1 from public.tasks t
      where t.id = task_id and public.is_project_member(t.project_id)
    )
  );
create policy attachments_delete on public.attachments
  for delete using (uploader_id = auth.uid());

-- ---------------------------------------------------------------------------
-- task_labels — task side requires project membership; label side requires
-- label ownership (labels are personal even in shared projects, §10.9)
-- ---------------------------------------------------------------------------
create policy task_labels_select on public.task_labels
  for select using (
    exists (
      select 1 from public.labels l
      where l.id = label_id and l.owner_id = auth.uid()
    )
  );
create policy task_labels_insert on public.task_labels
  for insert with check (
    exists (
      select 1 from public.labels l
      where l.id = label_id and l.owner_id = auth.uid()
    )
    and exists (
      select 1 from public.tasks t
      where t.id = task_id and public.is_project_member(t.project_id)
    )
  );
create policy task_labels_delete on public.task_labels
  for delete using (
    exists (
      select 1 from public.labels l
      where l.id = label_id and l.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Strictly personal tables — auth.uid() only, no exceptions ever (§12.5)
-- ---------------------------------------------------------------------------
create policy labels_all on public.labels
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy saved_views_all on public.saved_views
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy habits_all on public.habits
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy habit_logs_all on public.habit_logs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy habit_stats_select on public.habit_stats
  for select using (user_id = auth.uid());
-- habit_stats writes happen only via the nightly rollup job (service role)

create policy reminders_all on public.reminders
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy notifications_select on public.notifications
  for select using (user_id = auth.uid());
create policy notifications_update on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
-- notification inserts happen only via dispatcher Edge Functions (service role)

create policy dashboard_layouts_all on public.dashboard_layouts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy user_preferences_select on public.user_preferences
  for select using (user_id = auth.uid());
create policy user_preferences_update on public.user_preferences
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy activity_log_select on public.activity_log
  for select using (public.is_project_member(project_id));
-- activity_log inserts happen via triggers/Edge Functions (V1, service role)

create policy sync_ops_select on public.sync_ops
  for select using (user_id = auth.uid());
create policy sync_ops_insert on public.sync_ops
  for insert with check (user_id = auth.uid());
-- sync_ops rows are written by apply_sync_ops()/complete_task() (SECURITY
-- INVOKER), so users insert their own dedupe-ledger rows; never updated/deleted.
