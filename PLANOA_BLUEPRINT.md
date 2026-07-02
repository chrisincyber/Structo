# Planoa — Product & Technical Blueprint

**Status:** Decided. Execution-ready.
**Owner:** Product/Engineering founding team
**Date:** 2026-07-02
**Working name:** Planoa (iOS + Web at launch, Windows later)

This is not a brainstorm. Every section below is a decision. Where alternatives existed, they were evaluated and closed. Open questions are explicitly flagged as such; everything else is locked.

---

## 1. EXECUTIVE PRODUCT DECISION

**What Planoa is.** Planoa is a premium personal productivity system that unifies deep task management (Todoist-class), native habit tracking, and a modular, personalized home dashboard into one calm, fast app. It is the single place a serious person plans their day: what must get done (tasks), what must be sustained (habits), and a home screen that shows exactly — and only — what matters to them.

**Who it is for.** Individual professionals and ambitious personal-life organizers, 22–45, who currently run Todoist/Things/Reminders *plus* a separate habit app (Streaks, HabitKit, Waterllama) *plus* mental glue between them. They pay for software, care about design, and are tired of stitching three apps together every morning.

**Why it can win.** The task-app market is mature but structurally fragmented: no leading product treats habits as a first-class citizen alongside tasks, and none offers a genuinely personalized home surface. Todoist's home is a list; Things has no habits; habit apps have no real task depth. Planoa's bet: **the morning glance is the product.** Win the first 10 seconds of the user's day and you win the day.

**The wedge vs. Todoist + a habit app.**
1. **One Today.** Tasks and habits on one screen, one review, one plan — not two apps and a prayer.
2. **The personal cockpit.** A curated, modular home that adapts to the user: a runner sees workouts and water; a PM sees overdue tasks and this week's plan. Todoist cannot become this without rearchitecting its entire information hierarchy.
3. **Premium calm.** Things-level polish with Todoist-level depth. That combination does not exist today.

**What must be avoided to keep the product strong.**
- **Widget chaos.** The dashboard is curated, capped, and opinionated — not a Notion-style anything-canvas.
- **Habit gamification creep.** No karma, points, mascots, confetti economies. Streaks exist because they are informative, not because they are addictive.
- **Team-tool drift.** Collaboration is "share a project with your partner/colleague," not Asana. No workloads, no Gantt, no admin consoles in the first two years.
- **Parity-driven bloat.** We match Todoist where it drives retention (recurrence, filters, quick add), and deliberately skip where it doesn't (karma, goals, board-view-everything).
- **Cross-platform mediocrity.** We ship native SwiftUI on iOS even though it costs more, because "premium" dies in a webview on iPhone.

**Business model (decided, briefly):** Freemium. Free: full task core, 5 projects, 3 habits, core widgets. **Planoa Pro** ($4.99/mo, $39.99/yr): unlimited projects/habits, saved filters, attachments, collaboration, advanced widgets, review analytics. Price anchored under Todoist Pro to ease switching.

---

## 2. PRODUCT POSITIONING

### Target user segments (priority order)

| # | Segment | Description | Why they convert |
|---|---------|-------------|------------------|
| 1 | **The Optimizer** | 25–40, tech/design/finance professional, currently pays for Todoist/Things AND a habit app | Consolidation + polish; already proven willingness to pay |
| 2 | **The Life-Systems Builder** | Runs personal routines seriously — gym, reading, supplements, sleep — and manages life admin as projects | Habits are first-class here, nowhere else |
| 3 | **The Recovering Notion User** | Built an elaborate Notion dashboard, abandoned it because it was slow and manual | Planoa is the dashboard that maintains itself |
| 4 | **Couples/duos** (later) | Shared household projects + individual habits | Collaboration-lite drives network retention in V1+ |

### Primary jobs-to-be-done
1. "Show me my whole day — obligations and routines — in one glance, every morning."
2. "Let me capture a task in under 3 seconds from anywhere, and trust it lands in the right place."
3. "Help me sustain the behaviors I've committed to, without nagging or shame."
4. "Let me plan my week on Sunday in ten minutes."
5. "Keep work projects and life projects in one system without them contaminating each other."

### Strongest switching reasons
- Two subscriptions collapse into one cheaper one.
- The Home dashboard demo moment: "this screen is *mine*."
- Habits inside Today — the feature people literally ask Todoist for (recurring-task-as-habit is a famous Todoist anti-pattern; see §5).
- Import from Todoist (CSV/API) at V1 to remove lock-in friction.

### Strongest retention drivers
1. **Daily habit logs** — history the user cannot bear to abandon (this is the moat; task lists are portable, streak history is not).
2. **A personalized dashboard** — configured surface = sunk investment = stickiness.
3. **Weekly review ritual** — a Sunday habit that re-engages the whole system.
4. **Reminders that actually fire correctly** — reliability is a retention feature.

### Biggest product risks
1. Tasks + habits + dashboard = three products' surface area with one team's resources → mitigated by the strict MVP in §16.
2. The dashboard becomes a gimmick users configure once and ignore → mitigated by making Home genuinely operational (interactive logging, live counts), not decorative.
3. "Jack of all trades" positioning confusion → mitigated by leading marketing with *one* message: "Your day, in one place."
4. Sync bugs destroy trust irreversibly → mitigated by the conservative sync architecture in §11/§12 (append-only logs, idempotent ops).

### Why Planoa over Todoist + habit tracker combo
- **One data model of "my day"** → cross-domain views no combo can produce (e.g., "you complete 40% more tasks on days you work out" — V3 insight, but the data accrues from day one).
- **One capture point, one review, one notification system, one subscription.**
- **Design coherence**: two apps never share a design language; Planoa's Today is composed, not concatenated.

### Intentionally omitted (forever, or near-forever)
- Karma/points/goals/gamification of any kind
- Time tracking, Pomodoro (integrations later, never core)
- Email-client features, full calendar replacement (we render calendars; we don't manage them)
- Enterprise: SSO/SAML, admin seats, permissions matrices, audit exports
- Public API at launch (V2+), template marketplace, AI-everything (targeted assistance only, later)

---

## 3. FEATURE ARCHITECTURE

Ten domains. Each has a purpose, a strict MVP cut, and its hidden complexity flagged.

### 3.1 Task Management
- **Purpose:** The credibility core. Must be deep enough that a Todoist power user loses nothing that matters.
- **MVP:** Inbox; Today; Upcoming; projects (list layout) with sections; subtasks (1 level rendered, unlimited stored); due date + optional time; recurring tasks (common grammar, see §11); priorities P1–P4; labels; description field; complete/uncomplete; reorder; move between projects/sections; archive completed.
- **Post-launch:** Deadlines as a second date field (V1); comments & attachments (V1); board layout for projects (V2); task duration (V2); dependencies (V3 or never).
- **Hidden complexity:** ⚠️ Recurrence is the single most expensive "simple" feature in the domain — grammar parsing, timezone-correct next-occurrence math, completion semantics, editing a recurring task ("this vs. all"). Budget it as an epic, not a ticket. ⚠️ Manual ordering across devices (fractional ranks, §10) is deceptively hard.
- **UX principles:** A task is one tap to complete, one swipe to reschedule. Metadata is progressive — a task with no metadata looks clean, not empty.
- **Technical dependencies:** Recurrence engine (shared spec, §12), sync layer, rank ordering.

### 3.2 Habit Tracking
- **Purpose:** The differentiator. Sustained behaviors, tracked with respect, integrated into Today.
- **MVP:** Binary, quantity (target + unit), and frequency (x/week) habits; per-habit schedule (daily / specific weekdays / x-per-week); today checklist; quick quantity logging (+1 glass); streaks; habit detail with calendar history; pause/archive habit.
- **Post-launch:** Weekly/monthly review screens (V1); reminders per habit (V1); HealthKit read integration for water/sleep/workouts (V2); habit notes (V2); trends/insights (V2–V3).
- **Hidden complexity:** ⚠️ Streak math across timezones and travel (§11.5). ⚠️ Frequency habits ("3x/week") break naive daily-streak logic — streaks must be schedule-aware. ⚠️ Backfilling ("I forgot to log yesterday") must exist at MVP or users churn on the first missed log.
- **UX principles:** Logging is faster than thinking about logging. Missing a day is information, not punishment. Habits never visually masquerade as tasks.
- **Technical dependencies:** Append-only `habit_logs`, streak calculator (shared spec), local notifications.

### 3.3 Modular Home / Dashboard
- **Purpose:** The signature surface. The user's personal cockpit; default landing screen.
- **MVP:** Fixed widget catalog (7 widgets, §6); add/remove/reorder; two sizes; interactive logging from widgets; per-user layout synced across devices.
- **Post-launch:** Resize (V1); more widgets (rolling); multiple dashboards e.g. "Work"/"Life" (V2); scheduled layouts — morning vs. evening (V3).
- **Hidden complexity:** ⚠️ Layout sync between a 2-column phone grid and a 12-column web grid needs a device-class-aware layout model (§6, §10.18). ⚠️ Every widget is a mini-app with its own data needs — the widget data-provider contract must be designed once, correctly (§6).
- **UX principles:** Curated, capped, calm. Every widget must be *operational* (you can act from it) or it doesn't ship.
- **Technical dependencies:** Widget registry, layout persistence, live query subscriptions per widget.

### 3.4 Planning / Calendar
- **Purpose:** Time-horizon views: today's shape, the week's plan.
- **MVP:** Upcoming view = vertically scrolling day-grouped list (Todoist-style) with drag-to-reschedule (web) / swipe-to-reschedule (iOS). That's it. No month grid at MVP.
- **Post-launch:** Week strip navigation (V1); read-only overlay of device/Google calendar events in Upcoming (V2); month view (V2); time-blocking (V3, maybe never).
- **Hidden complexity:** ⚠️ Calendar *integration* (OAuth, ics quirks, event sync) is a swamp — this is exactly why it is V2 read-only first. ⚠️ Drag-to-reschedule interacts with recurrence ("move just this occurrence?").
- **UX principles:** Planning is rearranging, not data entry. Overdue tasks confront the user in Today, not in a shame archive.
- **Technical dependencies:** Recurrence engine, date bucketing logic (§11.3).

### 3.5 Quick Capture
- **Purpose:** Thought → captured task in under 3 seconds. The most-used interaction in the product.
- **MVP:** Global "+" everywhere; single-field composer with natural-language parsing for dates ("tomorrow 5pm", "every monday") and inline tokens (`#project`, `@label`, `p1`); defaults to Inbox; iOS share extension; web `Q` shortcut + Cmd/Ctrl-K command bar.
- **Post-launch:** iOS Lock Screen/Home Screen widget + App Intents/Siri (V1); email-to-inbox (V2); Apple Watch capture (V3).
- **Hidden complexity:** ⚠️ NL date parsing must behave *identically* on iOS (Swift) and web (TS) — solved with a fixed grammar + shared conformance test vectors (§12). Do not free-form this. ⚠️ Parsing must be visibly previewed (chips) so users trust it; silent misparses destroy capture trust.
- **UX principles:** Never more than one tap/keystroke away. Zero required fields. The parser proposes, the user confirms with Enter.
- **Technical dependencies:** Shared parsing grammar, offline-capable create (capture must work in airplane mode).

### 3.6 Search / Filtering
- **Purpose:** Findability and power-user views.
- **MVP:** Global search over task/project/habit/comment titles+text (Postgres FTS + local index on iOS); built-in views only (Today, Upcoming, Inbox, per-project, per-label, Completed).
- **Post-launch:** Saved filters with a query grammar — `(today | overdue) & #work & p1` (V1, Pro feature); filter builder UI for non-power-users (V1); search operators (V2).
- **Hidden complexity:** ⚠️ The filter grammar must compile to both a SQL/PostgREST query (web/server) and a local SQLite/in-memory predicate (iOS offline). Design the filter AST once; two evaluators. This is why saved filters are V1, not MVP.
- **UX principles:** Search is instant (<100ms perceived, local-first). Filters are a power feature with a friendly builder in front.
- **Technical dependencies:** Postgres `tsvector` + GIN, iOS local FTS5, filter AST.

### 3.7 Collaboration
- **Purpose:** Share a project with 1–5 people (partner, co-founder, small team). Not enterprise.
- **MVP:** **None.** Single-player. (The schema is multiplayer-ready from day one — §10 — so V1 collaboration is an unlock, not a migration.)
- **Post-launch:** V1: share project via email invite; assignee on tasks; comments; realtime updates in shared projects; activity feed per project. V2: mentions, notification preferences per project.
- **Hidden complexity:** ⚠️ RLS policies for shared data are where security bugs live — the membership model must be in the schema from MVP even if unused. ⚠️ Realtime presence/edit conflicts in shared projects. ⚠️ Notification fan-out.
- **UX principles:** Sharing is per-project, never per-account. Personal projects are visibly, reassuringly private.
- **Technical dependencies:** `project_members`, RLS via membership, Realtime channels, Edge Function for invites.

### 3.8 Reminders / Notifications
- **Purpose:** The system's reliability contract. Fires exactly when promised, never spams.
- **MVP:** Time-based task reminders (at due time, or custom offset); habit reminders (per-habit time); daily agenda notification (opt-in, "Your day: 6 tasks, 3 habits"); iOS push via APNs; all local-notification-backed on iOS for offline reliability.
- **Post-launch:** Web push (V1); location reminders (V3/skip); smart reminder suggestions (V3); email digests (V2).
- **Hidden complexity:** ⚠️ The dual system — server-scheduled push (source of truth) + iOS local notifications (offline fallback) — must dedupe (§11.4). ⚠️ Recurring task reminders must be scheduled per-occurrence. ⚠️ Timezone changes mid-flight.
- **UX principles:** Every notification is actionable (Complete/Snooze/Log from the notification). Defaults are quiet; the user opts *into* noise.
- **Technical dependencies:** `reminders` table, pg_cron sweep + Edge Function dispatcher, APNs, iOS `UNUserNotificationCenter`.

### 3.9 Settings / Customization
- **Purpose:** Control without clutter.
- **MVP:** Account; appearance (system/light/dark, accent color — 6 curated accents, not a color picker); start-of-week; time format; default view on launch; notification preferences; dashboard edit entry point; data export (JSON).
- **Post-launch:** App icon variants (V1, Pro); Todoist import (V1); per-project defaults (V2); advanced date/locale (V2).
- **Hidden complexity:** ⚠️ Every preference is a sync + platform-parity liability. Cap the settings surface aggressively.
- **UX principles:** Settings fit on two screens. Anything needing a manual doesn't ship.
- **Technical dependencies:** `user_preferences` (synced) vs. device-local prefs (not synced) — split deliberately (§10.20).

### 3.10 Analytics / Insights
- **Purpose:** Reflection, not surveillance. Powers weekly/monthly reviews.
- **MVP:** Minimal: habit detail history calendar + current/best streak; completed-today count. Nothing else.
- **Post-launch:** Weekly Review flow (V1 — the ritual, see §5.9); monthly habit consistency (V1); productivity trends (V2); cross-domain insights (V3).
- **Hidden complexity:** ⚠️ Review screens require pre-aggregated data to feel instant — nightly rollup job (`habit_stats`) rather than on-the-fly aggregation. ⚠️ Any chart shown must survive the "so what?" test; insight theater cheapens the product.
- **UX principles:** Reviews tell a short story ("You kept 5 of 6 habits"), never dump charts.
- **Technical dependencies:** pg_cron rollups, `habit_stats` table.

---

## 4. TODOIST PARITY MAP

Classification: **LC** = launch-critical (MVP), **P2** = phase 2 (V1), **P3** = phase 3 (V2+), **SKIP** = deliberately never.

| Feature | Phase | Why it matters | Retention weight | Tech difficulty | UX difficulty |
|---|---|---|---|---|---|
| Inbox | LC | Capture trust: everything has a home | High | Low | Low |
| Today view | LC | The daily anchor; Planoa's is tasks+habits | Critical | Low | Medium |
| Upcoming view | LC | Weekly planning surface | High | Medium | Medium |
| Projects + sections | LC | Baseline organization | High | Low | Low |
| Subtasks | LC | Expected depth; absence reads as "toy" | Medium | Medium | Medium |
| Due date + time | LC | Core scheduling | Critical | Low | Low |
| Recurring tasks | LC | Todoist's #1 sticky feature | Critical | **High** ⚠️ | High |
| Priorities P1–P4 | LC | Cheap, expected, visually useful | Medium | Low | Low |
| Labels | LC | Cross-project organization | Medium | Low | Low |
| Quick add w/ NL dates | LC | The signature Todoist behavior; capture speed | Critical | **High** ⚠️ | Medium |
| Reminders (time) | LC | Reliability contract | Critical | High | Medium |
| Search (basic) | LC | Trust that nothing is lost | High | Medium | Low |
| Cross-device sync | LC | Table stakes | Critical | **Very high** ⚠️ | — |
| Offline (iOS full) | LC | Premium feel; capture anywhere | High | **Very high** ⚠️ | — |
| Task description | LC | Cheap, expected | Low | Low | Low |
| Deadlines (2nd date) | P2 | Power-user planning (do-date vs due-date) | Medium | Low | Medium |
| Comments | P2 | Needed with collaboration; solo notes too | Medium | Low | Low |
| Attachments | P2 | Expected in paid tier | Medium | Medium (Storage+RLS) | Low |
| Saved filters/views | P2 | Power-user lock-in | High | High (filter AST ⚠️) | High |
| Collaboration (shared projects, assignees) | P2 | Duo/team retention loop | High | **High** ⚠️ | Medium |
| Todoist import | P2 | Switching-cost killer | High (acquisition) | Medium | Low |
| Board/kanban layout | P3 | Nice for some projects; not core | Low | Medium | Medium |
| Calendar overlay (read-only) | P3 | Context while planning | Medium | High ⚠️ | Medium |
| Durations / time blocking | P3 | Niche | Low | Medium | High |
| Templates | P3 | Convenience | Low | Low | Low |
| Email-to-inbox | P3 | Long-tail capture | Low | Medium | Low |
| Public API / integrations | P3 | Ecosystem play, premature earlier | Medium | High | — |
| Location reminders | SKIP→P3 | Low usage, high battery/permission cost | Low | High | Medium |
| Karma / goals / gamification | **SKIP** | Off-brand by definition | — | — | — |
| Workspaces/teams (org tier) | **SKIP** (2yr) | Enterprise drift | — | Very high | High |
| Assistant/AI features | SKIP for now | Do it later, narrowly, or not at all | — | — | — |

**Reading of the table:** MVP credibility = the LC rows, fully polished. Four LC rows are flagged very-hard (recurrence, NL parsing, sync, offline) — these four are the real MVP cost, and they are exactly the ones that cannot be faked or bolted on later. Everything else in MVP is cheap by comparison.

---

## 5. HABIT INTEGRATION MODEL

### 5.1 Habit vs. recurring task — the decision rule
**A recurring task is an obligation that must be *done and cleared*, occurrence by occurrence. A habit is a behavior whose *pattern over time* is the point.**

Practical test, encoded in UX copy and onboarding: *"If missing it means it still has to happen (pay rent), it's a task. If missing it just means you missed it (gym), it's a habit."*

- "Pay rent monthly," "water plants," "submit timesheet" → recurring tasks. Overdue state matters; they roll forward.
- "Workout," "read 20 min," "drink 8 glasses" → habits. They never go "overdue"; a miss is recorded and the next day starts clean.

The quick-capture parser nudges: typing "every day" in quick add shows a subtle "Track as habit instead?" chip when the content matches habit heuristics (gym/read/meditate/drink...). One tap converts. This is the moment we rescue users from the Todoist anti-pattern of habit-as-recurring-task.

### 5.2 Shared logic vs. distinct logic

| Shared (one implementation) | Distinct (never merged) |
|---|---|
| Schedule/recurrence grammar & evaluator (which days is this expected?) | Storage: `habits` + `habit_logs` are separate tables from `tasks` — a habit is **not** a task subtype ⚠️ (locked decision; a shared table poisons every task query with habit special-cases) |
| Reminder scheduling pipeline | Completion model: tasks flip state; habits append immutable logs |
| Today-view assembly (one query layer produces both bands) | Overdue: tasks accumulate overdue; habits never do |
| Quick-capture entry point | History UI: habits get calendars/streaks; tasks get activity log |
| Notification actions (Complete / Log / Snooze) | Ordering: habits are schedule-ordered, not manually rankable |

### 5.3 Modeling the three habit types
One `habits` table, one `type` enum, one `habit_logs` shape (see §10.11–10.13):

- **Binary** (`type='binary'`): done/not-done per scheduled day. Log = `{date, value: 1}`.
- **Quantity** (`type='quantity'`): numeric target per day (`target_value: 8`, `unit: 'glasses'`). Logs are **incremental entries** (`+1`, `+2`), summed per day. Day is complete when `sum ≥ target`. Multiple logs/day expected; each keeps a timestamp (this enables "you drink most water at 3pm" later, free).
- **Frequency** (`type='frequency'`): target per period (`times_per_week: 3`). Each completion is a binary log; success is evaluated **per week**, not per day.
- **Scheduled** is not a fourth type — it's the schedule dimension (`daily` | `weekdays: [1,3,5]` | `per_week: n`) orthogonal to type. A binary habit on Mon/Wed/Fri is `type=binary, schedule=weekdays`.

### 5.4 Daily completion mechanics
- Logging writes an append-only row to `habit_logs` (client-generated UUID → idempotent, conflict-free sync; this is why habits sync trivially while tasks need care).
- Un-logging inserts a compensating negative entry for quantity, or tombstones the log for binary. Never mutate history rows in place — the sync layer depends on append-only.
- **Backfill is MVP:** habit detail calendar allows tapping yesterday/any past day to log late. Backfilled logs store both `logged_for` (the day it counts for) and `created_at` (when entered) — honest data, forgiving UX.
- Day boundary: user's local day, computed against `profiles.timezone` (§11.12). A "log water at 12:30am after a late night" edge: MVP uses hard midnight boundary; a configurable "day ends at 3am" offset is V2 (field reserved in schema now).

### 5.5 Streak rules (locked)
- **Daily-schedule habits:** streak = consecutive *scheduled* days completed. Non-scheduled days are neutral — a Mon/Wed/Fri habit skips Tuesday without penalty.
- **Frequency habits:** streak counts in **weeks** — consecutive weeks hitting the target. Displayed as "6-week streak," never fake-converted to days.
- **Quantity habits:** day counts toward streak only when target met; partial progress shows in the ring but does not extend streak.
- **Pauses** (vacation mode, per-habit): paused days are neutral. MVP includes pause because travel is the #1 streak-rage trigger.
- **No streak freezes/repair tokens.** That's gamification. If you missed, you missed. We soften the *presentation* (see 5.6), not the math.
- Computation: derived, never stored as source of truth. Nightly rollup caches `current_streak`/`best_streak` into `habit_stats`; clients recompute locally for instant optimistic updates. Shared conformance test vectors keep Swift and TS in agreement (§12).

### 5.6 Missed habits
- A miss is a quiet gray dot in history — no red, no "streak lost!" interstitial, no push notification about failure. The next scheduled day simply starts fresh.
- Yesterday's missed habit **does not appear in Today**. Habits never roll over — that's the defining contrast with tasks and the core of "not punishing."
- Weekly Review is where misses get acknowledged, once, calmly: "Reading: 4 of 7 days."

### 5.7 Habits in Today (locked layout)
Today has two bands: **Habits band** (top) — a horizontal row of compact habit chips (ring progress for quantity, check state for binary), one tap logs binary / opens stepper for quantity; collapsible; hidden entirely when all done ("All habits done ✓" hairline). **Tasks band** below — the full task list. Habits and tasks are **never interleaved or co-sorted**. Habits don't inflate the task count ("6 tasks · 3 habits" reads separately).

### 5.8 Habits on the Dashboard
Three habit widgets at launch (§6): **Habits Today** (interactive checklist/rings — the hero widget), **Quick Log** (single-habit big-tap counter, e.g. water +1), **Streaks** (compact multi-habit streak overview). All interactive — logging from Home without opening the Habits tab is the demo moment.

### 5.9 Weekly & monthly review (V1, designed now)
- **Weekly Review** — a Sunday-evening (configurable) guided flow, entered via notification or Home card: (1) habit scorecard for the week, (2) tasks completed count + notable finishes, (3) overdue triage — reschedule/drop each in one swipe, (4) next week's calendar-light glance. Three minutes, end-to-end. This ritual is a retention engine, not an analytics page.
- **Monthly Review** — habit consistency percentages, best streaks, month-over-month deltas. Read-only, one screen.
- Both are backed by pre-aggregated `habit_stats` + simple task counts — no heavy client math.

### 5.10 Preventing habit pollution of the task experience (hard rules)
1. Habits never appear in Inbox, Upcoming, project views, or search *task* results (they're a separate result group).
2. Habits are excluded from all task counts and badges.
3. Habits have a distinct visual token (ring/chip) vs. tasks (checkbox row) — recognizable at a glance forever.
4. Filters operate on tasks; habit filtering doesn't exist (there are ≤ ~12 habits; filtering them is over-engineering).
5. A habit cannot live inside a project. If a user wants "project-scoped repeated to-do," that's a recurring task, and the UI says so.

---

## 6. MODULAR HOME SYSTEM

### 6.1 Core decisions
- **Home is the default landing screen** on both iOS and web. If the morning glance is the product, it must be screen one. (Escape hatch: Settings → "Open app to: Home / Today" — some list-purists will want Today; give them the toggle, keep Home the default.)
- The system is a **curated widget grid**, not a canvas: fixed grid, fixed sizes, capped catalog, no free positioning, no nesting.

### 6.2 Default layout for a new user (locked)
Order, iPhone (2-column grid):
1. **Greeting / date header** (system, not removable — anchors the screen, shows "Tuesday, July 2 · 4 tasks · 3 habits")
2. **Today Tasks** (large, 2×2) — top 5 tasks, interactive checkboxes, "+2 more →"
3. **Habits Today** (medium, 2×1) — habit chips/rings, interactive
4. **Quick Add** (small, 1×1) — opens capture composer
5. **Upcoming Peek** (medium, 2×1) — next 3 days, counts + first items

That's it — four widgets plus header. The default must feel composed and slightly *sparse*. Personalization is adding, and the empty bottom edge invites it ("+ Add widget" ghost tile).

### 6.3 Launch widget catalog (7 + header)

| Widget | Sizes | Interactive? | Content |
|---|---|---|---|
| Today Tasks | M, L | ✅ complete, tap-through | Today's tasks, overdue rolled in with subtle marker |
| Habits Today | M, L | ✅ log binary, stepper for quantity | Today's scheduled habits |
| Quick Add | S | ✅ opens composer | Capture button + "to Inbox" hint |
| Upcoming Peek | M | tap-through | Next 3–7 days summary |
| Quick Log | S | ✅ big-tap +1 | One chosen quantity habit (water) — ring + count |
| Streaks | M | tap-through | Top habit streaks, flame-free design (dot-chain, not 🔥) |
| Inbox Count | S | tap-through | Unprocessed inbox count — a gentle "process me" cue |

### 6.4 Future widgets (rolling post-launch)
V1: Project Peek (pin one project), Weekly Review card (appears Sunday), Overdue triage. V2: Calendar strip (needs calendar integration), Notes/scratchpad, Monthly consistency heatmap, Focus (single chosen task). V3: cross-domain insight cards. **Catalog cap: ~15 widgets ever visible in the picker; retire weak ones rather than accumulate.**

### 6.5 Size strategy
Three sizes total — S (1×1), M (2×1), L (2×2) on the phone's 2-column grid. Web maps the same instances onto a 12-column grid: S→3 cols, M→6, L→6 wide/2 rows (§10.18 for the layout model). **MVP: each widget ships at one fixed size; user resizing is V1.** Resizing is pure delight, zero utility — cut from MVP without guilt.

### 6.6 Interactive vs. informational
Rule: **every widget must support at least one direct action or a meaningful tap-through.** Checkbox completion, +1 logging, and capture happen *in place* with optimistic UI — no navigation. This is what separates Planoa's home from a pretty report.

### 6.7 iPhone interaction model
- Scroll: single vertical scroll, header pinned lightly.
- Edit mode: **explicit "Edit" via header ellipsis → grid gets drag handles + remove badges; drag to reorder; "+ Add widget" opens a bottom-sheet gallery with live previews.** Deliberately *not* the iOS wiggle — wiggle reads as chaos; Planoa's edit mode is calm and modal. Long-press on a widget offers a shortcut menu (Edit layout / Widget settings).
- Widget settings (e.g., which habit Quick Log tracks): long-press → "Widget options" sheet.

### 6.8 Web interaction model
- Same widget instances, 12-col responsive grid, max content width ~1200px.
- Hover reveals a subtle drag handle + ⋯ menu per widget; drag-and-drop reorder is always live (no modal edit mode needed with a pointer). "+ Add widget" tile persists at grid end.
- Keyboard: widgets are focusable; Enter activates primary action.

### 6.9 Add / remove / reorder behavior
- Add: gallery sheet with rendered live previews (real user data, not lorem) and one-line purpose text. One instance per widget type at MVP (except Quick Log, which is per-habit — the only multi-instance widget, and it's parameterized, proving out the instance model).
- Remove: never deletes data; a removed widget returns to the gallery.
- Reorder: drag; persistence is per-device-class (phone layout and desktop layout stored separately, same instance list — §10.18).

### 6.10 Anti-clutter rules (enforced in product, not just guidelines)
1. Soft cap: at 8 widgets, the add-gallery shows "A focused home works better — consider removing one." Hard cap: 12.
2. No duplicate widget types (except parameterized Quick Log).
3. Widgets self-collapse when empty where sensible ("All habits done" hairline instead of an empty box); Inbox Count hides at zero via widget option.
4. No badges, no red dots on Home. Urgency lives inside views, not on the cockpit.
5. Every new widget proposal must answer: *what action does it enable this morning?* If none — rejected.

### 6.11 Onboarding into personalization
Onboarding (§8.1) seeds the default layout, then plants one contextual hook rather than a tutorial: after the user creates their first habit, a one-time toast — "Your Home updated. Long-press to make it yours." Personalization is *discovered on day 2–3*, not taught on day 0. A "Customize Home" row in Settings and the header ellipsis are the permanent entry points.

### 6.12 Customizable at MVP vs. later
- **MVP:** add/remove/reorder widgets; Quick Log habit choice; accent color; default landing screen toggle.
- **V1:** widget resize; per-widget options (Today widget scope, list length); app icons.
- **V2+:** multiple dashboards (Work/Life); layout schedules (morning/evening); shared/team widgets. Do not build the multi-dashboard model early — it doubles layout persistence complexity for a speculative need.

---

## 7. INFORMATION ARCHITECTURE

One strong recommendation, both platforms. The unifying idea: **Home is the cockpit, Today is the work surface, Browse is the filing cabinet, Habits is the practice room.**

### 7.1 iOS

**Primary navigation — a 4-tab bar + floating capture button:**

| Tab | Contents |
|---|---|
| **Home** | The modular dashboard (§6). Header ellipsis → Edit Home. |
| **Today** | Habits band + task list for today (incl. overdue). Swipe header left → Upcoming (a paged pair: Today ⇄ Upcoming, with a segmented control). |
| **Browse** | Inbox (pinned top with count), then Projects (with sections/archive), Labels, Filters/saved views (V1), Completed. This is Todoist's proven "browse" pattern — familiar to switchers. |
| **Habits** | Habit list with today states → habit detail (history calendar, streaks, options). Weekly/Monthly Review entry lives here (V1) plus surfaces on Home via the Sunday card. |

- **Quick capture:** floating "+" bottom-center, present on every tab, opens the composer sheet. Long-press "+" → capture menu (Task / Habit log / New habit).
- **Search:** magnifier in the nav bar on Today and Browse; global scope (tasks, projects, habits as separate result groups). No dedicated tab — search is a verb, not a place.
- **Calendar:** no calendar tab. Upcoming *is* the planning surface; the V2 calendar overlay renders inside Upcoming.
- **Collaboration (V1):** lives inside projects — share sheet on the project header; activity feed per project. No global "Teams" area.
- **Settings:** avatar top-left on Home → Settings sheet (account, appearance, notifications, Customize Home, data).

Secondary navigation: project detail → sections, task detail sheet (comments/attachments V1); habit detail; filter detail. Task detail is a **sheet**, not a push — tasks are glanced and dismissed, and sheets preserve list context.

### 7.2 Web

**Layout: persistent left sidebar + content pane + global command bar.**

Sidebar (top → bottom):
1. Planoa mark + workspace/account switcher (future-proofing; single item at MVP)
2. **Search / Cmd-K** field
3. **Home**, **Today** (with count), **Upcoming**, **Inbox** (with count)
4. **Habits**
5. **Filters** (V1, collapsible)
6. **Projects** (collapsible tree, drag-reorder; shared projects get an avatar cluster, V1)
7. Bottom: Completed, Settings, Upgrade

- Home is the default route (`/home`). Today is `/today`, one click or `g t` away.
- Quick add: global `Q` opens the composer; Cmd/Ctrl-K opens the command palette (navigate, add, search — one bar, three verbs).
- Settings and dashboard customization: `/settings/*`; "Edit Home" also directly from a button on `/home`.
- Task detail: right-side panel sliding over content (list stays visible — critical for planning flows), URL-addressable (`/task/:id`).

### 7.3 Why this IA wins
- Four tabs is the calm maximum; habits get a tab because they are a *pillar*, not a feature — burying them under Browse would falsify the product's core claim.
- Today⇄Upcoming as a paged pair keeps "doing" and "planning" adjacent without a fifth tab.
- Browse consolidates all filing (inbox/projects/labels/filters) into one predictable place — switchers from Todoist feel at home instantly.

---

## 8. CORE UX FLOWS

Format per flow: **Goal → Sequence → Actions → Edge cases → UX notes.**

### 8.1 Onboarding
- **Goal:** From App Store to a personally meaningful Home in under 90 seconds.
- **Sequence:** (1) Welcome — one screen, one sentence ("Your day, in one place"), sign-in options. (2) Auth: Sign in with Apple (primary on iOS) / Google / email magic link. (3) "What are you organizing?" — chips: Work · Personal · Health · Study (multi-select) → seeds 1–2 starter projects. (4) "Pick habits to build" — 6 curated suggestions (Workout, Water, Read, Sleep by 11, Supplements, Custom) → creates chosen habits with sensible defaults. (5) Notification permission, *with the payoff shown first* ("Planoa reminds you at the moment you chose — nothing more"). (6) Land on Home, pre-populated with their projects, habits, and 2 sample tasks in Inbox marked as samples.
- **Actions:** every step skippable; total taps ≤ 8.
- **Edge cases:** skip-all lands on default Home with sample content; declined notifications → banner appears only later, contextually, when the user sets their first reminder; existing account → straight to Home with synced data.
- **UX notes:** No feature tour, no coach marks, no 9-screen carousel. The seeded content *is* the tutorial. Ask for the notification permission after value is visible on screen behind the dialog.

### 8.2 First task creation
- **Goal:** Trust: "I typed a thought, Planoa understood it."
- **Sequence:** Home → "+" → composer sheet → type "Call dentist tomorrow 10am" → parsed chips appear live (📅 Tomorrow 10:00) → Enter → toast "Added to Inbox · View".
- **Actions:** type; optionally tap chips to adjust; Enter saves; sheet stays open for rapid entry (Todoist behavior — deliberate copy, it's correct), swipe down closes.
- **Edge cases:** misparse ("Read Tomorrowland review" → tomorrow) — chips are visible pre-save and one tap removes the date; date-only text like "tomorrow" alone → becomes title, no date (title must be non-empty after extraction, else extraction is cancelled).
- **UX notes:** Parsed tokens highlight *in the text* as chips (Todoist-style); deletion of a chip returns the literal text. Default destination Inbox unless `#project` token or composer opened from within a project.

### 8.3 Quick capture (steady-state)
- **Goal:** <3 seconds, from anywhere, including offline.
- **Sequence:** any tab → "+" → type → Enter → done. iOS share sheet: share URL/text from Safari → Planoa extension → pre-filled composer → save. Web: `Q` from any route.
- **Edge cases:** offline → saves locally, syncs later, zero UI difference (no "offline!" banner in the composer — trust is silent); capture during edit-mode on Home → edit mode exits first.
- **UX notes:** Composer opens with keyboard up in <200ms — this is a hard performance budget, tested in CI (§13.10).

### 8.4 Project creation
- **Goal:** A filing home in seconds; structure optional.
- **Sequence:** Browse → "+ New project" → name, color (curated palette), optional "Add sections?" quick-chips (To do/Doing/Done · Weekly · Custom) → land in project.
- **Edge cases:** duplicate names allowed (color + position disambiguate); project cap on free tier → tasteful upgrade sheet; sections skippable and addable inline later ("+ Add section" between groups).
- **UX notes:** No project templates at MVP. No project descriptions/icons at MVP — name + color only.

### 8.5 Recurring task setup
- **Goal:** Natural-language recurrence that round-trips visibly.
- **Sequence:** composer → "water plants every saturday" → chip "🔁 Every Saturday" → save. Or task detail → Date → "Repeat" → picker (Daily / Weekly on [days] / Monthly on day N / Every N days / After completion).
- **Edge cases:** completing a recurring task rolls it to next occurrence with an undo toast ("Next: Sat 12 Jul · Undo"); editing date of a recurring task asks **"This occurrence / All future"** (sheet, two buttons, no third option); "complete forever" via long-press on the checkbox → "Complete permanently".
- **UX notes:** The picker and the parser share the same grammar — anything the picker can produce, quick add can parse, and vice versa. That symmetry is a spec-level requirement (§12).

### 8.6 First habit creation
- **Goal:** A correctly-typed habit in under 30 seconds.
- **Sequence:** Habits tab → "+" → choose from curated gallery (pre-typed: Water=quantity/8/glasses, Workout=frequency/3-week, Read=binary/daily…) or Custom → Custom asks, in order: name → "How do you track it?" (Done or not / An amount / X times per week — plain language, not "binary") → schedule → optional reminder time → done.
- **Edge cases:** habit that looks like a task ("Pay rent monthly") → gentle inline note "Sounds like a recurring task — create there?"; >3 habits on free tier → upgrade sheet.
- **UX notes:** Type is *immutable after creation* at MVP (changing binary→quantity corrupts history semantics; V2 can offer "duplicate as new type"). Defaults everywhere — a user tapping through makes a valid daily binary habit.

### 8.7 Water logging (quantity habit)
- **Goal:** Log a glass in one tap, from anywhere.
- **Sequence:** Home → Quick Log widget → tap → ring animates +1 (haptic tick) → at target, single soft completion moment (ring fills, one gentle haptic — no confetti). Alternatives: Today habit chip → stepper sheet (+1/+2/custom); notification action "Log +1".
- **Edge cases:** overshoot beyond target → keeps counting (12/8), ring stays full, no penalty; mistake → stepper "−1" (compensating log entry, §5.4); backfill yesterday → habit detail calendar → tap day → stepper.
- **UX notes:** The tap target is huge (whole widget). Latency budget: optimistic, <50ms visual response. This interaction is the product's heartbeat; polish it obsessively.

### 8.8 Workout completion (frequency habit)
- **Goal:** Mark a workout; see weekly progress, not daily guilt.
- **Sequence:** Today → Workout chip → tap → check + "2 of 3 this week" caption updates. Habit detail shows week dots (M T W T F S S) with target line.
- **Edge cases:** 4th workout in a 3× week → counts, shows "4 of 3 ✓"; logging on a rest day is always allowed (frequency habits have no wrong day); un-log via tap-again within the day.
- **UX notes:** Frequency habits show *week context* everywhere ("2 of 3"), never a bare daily checkmark that reads as a miss on rest days.

### 8.9 Weekly planning
- **Goal:** Sunday: empty the inbox, shape the week, ten minutes.
- **Sequence (V1 guided flow; MVP = manual equivalent works fine):** Weekly Review card on Home (Sundays) → (1) habit scorecard → (2) "Inbox: 7 items" — triage each: schedule / move to project / delete, swipe-driven → (3) overdue tasks: reschedule-all-to suggestions or per-item → (4) Upcoming glance for next week → "Week planned ✓".
- **Edge cases:** empty inbox → step skipped with a nod; abandoned mid-flow → resumable, no state lost (each triage action commits immediately).
- **UX notes:** Every action in the flow is a normal action (reschedule, move) — the flow is choreography over existing verbs, which is why it's cheap to build in V1 and works manually at MVP.

### 8.10 Dashboard customization
- **Goal:** Make Home mine in under a minute.
- **Sequence:** Home → ⋯ → Edit Home → tiles get handles/remove badges → drag to reorder → "+ Add widget" → gallery with live previews → tap to add (lands at bottom) → Done.
- **Edge cases:** removing an interactive widget mid-animation → action queue flushes first; cap reached (§6.10); layout syncs to other devices *of the same class* (phone→phone), web layout independent.
- **UX notes:** Gallery previews render the user's real data — a preview with your actual tasks sells the widget instantly.

### 8.11 Search and filtering
- **Goal:** Find anything in two seconds; power views without query syntax (until V1).
- **Sequence:** iOS: 🔍 → type → grouped live results (Tasks / Projects / Habits / Comments-V1) → tap → context-preserving open. Web: Cmd-K → same, plus navigation commands.
- **Edge cases:** offline → local index serves results (iOS full, web recent-cache); completed tasks searchable behind a "Completed" group toggle.
- **UX notes:** Recent searches, zero-state shows recently viewed. V1 filters: builder UI (conditions: date, project, label, priority + AND/OR) that *generates* the grammar visibly — teaches power syntax by showing, never requires it.

### 8.12 Sharing a project (V1)
- **Goal:** Partner/colleague joins one project; nothing else leaks.
- **Sequence:** Project → header avatars/Share → invite by email → invitee gets email + in-app notification → accepts → project appears in their Browse under "Shared"; assignee field appears on the project's tasks; per-project activity feed becomes visible.
- **Edge cases:** invitee has no account → invite email routes through signup, deep-links back to acceptance; removing a member → their assignments become unassigned (kept, flagged in feed); owner leaves → must transfer ownership first; personal data (other projects, habits, dashboard) never visible to collaborators — stated in the share sheet copy.
- **UX notes:** Roles at V1: owner / member. No viewer/commenter matrix — that's enterprise drift.

### 8.13 Managing reminders
- **Goal:** Set-and-trust; edit without hunting.
- **Sequence:** Task detail → Remind → default = at due time; chips: 10m/1h/1d before, or custom. Habit reminder: habit options → time per scheduled day. Global: Settings → Notifications → master toggles (task reminders / habit reminders / daily agenda + its time / weekly review).
- **Edge cases:** reminder on a task with no time → prompts date+time inline; recurring tasks → reminder repeats per occurrence automatically; timezone travel → §11.12 rules; notification arrives with actions (Complete / Snooze 1h / Log).
- **UX notes:** One reminder per task at MVP (multiple = V2). The daily agenda notification is opt-in and shown as an offer at the end of the user's first active day, not at onboarding.

---

## 9. DESIGN SYSTEM DIRECTION

### 9.1 Visual tone
**"Quiet instrument."** The reference points are Things 3's restraint, Linear's precision, and a premium watch face's information density — not Notion's beige maximalism, not Todoist's utilitarian red, not the glassy purple-gradient AI-app look. Surfaces are calm and matte; color is scarce and meaningful; the interface recedes so the user's content is the interface.

### 9.2 Typography
- iOS: **SF Pro** (text + rounded variant for numerals in rings/streaks). Web: **Inter** with SF-like metrics. One family per platform, no display font.
- Scale: 4 sizes essentially everywhere — Large Title (Home greeting), Headline (widget/section titles), Body (task rows), Caption (metadata). Tabular numerals for all counts.
- Weight does hierarchy; size stays modest. A task row is Body regular; its metadata is Caption in secondary color. Never bold-everything.

### 9.3 Spacing & density
- 4pt base grid; generous but not airy: task rows ~44–48pt on iOS, ~40px web (with a "compact" density toggle deferred to V2 — density toggles are a settings trap).
- Content max-width on web: 680px for lists, 1200px for Home grid. Lists never span a 27" monitor.

### 9.4 Card system
- Two surface levels only: **background** (app canvas) and **card** (widgets, sheets, task detail). Cards: 16pt radius, hairline border in light mode, elevation-by-border-not-shadow in dark mode, very soft single shadow in light.
- Lists inside views are *not* cards-per-task (card-per-task is the generic-AI-app tell). Tasks are rows with hairline separators; cards are reserved for Home widgets and modals — this contrast is what makes Home feel special.

### 9.5 Dashboard widget design
- Uniform anatomy: Caption-size title row (icon + label + optional count) / content area / no footers. Identical padding (16pt), identical radius. Interactive elements use the accent; informational text never does.
- Widgets are visually quieter than their content: gray-scale chrome, colored content (project dots, habit rings).

### 9.6 Color philosophy
- Neutral core: warm gray ramp (not blue-gray — warmth reads premium), true dark mode (near-black #0E0E10, not gray-blue).
- **One user-chosen accent** from 6 curated options (default: a deep teal — deliberately distant from Todoist red, Things blue, TickTick teal-blue is avoided via depth/darkness). Accent is used *only* for: primary actions, selected states, progress rings, links. If accent appears more than ~5 times on a screen, the screen is wrong.
- Fixed semantic colors: P1 red-orange, P2 amber, P3 blue, P4 none; success = accent (not green — reduces palette noise); habit rings use accent, not per-habit rainbow (per-habit color is a V2 option, curated palette only).
- Project colors: 12 curated muted tones.

### 9.7 Iconography
- SF Symbols on iOS; a matched custom set on web (Lucide, curated + adjusted weights) — outline style, 1.5px stroke feel, no filled icons except selected tab states.
- Habits get a small curated icon set (~40) — no emoji-as-icon (emoji instantly de-premiums the grid).

### 9.8 Motion principles
- Motion confirms, never decorates. 150–250ms, standard spring on iOS, ease-out on web.
- Signature moments (the only choreographed animations): task-complete check draw + row settle; habit ring fill; Home widgets' staggered 30ms fade-in on first appearance; sheet transitions. Nothing loops, nothing bounces twice, no confetti anywhere in the product, ever.
- Reduced-motion honored fully.

### 9.9 Keeping it premium and calm — operating rules
1. One accent per screen region; color earns its place.
2. Empty states are designed (short line + one action), never illustrated with quirky mascots.
3. No banners, badges, or upsell interruptions inside working views; monetization surfaces live in Settings and at natural limits.
4. Copy voice: brief, lowercase-calm, zero exclamation marks ("All habits done" not "You crushed it! 🎉").

### 9.10 Unifying tasks, habits, and planning
- Shared DNA: same row heights, same caption metadata style, same date chips, same sheet anatomy.
- Distinct tokens: task = square-ish checkbox; habit = circular ring/chip. This one shape distinction carries the entire "two pillars, one system" idea across every surface — protect it fiercely.

### 9.11 Avoiding generic-AI and Todoist-clone aesthetics
- Banned: purple/indigo gradients, glassmorphism, card-per-task lists, emoji headers, giant rounded-everything, floating gradient orbs.
- Anti-Todoist: warm neutrals vs. Todoist's stark white; teal accent vs. red; rows+cards contrast vs. uniform lists; the Home cockpit — which Todoist simply does not have — is the identity carrier.

### 9.12 Native vs. shared
| Native iOS | Native web | Shared across both |
|---|---|---|
| SF Pro, SF Symbols, sheets, context menus, haptics, edge-swipe back, Dynamic Type | Sidebar IA, hover states, Cmd-K, keyboard shortcuts, right-side detail panel, focus rings | Color system, spacing scale, widget anatomy, iconographic language, date-chip grammar, motion timing, copy voice, empty-state patterns |

Design tokens (color/spacing/type/radius) live in one JSON source of truth → generated Swift + CSS variables (§12).

---

## 10. DATA MODEL

Supabase Postgres. Conventions: all PKs are **client-generated UUIDv7** (offline creation + time-ordered index locality); every synced table carries `created_at`, `updated_at` (server-set via trigger), `deleted_at` (soft delete for sync tombstones); RLS on everything; `updated_at` indexed on synced tables (delta pull cursor).

### 10.1 users (Supabase `auth.users`)
- **Purpose:** Identity only; owned by Supabase Auth. Never extended directly.

### 10.2 profiles
- **Purpose:** App-level user data, 1:1 with auth.users.
- **Key fields:** `id uuid PK = auth.users.id`, `display_name`, `avatar_url`, `timezone text NOT NULL` (IANA), `week_start smallint`, `day_end_offset_minutes int DEFAULT 0` (reserved, §5.4), `plan text DEFAULT 'free'`, `onboarding_state jsonb`.
- **MVP:** all above except `day_end_offset_minutes` (reserved). **Future:** locale, referral, plan metadata.
- **Constraints:** trigger creates profile on signup; RLS: owner read/write (display_name/avatar readable by co-members in V1).

### 10.3 workspaces & 10.4 workspace_members  *(schema now, product later)*
- **Purpose:** Future container for team tiers. **MVP: every user gets one auto-created personal workspace; UI never shows it.** This costs one FK per project now and saves a brutal migration later.
- **workspaces:** `id`, `name`, `kind text CHECK (kind IN ('personal','shared'))`, `owner_id`.
- **workspace_members:** `workspace_id`, `user_id`, `role`, PK(workspace_id,user_id). MVP contains exactly the owner row.

### 10.5 projects
- **Purpose:** Top-level task containers; unit of sharing.
- **Key fields:** `id`, `workspace_id FK`, `owner_id FK`, `name`, `color text` (token name), `rank text` (fractional/lexo rank), `is_archived bool`, `archived_at`, `view_layout text DEFAULT 'list'` (future board).
- **MVP:** all except view_layout (reserved). **Future:** description, icon, is_favorite.
- **Indexes:** `(workspace_id, is_archived, rank)`. RLS: owner OR project_member (§12.5).

### 10.6 project_members  *(schema at MVP, product at V1)*
- `project_id`, `user_id`, `role text CHECK (role IN ('owner','member'))`, `invited_by`, `joined_at`; PK(project_id,user_id). The single most important future-proofing table: **all task/project RLS routes through it from day one**, so V1 sharing is an INSERT, not a migration.

### 10.7 sections
- `id`, `project_id FK CASCADE`, `name`, `rank`, `is_archived`. Index `(project_id, rank)`.

### 10.8 tasks
- **Purpose:** The core entity.
- **Key fields:** `id`, `project_id FK` (nullable = Inbox… **decision: no.** Inbox is a real, auto-created, undeletable project per user (`is_inbox bool` on projects) — nullable project_id poisons every RLS policy and join; locked), `section_id FK nullable`, `parent_task_id FK nullable` (subtasks, unlimited depth stored / 1 level rendered at MVP), `author_id`, `assignee_id nullable` (V1), `title text NOT NULL`, `description text`, `priority smallint DEFAULT 4`, `due_date date nullable`, `due_time time nullable` (split fields, not timestamptz — a "due Friday" has no time and must not gain one via timezone math ⚠️), `due_tz text nullable` (fixed-zone events, V2; MVP uses floating local dates), `deadline_date date nullable` (V1), `recurrence jsonb nullable` (structured rule, §11.1), `recurrence_text text` (display string), `completed_at timestamptz nullable`, `completed_by nullable`, `rank text` (within section), `day_rank text` (within Today — separate manual order for the day list ⚠️ commonly forgotten).
- **MVP-required:** all except assignee, deadline, due_tz.
- **Indexes:** `(project_id, section_id, rank)` partial WHERE completed_at IS NULL AND deleted_at IS NULL; `(author_id, due_date)` partial for Today/Upcoming; `(parent_task_id)`; FTS `tsvector` GIN on title+description.
- **Constraints:** CHECK priority BETWEEN 1 AND 4; trigger forbids parent cycles.

### 10.9 labels & task_labels
- **labels:** `id`, `owner_id`, `name`, `color`, `rank`; UNIQUE(owner_id, lower(name)). Personal, never shared (in shared projects your labels remain yours — Todoist's model, correct).
- **task_labels:** PK(task_id, label_id); index on label_id.

### 10.10 saved_views  *(V1)*
- `id`, `owner_id`, `name`, `icon`, `query jsonb` (**filter AST, not raw string** — versioned, machine-checkable, compiles to SQL and to client predicates), `query_text` (display), `rank`.

### 10.11 habits
- `id`, `owner_id`, `name`, `icon`, `color nullable` (V2), `type text CHECK (type IN ('binary','quantity','frequency'))`, `target_value numeric nullable` (quantity), `unit text nullable`, `times_per_week smallint nullable` (frequency), `schedule jsonb NOT NULL` (`{"kind":"daily"} | {"kind":"weekdays","days":[1,3,5]} | {"kind":"per_week"}`), `reminder_time time nullable`, `rank`, `is_paused bool`, `paused_at`, `archived_at`.
- **Constraints:** CHECK (type='quantity') = (target_value IS NOT NULL); type immutable via trigger (MVP).

### 10.12 habit_schedules — **rejected as a table.** Schedule lives in `habits.schedule jsonb`. A separate table earns its keep only with schedule *history* ("was Mon/Wed, now daily — score old weeks by old rule"). MVP scores history by current schedule (documented, acceptable); if history-accurate scoring is demanded, V2 adds `habit_schedule_versions`. Hidden complexity acknowledged and deliberately deferred. ⚠️

### 10.13 habit_logs
- **Purpose:** Append-only behavioral record — the moat table.
- **Key fields:** `id` (client UUID → idempotent sync), `habit_id FK`, `user_id`, `logged_for date NOT NULL` (day it counts toward, user-local), `value numeric NOT NULL DEFAULT 1` (negative = compensating entry), `created_at`.
- **Indexes:** `(habit_id, logged_for)`; `(user_id, logged_for)` (Today/dashboard assembly). Rows never UPDATEd (except tombstone `deleted_at` for binary un-log).

### 10.14 reminders
- `id`, `owner_id`, `task_id nullable FK` / (habit reminders live on `habits.reminder_time`, not here — different lifecycle), `kind text DEFAULT 'absolute'` (`absolute`|`offset`), `remind_at timestamptz nullable`, `offset_minutes int nullable`, `fired_at timestamptz nullable`.
- **Index:** `(remind_at) WHERE fired_at IS NULL AND deleted_at IS NULL` — the dispatcher sweep (§11.4).

### 10.15 notifications
- **Purpose:** In-app notification feed + push dedupe record.
- `id`, `user_id`, `kind`, `payload jsonb`, `dedupe_key text` UNIQUE(user_id,dedupe_key), `read_at`, `created_at`. MVP: reminders + daily agenda; V1: invites, comments, assignments.

### 10.16 comments  *(V1)*
- `id`, `task_id FK` (project-level comments deferred), `author_id`, `body text`, `edited_at`. RLS inherits task's project access.

### 10.17 attachments  *(V1)*
- `id`, `comment_id nullable`, `task_id FK`, `uploader_id`, `storage_path text` (bucket `attachments`, path `project_id/task_id/uuid-filename` — RLS on storage.objects mirrors project membership via path prefix), `file_name`, `mime_type`, `size_bytes`. Limit 25MB (Pro), images+pdf+common docs.

### 10.18 dashboard_layouts & widget instances
- **Decision:** one row per user **per device class**, widgets embedded as jsonb (a normalized widget-instance table is over-modeling for ≤12 ordered items).
- `id`, `user_id`, `device_class text CHECK (IN ('phone','desktop'))` (tablet later), `widgets jsonb` — ordered array `[{instance_id, widget_type, size, config:{habit_id?...}}]`, `updated_at`. UNIQUE(user_id, device_class).
- Adding a widget on phone appends it to desktop too (same instance list, per-class order+size); a class-level `hidden` flag per instance allows "on phone only" (V1).

### 10.19 widget_definitions — **rejected as a DB table.** The widget catalog is *code* (a registry in each client + shared JSON manifest for gating/versioning). A DB catalog implies server-rendered widget definitions we will never build. Feature-flag gating handles staged rollout.

### 10.20 user_preferences & 10.21 activity_log
- **user_preferences:** `user_id PK`, `default_landing text`, `accent text`, `time_format`, `notification_prefs jsonb`, `agenda_time time`. (Device-local prefs — e.g., haptics — stay on-device, never synced.)
- **activity_log** *(V1, with collaboration)*: `id`, `project_id`, `actor_id`, `verb`, `object_type/object_id`, `meta jsonb`, `created_at`; partitioned by month when volume demands. MVP writes nothing here — task `completed_at`/`updated_at` covers solo needs; a full audit log before sharing exists is cost without customer.

### Relationships summary
`auth.users 1–1 profiles`; `workspaces 1–N projects 1–N sections 1–N tasks (self-ref subtasks)`; `tasks N–M labels`; `projects 1–N project_members`; `profiles 1–N habits 1–N habit_logs`; `tasks 1–N reminders/comments`; `comments 1–N attachments`; `profiles 1–2 dashboard_layouts`.

---

## 11. BUSINESS LOGIC MODEL

### 11.1 Recurrence rules
- Stored as structured JSON (versioned): `{v:1, freq:'daily'|'weekly'|'monthly'|'yearly', interval:n, weekdays:[1..7]?, monthday:n?, mode:'fixed'|'after_completion'}`.
- **MVP grammar (locked):** every day · every N days · every weekday · every week on [days] · every N weeks · every month on day N · every year on date · "every!" (after-completion mode). **Deferred:** last-day-of-month, "3rd Tuesday", multiple times per day, end dates/counts (V2).
- Semantics: Todoist model — **one task row, rolling due date.** Completing computes next occurrence from (fixed: current due date; after_completion: completion date) and updates `due_date`; a completion event is recorded (task `completed_at` stays NULL until permanent completion; per-occurrence history lands in the completions record for stats).
- Next-occurrence math runs in the user's timezone, date-level (no DST trap since due_date/due_time are floating local values).
- Editing: "This occurrence" = move due_date only; "All future" = rewrite rule anchored at new date.

### 11.2 Due date vs. deadline (V1)
- `due date` = when you plan to do it (drives Today/Upcoming, reminders, recurrence).
- `deadline` = when it's actually due (displayed as a quiet secondary chip; drives a "deadline approaching" grouping in Upcoming; never triggers recurrence).
- MVP ships due date only; the distinction arrives V1 with the planning audience that needs it.

### 11.3 Today / Upcoming logic
- **Today =** tasks with due_date ≤ user-local today (overdue folded in under a collapsed "Overdue (n)" group at top) + habits scheduled today (band, §5.7). Frequency habits appear daily while the week's target is unmet; after target met they show as done-state chips.
- **Upcoming =** infinite day-grouped scroll starting tomorrow; recurring tasks render **only their next occurrence** (no phantom future instances — matches the single-row model and avoids projection complexity at MVP; projected occurrences in Upcoming = V2).
- Day boundary: computed client-side against profile timezone; recomputed on foreground/midnight tick.

### 11.4 Reminder scheduling
- Source of truth: `reminders` rows. Dispatcher: pg_cron every minute → Edge Function sweeps `remind_at <= now() AND fired_at IS NULL` → APNs / web push → sets `fired_at`, writes `notifications` row with `dedupe_key = reminder_id:occurrence_date`.
- iOS additionally schedules **local** notifications for the next 7 days of known reminders (offline reliability). Dedupe rule: iOS local notification is the primary for that device; the push payload carries the dedupe key and the app suppresses the duplicate if the local one already presented. ⚠️ This dual path is fiddly — it is the price of "reminders fire in airplane mode," which is worth it.
- Recurring tasks: on each occurrence roll, offset-kind reminders recompute `remind_at` automatically (trigger).
- Daily agenda: per-user scheduled job keyed to `agenda_time` in profile timezone.

### 11.5 Habit streaks — see §5.5 (locked there). Implementation: pure function `streak(schedule, logs[], today, tz)` in the shared spec with ~40 conformance vectors (DST transitions, week boundaries with different week_start, pauses, backfills). Nightly rollup caches to `habit_stats`; clients compute locally for optimism; server value wins on drift (it's derived data — recompute, never merge).

### 11.6 Quantity logging — append-only entries; day total = SUM(value) for `logged_for`; negative compensating entries for corrections; completion at total ≥ target; overshoot allowed and displayed.

### 11.7 Widget visibility — a widget renders when: in user's layout ∧ feature flag on ∧ (plan allows ∨ shows tasteful locked-state preview). Empty-state collapse per §6.10.

### 11.8 Completion rules
- Task complete: sets completed_at/by; subtasks — completing a parent prompts if open subtasks exist ("Complete 3 subtasks too?"); completing the last subtask never auto-completes the parent (annoying magic — locked out).
- Uncomplete: allowed anytime from Completed view; recurring uncomplete within the undo window rolls the date back, after that it's a plain uncomplete of the *current* occurrence.
- Habits: §5.4.

### 11.9 Archive vs. delete
- **Archive** (projects, sections, habits): hidden from active UI, fully recoverable, excluded from counts, included in search behind a toggle. **Habits archive rather than delete by default** — history is the moat; deleting a habit warns hard about log loss.
- **Delete**: soft-delete rows (`deleted_at` tombstones, required by sync) with a 30-day trash for projects/tasks (V1 exposes trash UI; MVP has undo-toast only + tombstones already in place). Hard purge: scheduled job after 30 days.
- Completed tasks are neither — they live in Completed view per project/day, forever (cheap, valuable).

### 11.10 Project completion — projects are archived, not completed (a project with open tasks prompts: complete-all / keep / cancel). No "project done" state to sync or explain.

### 11.11 Collaboration permissions (V1)
- Roles: **owner** (share/unshare, delete project, transfer) and **member** (full task CRUD, comment, assign). No read-only tier until demanded.
- RLS is the enforcement point (§12.5); clients only *hide* affordances.
- Personal-space guarantee: habits, dashboard, labels, other projects never resolvable via any shared-project query path — enforced by RLS design review + tests, and stated in UI copy.

### 11.12 Timezone handling (locked rules)
- Task due dates/times are **floating local** (date + optional time, no zone). "Friday" is Friday wherever you wake up. This is the correct model for personal tasks and eliminates the classic off-by-a-day sync bugs. Zone-fixed times (flights) are out of scope until calendar overlay (V2) — flights belong in calendars.
- `profiles.timezone` updates on client-detected change (prompted: "You're in Tokyo — update your day boundary?"). Streaks/day-buckets use the timezone *current at evaluation*; historical logs keep their recorded `logged_for` (never re-bucket history on travel ⚠️).
- Server-side jobs (agenda, sweeps) always evaluate per-user zone from profile.

### 11.13 Offline behavior
- **iOS: full offline** — every read from local SQLite; every write is an optimistic local commit + queued op. Capture, complete, log habits, reorder, create projects: all functional in airplane mode. Reminders fire via pre-scheduled local notifications (11.4).
- **Web: session-resilient online-first** — TanStack Query cache + an in-memory/IndexedDB outbox so a dropped connection during a planning session loses nothing; a *closed* browser offline is not a supported entry point at MVP (full IndexedDB replica = V2). This asymmetry is deliberate: web offline costs a second sync engine and serves a rare scenario.

### 11.14 Conflict resolution (locked strategy)
- Client-generated UUIDv7 ids; every mutation is an idempotent op with `op_id` (server dedupes replays).
- **Row-level last-write-wins on server receipt time** for task/project/habit *metadata* edits — with three carve-outs that eliminate the painful cases:
  1. **Completions/logs are events, not state** — append-only, order-independent, never conflict.
  2. **Deletes win over concurrent edits** (tombstone precedence; undo restores).
  3. **Rank changes merge trivially** (fractional ranks are per-row writes; worst case two items swap visually — acceptable).
- No CRDTs, no vector clocks, no operational transform. A personal-productivity edit conflict window is seconds wide and single-user; LWW + event-sourcing-for-the-hot-paths is the right cost/correctness point. Revisit only if collaborative *text* editing ever ships (comments are whole-row LWW; fine).
- Sync protocol: push outbox (ordered ops, batched) → pull deltas per table via `updated_at > cursor` (server clock, monotonic per pull); tombstones included; initial sync = snapshot then cursor.

---

## 12. TECHNICAL ARCHITECTURE

### 12.1 Client architecture options — evaluation

| Criterion | A. SwiftUI + Next.js + Supabase | B. React Native/Expo + web | C. Flutter | D. Native iOS + thin web |
|---|---|---|---|---|
| Speed to build | ▲ Medium (two frontends) | ✅ Fast (one team/codebase) | ✅ Fast-ish | ▲ Medium |
| iOS quality | ✅ Best possible | ▲ Good, rarely premium; widgets/intents via bridges | ▲ Non-native feel, own renderer | ✅ Best |
| Web quality | ✅ First-class (Next.js) | ▲ RN-web is a compromise | ❌ Flutter web is weak for text-heavy UI | ❌ "Thin web" undersells a launch platform |
| Offline | ✅ GRDB/SQLite, full control | ▲ Doable (WatermelonDB etc.) | ▲ Doable (Drift) | ✅ |
| Windows path | ✅ Web wrapper (Tauri) | ▲ RN-Windows is niche | ✅ Flutter Windows exists | ▲ |
| Maintenance | ▲ Two codebases + shared spec | ✅ One-ish | ✅ One | ▲ |
| Product-quality risk | ✅ Lowest | ⚠️ Highest for "premium iOS" promise | ⚠️ High (uncanny valley) | ▲ web risk |

**Decision: Option A — native SwiftUI iOS + Next.js/React web + Supabase.** The brand promise is *premium*, and premium on iPhone means SwiftUI: real sheets, haptics, SF Symbols, Lock Screen widgets, App Intents, flawless Dynamic Type. The cost — two frontends — is contained by three moves: (1) Supabase carries the entire backend; (2) all tricky domain logic (recurrence, streaks, NL parsing, filter AST) is written against a **shared specification with shared JSON conformance test vectors** consumed by both Swift and TypeScript test suites; (3) design tokens generated from one source. RN/Expo is the right answer for a different company — one shipping speed over feel.

### 12.2 Frontend architecture
- **iOS:** SwiftUI app, offline-first, local SQLite via GRDB, custom sync engine (§13).
- **Web:** Next.js (App Router) SPA-behavior app behind auth (marketing pages SSG on the same domain), TanStack Query + `supabase-js` (§14).
- **Shared:** `spec/` package in the monorepo — grammar definitions, JSON test vectors, generated design tokens, generated TS types from Postgres schema (`supabase gen types`), OpenAPI-ish docs for Edge Functions.

### 12.3 Backend architecture (Supabase)
- **Postgres** is the single source of truth; schema in §10; migrations via Supabase CLI, checked into repo, applied through CI (never dashboard-edited).
- **API style:** PostgREST (via supabase-js / supabase-swift) for CRUD reads/writes guarded by RLS — no custom API layer for the 90% path. **Edge Functions (Deno/TS) for the 10%** that must be transactional or privileged: `sync-push` (batched op apply with dedupe), invite acceptance, account deletion/export, notification dispatch, Todoist import (V1), IAP/Stripe webhooks. Postgres functions (RPC) for hot transactional composites (e.g., `complete_recurring_task(op_id, task_id)` computes next occurrence server-side atomically).
- **Auth:** Supabase Auth — Sign in with Apple (primary iOS), Google, email magic link (no passwords at MVP). JWT in clients; refresh handled by SDKs.
- **RLS strategy (§12.5), Realtime (§12.6), Storage:** private `attachments` + `avatars` buckets, signed URLs, storage RLS mirrors project membership via path prefix.
- **Background jobs:** `pg_cron` — per-minute reminder sweep; nightly per-zone-batched `habit_stats` rollup; 30-day purge; weekly-review notification scheduling.
- **Notifications:** APNs directly from an Edge Function (token auth), web push (V1) via VAPID; `notifications` table is the in-app feed + dedupe ledger.

### 12.5 RLS strategy (the security backbone)
- Deny-by-default on every table.
- One canonical helper: `is_project_member(project_id)` (SECURITY DEFINER, checks `project_members`) — **every** project-scoped policy (projects, sections, tasks, comments, attachments, task_labels-via-task) routes through it, even while membership is always just the owner at MVP.
- Personal tables (habits, habit_logs, labels, saved_views, dashboard_layouts, preferences, notifications, reminders): `user_id = auth.uid()`, no exceptions ever — this is the enforcement of the §11.11 personal-space guarantee.
- Policies live in migrations with a required test file per table: pgTAP suite runs in CI as two personas (owner, stranger; V1 adds member) asserting allow/deny per verb. **No policy merges without its tests.**
- Advisor check (`supabase get_advisors --type security`) wired into CI as a gate.

### 12.6 Realtime strategy (selective, as briefed)
- **MVP:** one channel per user — `user:{id}` — carrying "something changed, pull deltas" pokes (postgres_changes on the user's rows is too chatty and RLS-fragile at scale; a poke→delta-pull keeps one sync path for realtime *and* reconnect). Plus `notifications` inserts for in-app feed.
- **V1:** per-shared-project channels for live task updates + presence dots in shared projects — the one place realtime visibly earns its cost.
- **Never:** realtime for dashboards/analytics; typing indicators.

### 12.7 Cross-cutting choices
- **Analytics:** PostHog (EU cloud), thin wrapper, ~25 named events (activation funnel, capture latency, widget edits, habit logs/day, review completion). No session recording. Privacy-respecting by default; document in privacy policy.
- **Search:** iOS — local SQLite FTS5 (instant, offline); web — Postgres `websearch_to_tsquery` over the tsvector GIN; same ranking intent documented in spec. Dedicated search infra (Typesense etc.): not before V3, if ever.
- **Feature flags:** PostHog flags for staged rollout (widget catalog gating, V1 features); a tiny `app_config` table for kill-switches read at boot.
- **Deployment:** Monorepo (`ios/`, `web/`, `supabase/`, `spec/`). Web → Vercel (preview per PR). Supabase → staging project + prod project; migrations via CI (GitHub Actions + Supabase CLI); Edge Functions deployed from CI. iOS → Xcode Cloud or GitHub Actions + Fastlane → TestFlight weekly, App Store on 2–3-week trains.
- **Testing:** spec conformance vectors run in both Swift (XCTest) and TS (Vitest) suites — the cross-platform correctness net; pgTAP for RLS + Postgres functions; Playwright smoke flows (capture, complete, plan, log habit) on web; XCUITest for the same four golden flows on iOS; sync engine gets a deterministic simulation harness (scripted op interleavings, assert convergence) ⚠️ non-negotiable before beta.
- **Observability:** Sentry (iOS + web + Edge Functions); Supabase logs/log drains for API+DB; a `sync_health` heartbeat metric (queue depth, last-pull age) reported from clients to PostHog — sync failures must be *seen* before users report them; alerting: Sentry → Slack, uptime check on Edge Function health endpoint.

---

## 13. IOS ARCHITECTURE

### 13.1 Project & module structure (SPM local packages, one app target)
```
ios/
  Planoa.xcodeproj (thin app target + widget/intents/share extensions)
  Packages/
    PlanoaKit/         // domain models, business logic (recurrence, streaks, parser, filter eval) — UI-free, spec-conformant
    PlanoaData/        // GRDB schema, DAOs, sync engine, outbox, supabase-swift client
    PlanoaUI/          // design system: tokens (generated), components (TaskRow, HabitChip, WidgetCard, Composer)
    Features/          // one module per surface: Home, TodayUpcoming, Browse, ProjectDetail, Habits, SearchFeature, SettingsFeature, Composer
```
Dependency rule: Features → PlanoaUI + PlanoaKit + PlanoaData interfaces; PlanoaKit depends on nothing (pure Swift — this is where conformance vectors run).

### 13.2 Navigation
- `TabView` (4 tabs) + a root coordinator holding a `NavigationStack` path per tab (state-restorable, deep-linkable: `planoa://task/{id}` from notifications/widgets).
- Sheets for: composer, task detail, widget gallery, settings. Sheet-first for transient content (§7.1).

### 13.3 State management
- **Vanilla SwiftUI + @Observable (Observation framework), no TCA.** Pattern: each feature has an `@Observable` view-model owning view state, reading from PlanoaData's query layer and writing via a single `ActionDispatcher` (all mutations funnel through one API → guarantees every write hits outbox + optimistic store consistently).
- Live queries: GRDB `ValueObservation` → AsyncSequence → view models. The DB is the single source of UI truth (server pushes land in DB; UI reacts) — unidirectional without framework ceremony.

### 13.4 Domain organization — PlanoaKit mirrors `spec/`: `Recurrence/`, `Streaks/`, `QuickAddParser/`, `FilterAST/` (V1), `DateBuckets/`. Each has a vector-driven test target. Any behavior change starts as a spec-vector PR.

### 13.5 Local persistence
- **GRDB (SQLite)** — mirrors Postgres schema (same table/column names — one mental model, mechanical mapping), plus `outbox` (op_id, op json, created_at, attempts), `sync_state` (per-table cursor), FTS5 tables for search. Migrations via GRDB DatabaseMigrator, versioned alongside server migrations in the same PRs.

### 13.6 Sync layer
- `SyncEngine` actor: push loop (drain outbox in order, batched to `sync-push` Edge Function, exponential backoff, dedupe by op_id) + pull loop (per-table delta by cursor) triggered by: foreground, realtime poke, post-push, periodic BGAppRefresh.
- Conflict handling per §11.14 happens server-side; the client's job is faithful op capture + delta apply (tombstones delete locally; LWW is server-decided).
- Full offline per §11.13; initial sync = paged snapshot with progress UI on first login.

### 13.7 Offline caching — the DB *is* the cache (no separate layer). Images/avatars via lightweight disk cache (Nuke). Attachment blobs (V1): on-demand download, LRU cap.

### 13.8 Notifications
- `UNUserNotificationCenter`: local scheduling of next-7-days reminders (recomputed on every sync/edit), categories with actions (Complete/Snooze/Log +1 — actions execute through ActionDispatcher, offline-safe).
- APNs push with dedupe-key suppression (§11.4); silent pushes nudge BGAppRefresh sync.

### 13.9 System integration (part of the premium promise)
- **WidgetKit** (V1, fast-follow weeks after launch): Lock Screen + Home Screen Today/Habits widgets with `AppIntent` interactive completion/logging — reads via shared app-group GRDB.
- **App Intents/Siri + Shortcuts** (V1): "Add task", "Log water". **Share extension** (MVP). **Spotlight indexing** (V2).

### 13.10 Testing & maintainability
- Vector conformance tests (PlanoaKit) in CI on every PR; sync simulation harness (scripted interleavings → convergence asserts); XCUITest golden flows (capture <200ms budget asserted via signposts, complete, log habit, edit home); snapshot tests for PlanoaUI components in light/dark/DynamicType-XL.
- Guidelines: no singletons except the DB pool; every mutation through ActionDispatcher; features can't import each other (coordinator mediates); os_signpost on capture/log hot paths; SwiftLint + swift-format in CI.

---

## 14. WEB ARCHITECTURE

### 14.1 App shell & routing
- **Next.js App Router.** `(marketing)/` — SSG landing/pricing; `(app)/` — the product: client-rendered SPA behavior behind auth (no SSR for app data; a productivity app's value is post-login interactivity, and SSR of RLS-gated per-user data buys nothing but complexity). Routes: `/home`, `/today`, `/upcoming`, `/inbox`, `/project/[id]`, `/habits`, `/habit/[id]`, `/label/[id]`, `/filter/[id]` (V1), `/search`, `/settings/*`; `/task/[id]` renders as the slide-over panel via parallel/intercepting routes (URL-addressable, list-preserving).

### 14.2 State & data
- **TanStack Query** as the server-state backbone over `supabase-js` (typed via generated DB types). Normalized query keys per table+view; optimistic updates through a single `mutations.ts` module (mirror of iOS ActionDispatcher — same op shapes, same `sync-push` endpoint for batched/transactional ops, direct PostgREST for simple ones).
- Realtime poke channel → targeted `invalidateQueries`. Zustand only for pure UI state (panels, composer, edit-mode) — no app-data in Zustand.
- Outbox-lite: pending mutations persisted to IndexedDB so tab-close/offline-blip loses nothing (§11.13); full offline replica deferred to V2 (would swap the cache layer for a local-first store — the mutation-funnel design keeps that door open).

### 14.3 Interaction layer
- **Dashboard grid:** CSS grid + **dnd-kit** for reorder (also powers list reorder and drag-to-day rescheduling in Upcoming). No grid framework like gridstack — our fixed-size, ordered-flow model doesn't need free 2D placement, and dnd-kit keeps one drag system product-wide.
- **Keyboard shortcuts:** `Q` quick add · `Cmd/Ctrl-K` palette · `g h/t/u/i/b` navigation · `j/k` row focus · `x` complete · `1–4` priority · `t/w` reschedule today/next week · `f` search · `e` edit home. Shortcuts sheet on `?`. This is the web power-user retention feature.
- **Accessibility:** Radix primitives (or Base UI) for menus/dialogs/popovers — correct focus/ARIA for free; full keyboard operability of lists and grid (dnd-kit keyboard sensors); visible focus rings; WCAG AA contrast enforced in the token pipeline; reduced-motion respected; axe checks in Playwright CI.

### 14.4 Performance & caching
- Budgets: app-shell interactive <2s on mid hardware; route swaps <100ms (cache-first render + background revalidate); list virtualization (TanStack Virtual) beyond ~100 rows; composer opens <150ms.
- Code-split per route; the dashboard lazy-loads widget modules. React Compiler on; profiling in CI on golden flows (Lighthouse budget check).
- Query cache persisted to IndexedDB (persistQueryClient) → warm reload paints instantly, then revalidates.

### 14.5 Testing
- Vitest: spec conformance vectors (same JSON as iOS), mutations module, reducers. Playwright: golden flows (capture, complete, plan-drag, habit log, edit-home, share-V1) against a seeded Supabase branch DB per CI run; axe accessibility pass; visual snapshots of tokens/components via Storybook + Chromatic (or Playwright screenshots).

---

## 15. WINDOWS EXPANSION PLAN

**Recommendation: Tauri-wrapped web app, V2 timeframe — with the web app treated as the real product it wraps.**

Reasoning against alternatives: native WinUI is a third codebase for the smallest launch audience — unjustifiable; React Native for Windows is a niche runtime we'd be adopting *only* for this; Flutter contradicts the chosen stack; PWA-only leaves out tray/shortcuts/autostart and feels non-premium on Windows.

Tauri (not Electron: ~10MB vs ~150MB, lower RAM, uses WebView2 already present on Win11) wraps the existing Next.js app with a thin native layer:
- global quick-add hotkey (the one feature that makes desktop productivity apps feel native),
- tray icon + background launch, native notifications via Windows toast,
- deep OS integration later if earned (jump lists).

Prerequisite checklist (owned by web team from V1): keyboard completeness, offline-capable session layer (the V2 IndexedDB replica lands with this), window-scale layouts already handled by responsive grid. Same wrapper strategy gives macOS desktop nearly free — ship both when Tauri lands. Revisit native only if Windows exceeds ~25% of paid usage (unlikely).

---

## 16. MVP DEFINITION

The MVP is **"single-player Planoa, fully trustworthy."** Ship quality on a narrow surface; the four hard LC systems (sync, offline-iOS, recurrence, NL capture) at full polish; everything social and analytical deferred.

### Exactly IN
- Auth (Apple/Google/magic link), onboarding (§8.1)
- Tasks: Inbox, Today (with habits band), Upcoming; projects+sections; subtasks (1 level rendered); due date+time; recurrence (locked grammar §11.1); priorities; labels; descriptions; complete/uncomplete/reorder/move; Completed view; undo toasts
- Quick capture: composer with NL dates + `#`/`@`/`p` tokens; iOS share extension; web `Q`/Cmd-K
- Habits: 3 types, schedules, today band, quick logging, backfill, streaks, pause, detail history calendar
- Home dashboard: 7-widget catalog, add/remove/reorder, interactive widgets, per-device-class layouts
- Reminders: task + habit + daily agenda; APNs + iOS local fallback
- Search: global, basic (tasks/projects/habits)
- Sync: iOS full offline; web session-resilient; conflict model §11.14
- Settings (§3.9 MVP list); JSON export; account deletion
- Free/Pro plumbing: limits enforced (5 projects/3 habits free), StoreKit 2 + Stripe (web) checkout

### Exactly OUT (with the V they land in)
Collaboration/sharing/assignees (V1) · comments & attachments (V1) · saved filters (V1) · deadlines (V1) · WidgetKit home-screen widgets & App Intents (V1 fast-follow) · weekly/monthly review flows (V1) · Todoist import (V1) · web push (V1) · board view, calendar overlay, multiple dashboards, durations (V2) · web full offline (V2) · Windows (V2) · API/integrations (V3) · everything in the SKIP list (never)

### Day-one user capabilities
Capture in 3 seconds from anywhere including offline → organize into projects → plan Today/Upcoming → complete recurring routines correctly → track 3 habits with streaks from Home → get reminded reliably → trust sync across iPhone and web.

### What creates the early "I need this"
The morning moment: open Planoa → Home shows *your* day — 4 tasks, water ring at 2/8, workout chip — you log a glass with one tap and complete a task without leaving the screen. That composed 10-second loop is the retention hook and must be flawless before anything else ships.

### Looks simple, actually expensive (budget honestly)
1. Sync + iOS offline engine (~the single biggest line item)
2. Recurrence semantics (grammar ↔ picker symmetry, this/all-future edits, reminder recompute)
3. NL date parsing identical on two platforms
4. Reminder reliability (dual local/push + dedupe + timezones)
5. Manual ordering (rank fields, cross-device merge, day-rank vs project-rank)
6. Dashboard layout persistence across device classes
7. Streak correctness across DST/travel/backfill

### Scope creep to resist by name
Custom widget colors/themes at MVP · "just simple" shared projects at MVP · month calendar grid · habit types beyond the three · per-widget settings beyond Quick Log's habit picker · template galleries · any AI feature · settings for things a good default solves.

---

## 17. PHASED ROADMAP

| Phase | Timeframe (2 senior mobile + 2 senior web/full-stack + 1 designer-founder) | Theme |
|---|---|---|
| MVP (private beta → App Store) | ~4.5 months build + 6 weeks beta | Single-player, trustworthy |
| V1 | +3 months | Power + together: filters, reviews, sharing, widgets |
| V2 | +4 months | Context: calendar, boards, insights, Windows/desktop |
| V3 | ongoing | Ecosystem + intelligence |

### MVP
- **Features:** §16.
- **Engineering priorities:** sync engine + schema + RLS first (weeks 1–6, nothing UI-blocking before this is walking); recurrence/parser/streaks as spec-vector packages in parallel; golden-flow perf budgets in CI from week 4.
- **UX/design priorities:** design tokens + component kit before feature screens; the Home/Today composed moment; capture latency; empty states.
- **Key risks:** sync correctness (mitigate: simulation harness + beta cohort with sync-health telemetry); scope discipline.
- **Success criteria:** beta: crash-free >99.5%, sync-error rate <0.1% of ops, capture p95 <250ms; launch cohort: D7 ≥ 25%, ≥40% of actives log ≥1 habit/day, ≥30% customize Home in week 1.

### V1 — "Power + Together"
- **Features:** saved filters (AST + builder UI), deadlines, comments+attachments, project sharing (invites, assignees, per-project activity, realtime channels), weekly/monthly reviews, WidgetKit + App Intents, web push, Todoist import, app icons, trash UI.
- **Engineering:** RLS member-persona test expansion; realtime per-project channels; filter AST dual evaluators; import pipeline (Edge Function).
- **UX:** review flow choreography; share/invite clarity (personal-space copy); filter builder that teaches syntax.
- **Risks:** RLS regressions with sharing (gate: pgTAP matrix); notification fan-out spam (conservative defaults).
- **Success:** Pro conversion ≥5% of MAU; ≥15% of WAU run a weekly review; ≥10% of paid users share ≥1 project; import-completion rate >90%.

### V2 — "Context"
- **Features:** read-only calendar overlay (Google/Apple) in Upcoming; board layout; multiple dashboards (Work/Life); habit insights + per-habit color; web full offline (IndexedDB replica); **Windows + macOS via Tauri**; recurring end-dates + advanced patterns; email digests; task durations (maybe).
- **Engineering:** calendar OAuth/ics service isolation (its own Edge Function + tables, quarantined from core); local-first web store swap behind the mutation funnel.
- **Risks:** calendar-sync swamp (strictly read-only, one provider first: Google); desktop wrapper QA surface.
- **Success:** desktop DAU ≥10% of total; calendar-connected users show +X% weekly-planning completion; churn improvement in connected cohort.

### V3 — "Ecosystem + Intelligence"
- **Features:** public API + webhooks; Zapier; Apple Watch (capture + habit log); Spotlight; cross-domain insights ("tasks complete 40% more on workout days"); targeted assistance (NL "plan my week" suggestions — assistive, never autonomous); location reminders if ever.
- **Risks:** platform sprawl; AI gimmickry (rule: any intelligent feature must save a measured ≥30s/week or die).
- **Success:** API adoption, watch attach rate, insight-feature retention lift measured against holdout.

---

## 18. ENGINEERING BACKLOG

Milestones M0–M8 to launch. Epics tagged [iOS] [Web] [BE] [Spec] [Design]. Two tracks run in parallel throughout: Track A (platform/sync/backend), Track B (product surfaces) — B consumes A's interfaces, stubbed at first.

**M0 — Foundations (wks 1–2)** — everything else depends on this; do not parallelize past it.
1. Monorepo, CI (lint/test/migrations/preview deploys), staging+prod Supabase projects [BE]
2. Schema v1 migrations: all §10 tables incl. dormant workspace/membership tables; triggers (updated_at, profile-on-signup, inbox-project-on-signup) [BE]
3. RLS v1 + pgTAP harness (owner/stranger personas) [BE]
4. `spec/` package: recurrence + streak + parser grammars, first 60 conformance vectors; token pipeline (JSON → Swift/CSS) [Spec][Design]
5. Design tokens + core components (TaskRow, HabitChip, WidgetCard, Composer) in both UI kits [Design][iOS][Web]

**M1 — Sync spine (wks 2–6)** ⚠️ the schedule's critical path
6. iOS GRDB schema + DAOs + ValueObservation query layer [iOS]
7. SyncEngine: outbox, `sync-push` Edge Function with op dedupe, delta pull, cursors, tombstones [iOS][BE]
8. Sync simulation harness (interleavings → convergence) [iOS][BE]
9. Web data layer: typed supabase-js + TanStack Query + mutations funnel + IndexedDB outbox-lite [Web]
10. Realtime poke channel → pull trigger (both clients) [BE][iOS][Web]
11. Auth flows + onboarding-state plumbing (both) [iOS][Web]

**M2 — Task core (wks 5–9)** (parallel with M1 tail, on stub-then-real data)
12. Inbox/project/section CRUD + rank ordering + move/reorder [iOS][Web]
13. Task detail (sheet/panel), subtasks, priorities, labels [iOS][Web]
14. Today + Upcoming (bucketing per §11.3, overdue group, day_rank) [iOS][Web]
15. Recurrence engine integration: picker ↔ parser symmetry, complete-and-roll RPC, this/all-future edits [Spec][BE][iOS][Web]
16. Completed view + undo system [iOS][Web]

**M3 — Capture (wks 8–10)**
17. Composer with live token chips, both platforms; share extension; Cmd-K palette [iOS][Web]
18. Parser conformance green on both platforms; capture latency budgets in CI [Spec][iOS][Web]

**M4 — Habits (wks 9–12)**
19. Habit CRUD + gallery + 3 types + schedules [iOS][Web]
20. Logging (append-only), backfill calendar, pause; streak engine integration; nightly `habit_stats` rollup [Spec][BE][iOS][Web]
21. Today habits band [iOS][Web]

**M5 — Home dashboard (wks 11–14)**
22. Widget registry + data providers; layout persistence per device class [iOS][Web][BE]
23. 7 launch widgets, interactive paths through ActionDispatcher/mutations funnel [iOS][Web]
24. Edit mode (iOS) / drag grid (web) + gallery with live previews [iOS][Web][Design]

**M6 — Reminders & notifications (wks 13–15)**
25. Reminders CRUD + pg_cron sweep + APNs dispatch Edge Function [BE]
26. iOS local-notification scheduling + dedupe + actions; daily agenda job [iOS][BE]

**M7 — Search, settings, monetization (wks 14–16)**
27. FTS5 (iOS) + Postgres FTS (web) + grouped results UI [iOS][Web][BE]
28. Settings surfaces; JSON export + account deletion Edge Functions [iOS][Web][BE]
29. Plan limits, StoreKit 2, Stripe checkout + webhook [iOS][Web][BE]

**M8 — Hardening & beta (wks 16–20+)**
30. Golden-flow XCUITest/Playwright suites; perf budget enforcement; a11y pass [all]
31. Sync-health + analytics events wiring; Sentry; alerting [all]
32. Beta program (TestFlight ~200 users), sync-telemetry watch, fix cycle; App Store assets [all]

**Parallelization notes:** Track B (M2–M5 UI) proceeds against local-only data while M1 hardens — the ActionDispatcher/mutations abstraction is what makes this safe. Design runs one milestone ahead. The `spec/` engines (recurrence/streaks/parser) are pure functions — buildable by one engineer independently from week 1.

**Deliberately postponed:** everything in §16-OUT; also internal admin tooling (use Supabase Studio), marketing site beyond a single page, localization (English-only at launch; string discipline from day 1 via catalogs).

---

## 19. RISKS AND TRADEOFFS

| # | Risk | Domain | Why it matters | Likelihood | Severity | Mitigation |
|---|---|---|---|---|---|---|
| 1 | Sync data loss/corruption | Sync/Eng | One lost task ends trust forever; the product's contract is reliability | Medium | **Critical** | Conservative LWW+events model; op idempotency; simulation harness; tombstones+trash; sync-health telemetry; beta soak before launch |
| 2 | Three-products-in-one scope blowout | Product | MVP slips 3+ months, quality dilutes | **High** | High | §16 is a contract; weekly scope review vs. the OUT list; every addition displaces something visibly |
| 3 | Dashboard = configured-once gimmick | Product/UX | The differentiator must earn daily use or the wedge collapses | Medium | High | Widgets are operational (act-in-place); Home is default landing; measure widget interactions/DAU and iterate the catalog |
| 4 | Recurrence edge-case wrongness | Eng | Silent wrong dates = users quietly leave | Medium | High | Small locked grammar; vectors incl. DST/zones; server-side roll RPC; "this/all" semantics tested; defer exotic patterns |
| 5 | Habit features read as gimmick to task-first users | Product | Splits positioning; app feels unfocused | Medium | Medium | Habits collapsible/optional everywhere; onboarding lets users skip habits entirely; task core stands alone at Todoist depth |
| 6 | Streak/timezone anger (travel, DST, midnight) | Habits | Streak bugs generate the loudest 1-star reviews in this category | Medium | Medium | §5.5/§11.12 rules; pause feature at MVP; backfill at MVP; vectors for travel cases; never re-bucket history |
| 7 | Two-frontend drift (behavior divergence iOS vs web) | Eng | Same input, different result = trust damage + support load | **High** | Medium | Shared spec + conformance vectors as CI gate; single mutation-funnel pattern both sides; parity checklist per feature PR |
| 8 | RLS policy hole exposes personal data | Collab/Sec | Habit/health-adjacent data leak is existential | Low-Med | **Critical** | Deny-by-default; membership-helper pattern; pgTAP persona matrix as merge gate; security advisors in CI; pre-V1 external pentest |
| 9 | Notification unreliability or spam | Product | Reminders are the retention contract; spam is the uninstall trigger | Medium | High | Dual-path with dedupe ledger; quiet defaults; per-category toggles; delivery telemetry |
| 10 | Free tier too generous / Pro too weak | Business | No conversion → no company | Medium | High | Limits chosen to bite at habit #4 and project #6 (engaged-user thresholds); price under Todoist; measure and tune in beta |
| 11 | Collaboration pulls product toward team-tool | Product | Erodes the calm-personal identity; invites enterprise asks | Medium | Medium | Two roles only; per-project sharing only; the §2 omit-list is policy; say no in public roadmap |
| 12 | Supabase platform ceiling (Realtime scale, Edge cold starts, vendor risk) | Eng | Bet concentration | Low | Medium | Poke-not-payload Realtime keeps load trivial; hot paths are Postgres-native (portable); plain-Postgres schema = exit ramp exists; monitor limits from beta |
| 13 | Web app underinvested vs iOS | Product | Web is an acquisition + Windows foundation, not a companion | Medium | Medium | Dedicated web engineers (not "iOS team also does web"); keyboard-first bar; golden flows CI-equal with iOS |
| 14 | App Store review friction (IAP + external Stripe) | Launch | Launch-window slip | Low-Med | Medium | StoreKit for all iOS-originated purchases; no cross-platform purchase talk in-app; standard compliance |

**Named tradeoffs accepted:** two frontends over one cross-platform codebase (premium > velocity); LWW over CRDT (simplicity > theoretical merge fidelity); web session-resilience over full offline at MVP (cost > rare scenario); habits-as-separate-tables over unified items (query clarity > model elegance); jsonb widget layouts over normalized tables (pragmatism > purity); floating local due dates over zoned timestamps (correct-for-humans > correct-for-machines).

---

## 20. FINAL RECOMMENDATION

**The single best product strategy.** Build the trustworthy single-player core first and win the *morning glance*: one composed screen where a serious person sees and operates their whole day. Do not chase Todoist across its full surface; match it exactly where retention lives (capture, recurrence, planning views, reminders) and beat it where it cannot follow — habits and the personal cockpit, natively unified.

**The single best differentiation strategy.** Habits + tasks in one Today, surfaced through an *operational* modular Home. Defensibility compounds through data: streak history and layout investment are non-portable in a way task lists never are. Design identity — quiet-instrument calm vs. Todoist's utilitarianism — is the moat's visible layer.

**The single best MVP strategy.** Narrow and deep: single-player, seven widgets, three habit types, one locked recurrence grammar — and the four expensive invisible systems (sync, offline, recurrence, NL capture) built *properly, first*. Beta until sync-error telemetry says trustworthy, then launch. Nothing social ships until the solo product is loved.

**The single best technical stack.** Native SwiftUI + GRDB offline-first iOS · Next.js + TanStack Query web · Supabase (Postgres/Auth/RLS/Realtime-as-poke/Storage/Edge Functions) · a shared spec package with cross-platform conformance vectors as the two-frontend insurance policy · Tauri for Windows/macOS at V2.

### Top 10 product decisions — locked
1. Home dashboard is the default landing screen (with a settings escape hatch).
2. Habits are a separate first-class pillar — own tab, own data model, never task-subtypes.
3. Habits never roll over, never go overdue; misses are quiet; no streak repair mechanics.
4. Today = habits band + task list, never interleaved.
5. MVP is single-player; collaboration is V1 and capped at owner/member per-project sharing.
6. Widget catalog is curated and capped (7 at launch, ~15 ever, soft cap 8 per user).
7. Quick add with visible NL parsing chips is the capture model on both platforms.
8. Recurrence ships with the locked common grammar; exotic patterns wait.
9. Freemium: 5 projects/3 habits free; Pro at $4.99/mo–$39.99/yr under Todoist.
10. No gamification, no goals, no karma — ever. Weekly Review is the reflection mechanic.

### Top 10 engineering decisions — locked
1. SwiftUI native iOS + Next.js web + Supabase; no cross-platform UI framework.
2. iOS is offline-first on GRDB/SQLite with an outbox sync engine; the local DB is the UI's source of truth.
3. Conflict model: idempotent ops + row-LWW + append-only events for completions/logs; no CRDTs.
4. All PKs are client-generated UUIDv7; every synced table has updated_at + tombstones.
5. Recurrence, streaks, NL parsing, filter AST live in a shared spec with JSON conformance vectors run by both Swift and TS CI — behavior changes start as vector PRs.
6. RLS deny-by-default through a single membership helper; pgTAP persona tests gate every policy merge; dormant workspace/membership tables ship in MVP schema.
7. Inbox is a real per-user project row (no nullable project_id); due dates are floating local date+time fields (no timestamptz for dues).
8. Realtime is a poke-then-delta-pull channel, not a data firehose; one sync path for live and reconnect.
9. Reminders: server pg_cron sweep + Edge dispatch as source of truth, iOS local notifications as offline fallback, dedupe ledger between them.
10. All mutations on both clients flow through one dispatcher/funnel module — the seam that makes offline, optimism, telemetry, and the V2 local-first web swap tractable.

**Bottom line.** Planoa wins by being the first app that treats a person's day — obligations *and* practices — as one designed object. The blueprint above is deliberately narrow where narrowness protects quality, and deliberately expensive where the cost is invisible but existential (sync, recurrence, reminders). Build M0–M1 before any screens matter, hold the §16 line, and ship the morning moment flawlessly.

— End of blueprint.
