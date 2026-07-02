# Quick-add capture grammar (v1)

Blueprint §3.5 / §8.2. The parser must behave **identically** on iOS (Swift) and
web (TypeScript); this grammar is deliberately fixed and small — no free-form NLP.
The parser **proposes, the user confirms**: every extraction renders as a visible
chip before save; deleting a chip returns the literal text to the title.

## Tokens (recognized anywhere in the input, whole-token only)

| Token | Meaning | Notes |
|---|---|---|
| `#ProjectName` | destination project | prefix-matched against user's projects; unknown → literal text |
| `@label` | attach label | unknown label → offer-to-create chip |
| `p1`–`p4` | priority | whole word only |
| date/time phrase | due date (+ optional time) | grammar below |
| recurrence phrase | recurring rule | see `spec/recurrence/grammar.md`; implies a date anchor |

## Date/time grammar (locked)

- Relative days: `today`, `tomorrow`, `tod`, `tom`
- Weekday names: `monday`…`sunday`, 3-letter abbreviations — resolves to the
  **next** occurrence strictly after the reference date
- `next week` → next week's first day (per user `week_start`)
- `in N days`
- Explicit dates: `jul 15`, `15 jul`, `july 15`, `15/7` (locale day-month order
  deferred: MVP is d/m for 24h locales, m/d for 12h — from `time_format`)
- Times: `10am`, `10:30`, `at 10`, `17:45` — a time without a date implies today
  (or tomorrow if the time already passed)
- Recurrence: the phrases in `spec/recurrence/grammar.md`, prefixed `every` /
  `every!`

## Extraction rules (the correctness contract)

1. **Whole-word matching only.** "Read Tomorrowland review" contains no date.
2. **Rightmost-wins** when multiple date phrases exist; earlier ones stay literal.
3. **Title must remain non-empty** after extraction — if extraction would empty
   the title (input = "tomorrow"), extraction is cancelled and the text is the
   title.
4. Recurrence implies a date: "every monday" sets rule + next-Monday due date.
5. Case-insensitive throughout; extraction spans never cross token boundaries
   (`#Work tomorrow` = project + date, two chips).
5a. **Priority tokens need position evidence**: `p1`–`p4` is extracted only at
   the end of input or adjacent to another extracted token; mid-prose
   occurrences surrounded by plain words stay literal ("Review p1 metrics
   dashboard" has no priority).
6. Unrecognized text is title, always. The parser never guesses beyond this
   grammar.

## Vector shape

`{ input, ref: {date, time, week_start, time_format}, expect: {title, due_date?, due_time?, recurrence?, project?, labels?, priority?} }`
