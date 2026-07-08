-- Streak engine, server side — blueprint §5.5 / §11.5.
-- compute_streak() is the Postgres implementation of spec/streaks/rules.md and
-- must stay conformant with spec/streaks/vectors.json (checked in CI via
-- scripts/check_streak_vectors.py). It is a PURE function: habit shape, logs,
-- "today", and week_start are all parameters, which is what makes it
-- vector-testable and timezone-honest (§11.12: the caller resolves the
-- user-local day; history is never re-bucketed).
--
-- refresh_habit_stats() is the nightly rollup wrapper (pg_cron) that feeds
-- real rows into compute_streak() and caches results in habit_stats.

create or replace function public.compute_streak(
  p_habit jsonb,          -- {type, schedule, target_value?, times_per_week?, pauses?: [{from,to}]}
  p_logs jsonb,           -- [[logged_for, value], ...] (non-tombstoned)
  p_today date,
  p_week_start integer default 1
)
returns jsonb
language plpgsql
immutable
as $$
declare
  htype text := p_habit ->> 'type';
  sched_kind text := p_habit -> 'schedule' ->> 'kind';
  sched_days integer[];
  target numeric := coalesce((p_habit ->> 'target_value')::numeric, 1);
  times_pw integer := (p_habit ->> 'times_per_week')::integer;
  pauses jsonb := coalesce(p_habit -> 'pauses', '[]'::jsonb);
  completed date[];       -- days whose net total meets the day threshold, ascending
  min_completed date;
  cur integer := 0;
  best integer := 0;
  run integer := 0;
  d date;
  w date;
  first_week date;
  today_week date;
  wk_cnt integer;
  paused_days integer;
  active_days integer;
  thr integer;
begin
  if sched_kind = 'weekdays' then
    select array_agg(x::integer) into sched_days
    from jsonb_array_elements_text(p_habit -> 'schedule' -> 'days') as x;
  end if;

  -- Day-level completion: net (compensating entries included) total per
  -- logged_for must reach the threshold — target for quantity, 1 otherwise.
  select array_agg(day order by day) into completed
  from (
    select (l ->> 0)::date as day, sum((l ->> 1)::numeric) as total
    from jsonb_array_elements(p_logs) as l
    group by 1
  ) as s
  where s.total >= case when htype = 'quantity' then target else 1 end;

  if completed is null then
    return jsonb_build_object('current', 0, 'best', 0,
      'unit', case when htype = 'frequency' then 'weeks' else 'days' end);
  end if;
  min_completed := completed[1];

  if htype in ('binary', 'quantity') then
    -- ---- unit = days; walk scheduled, non-paused days ----------------------
    -- current: backward from today; a scheduled-but-unlogged *today* is
    -- pending, not a miss (spec: reference day rule).
    d := p_today;
    while d >= min_completed loop
      if _streak_scheduled(sched_kind, sched_days, d)
         and not _streak_paused(pauses, d) then
        if d = any (completed) then
          cur := cur + 1;
        elsif d = p_today then
          null; -- pending
        else
          exit;
        end if;
      end if;
      d := d - 1;
    end loop;

    -- best: forward scan with the same neutrality rules
    d := min_completed;
    while d <= p_today loop
      if _streak_scheduled(sched_kind, sched_days, d)
         and not _streak_paused(pauses, d) then
        if d = any (completed) then
          run := run + 1;
          best := greatest(best, run);
        elsif d <> p_today then
          run := 0;
        end if;
      end if;
      d := d + 1;
    end loop;

    return jsonb_build_object('current', cur, 'best', greatest(best, cur), 'unit', 'days');

  elsif htype = 'frequency' then
    -- ---- unit = weeks; a week counts when completed days >= threshold ------
    today_week := _streak_week_of(p_today, p_week_start);
    first_week := _streak_week_of(min_completed, p_week_start);

    -- current: backward from the current week; an unmet *current* week is
    -- pending, not a miss. Fully-paused weeks are neutral; partial pauses
    -- shrink the threshold pro-rata (spec rule 4).
    w := today_week;
    while w >= first_week loop
      select count(*) into paused_days
      from generate_series(w, w + 6, interval '1 day') as g
      where _streak_paused(pauses, g::date);
      active_days := 7 - paused_days;

      if active_days = 0 then
        w := w - 7; continue;             -- neutral week
      end if;
      thr := ceil(times_pw * active_days / 7.0)::integer;

      select count(*) into wk_cnt
      from unnest(completed) as cd
      where _streak_week_of(cd, p_week_start) = w;

      if wk_cnt >= thr then
        cur := cur + 1;
      elsif w = today_week then
        null; -- pending current week
      else
        exit;
      end if;
      w := w - 7;
    end loop;

    -- best: forward scan, same rules
    w := first_week;
    while w <= today_week loop
      select count(*) into paused_days
      from generate_series(w, w + 6, interval '1 day') as g
      where _streak_paused(pauses, g::date);
      active_days := 7 - paused_days;

      if active_days > 0 then
        thr := ceil(times_pw * active_days / 7.0)::integer;
        select count(*) into wk_cnt
        from unnest(completed) as cd
        where _streak_week_of(cd, p_week_start) = w;

        if wk_cnt >= thr then
          run := run + 1;
          best := greatest(best, run);
        elsif w <> today_week then
          run := 0;
        end if;
      end if;
      w := w + 7;
    end loop;

    return jsonb_build_object('current', cur, 'best', greatest(best, cur), 'unit', 'weeks');

  else
    raise exception 'unknown habit type: %', htype;
  end if;
end;
$$;

-- Small helpers (prefixed _streak_, internal to the engine)

create or replace function public._streak_scheduled(
  p_kind text, p_days integer[], p_day date
)
returns boolean
language sql
immutable
as $$
  select case
    when p_kind = 'weekdays' then extract(isodow from p_day)::integer = any (p_days)
    else true   -- 'daily' (and any-day logging for frequency handled by caller)
  end
$$;

create or replace function public._streak_paused(p_pauses jsonb, p_day date)
returns boolean
language sql
immutable
as $$
  select exists (
    select 1 from jsonb_array_elements(p_pauses) as p
    where p_day between (p ->> 'from')::date and (p ->> 'to')::date
  )
$$;

create or replace function public._streak_week_of(p_day date, p_week_start integer)
returns date
language sql
immutable
as $$
  select p_day - ((extract(isodow from p_day)::integer - p_week_start + 7) % 7)
$$;

-- ---------------------------------------------------------------------------
-- Nightly rollup (pg_cron -> refresh_habit_stats()). SECURITY DEFINER: runs
-- across users; writes only the derived habit_stats cache (§11.5 — derived
-- data is recomputed, never merged).
-- ---------------------------------------------------------------------------
create or replace function public.refresh_habit_stats(p_user_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  h record;
  res jsonb;
  local_today date;
  n integer := 0;
begin
  for h in
    select hb.id, hb.owner_id, hb.type, hb.schedule, hb.target_value,
           hb.times_per_week, hb.is_paused, hb.paused_at,
           pr.timezone, pr.week_start
    from public.habits hb
    join public.profiles pr on pr.id = hb.owner_id
    where hb.archived_at is null and hb.deleted_at is null
      and (p_user_id is null or hb.owner_id = p_user_id)
  loop
    local_today := (now() at time zone coalesce(h.timezone, 'UTC'))::date;

    res := public.compute_streak(
      jsonb_build_object(
        'type', h.type,
        'schedule', h.schedule,
        'target_value', h.target_value,
        'times_per_week', h.times_per_week,
        'pauses', case when h.is_paused and h.paused_at is not null
          then jsonb_build_array(jsonb_build_object(
                 'from', ((h.paused_at at time zone coalesce(h.timezone, 'UTC'))::date)::text,
                 'to', local_today::text))
          else '[]'::jsonb end
      ),
      coalesce((
        select jsonb_agg(jsonb_build_array(hl.logged_for, hl.value))
        from public.habit_logs hl
        where hl.habit_id = h.id and hl.deleted_at is null
      ), '[]'::jsonb),
      local_today,
      h.week_start
    );

    insert into public.habit_stats
      (habit_id, user_id, current_streak, best_streak, streak_unit,
       completions_this_week, computed_at)
    values
      (h.id, h.owner_id,
       (res ->> 'current')::integer, (res ->> 'best')::integer, res ->> 'unit',
       (select count(distinct hl.logged_for)
        from public.habit_logs hl
        where hl.habit_id = h.id and hl.deleted_at is null
          and hl.logged_for >= public._streak_week_of(local_today, h.week_start)),
       now())
    on conflict (habit_id) do update set
      current_streak = excluded.current_streak,
      best_streak = excluded.best_streak,
      streak_unit = excluded.streak_unit,
      completions_this_week = excluded.completions_this_week,
      computed_at = excluded.computed_at;

    n := n + 1;
  end loop;

  return n;
end;
$$;

-- Do not let clients call the cross-user rollup directly.
revoke execute on function public.refresh_habit_stats(uuid) from public, authenticated;
