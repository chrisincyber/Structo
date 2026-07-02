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

## M0 status

- `supabase/migrations/0001_schema.sql` — full schema v1 (blueprint §10): all tables incl. dormant collaboration tables, triggers (updated_at, signup bootstrap, cycle/immutability guards), indexes, FTS.
- `supabase/migrations/0002_rls.sql` — deny-by-default RLS routed through `is_project_member()` (§12.5).
- `supabase/tests/001_rls_personas.sql` — pgTAP owner/stranger persona harness; grows with every policy.
- `spec/` — recurrence, streaks, and quick-add grammars with starter conformance vectors (~45; target ~60 before M1 exit), plus `tokens/tokens.json` design token source.

Migrations have not yet been applied to a Supabase project; `supabase db reset` against a fresh local stack is the first CI job to wire up.
