-- Delta pull — blueprint §11.14 / §13.6: clients keep a per-table cursor and
-- pull rows with updated_at beyond it; tombstones ride along. RLS (SECURITY
-- INVOKER) scopes every pull to what the caller may see, so one function
-- serves initial sync (epoch cursor), incremental sync, and reconnect.
--
-- Cursor semantics: composite (updated_at, id) with keyset pagination — ties
-- on updated_at can never skip or duplicate rows across pages. Server clock
-- caveat: a row committed concurrently with an in-flight pull can carry an
-- updated_at at/before the returned cursor and be missed; the Realtime poke
-- (§12.6) re-triggers a pull, and clients may also overlap cursors by a few
-- seconds — apply is idempotent LWW, so re-receiving rows is harmless.

-- task_labels joins the synced set: it needs updated_at (cursor) and
-- deleted_at (tombstones) like every synced table (§10 conventions).
alter table public.task_labels
  add column updated_at timestamptz not null default now(),
  add column deleted_at timestamptz;

create index task_labels_updated_at_idx on public.task_labels (updated_at);

create trigger task_labels_set_updated_at
  before update on public.task_labels
  for each row execute function public.set_updated_at();

create or replace function public.pull_table_deltas(
  p_table text,
  p_since timestamptz default '-infinity',
  p_after_id uuid default '00000000-0000-0000-0000-000000000000',
  p_limit integer default 500
)
returns jsonb
language plpgsql
security invoker
stable
as $$
declare
  allowed_tables constant text[] := array[
    'profiles', 'projects', 'sections', 'tasks', 'labels', 'saved_views',
    'habits', 'habit_logs', 'habit_stats', 'reminders', 'comments',
    'attachments', 'dashboard_layouts', 'user_preferences'
  ];
  id_col text;
  rows jsonb;
  n integer;
begin
  if not (p_table = any (allowed_tables)) then
    raise exception 'table not allowed in delta pull: %', p_table;
  end if;
  if p_limit < 1 or p_limit > 1000 then
    raise exception 'limit must be between 1 and 1000';
  end if;

  -- Two tables key on something other than id.
  id_col := case p_table
    when 'user_preferences' then 'user_id'
    when 'habit_stats' then 'habit_id'
    else 'id'
  end;

  -- habit_stats is a rollup cache without updated_at; computed_at plays the
  -- same role. Everything else uses updated_at.
  execute format(
    'select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb), count(*)
       from (select * from public.%I
              where (%s, %I) > ($1, $2)
              order by %s, %I
              limit $3) as t',
    p_table,
    case when p_table = 'habit_stats' then 'computed_at' else 'updated_at' end,
    id_col,
    case when p_table = 'habit_stats' then 'computed_at' else 'updated_at' end,
    id_col
  )
  into rows, n
  using p_since, p_after_id, p_limit;

  return jsonb_build_object(
    'table', p_table,
    'rows', rows,
    'count', n,
    'has_more', n = p_limit,
    'next_cursor', case when n > 0
      then jsonb_build_object(
        'since', rows -> (n - 1) ->> (case when p_table = 'habit_stats'
                                            then 'computed_at' else 'updated_at' end),
        'after_id', rows -> (n - 1) ->> id_col)
      else null end,
    'server_time', now()
  );
end;
$$;

-- task_labels pulls ride on the tasks cursor lifecycle but keep their own
-- endpoint shape via the composite PK: keyset on (updated_at, task_id, label_id).
create or replace function public.pull_task_label_deltas(
  p_since timestamptz default '-infinity',
  p_limit integer default 500
)
returns jsonb
language sql
security invoker
stable
as $$
  select jsonb_build_object(
    'table', 'task_labels',
    'rows', coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb),
    'count', count(*),
    'has_more', count(*) = p_limit,
    'server_time', now()
  )
  from (
    select * from public.task_labels
    where updated_at > p_since
    order by updated_at, task_id, label_id
    limit p_limit
  ) as t
$$;
