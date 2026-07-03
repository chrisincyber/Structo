-- Planoa schema v1 — implements PLANOA_BLUEPRINT.md §10.
-- Conventions:
--   * PKs are client-generated UUIDv7; gen_random_uuid() is a server-side fallback
--     for rows created by triggers/jobs.
--   * Every synced table carries created_at, updated_at (server-set via trigger),
--     deleted_at (soft-delete tombstone for sync).
--   * updated_at is indexed on synced tables (delta-pull cursor).
--   * RLS is enabled here, policies live in 0002_rls.sql.

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- Shared trigger: server-authoritative updated_at.
-- clock_timestamp(), not now(): now() is frozen at transaction start, so every
-- row touched in one transaction (e.g. an apply_sync_ops batch) would share
-- one timestamp and a delta-pull cursor could never advance past it. Real
-- wall-clock per statement keeps cursors monotonic; ties that remain are
-- handled by the (updated_at, id) keyset in pull_table_deltas.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles (§10.2) — 1:1 with auth.users
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  timezone text not null default 'UTC',
  week_start smallint not null default 1 check (week_start between 1 and 7), -- ISO: 1=Mon
  day_end_offset_minutes integer not null default 0,                        -- reserved (§5.4)
  plan text not null default 'free' check (plan in ('free', 'pro')),
  onboarding_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- workspaces & workspace_members (§10.3/10.4) — schema now, product later.
-- MVP: one auto-created personal workspace per user; UI never shows it.
-- ---------------------------------------------------------------------------
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'personal' check (kind in ('personal', 'shared')),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- ---------------------------------------------------------------------------
-- projects (§10.5) — Inbox is a real, undeletable per-user project (is_inbox)
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  color text not null default 'stone',
  rank text not null default 'm',
  is_inbox boolean not null default false,
  is_archived boolean not null default false,
  archived_at timestamptz,
  view_layout text not null default 'list' check (view_layout in ('list', 'board')), -- board = V2
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index projects_workspace_idx on public.projects (workspace_id, is_archived, rank)
  where deleted_at is null;
create index projects_updated_at_idx on public.projects (updated_at);
-- exactly one inbox per user
create unique index projects_one_inbox_per_user on public.projects (owner_id)
  where is_inbox and deleted_at is null;

-- ---------------------------------------------------------------------------
-- project_members (§10.6) — schema at MVP, product at V1.
-- ALL project-scoped RLS routes through this table from day one.
-- ---------------------------------------------------------------------------
create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  invited_by uuid references public.profiles (id),
  joined_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index project_members_user_idx on public.project_members (user_id);

-- Owner membership is created automatically with the project.
create or replace function public.add_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.project_members (project_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict do nothing;
  return new;
end;
$$;

create trigger projects_add_owner_membership
  after insert on public.projects
  for each row execute function public.add_owner_membership();

-- ---------------------------------------------------------------------------
-- sections (§10.7)
-- ---------------------------------------------------------------------------
create table public.sections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  rank text not null default 'm',
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index sections_project_idx on public.sections (project_id, rank) where deleted_at is null;
create index sections_updated_at_idx on public.sections (updated_at);

-- ---------------------------------------------------------------------------
-- tasks (§10.8)
-- Due dates are FLOATING LOCAL (date + optional time, no zone) — §11.12.
-- ---------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  section_id uuid references public.sections (id) on delete set null,
  parent_task_id uuid references public.tasks (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  assignee_id uuid references public.profiles (id),            -- V1 (collaboration)
  title text not null check (length(title) > 0),
  description text not null default '',
  priority smallint not null default 4 check (priority between 1 and 4),
  due_date date,
  due_time time,
  due_tz text,                                                 -- reserved, V2 fixed-zone events
  deadline_date date,                                          -- V1
  recurrence jsonb,                                            -- structured rule, §11.1
  recurrence_text text,                                        -- display string
  completed_at timestamptz,
  completed_by uuid references public.profiles (id),
  rank text not null default 'm',                              -- order within section
  day_rank text not null default 'm',                          -- order within Today (§10.8 ⚠️)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint due_time_requires_date check (due_time is null or due_date is not null),
  constraint recurrence_requires_date check (recurrence is null or due_date is not null)
);

create index tasks_project_open_idx on public.tasks (project_id, section_id, rank)
  where completed_at is null and deleted_at is null;
create index tasks_due_idx on public.tasks (author_id, due_date)
  where completed_at is null and deleted_at is null;
create index tasks_parent_idx on public.tasks (parent_task_id) where deleted_at is null;
create index tasks_updated_at_idx on public.tasks (updated_at);

-- Full-text search (web path; iOS uses local FTS5) — §12.7
alter table public.tasks
  add column search tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'B')
  ) stored;
create index tasks_search_idx on public.tasks using gin (search);

-- Forbid parent cycles (§10.8)
create or replace function public.check_task_parent_cycle()
returns trigger
language plpgsql
as $$
declare
  cursor_id uuid := new.parent_task_id;
  depth integer := 0;
begin
  while cursor_id is not null loop
    if cursor_id = new.id then
      raise exception 'task parent cycle detected';
    end if;
    depth := depth + 1;
    if depth > 50 then
      raise exception 'task nesting too deep';
    end if;
    select parent_task_id into cursor_id from public.tasks where id = cursor_id;
  end loop;
  return new;
end;
$$;

create trigger tasks_no_parent_cycle
  before insert or update of parent_task_id on public.tasks
  for each row when (new.parent_task_id is not null)
  execute function public.check_task_parent_cycle();

-- ---------------------------------------------------------------------------
-- labels & task_labels (§10.9) — personal, never shared
-- ---------------------------------------------------------------------------
create table public.labels (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (length(name) > 0),
  color text not null default 'stone',
  rank text not null default 'm',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index labels_owner_name_idx on public.labels (owner_id, lower(name))
  where deleted_at is null;
create index labels_updated_at_idx on public.labels (updated_at);

create table public.task_labels (
  task_id uuid not null references public.tasks (id) on delete cascade,
  label_id uuid not null references public.labels (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, label_id)
);

create index task_labels_label_idx on public.task_labels (label_id);

-- ---------------------------------------------------------------------------
-- saved_views (§10.10) — V1 product, schema now. query = filter AST (versioned).
-- ---------------------------------------------------------------------------
create table public.saved_views (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  icon text,
  query jsonb not null,
  query_text text not null default '',
  rank text not null default 'm',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index saved_views_owner_idx on public.saved_views (owner_id, rank) where deleted_at is null;
create index saved_views_updated_at_idx on public.saved_views (updated_at);

-- ---------------------------------------------------------------------------
-- habits (§10.11) — separate pillar; NOT a task subtype (locked, §5.2)
-- schedule jsonb: {"kind":"daily"} | {"kind":"weekdays","days":[1,3,5]} | {"kind":"per_week"}
-- ---------------------------------------------------------------------------
create table public.habits (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (length(name) > 0),
  icon text not null default 'circle',
  color text,                                                  -- V2 (curated palette only)
  type text not null check (type in ('binary', 'quantity', 'frequency')),
  target_value numeric,
  unit text,
  times_per_week smallint check (times_per_week between 1 and 7),
  schedule jsonb not null default '{"kind":"daily"}'::jsonb,
  reminder_time time,
  rank text not null default 'm',
  is_paused boolean not null default false,
  paused_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint quantity_has_target check ((type = 'quantity') = (target_value is not null)),
  constraint frequency_has_times check ((type = 'frequency') = (times_per_week is not null))
);

create index habits_owner_idx on public.habits (owner_id, rank)
  where archived_at is null and deleted_at is null;
create index habits_updated_at_idx on public.habits (updated_at);

-- Habit type is immutable at MVP (§8.6): changing type corrupts history semantics.
create or replace function public.forbid_habit_type_change()
returns trigger
language plpgsql
as $$
begin
  if new.type is distinct from old.type then
    raise exception 'habit type is immutable';
  end if;
  return new;
end;
$$;

create trigger habits_type_immutable
  before update of type on public.habits
  for each row execute function public.forbid_habit_type_change();

-- ---------------------------------------------------------------------------
-- habit_logs (§10.13) — append-only behavioral record; the moat table.
-- Never UPDATEd (tombstone deleted_at only, for binary un-log).
-- Corrections are compensating negative-value entries (§5.4).
-- ---------------------------------------------------------------------------
create table public.habit_logs (
  id uuid primary key,                                         -- client UUID → idempotent sync
  habit_id uuid not null references public.habits (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  logged_for date not null,                                    -- user-local day it counts toward
  value numeric not null default 1,                            -- negative = compensating entry
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index habit_logs_habit_day_idx on public.habit_logs (habit_id, logged_for)
  where deleted_at is null;
create index habit_logs_user_day_idx on public.habit_logs (user_id, logged_for)
  where deleted_at is null;
create index habit_logs_updated_at_idx on public.habit_logs (updated_at);

-- ---------------------------------------------------------------------------
-- habit_stats (§5.5/§11.5) — nightly rollup cache; derived, recomputable.
-- ---------------------------------------------------------------------------
create table public.habit_stats (
  habit_id uuid primary key references public.habits (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  current_streak integer not null default 0,
  best_streak integer not null default 0,
  streak_unit text not null default 'days' check (streak_unit in ('days', 'weeks')),
  completions_this_week integer not null default 0,
  computed_at timestamptz not null default now()
);

create index habit_stats_user_idx on public.habit_stats (user_id);

-- ---------------------------------------------------------------------------
-- reminders (§10.14) — task reminders; habit reminders live on habits.reminder_time
-- ---------------------------------------------------------------------------
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  kind text not null default 'absolute' check (kind in ('absolute', 'offset')),
  remind_at timestamptz,
  offset_minutes integer,
  fired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint absolute_has_remind_at check (kind <> 'absolute' or remind_at is not null),
  constraint offset_has_minutes check (kind <> 'offset' or offset_minutes is not null)
);

-- The dispatcher sweep (§11.4)
create index reminders_sweep_idx on public.reminders (remind_at)
  where fired_at is null and deleted_at is null;
create index reminders_task_idx on public.reminders (task_id) where deleted_at is null;
create index reminders_updated_at_idx on public.reminders (updated_at);

-- ---------------------------------------------------------------------------
-- notifications (§10.15) — in-app feed + push dedupe ledger
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index notifications_dedupe_idx on public.notifications (user_id, dedupe_key);
create index notifications_feed_idx on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- comments (§10.16) & attachments (§10.17) — V1 product, schema now
-- ---------------------------------------------------------------------------
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  body text not null,
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index comments_task_idx on public.comments (task_id, created_at) where deleted_at is null;
create index comments_updated_at_idx on public.comments (updated_at);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete set null,
  uploader_id uuid not null references public.profiles (id),
  storage_path text not null,                                  -- attachments/{project_id}/{task_id}/{uuid-name}
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 26214400), -- 25MB
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index attachments_task_idx on public.attachments (task_id) where deleted_at is null;
create index attachments_updated_at_idx on public.attachments (updated_at);

-- ---------------------------------------------------------------------------
-- dashboard_layouts (§10.18) — one row per user per device class; widgets as
-- ordered jsonb array: [{instance_id, widget_type, size, config}]
-- ---------------------------------------------------------------------------
create table public.dashboard_layouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  device_class text not null check (device_class in ('phone', 'desktop')),
  widgets jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index dashboard_layouts_user_class_idx on public.dashboard_layouts (user_id, device_class);
create index dashboard_layouts_updated_at_idx on public.dashboard_layouts (updated_at);

-- ---------------------------------------------------------------------------
-- user_preferences (§10.20) — synced prefs only; device-local prefs stay on-device
-- ---------------------------------------------------------------------------
create table public.user_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  default_landing text not null default 'home' check (default_landing in ('home', 'today')),
  accent text not null default 'teal',
  time_format text not null default 'system' check (time_format in ('system', '12h', '24h')),
  notification_prefs jsonb not null default '{}'::jsonb,
  agenda_time time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- activity_log (§10.21) — V1 with collaboration; MVP writes nothing here
-- ---------------------------------------------------------------------------
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  actor_id uuid not null references public.profiles (id),
  verb text not null,
  object_type text not null,
  object_id uuid not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index activity_log_project_idx on public.activity_log (project_id, created_at desc);

-- ---------------------------------------------------------------------------
-- sync op ledger — server-side dedupe for idempotent client ops (§11.14)
-- ---------------------------------------------------------------------------
create table public.sync_ops (
  op_id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  applied_at timestamptz not null default now()
);

create index sync_ops_user_idx on public.sync_ops (user_id, applied_at);

-- ---------------------------------------------------------------------------
-- updated_at triggers for all synced tables
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'workspaces', 'projects', 'sections', 'tasks', 'labels',
    'saved_views', 'habits', 'habit_logs', 'reminders', 'comments',
    'attachments', 'dashboard_layouts', 'user_preferences'
  ]
  loop
    execute format(
      'create trigger %I_set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()',
      t, t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Signup bootstrap (§10.2/§10.3/§10.8): profile, personal workspace,
-- membership, Inbox project, default preferences, default dashboard layouts.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_id uuid := gen_random_uuid();
begin
  insert into public.profiles (id, display_name, timezone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    'UTC'
  );

  insert into public.workspaces (id, name, kind, owner_id)
  values (ws_id, 'Personal', 'personal', new.id);

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws_id, new.id, 'owner');

  insert into public.projects (workspace_id, owner_id, name, color, is_inbox, rank)
  values (ws_id, new.id, 'Inbox', 'stone', true, 'a');

  insert into public.user_preferences (user_id) values (new.id);

  -- Default Home layout (§6.2): Today Tasks (L), Habits Today (M), Quick Add (S), Upcoming Peek (M)
  insert into public.dashboard_layouts (user_id, device_class, widgets)
  select new.id, dc, '[
      {"instance_id": "w-today",    "widget_type": "today_tasks",  "size": "L", "config": {}},
      {"instance_id": "w-habits",   "widget_type": "habits_today", "size": "M", "config": {}},
      {"instance_id": "w-quickadd", "widget_type": "quick_add",    "size": "S", "config": {}},
      {"instance_id": "w-upcoming", "widget_type": "upcoming_peek","size": "M", "config": {}}
    ]'::jsonb
  from unnest(array['phone', 'desktop']) as dc;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
