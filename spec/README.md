# spec/ — Structo shared behavior specification

This package is the two-frontend insurance policy (blueprint §12.1): every piece of
tricky domain logic is defined **here first** as a grammar/rules document plus JSON
conformance vectors, and implemented twice — in Swift (`ios/Packages/StructoKit`) and
TypeScript (`web/`). Both test suites load the same vector files; CI fails if either
platform disagrees with the vectors.

**Rule: any behavior change starts as a vector PR.** Implementations follow.

## Contents

| Directory | Spec | Consumed by |
|---|---|---|
| `recurrence/` | Recurrence rule semantics + next-occurrence math (§11.1) | StructoKit `Recurrence/`, web `lib/recurrence`, Postgres RPC `complete_recurring_task` |
| `streaks/` | Habit streak calculation (§5.5, §11.5) | StructoKit `Streaks/`, web `lib/streaks`, nightly rollup job |
| `quick-add/` | Natural-language capture grammar (§3.5, §8.2) | StructoKit `QuickAddParser/`, web `lib/quickadd` |
| `tokens/` | Design tokens source of truth (§9.12) | generated Swift constants + CSS variables |

Filter AST spec (`filters/`) lands with V1 (§10.10).

## Vector file conventions

- Dates are ISO `YYYY-MM-DD`; times `HH:MM` (24h); weekdays ISO (1 = Monday).
- Every vector has a unique `name` and a one-line `why` when the case is non-obvious.
- Vectors are append-mostly. Changing an existing vector's expectation is a
  semantics change and requires a blueprint amendment in the same PR.
- Starter sets below must grow to ~60 total before M1 exit (backlog item M0-4);
  DST-transition, week-start-variation, and travel cases are the priority gaps.
