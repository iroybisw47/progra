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
> _Last updated: 2026-07-14_

---

## 1. What Progra is

A personal productivity PWA (installs to the iPhone home screen), evolving into a
friends-based social layer. The single-user tracker is the live beta; the entire
**social v2** build (feed, profiles, friends, session photos/stories, comments,
reactions, moderation, account deletion — Phases 0–4) ships behind the
`SOCIAL_ENABLED` flag, dark unless `NEXT_PUBLIC_SOCIAL_ENABLED=1` in the host.

The tracker unifies four loops:

1. **Goals** — set weekly goals with hour quotas and track actual time against
   them. (The former weekly *planner* — session plans auto-placed into calendar
   blocks — was removed 2026-07-10; see Changelog.)
2. **Clock** — clock in/out (with pause/resume) on a task, optionally attributed
   to a goal, accumulating real worked time.
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
Supabase (Postgres + RLS)   ← RLS scopes every row to auth.uid(). Own-view reads
                              ALSO filter .eq("user_id", me.id) as defense-in-depth
                              (social v2); cross-user reads let RLS friend policies decide.
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

Social v2 routes (`/me`, `/friends`, `/profile/[username]`, `/admin`) and the
feed at `/` are all gated by `SOCIAL_ENABLED`; with the flag off they 404 (or,
for `/`, fall back to the dashboard) and the beta is unaffected. `/admin`
additionally 404s anyone who isn't the admin (`rpc('is_admin')`).

| Route | Server page | Client | Purpose |
|---|---|---|---|
| `/` | `app/page.tsx` | — | Home. Flag off → personal dashboard (`components/dashboard.tsx`). Flag on → the social **feed** (`components/feed.tsx`): friends' recent finished sessions + comment threads. |
| `/me` | `app/me/page.tsx` | — | **You** tab (social on only): the personal dashboard, relocated off Home. Shares `components/dashboard.tsx`. |
| `/friends` | `friends/page.tsx` | `friends-client.tsx` | Friend search / requests / blocked (social on only). |
| `/profile/[username]` | `profile/[username]/page.tsx` | `profile-actions.tsx` | Public profile: identity + a friend's non-private goals/habits + photo **stories** (social on only). |
| `/admin` | `admin/page.tsx` | `admin-reports.tsx` | Moderation queue (social on + `is_admin()` only): open reports with target preview, take-down / dismiss. |
| `/login` | `app/login/page.tsx` | `google-sign-in-button.tsx` | Google OAuth entry. |
| `/auth/callback` | `route.ts` | — | OAuth code exchange → session. |
| `/auth/signout` | `route.ts` | — | Sign out. |
| `/onboarding` | `onboarding/page.tsx` | `onboarding-client.tsx` | First-run wizard (goal → practice clock-in → tour). Home redirects here while `profiles.onboarded_at` is null; "Replay onboarding" on Home re-enters it. |
| `/search` | `search/page.tsx` | — | Placeholder ("Coming soon") for a future search surface. |
| `/clock` | `clock/page.tsx` | `clock-client.tsx` | Clock in/out/pause; live timer; week strip. |
| `/goals` | `goals/page.tsx` | `goals-client.tsx` | Weekly quotas and progress. |
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
| `profiles` | `lib/auth/profile.ts`, `lib/google/oauth.ts` | One row per user (created by a Supabase trigger on auth signup). Stores Google `provider_token`, `provider_refresh_token`, `token_expires_at`, the user's IANA timezone, and `onboarded_at` (null until the first-run wizard completes; Home gates on it). |
| `categories` | `lib/db/categories.ts` | `name`, `color`, `rules` (JSON, `titleContains[]` for auto-categorization). |
| `sessions` | `lib/db/sessions.ts` | The clock-in record. `started_at`/`ended_at` (real wall-clock), `paused_ms` (banked), `paused_since` (set only while paused), `category_id`, `goal_id`, and (social v2) `before_photo_path`/`after_photo_path`. **Partial unique index** enforces one active (`ended_at IS NULL`) session per user → insert error `23505`. |
| `goals` | `lib/db/goals.ts` | `weekly_quota_hours`, active flag, ordering. |
| `calendar_events` | `lib/db/calendar-events.ts` | Synced Google events. Upsert keyed on `(user_id, google_event_id)`. All-day + cancelled events skipped on sync. |
| `event_categorizations` | `app/actions/event-categorizations.ts` | Manual category overrides for specific calendar events. |
| `event_exclusions` | `app/actions/event-exclusions.ts` | Hidden/excluded calendar events. |
| `habits` (+ logs) | `lib/db/habits.ts` | Habit definitions and per-day completion. Tz-checked server-side. |
| rollups / recap | `lib/db/rollups.ts`, `lib/db/recap.ts` | Read-side aggregation helpers for `/history` and `/recap`. |
| `friendships` (social v2) | `lib/db/friends.ts` | One row per pair: `requester_id`/`addressee_id`, `status` (pending/accepted/blocked), `blocked_by`. RLS hides blocks from the blocked party; consent-critical transitions go through `SECURITY DEFINER` RPCs (`accept_friend_request`, `block_user`). |
| `session_comments` (social v2) | `lib/db/comments.ts`, `app/actions/comments.ts` | Comments on feed sessions (`body` 1–500). RLS mirrors session visibility via the `can_see_session` definer helper; delete limited to author or session owner (`owns_session`). |
| `session_reactions` (social v2) | `lib/db/reactions.ts`, `app/actions/reactions.ts` | Fixed-palette emoji reactions on feed sessions. RLS SELECT mirrors session visibility; writes go **only** through the `toggle_reaction` definer RPC (atomic insert-or-delete, re-checks visibility + emoji) so a reaction can't target an unseen session or be forged. |
| `reports` (social v2, Phase 4) | `lib/social/reports.ts`, `app/actions/reports.ts` | Abuse reports. **INSERT-only RLS** (`reporter_id = auth.uid()`) — users can file but never read; the admin reads via definer RPCs. `target_type` ∈ story/comment/profile, `target_id` (polymorphic, no FK), fixed reason set + optional note, `status`. |

**Social v2 also added:** `is_private` on `sessions`/`goals`/`habits`; the
`public_profiles` view (id/username/display_name/bio only); a private
**`session-photos` Storage bucket** (`{user_id}/{session_id}/{kind}.jpg`, 1-hour
signed URLs, read policy `can_see_session_photo` = owner OR admin OR non-private
complete-pair friend); and definer RPCs `are_friends`, `are_blocked`,
`can_see_session`, `owns_session`, `search_users`, `toggle_reaction`,
`can_see_session_photo`, plus the Phase 4 admin/account set: `is_admin`,
`admin_list_reports`, `admin_resolve_report`, `admin_take_down_story`,
`admin_delete_comment`, `delete_own_account`. Cross-user reads (`*ForUser`
helpers, `listFriendFeed`, `listProfileStories`) omit the owner filter and let
the friend-read RLS (`owner OR are_friends AND NOT is_private`) decide.

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
  `aggregateWeekByGoal` sum per-goal time directly via the session's `goal_id`.
  **Invariant:** a session is attributed to the single instant of its `end`
  (`endedAt ?? now`); events to their `start`. That single-instant rule is what
  makes a session land in exactly one week AND one month AND one year — never
  double-counted, never dropped. Sessions and events are summed *without
  dedup* (an event overlapping a session counts in both — the deliberate
  "unified time-spent" model). `null` category = the Uncategorized bucket.

- **`lib/categorize.ts` — auto-categorization.** First category whose
  `rules.titleContains` substring-matches the title (case-insensitive). Order =
  priority; caller sorts first.

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
- **RLS does the row scoping, reads now double up.** The policy enforces
  `auth.uid()`, and since social v2 (Aspect 4) own-view read helpers also filter
  `.eq("user_id", me.id)` explicitly — defense-in-depth so a policy regression
  can't leak rows into your own screens. Cross-user reads (the `*ForUser(userId)`
  helpers behind `/profile/[username]`) deliberately omit that filter and let the
  friend-read RLS policies (`owner OR are_friends AND NOT is_private`) decide what
  a viewer sees. Writes still set `user_id` explicitly on insert.

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
- **No service-role key anywhere.** All privileged/admin power is `SECURITY
  DEFINER` RPCs gated by a single `is_admin()` helper (holds one UUID). `/admin`
  checks `is_admin()` to render *and* every `admin_*` RPC re-checks it (defense in
  depth), so a direct RPC call from a non-admin fails even if the endpoint leaks.
- **Take-down = hide.** `admin_take_down_story` nulls the photo path columns (the
  session stops being a complete pair → drops off every profile, and
  `can_see_session_photo` stops serving the blob); `admin_delete_comment` deletes
  the row. Blob purge from Storage is deferred (hygiene, not visibility).
- **Account deletion is cascade-driven.** Every user-owned table is `ON DELETE
  CASCADE` from `auth.users` (verified via `pg_constraint`), so
  `delete_own_account()` clears the polymorphic `reports` about the user, then
  deletes the one `auth.users` row and the DB cascades the rest. The
  `deleteAccount` action removes the user's photo blobs from Storage *first*
  (rows are gone after), then calls the RPC, then signs out.
- **Photo EXIF/GPS is stripped server-side.** The client canvas downscale
  (`lib/images/downscale.ts`) only bakes in orientation; the security boundary is
  the server `sharp.rotate().resize(1600).jpeg(80)` re-encode in
  `uploadSessionPhoto`, which drops all metadata. Ownership is checked explicitly
  there (friend-read RLS means a non-empty session read no longer implies owner).
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

---

## 11. Changelog (cumulative — newest first)

> Append one entry per work session / feature set. Keep it terse: what changed
> architecturally, why, and any new invariant or migration. Seeded from git
> history; entries before this file existed are reconstructed.

### 2026-07-14 — Social v2 Phases 2–4 (feed → moderation → deletion), first deploy
- **Phase 2 — feed + comments + reactions + live.** Home becomes the feed
  (`listFriendFeed`, friends' finished sessions) with a "clocked in now" strip
  (`listClockedInNow`, 30s poll); the personal dashboard moved to `/me`
  (`components/dashboard.tsx`, shared so flag-off is byte-identical). Comments
  (`session_comments`) and emoji reactions (`session_reactions`) both gate on the
  `can_see_session` definer helper; reactions write only via `toggle_reaction`.
- **Phase 3 — session photos + stories.** Private `session-photos` bucket;
  `uploadSessionPhoto` re-encodes with `sharp` (strips EXIF/GPS — the security
  boundary) and enforces ownership + timing; optional before/after capture in the
  clock flow (`session-photo-step.tsx`, skip is one equal-weight tap). A profile
  shows a session ONLY as a complete before+after **story** (`listProfileStories`,
  `story-card.tsx`) — photo-less/half-pairs stay private. Storage read policy
  `can_see_session_photo` tightened to owner OR non-private complete-pair friend
  (closed an enumeration/private-photo gap).
- **Phase 4 — moderation + account deletion (the go-wider gate).** Write-only
  `reports` table + `report-button.tsx` on others' stories/comments/profiles;
  `/admin` queue gated by `is_admin()` (no service-role key) with take-down /
  dismiss via self-gating `admin_*` RPCs. `delete_own_account()` (cascade-driven)
  + `deleteAccount` action (blob purge → RPC → sign-out) with type-to-confirm UI.
- **Invariants added:** no service-role key (admin = `is_admin()` definer RPCs,
  double-gated); take-down = hide; user-owned tables are `ON DELETE CASCADE` from
  `auth.users`; photo EXIF stripped server-side. Each phase verified with an
  adversarial JWT test (5-persona RLS, 10-point comments, 14-check admin/reports,
  deletion scoping). **Shipped to `main`** behind `SOCIAL_ENABLED`.

### 2026-07-10 — First-run onboarding
- `/onboarding` wizard (from the Claude Design handoff) reusing real actions:
  `createGoal`, `clockIn`/`clockOut`, `completeOnboarding`. Gate lives in
  Home's server component on `profiles.onboarded_at` (new nullable column,
  added via Supabase SQL); OAuth callback default landing moved `/clock → /`
  so new users always hit the gate. Replay switch on Home's Profile card
  nulls the stamp for end-to-end retesting. `BottomNav` hides on `/onboarding`
  unless a tour screen passes `activePath`.

### 2026-07-10 — Weekly planner removed
- Deleted the `/plan` tab and its whole subsystem: `scheduled_blocks` +
  `session_plans` (actions + db readers), the greedy placement engine
  (`lib/placement.ts`), the missed-block sweep/reslot pipeline, and Home's
  "Needs reslotting" card. `PlanPicker` and the session-plan CRUD actions were
  already dead code. `sessions.session_plan_id` (vestigial — read once at
  clock-out, never written) removed from types, `SESSION_COLUMNS`, and the
  clock-out flow; goal attribution was already direct via `sessions.goal_id`.
  `listBusyTimes`/`BusyInterval` dropped from `lib/db/calendar-events.ts`
  (planner-only). Nav is 4 tabs. The `scheduled_blocks` / `session_plans`
  tables and the `sessions.session_plan_id` column are dropped in Supabase
  (manual SQL — schema is not in-repo).

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
