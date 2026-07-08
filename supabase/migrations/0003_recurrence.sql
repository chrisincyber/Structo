-- Recurrence engine, server side — blueprint §11.1 / §12.3.
-- next_occurrence() is the Postgres implementation of spec/recurrence/grammar.md;
-- it must stay conformant with spec/recurrence/vectors.json (checked in CI by
-- supabase/tests/003_recurrence_vectors generated from the vector file).
--
-- complete_task() is the atomic complete-and-roll RPC: clients never compute
-- the next occurrence for the authoritative write. SECURITY INVOKER — RLS
-- governs which tasks it can touch.

create or replace function public.next_occurrence(
  rule jsonb,
  from_date date,
  anchor_override date default null
)
returns date
language plpgsql
immutable
as $$
declare
  freq text := rule ->> 'freq';
  ival integer := coalesce((rule ->> 'interval')::integer, 1);
  anchor date := coalesce(anchor_override, (rule ->> 'anchor')::date, from_date);
  wdays integer[];
  mday integer;
  d date;
  first_of_month date;
  anchor_monday date;
  guard integer := 0;
begin
  if ival < 1 then
    raise exception 'recurrence interval must be >= 1';
  end if;

  if freq = 'daily' then
    return from_date + ival;

  elsif freq = 'weekly' then
    if rule ? 'weekdays' then
      select array_agg(x::integer) into wdays
      from jsonb_array_elements_text(rule -> 'weekdays') as x;

      anchor_monday := anchor - (extract(isodow from anchor)::integer - 1);
      d := from_date + 1;
      loop
        guard := guard + 1;
        if guard > 800 then
          raise exception 'no next occurrence found for rule %', rule;
        end if;
        if extract(isodow from d)::integer = any (wdays)
           and (((d - (extract(isodow from d)::integer - 1)) - anchor_monday) / 7) % ival = 0
        then
          return d;
        end if;
        d := d + 1;
      end loop;
    else
      return from_date + 7 * ival;
    end if;

  elsif freq = 'monthly' then
    -- Clamp to last day of shorter months; the stored rule keeps its monthday,
    -- so the "31st" resumes in longer months (spec: monthly_recovers_from_clamp).
    mday := coalesce((rule ->> 'monthday')::integer, extract(day from anchor)::integer);
    first_of_month := (date_trunc('month', from_date) + make_interval(months => ival))::date;
    return make_date(
      extract(year from first_of_month)::integer,
      extract(month from first_of_month)::integer,
      least(mday, extract(day from (first_of_month + interval '1 month' - interval '1 day'))::integer)
    );

  elsif freq = 'yearly' then
    -- Postgres interval addition clamps Feb 29 -> Feb 28 in non-leap years,
    -- which matches the spec (yearly_feb29_clamps).
    return (from_date + make_interval(years => ival))::date;

  else
    raise exception 'unknown recurrence freq: %', freq;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- complete_task: idempotent (op_id dedupe), atomic complete-and-roll.
--   * non-recurring, or p_permanent          -> set completed_at/by
--   * recurring, fixed mode                  -> roll from current due_date
--   * recurring, after_completion ("every!") -> roll from today (profile tz)
-- Offset-kind reminders on the task are recomputed for the new occurrence
-- (due_time, or 09:00 when the task has no time — §11.4).
-- ---------------------------------------------------------------------------
create or replace function public.complete_task(
  p_op_id uuid,
  p_task_id uuid,
  p_permanent boolean default false
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  t public.tasks%rowtype;
  user_tz text;
  local_today date;
  next_due date;
begin
  -- idempotency: replayed ops are acknowledged, not re-applied
  insert into public.sync_ops (op_id, user_id)
  values (p_op_id, auth.uid())
  on conflict (op_id) do nothing;
  if not found then
    return jsonb_build_object('op_id', p_op_id, 'status', 'deduped');
  end if;

  select * into t
  from public.tasks
  where id = p_task_id and deleted_at is null
  for update;
  if not found then
    raise exception 'task not found or not accessible';
  end if;

  select timezone into user_tz from public.profiles where id = auth.uid();
  local_today := (now() at time zone coalesce(user_tz, 'UTC'))::date;

  if t.recurrence is null or p_permanent then
    update public.tasks
    set completed_at = now(), completed_by = auth.uid()
    where id = p_task_id;
    return jsonb_build_object('op_id', p_op_id, 'status', 'completed');
  end if;

  next_due := public.next_occurrence(
    t.recurrence,
    case when t.recurrence ->> 'mode' = 'after_completion'
         then local_today
         else coalesce(t.due_date, local_today)
    end
  );

  update public.tasks
  set due_date = next_due
  where id = p_task_id;

  update public.reminders
  set remind_at = ((next_due + coalesce(t.due_time, time '09:00'))
                    at time zone coalesce(user_tz, 'UTC'))
                  - make_interval(mins => offset_minutes),
      fired_at = null
  where task_id = p_task_id
    and kind = 'offset'
    and deleted_at is null;

  return jsonb_build_object('op_id', p_op_id, 'status', 'rolled', 'next_due', next_due);
end;
$$;
