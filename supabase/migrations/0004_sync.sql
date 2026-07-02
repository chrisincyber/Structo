-- Sync spine, server side — blueprint §11.14 / §12.3.
-- apply_sync_ops() is the transactional core behind the sync-push Edge Function:
-- an ordered batch of idempotent ops, each deduped by client-generated op_id.
-- SECURITY INVOKER — every write passes through RLS exactly as a direct
-- PostgREST write would; this function adds atomicity + dedupe, never privilege.
--
-- Op vocabulary v1:
--   {op_id, verb: 'upsert',        table, row}          -- row-level LWW write
--   {op_id, verb: 'delete',        table, id}           -- soft-delete tombstone
--   {op_id, verb: 'complete_task', task_id, permanent?} -- delegates to complete_task()
--
-- Not in the generic path (by design):
--   * task_labels (composite PK)  -> clients write via PostgREST directly
--   * user_preferences (PK=user_id, no ordering needs) -> PostgREST directly
--   * habit un-log                -> 'delete' on habit_logs (tombstone, §5.4)

create or replace function public.apply_sync_ops(p_ops jsonb)
returns jsonb
language plpgsql
security invoker
as $$
declare
  allowed_tables constant text[] := array[
    'projects', 'sections', 'tasks', 'labels', 'saved_views',
    'habits', 'habit_logs', 'reminders', 'comments', 'attachments',
    'dashboard_layouts'
  ];
  op jsonb;
  v_op_id uuid;
  verb text;
  tbl text;
  cols text;
  n_rows integer;
  results jsonb := '[]'::jsonb;
  applied integer := 0;
  deduped integer := 0;
  res jsonb;
begin
  if jsonb_typeof(p_ops) <> 'array' then
    raise exception 'ops must be a jsonb array';
  end if;
  if jsonb_array_length(p_ops) > 200 then
    raise exception 'op batch too large (max 200)';
  end if;

  for op in select * from jsonb_array_elements(p_ops)
  loop
    v_op_id := (op ->> 'op_id')::uuid;
    verb := op ->> 'verb';

    if verb = 'complete_task' then
      -- complete_task handles its own dedupe under the same op_id
      res := public.complete_task(
        v_op_id,
        (op ->> 'task_id')::uuid,
        coalesce((op ->> 'permanent')::boolean, false)
      );
      if res ->> 'status' = 'deduped' then
        deduped := deduped + 1;
      else
        applied := applied + 1;
      end if;
      results := results || res;
      continue;
    end if;

    insert into public.sync_ops (op_id, user_id)
    values (v_op_id, auth.uid())
    on conflict (op_id) do nothing;
    if not found then
      deduped := deduped + 1;
      results := results || jsonb_build_object('op_id', v_op_id, 'status', 'deduped');
      continue;
    end if;

    tbl := op ->> 'table';
    if tbl is null or not (tbl = any (allowed_tables)) then
      raise exception 'table not allowed in sync ops: %', tbl;
    end if;

    if verb = 'upsert' then
      -- Only columns present in the payload are inserted/assigned: absent
      -- columns keep their defaults on insert and their values on update
      -- (partial updates are safe). Server-owned and generated columns are
      -- excluded ('search' is a generated column on tasks).
      select string_agg(quote_ident(k), ', ') into cols
      from jsonb_object_keys(op -> 'row') as k
      where k not in ('id', 'created_at', 'updated_at', 'search');

      -- Update-first, then insert. Not ON CONFLICT DO UPDATE: Postgres enforces
      -- the INSERT policy's WITH CHECK on every proposed row even when it takes
      -- the update path, which rejects legitimate partial updates. An UPDATE
      -- matching 0 rows (row absent, or hidden by RLS) falls through to a plain
      -- INSERT, where full-row RLS checks apply as intended.
      if cols is null then
        execute format(
          'insert into public.%I (id) values ($1) on conflict (id) do nothing',
          tbl
        ) using (op -> 'row' ->> 'id')::uuid;
      else
        execute format(
          'update public.%I
             set (%s) = (select %s from jsonb_populate_record(null::public.%I, $1))
           where id = $2',
          tbl, cols, cols, tbl
        ) using op -> 'row', (op -> 'row' ->> 'id')::uuid;

        -- FOUND is not set by dynamic EXECUTE; ROW_COUNT is.
        get diagnostics n_rows = row_count;
        if n_rows = 0 then
          execute format(
            'insert into public.%I (id, %s)
               select id, %s from jsonb_populate_record(null::public.%I, $1)
             on conflict (id) do nothing',
            tbl, cols, cols, tbl
          ) using op -> 'row';
        end if;
      end if;

    elsif verb = 'delete' then
      -- Tombstone, never hard delete (§11.9). Deletes win over concurrent edits
      -- simply because the tombstone filters the row out everywhere (§11.14).
      execute format(
        'update public.%I set deleted_at = coalesce(deleted_at, now()) where id = $1',
        tbl
      ) using (op ->> 'id')::uuid;

    else
      raise exception 'unknown sync verb: %', verb;
    end if;

    applied := applied + 1;
    results := results || jsonb_build_object('op_id', v_op_id, 'status', 'applied');
  end loop;

  return jsonb_build_object(
    'applied', applied,
    'deduped', deduped,
    'server_time', now(),
    'results', results
  );
end;
$$;
