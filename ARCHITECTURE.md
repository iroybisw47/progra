# Progra — Architecture Reference

> **Purpose.** A cumulative, analysis-oriented map of how this codebase is built —
> the layers, the data flow, the invariants, and the reasoning behind them. Unlike
> `CLAUDE.md`/`AGENTS.md` (which are agent *instructions*) this file is a *running
> understanding* of the system. Append to the Changelog at the end of every work
> session / feature set so the picture stays current and the history is preserved.
>
> **How to read it.** Top sections describe the system *as it is now*. The
> Changelog at the bottom records *how it got here and where it's going*, newest
> first. When code and this doc disagree, the code wins — and the doc should be
> fixed in the same session.
>
> _Last updated: 2026-06-27_

---

## 1. What Progra is

A personal, single-user productivity PWA (installs to the iPhone home screen).
It unifies four loops:

1. **Plan** — set weekly goals with hour quotas, break them into ordered session
   plans, and auto-place them into calendar time blocks for the week.
2. **Clock** — clock in/out (with pause/resume) on a task, optionally attached to
   a planned session, accumulating real worked time.
3. **Track** — pull Google Calendar events in, categorize everything, and see
   per-category / per-goal time across week / month / year.
4. **Reflect** — a Sunday recap and a history/rollups view.

> ⚠️ **Scope note.** `SPEC.md` describes a v0 that was *clock-in only,
> localStorage, no auth*. That document is historical. The app today is a
> multi-feature, Supabase-backed, authenticated product. Treat `SPEC.md` as an
> origin artifact, this file as current truth.

---

## 2. Tech stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16** (App Router) | APIs differ from older Next — see `AGENTS.md`; read `node_modules/next/dist/docs/` before writing Next code. |
| Language | TypeScript 5, React 19 | |
| UI | shadcn/ui (Nova preset) on **Base UI** primitives | `components/ui/*`. Lucide icons, Geist font. |
| Styling | Tailwind CSS v4 (PostCSS) | `app/globals.css`. |
| Toasts | `sonner` | `components/ui/sonner.tsx`, mounted in root layout. |
| Auth + DB | **Supabase** (`@supabase/ssr`) | Postgres + Row-Level Security + Google OAuth. |
| External data | **Google Calendar API v3** | OAuth token stored on the user's profile; refreshed on demand. |
| Deploy | Vercel on push to `main` | PWA via `app/manifest.ts` + icons in `public/`. |

---

## 3. The layered architecture (the core mental model)

Data flows in a strict, repeating shape. Learn this once and every feature reads
the same way:

```
Browser (PWA)
   │
   ▼
proxy.ts  ──────────────►  lib/supabase/proxy.ts  (refreshes the Supabase
(Next "proxy"/middleware)      auth session cookie on every matched request)
   │
   ▼
app/<route>/page.tsx   ← Server Component. Auth-gates, fetches data via lib/db/*,
   │                      runs Promise.all for parallel reads, passes plain props.
   ▼
app/<route>/<route>-client.tsx   ← "use client". Renders UI, holds local state,
   │                                calls server actions on user interaction.
   ▼
app/actions/<domain>.ts   ← "use server". Mutations. Re-checks auth, writes to
   │                         Supabase, then revalidatePath() the affected routes.
   ▼
lib/db/<domain>.ts   ← "server-only" READ helpers. Map snake_case DB rows →
   │                    camelCase domain types. The only place that SELECTs.
   ▼
Supabase (Postgres + RLS)   ← RLS scopes every row to auth.uid(); the app rarely
                              filters by user_id on reads because RLS does it.
```

Key consequences of this shape:

- **Reads** live in `lib/db/*` (server-only, no `"use server"`). **Writes** live
  in `app/actions/*` (`"use server"`). A page may call `lib/db` directly; a client
  component may only call actions.
- **Row mapping is centralized.** Each `lib/db/*` file owns the `RowToX` mapper
  and a column-list constant (see `SESSION_COLUMNS` in `lib/db/sessions.ts`) so a
  new query can't forget a column.
- **Cache invalidation is explicit.** Every mutation ends with `revalidatePath()`
  for *every* route whose data it touched (e.g. `clockIn` revalidates both
  `/clock` and `/goals`). When adding a write, ask "which pages show this data?"

---

## 4. Route map

All feature routes are auth-gated and share the `BottomNav` (rendered in
`app/layout.tsx` only when a user is present).

| Route | Server page | Client | Purpose |
|---|---|---|---|
| `/` | `app/page.tsx` | — | Home: week summary card, habits, quick entry. |
| `/login` | `app/login/page.tsx` | `google-sign-in-button.tsx` | Google OAuth entry. |
| `/auth/callback` | `route.ts` | — | OAuth code exchange → session. |
| `/auth/signout` | `route.ts` | — | Sign out. |
| `/plan` | `plan/page.tsx` | `plan-client.tsx` | Weekly plan grid; greedy auto-placement of blocks. |
| `/clock` | `clock/page.tsx` | `clock-client.tsx` | Clock in/out/pause; live timer; week strip. |
| `/goals` | `goals/page.tsx` | `goals-client.tsx` | Weekly quotas, ordered session plans, progress. |
| `/calendar` | `calendar/page.tsx` | `calendar-client.tsx` | Google Calendar events, categorized. |
| `/habits` | `habits/page.tsx` | `habits-client.tsx` | Habit tracker (per-day, tz-aware). |
| `/history` | `history/page.tsx` | `history-client.tsx` | Month/year rollups, category axis, session browser. |
| `/recap` | `recap/page.tsx` | `recap-client.tsx` | Sunday weekly recap + share. |
| `/sessions` | `sessions/page.tsx` | `sessions-client.tsx` | Paginated past-session browser/editor. |

**Convention:** `page.tsx` is the server boundary (data + auth); `*-client.tsx`
is the interactive shell. `loading.tsx` provides route-level skeletons.

---

## 5. Data model (inferred from `lib/db/*` and `app/actions/*`)

> Schema lives in Supabase, not in this repo. The list below is reconstructed from
> queries — treat as a map, confirm against Supabase for authoritative DDL.

| Table | Owner module | Key columns / notes |
|---|---|---|
| `profiles` | `lib/auth/profile.ts`, `lib/google/oauth.ts` | One row per user. Stores Google `provider_token`, `provider_refresh_token`, `token_expires_at`, and the user's IANA timezone. |
| `categories` | `lib/db/categories.ts` | `name`, `color`, `rules` (JSON, `titleContains[]` for auto-categorization). |
| `sessions` | `lib/db/sessions.ts` | The clock-in record. `started_at`/`ended_at` (real wall-clock), `paused_ms` (banked), `paused_since` (set only while paused), `category_id`, `session_plan_id`. **Partial unique index** enforces one active (`ended_at IS NULL`) session per user → insert error `23505`. |
| `goals` | `lib/db/goals.ts` | `weekly_quota_hours`, active flag, ordering. |
| `session_plans` | `lib/db/session-plans.ts` | Ordered tasks under a goal. `status` (`planned`/`done`), `target_hours`, `sort_order`, `goal_id`. Flipped to `done` automatically at clock-out. |
| `scheduled_blocks` | `lib/db/scheduled-blocks.ts` | Time blocks placed onto the week by the planner. May carry `session_plan_id` (preselects a plan when you clock in inside the block). |
| `calendar_events` | `lib/db/calendar-events.ts` | Synced Google events. Upsert keyed on `(user_id, google_event_id)`. All-day + cancelled events skipped on sync. |
| `event_categorizations` | `app/actions/event-categorizations.ts` | Manual category overrides for specific calendar events. |
| `event_exclusions` | `app/actions/event-exclusions.ts` | Hidden/excluded calendar events. |
| `habits` (+ logs) | `lib/db/habits.ts` | Habit definitions and per-day completion. Tz-checked server-side. |
| rollups / recap | `lib/db/rollups.ts`, `lib/db/recap.ts` | Read-side aggregation helpers for `/history` and `/recap`. |

---

## 6. Domain logic core (`lib/` pure modules)

These are I/O-free and are the heart of the app's correctness. They're shared so
numbers reconcile across every surface.

- **`lib/session.ts` — worked-time source of truth.** `sessionWorkedMs(s, now)`
  = `(end - start) - pausedMs - currentPause`. *Every* aggregation routes through
  this so the week card, recap, rollups, and day breakdown all agree. Pre-pause
  rows (pausedMs=0, pausedSince=null) reduce to plain `end - start`.

- **`lib/aggregate.ts` — attribution engine.** `aggregateRange` /
  `aggregateWeek` sum per-category time; `aggregateRangeByGoal` /
  `aggregateWeekByGoal` sum per-goal time via `session_plan_id → plan → goal`.
  **Invariant:** a session is attributed to the single instant of its `end`
  (`endedAt ?? now`); events to their `start`. That single-instant rule is what
  makes a session land in exactly one week AND one month AND one year — never
  double-counted, never dropped. Sessions and events are summed *without
  dedup* (an event overlapping a session counts in both — the deliberate
  "unified time-spent" model). `null` category = the Uncategorized bucket.

- **`lib/categorize.ts` — auto-categorization.** First category whose
  `rules.titleContains` substring-matches the title (case-insensitive). Order =
  priority; caller sorts first.

- **`lib/placement.ts` — greedy weekly planner.** Pure. Takes goals + plans +
  busy intervals + waking window → proposed blocks. Round-robins across goals so
  none monopolizes early slots; spreads across days (fewest-blocks-per-day
  tiebreaker, then earliest day); never overlaps busy time. `proposeReslotSlots`
  reuses the same gap-finder to suggest re-slots for missed blocks. Explicitly
  *not* a solver.

- **`lib/dates.ts` — week/month/year boundaries.** Mon-first weeks. Local-time
  boundaries with inclusive ends (`23:59:59.999`) — the *same* convention across
  week/month/year is what lets rollups reconcile. Plus tz-aware helpers
  (`todayInTimeZone`, `weekRangeInTimeZone`) used by habits to validate the
  client's claimed "today" against the user's stored timezone.

---

## 7. Auth & session

- **OAuth:** Google via Supabase. Login → `/auth/callback/route.ts` exchanges the
  code → session cookie. `EnsureProfileSync` (mounted in layout for logged-in
  users) syncs the Google tokens onto the `profiles` row.
- **Session refresh:** `proxy.ts` (Next 16's renamed middleware) runs
  `lib/supabase/proxy.ts#updateSession` on every matched request. **Critical
  rule:** no code runs between `createServerClient` and `getUser()` — reading
  cookies in between breaks refresh.
- **Three Supabase clients:** `lib/supabase/server.ts` (Server Components /
  actions, cookie-bound), `client.ts` (browser), `proxy.ts` (the refresher).
- **Auth helpers:** `lib/auth/require-user.ts`. `getCurrentUser` is
  `react.cache`-wrapped so layout + page + db helpers share one auth round-trip
  per request. `requireUser()` redirects to `/login`; `getOptionalUser()` returns
  null.
- **RLS does the row scoping.** Reads generally don't filter by `user_id` — the
  policy enforces `auth.uid()`. Writes still set `user_id` explicitly on insert.

---

## 8. Google Calendar integration

- `lib/google/oauth.ts#getValidGoogleAccessToken(userId)` returns a token valid
  ≥60s; refreshes via the stored refresh token and persists the new token+expiry
  to `profiles`. Throws typed `GoogleAuthError` (`no_refresh_token` →
  user must re-auth, `refresh_failed`, `no_profile`).
- `lib/google/calendar.ts#listPrimaryCalendarEvents` pages the v3 API
  (`singleEvents=true` expands recurrences).
- `app/actions/sync-calendar.ts` pulls a window of **−30 / +90 days**, drops
  cancelled and all-day events, and upserts on `(user_id, google_event_id)`.

---

## 9. Conventions & invariants (quick reference)

- **Reads → `lib/db/*` (`server-only`). Writes → `app/actions/*` (`"use server"`).**
- **`Result` type** on actions: `{ ok: true } | { error: string }` (some carry a
  payload, e.g. sync's `count`). Client surfaces errors via `sonner` toasts.
- **PostgREST bigint comes back as a string** → normalize with `Number()` in row
  mappers (see `paused_ms`).
- **Every mutation `revalidatePath()`s every affected route.**
- **Time math is local-time** with Mon-first weeks and inclusive ends, except the
  habit tz helpers which use UTC arithmetic on a tz-resolved date string.
- **One active session per user**, DB-enforced (error `23505`).
- **`SPEC.md` is historical**, not current scope.
- **Sentinel** (`.sentinel.yaml`): the agent runtime is monitored. Notably it
  **denies tool-writes to `.claude/settings*.json` and `.sentinel.yaml`** (reads
  allowed) and denies reads of `.env*` and credential files. Relevant when wiring
  hooks/automation — those files must be edited by the user, not the agent.

---

## 10. Open questions / things to verify when touched

- Authoritative Supabase DDL is not in-repo — §5 is reconstructed from queries.
- `lib/hooks.ts`, `lib/duration.ts`, `lib/storage.ts` (now types-only),
  `lib/aggregate.ts` goal/category reconciliation, and the recap/rollups read
  helpers are summarized but not exhaustively documented.
- DST behavior on transition weeks is knowingly approximate in `lib/placement.ts`.

---

## 11. Changelog (cumulative — newest first)

> Append one entry per work session / feature set. Keep it terse: what changed
> architecturally, why, and any new invariant or migration. Seeded from git
> history; entries before this file existed are reconstructed.

### 2026-06-27 — Architecture reference created
- Established this document. Captured the current layered architecture (proxy →
  page → client → action → db → Supabase), route map, inferred data model, and
  the pure-domain core. Flagged that `SPEC.md`'s "clock-in only" scope is
  historical.

### Reconstructed history (from git, oldest → newest)
- **PWA + shadcn scaffold; v0 clock-in** — single-screen clock-in, localStorage.
- **Supabase + Google integration** — moved off localStorage to Postgres + RLS;
  added Google OAuth and full calendar sync. `lib/storage.ts` reduced to types.
- **Habits** — per-day, timezone-validated habit tracker; home page revamp.
- **Goals layer** — weekly quotas, ordered session plans, `/goals` route, clock
  attach (`session_plan_id`); declared on the `Session` type.
- **Quota progress** — per-goal weekly actual-vs-quota on `/goals` and home.
- **Weekly plan** — `scheduled_blocks`, greedy placement (`lib/placement.ts`),
  `/plan` grid, clock awareness of the active block.
- **Adapt** — missed-block sweep + greedy re-slot proposer + "Needs reslotting".
- **Sunday Recap** — weekly recap aggregate, `/recap` view + share.
- **Rollups** — month/year rollups on a category axis (sessions + calendar)
  across `/history` and recap.

---

## How to update this document

At the end of a work session or feature set:
1. Re-read the sections your change touched; fix anything now inaccurate.
2. Add a dated entry to the Changelog (§11) — what changed architecturally + any
   new invariant or migration.
3. Bump _Last updated_ at the top.
4. If you added a route, table, or `lib/` module, add it to §4 / §5 / §6.

Run `/update-arch` to do this with assistance.
