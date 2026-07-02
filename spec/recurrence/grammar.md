# Recurrence specification (v1)

Blueprint §11.1. Semantics are the Todoist model: **one task row, rolling due date.**
Completing a recurring task computes the next occurrence and updates `due_date`;
the task's `completed_at` stays NULL until permanent completion.

## Rule shape (stored in `tasks.recurrence` jsonb)

```json
{
  "v": 1,
  "freq": "daily | weekly | monthly | yearly",
  "interval": 1,
  "weekdays": [1, 3, 5],
  "monthday": 15,
  "mode": "fixed | after_completion"
}
```

- `weekdays` only with `freq=weekly` (ISO, 1=Mon). Absent = anchor weekday.
- `monthday` only with `freq=monthly`. Absent = anchor day-of-month.
- `mode=fixed` (default): next occurrence advances from the **current due date**.
- `mode=after_completion` ("every!"): next occurrence advances from the
  **completion date** (user-local).

## MVP grammar (locked — anything else is V2)

| Phrase | Rule |
|---|---|
| every day / daily | `{freq: daily, interval: 1}` |
| every N days | `{freq: daily, interval: N}` |
| every weekday | `{freq: weekly, weekdays: [1,2,3,4,5]}` |
| every week / every ‹day› | `{freq: weekly, interval: 1, weekdays: [d]}` |
| every ‹day›, ‹day›, … | `{freq: weekly, weekdays: [d…]}` |
| every N weeks | `{freq: weekly, interval: N}` |
| every month / every month on the Nth | `{freq: monthly, interval: 1, monthday: N}` |
| every year | `{freq: yearly, interval: 1}` |
| every! ‹any of the above› | same rule, `mode: after_completion` |

Deferred to V2: last-day-of-month, "3rd Tuesday", multiple times per day, end
dates / counts.

## Next-occurrence algorithm

Inputs: `rule`, `from` (a local date: the current due date for `fixed`, the
completion date for `after_completion`), user timezone (used only to determine
"today" for after_completion; all math is **date-level and DST-immune** because
due dates are floating local — §11.12).

1. `daily`: `from + interval` days.
2. `weekly` with `weekdays`: the next date strictly after `from` whose ISO weekday
   is in `weekdays`; when `interval > 1`, weeks are counted from the ISO week of
   the task's anchor (original due date), and only weeks where
   `(week - anchor_week) % interval == 0` qualify.
3. `weekly` without `weekdays`: `from + 7 * interval` days.
4. `monthly`: same `monthday` in month `from.month + interval`; if the target
   month is shorter than `monthday`, **clamp to the last day of that month**
   (a "31st" rule fires Feb 28/29). Clamping does not change the stored rule.
5. `yearly`: same month/day next year; Feb 29 clamps to Feb 28 in non-leap years.
6. `after_completion`: identical math with `from = completion date`; if the
   computed date is not strictly after the completion date, advance one more
   interval.

## Editing semantics (§8.5)

- **This occurrence**: mutate `due_date` only; rule untouched; anchor untouched.
- **All future**: rewrite the rule re-anchored at the newly chosen date.

## Reminder interaction (§11.4)

Offset-kind reminders recompute `remind_at` on every occurrence roll.
