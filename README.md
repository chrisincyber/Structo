# Structo

Premium productivity for iOS and web: Todoist-depth task management, native habit tracking, and a modular personalized home dashboard — in one calm, fast app.

**Start here:** [`STRUCTO_BLUEPRINT.md`](./STRUCTO_BLUEPRINT.md) — the execution-ready product and technical blueprint covering positioning, feature architecture, the habit integration model, the modular home system, IA and UX flows, the design system, the full data model, business logic rules, technical/iOS/web architecture, the MVP definition, phased roadmap, engineering backlog, and locked decisions.

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
ios/        SwiftUI app + SPM packages (StructoKit, StructoData, StructoUI, Features) — next
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

**Backend jobs & realtime — complete, verified:**
- `supabase/migrations/0007_dispatch.sql` — reminder/agenda dispatchers (idempotent via notification dedupe keys, timezone-aware firing windows, "already done today" suppression) + per-user Realtime poke triggers (`realtime.send` on Supabase, `pg_notify` fallback locally).
- `supabase/setup/cron.sql` — pg_cron schedules, applied once on a real Supabase project (not part of the migration chain).

**Web app (`web/`) — shell, auth, first screens, NL quick add:**
- Login (magic link), sidebar shell with poke-driven query invalidation, Today (overdue group + habits band), Inbox, Habits, first-cut Home.
- Quick-add parser implementing `spec/quick-add` — all 17 conformance vectors green (Vitest) — with live, dismissable extraction chips in the composer.
- CI web job: lint, conformance tests, build.

**Web app — MVP surface complete:** Upcoming, habit detail (streak header, 10-week backfill calendar), search (FTS), Completed, Settings (6 accents, default landing), the full §6 widget dashboard (7 operational widgets, edit mode, synced layout, soft cap), g-navigation shortcuts. TypeScript streak engine passes all 14 spec vectors.

**iOS — StructoKit begun:** pure domain package (CivilDate, Recurrence, Streaks) with vector-driven XCTest targets; CI swift job verifies against the same spec vectors as web and Postgres.

**Next:** Supabase go-live (needs a free project slot), web deploy, then the SwiftUI app itself (StructoData sync engine + surfaces).

**LIVE:** all migrations (0001–0009), pg_cron schedules, the Realtime poke authorization policy, and the sync-push Edge Function are deployed to the production Supabase project (`Structo`, eu-central region). Signup bootstrap verified against the live database. CI continues to verify every migration against vanilla Postgres 16 with the auth shim.

## Known follow-ups

- ~~Account deletion ordering~~ — **fixed in 0010**: `delete_account()` RPC deletes content in FK-safe order before the auth user; `export_account_data()` RPC provides the §3.9 JSON export. Both SECURITY-scoped, live-tested, and wired into Settings.
