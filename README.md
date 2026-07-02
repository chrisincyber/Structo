# Planoa

Premium productivity for iOS and web: Todoist-depth task management, native habit tracking, and a modular personalized home dashboard — in one calm, fast app.

**Start here:** [`PLANOA_BLUEPRINT.md`](./PLANOA_BLUEPRINT.md) — the execution-ready product and technical blueprint covering positioning, feature architecture, the habit integration model, the modular home system, IA and UX flows, the design system, the full data model, business logic rules, technical/iOS/web architecture, the MVP definition, phased roadmap, engineering backlog, and locked decisions.

## Stack (decided)

- **iOS:** native SwiftUI, offline-first (GRDB/SQLite + outbox sync engine)
- **Web:** Next.js (App Router) + TanStack Query + supabase-js
- **Backend:** Supabase — Postgres, Auth, RLS, Realtime (poke → delta pull), Storage, Edge Functions
- **Shared:** `spec/` package with cross-platform conformance test vectors for recurrence, streaks, quick-add parsing, and filters
- **Windows/macOS (V2):** Tauri wrapper around the web app

## Repo layout (planned)

```
ios/        SwiftUI app + SPM packages (PlanoaKit, PlanoaData, PlanoaUI, Features)
web/        Next.js app
supabase/   migrations, RLS policies + pgTAP tests, Edge Functions
spec/       grammars, conformance vectors, design tokens
```
