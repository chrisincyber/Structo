# Planoa

Premium productivity for iOS and web: Todoist-depth task management, native habit tracking, and a modular personalized home dashboard — in one calm, fast app.

**Start here:** [`PLANOA_BLUEPRINT.md`](./PLANOA_BLUEPRINT.md) — the execution-ready product and technical blueprint covering positioning, feature architecture, the habit integration model, the modular home system, IA and UX flows, the design system, the full data model, business logic rules, technical/iOS/web architecture, the MVP definition, phased roadmap, engineering backlog, and locked decisions.

## Stack (decided)

- **iOS:** native SwiftUI, offline-first (GRDB/SQLite + outbox sync engine)
- **Web:** Next.js (App Router) + TanStack Query + supabase-js
- **Backend:** Supabase — Postgres, Auth, RLS, Realtime (poke → delta pull), Storage, Edge Functions
- **Shared:** `spec/` package with cross-platform conformance test vectors for recurrence, streaks, quick-add parsing, and filters
- **Windows/macOS (V2):** Tauri wrapper around the web app

## Repo layout

```
spec/       shared behavior spec: grammars, conformance vectors, design tokens (M0 — in place)
supabase/   migrations (schema + RLS), pgTAP persona tests (M0 — in place)
ios/        SwiftUI app + SPM packages (PlanoaKit, PlanoaData, PlanoaUI, Features) — next
web/        Next.js app — next
```

## Status (backlog §18)

**M0 — done, verified against Postgres 16:**
- `supabase/migrations/0001_schema.sql` — full schema v1 (blueprint §10): all tables incl. dormant collaboration tables, triggers (updated_at, signup bootstrap, cycle/immutability guards), indexes, FTS.
- `supabase/migrations/0002_rls.sql` — deny-by-default RLS routed through `is_project_member()` (§12.5).
- `spec/` — recurrence, streaks, and quick-add grammars with starter conformance vectors (~47; target ~60 before M1 exit), plus `tokens/tokens.json` design token source.
- `.github/workflows/ci.yml` — spec validation + migrations + SQL test suites + recurrence vectors on every PR.

**M1 (sync spine) — server side complete, verified:**
- `supabase/migrations/0003_recurrence.sql` — `next_occurrence()` (passes all 16 spec vectors) + `complete_task()` atomic complete-and-roll RPC with op dedupe.
- `supabase/migrations/0004_sync.sql` — `apply_sync_ops()`: ordered, transactional, idempotent op batches (upsert / delete-tombstone / complete_task), RLS-enforced (SECURITY INVOKER).
- `supabase/migrations/0005_streaks.sql` — `compute_streak()` pure streak engine (passes all 14 spec vectors) + `refresh_habit_stats()` rollup for pg_cron.
- `supabase/migrations/0006_delta_pull.sql` — `pull_table_deltas()`: per-table keyset-cursor delta pull with tombstones (the client pull loop's contract). `updated_at` uses `clock_timestamp()` so cursors advance past multi-row transactions.
- `supabase/functions/sync-push/index.ts` — thin Edge Function over `apply_sync_ops` (auth, validation, size caps).
- `supabase/tests/` — persona, sync-op, and delta-pull suites; plain-SQL asserts, runnable on any Postgres via `tests/helpers/auth_shim.sql`.

**Next:** Realtime poke channel wiring, reminder dispatch job, then client data layers (iOS GRDB mirror, web TanStack Query + mutations funnel).

Migrations have not yet been applied to a real Supabase project — CI runs them against vanilla Postgres 16 with the auth shim.
