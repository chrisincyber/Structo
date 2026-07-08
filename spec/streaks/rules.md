# Habit streak specification (v1)

Blueprint §5.5 / §11.5. Streaks are **derived, never source of truth**: the nightly
rollup caches results into `habit_stats`; clients recompute locally for optimistic
updates; on drift, recompute — never merge.

## Signature

```
streak(habit, logs[], today, week_start) -> { current, best, unit }
```

- `habit`: type (`binary | quantity | frequency`), schedule, `target_value`,
  `times_per_week`, pause intervals.
- `logs`: non-tombstoned `habit_logs` rows (`logged_for`, `value`).
- `today`: user-local date (from profile timezone at evaluation time — §11.12;
  historical logs are never re-bucketed on travel).
- `week_start`: profile setting (ISO weekday, default 1 = Monday).

## Day completion

- **binary**: day complete iff `sum(value for logged_for = day) >= 1`.
- **quantity**: day complete iff `sum(value) >= target_value` (compensating
  negative entries net out; overshoot allowed; partial progress never counts).
- **frequency**: days are not the unit — see weekly evaluation below.

## Streak rules

1. **Daily / weekdays schedules** (`unit = days`): current streak = count of
   consecutive *scheduled* days completed, walking backward from the reference
   day. Non-scheduled days are neutral (skipped, streak preserved).
2. **Reference day**: if `today` is scheduled and not yet complete, it is
   *pending*, not a miss — the walk starts at the most recent scheduled day
   strictly before today, and today joins the streak once logged.
3. **Frequency habits** (`unit = weeks`): current streak = consecutive weeks
   (bounded by `week_start`) with `count(completed days) >= times_per_week`,
   walking backward from the reference week. The current week is pending until
   it ends: if it has already met the target it extends the streak; if not yet
   met and not yet over, the walk starts at the previous week.
4. **Pauses**: days (or whole weeks, for frequency) falling entirely inside a
   pause interval are neutral. A partially-paused week for a frequency habit is
   evaluated pro-rata: `ceil(times_per_week * active_days / 7)`.
5. **Backfill** counts fully — a log with `logged_for` in the past repairs the
   walk exactly as if logged that day.
6. **best** = maximum streak over full history under the same rules.
7. **No streak freezes, no repair tokens.** Presentation softens misses; the
   math never does.

## Known MVP limitation (accepted, §10.12)

History is scored against the **current** schedule. Schedule-version-accurate
scoring arrives with `habit_schedule_versions` (V2) if demanded.
