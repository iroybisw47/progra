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
> _Last updated: 2026-07-31_

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
| `/onboarding` | `onboarding/page.tsx` | `onboarding-client-v2.tsx` (redesign) / `onboarding-client.tsx` (legacy) | First-run wizard. Redesign: 6-step conversational flow (welcome→about→goal→categories→habits→invite) — no calendar step; connect lives in History/Settings. Home redirects here while `profiles.onboarded_at` is null; "Replay onboarding" re-enters it. |
| `/search` | `search/page.tsx` | — | Placeholder ("Coming soon") for a future search surface. |
| `/clock` | `clock/page.tsx` | `clock-client.tsx` | Clock in/out/pause; live timer; week strip. |
| `/goals` | `goals/page.tsx` | `goals-client.tsx` | Weekly quotas and progress. |
| `/habits` | `habits/page.tsx` | `habits-client.tsx` | Habit tracker (per-day, tz-aware). |
| `/history` | `history/page.tsx` | `history-client.tsx` | Month/year rollups, category axis, session browser. The app's calendar surface: Connect Google Calendar (when disconnected) / Sync (when connected) on month/year views. |
| `/recap` | `recap/page.tsx` | `recap-client.tsx` | Sunday weekly recap + share (the older scrubber card). |
| `/recap/[weekStart]` | `recap/[weekStart]/page.tsx` | `recap-story.tsx` | Full-screen 5-panel weekly recap **story** (number · categories · goals · circle rank · shareable card) — `framer-motion`, own-data, `force-dynamic`. The "your week is ready" nudge on Progress opens this. |
| `/recap/[weekStart]/card` | `recap/[weekStart]/card/route.tsx` (Route Handler) | — | 1080×1080 recap PNG via `next/og` `ImageResponse` (Node runtime, `getCurrentUser`-gated) — the story's Share button fetches it and shares it as a `File`. |
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
| `sessions` | `lib/db/sessions.ts` | The clock-in record. `started_at`/`ended_at` (real wall-clock), `paused_ms` (banked), `paused_since` (set only while paused), `category_id`, `goal_id`, and (social v2) `photo_path` (the session's one optional photo). `auto_ended_at` / `auto_end_reviewed_at` (both nullable) record that the 10-hour cap ended the row and whether the user has reviewed it — `is_private` alone can't say so, since a draft is private too. **Partial unique index** enforces one active (`ended_at IS NULL`) session per user → insert error `23505`. |
| `goals` | `lib/db/goals.ts` | `weekly_quota_hours`, active flag, ordering. |
| `calendar_events` | `lib/db/calendar-events.ts` | Synced Google events. Upsert keyed on `(user_id, google_event_id)`. All-day + cancelled events skipped on sync. |
| `event_categorizations` | `app/actions/event-categorizations.ts` | Manual category overrides for specific calendar events. |
| `event_exclusions` | `app/actions/event-exclusions.ts` | Hidden/excluded calendar events. |
| `habits` (+ logs) | `lib/db/habits.ts` | Habit definitions and per-day completion. Tz-checked server-side. |
| rollups / recap | `lib/db/rollups.ts`, `lib/db/recap.ts` | Read-side aggregation helpers for `/history` and `/recap`. |
| `friendships` (social v2) | `lib/db/friends.ts` | One row per pair: `requester_id`/`addressee_id`, `status` (pending/accepted/blocked), `blocked_by`. RLS hides blocks from the blocked party; consent-critical transitions go through `SECURITY DEFINER` RPCs (`accept_friend_request`, `block_user`). |
| `session_comments` (social v2) | `lib/db/comments.ts`, `app/actions/comments.ts` | Comments on feed sessions (`body` 1–500). RLS mirrors session visibility via the `can_see_session` definer helper; delete limited to author or session owner (`owns_session`). |
| `session_reactions` (social v2) | `lib/db/reactions.ts`, `app/actions/reactions.ts` | Fixed-palette emoji reactions on feed sessions. RLS SELECT mirrors session visibility; writes go **only** through the `toggle_reaction` definer RPC (atomic insert-or-delete, re-checks visibility + emoji) so a reaction can't target an unseen session or be forged. |
| `reports` (social v2, Phase 4) | `lib/social/reports.ts`, `app/actions/reports.ts` | Abuse reports. **INSERT-only RLS** (`reporter_id = auth.uid()`) — users can file but never read; the admin reads via definer RPCs. `target_type` ∈ story/comment/profile/**recap** (CHECK), `target_id` (polymorphic, no FK), fixed reason set + optional note, `status`. |
| `recap_views` (weekly recap) | `lib/db/recap-views.ts`, `app/actions/recap.ts` | Per-`(user_id, week_start_ms)` marker that a recap was opened — drives the "your week is ready" nudge across devices (survives reinstall, unlike localStorage). Owner-only RLS (SELECT + INSERT). |
| `recap_posts` (weekly recap) | `lib/db/feed.ts`, `app/actions/recap.ts` | A recap posted to the friends feed. **Denormalized summary** (`total_tracked_ms`, `rank`, `circle_size`, `categories` jsonb, `caption`) so the feed card renders without recompute; unique `(user_id, week_start_ms)` (re-post upserts). RLS: read own-or-accepted-friend, write own. Deliberately its own row, never a synthetic session (can't pollute time aggregation). |
| `recap_reactions` / `recap_comments` (weekly recap) | `lib/db/recap-social.ts`, `app/actions/recap-social.ts` | Kudos + comments on recap posts — **parallel tables** (chosen over a polymorphic migration so the live session social tables/RLS/RPCs stay untouched). RLS gates on the `can_see_recap` definer helper; reactions write only via `toggle_recap_reaction`; comments insert-own-on-visible / delete-own-or-recap-owner. FK `ON DELETE CASCADE` from `recap_posts` (takedown removes both). |

**Draft-private clock-out (2026-07-27).** In the redesign flow, ending a session
(Stop, or an edit that sets an end time) marks it `is_private = true` — a
*draft*. The finish screen (`/clock/finish`) is the compose step (notes, photo,
delete) and its **Post** button is the moment of publication (`is_private =
false`, or kept private). No dedicated column: draft = private, so RLS and the
photo storage policy already hide it. Consequence: an abandoned finish screen
leaves a private session, indistinguishable from a deliberately-private one (an
"unposted" nudge would need a `posted_at` column). Legacy flag-off clock-out and
the onboarding tour don't pass `draft` and still publish at clock-out.
`uploadSessionPhoto` accordingly allows uploads while the session is active OR
ended-but-private (blocked once posted, since the photo would become instantly
friend-visible).

**Social v2 also added:** `is_private` on `sessions`/`goals`/`habits`; the
`public_profiles` view (id/username/display_name/bio only); a private
**`session-photos` Storage bucket** (`{user_id}/{session_id}/photo.jpg`, 1-hour
signed URLs, read policy `can_see_session_photo` = owner OR admin OR (accepted
friend AND session not private AND session ended)); and definer RPCs `are_friends`, `are_blocked`,
`can_see_session`, `owns_session`, `search_users`, `toggle_reaction`,
`can_see_session_photo`, plus the Phase 4 admin/account set: `is_admin`,
`admin_list_reports`, `admin_resolve_report`, `admin_take_down_story`,
`admin_delete_comment`, `delete_own_account`. Cross-user reads (`*ForUser`
helpers, `listFriendFeed`, `listProfileSessions`) omit the owner filter and let
the friend-read RLS (`owner OR are_friends AND NOT is_private`) decide.

**Weekly recap added these definer RPCs:** `week_leaderboard(p_week_start_ms,
p_week_end_ms)` (ranks caller + accepted friends by **clocked** session time —
takes only the week bounds, derives the circle from `auth.uid()` so a caller can
never rank against a non-friend; replicates `aggregateRange`/`sessionWorkedMs`
exactly, minus calendar events); `can_see_recap` (owner-or-accepted-friend, the
recap analogue of `can_see_session`); `toggle_recap_reaction` (atomic kudos
insert-or-delete, mirrors `toggle_reaction`); and `admin_take_down_recap` (deletes
the `recap_posts` row, cascading its reactions/comments). `admin_list_reports`
gained a `recap` target-preview branch.

---

## 6. Domain logic core (`lib/` pure modules)

These are I/O-free and are the heart of the app's correctness. They're shared so
numbers reconcile across every surface.

- **`lib/session.ts` — worked-time source of truth.** `sessionWorkedMs(s, now)`
  = `(end - start) - pausedMs - currentPause`. *Every* aggregation routes through
  this so the week card, recap, rollups, and day breakdown all agree. Pre-pause
  rows (pausedMs=0, pausedSince=null) reduce to plain `end - start`.
  **`SESSION_CAP_MS` (10h) caps ACTIVE sessions only** — a running session's
  worked time is `Math.min(…, cap)`, so the live timer freezes at `10:00:00`;
  an ended row reads back exactly what's stored, so no historical total is
  retroactively rewritten. `sessionCapEndMs(s) = startedAt + cap + pausedMs` is
  the instant `autoClockOut` stamps, and the invariant that makes the two halves
  agree is that a row ended there reads back at *exactly* the cap — so an
  auto-ended session needs no clamp and no backfill. `isOverSessionCap` is false
  while paused under the cap (worked time is frozen, so a pause can never trip
  it) and false for every ended row.

- **`lib/aggregate.ts` — attribution engine.** `aggregateRange` /
  `aggregateWeek` sum per-category time; `aggregateRangeByGoal` /
  `aggregateWeekByGoal` sum per-goal time directly via the session's `goal_id`.
  **Invariant:** a session is attributed to the single instant of its `end`
  (`sessionAttributionEnd(s, now)` — `endedAt`, else `now`, except once past the
  10-hour cap where it's `sessionCapEndMs`, so the bucket doesn't move when
  `autoClockOut`'s write lands); events to their `start`. That single-instant rule is what
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
  client's claimed "today" against the user's stored timezone. Weekly recap adds
  `weekWindow(tz, weekStart?)` (the single tz-correct `{weekStartISO, weekStartMs,
  weekEndMs}` source shared by Progress, the story route, and the leaderboard
  caller) and `recapReadyMs` / `isRecapReady` (a week's recap unlocks Sunday 6pm
  **wall-clock** in the user's tz — resolved with the same two-pass DST offset as
  `zonedDayStartMs`, so it's correct even on a spring-forward Sunday).

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

### 7.1 Native (Capacitor iOS) sign-in

The iOS app is a **thin webview over production**: `capacitor.config.ts` sets
`server.url = https://progra.world` (so `webDir` is inert) and the same client
bundle serves both the website and the app. Every native-only branch is gated on
`isNativeApp()` (`lib/native.ts`).

Google **refuses OAuth inside an embedded webview** (`disallowed_useragent`), so
the web flow — let Supabase navigate the current window to `accounts.google.com`
— cannot work in the shell. Native instead:

1. `GoogleSignInButton` calls `signInWithOAuth({ skipBrowserRedirect: true })` to
   get the consent URL *without* navigating, and opens it via `@capacitor/browser`
   (SFSafariViewController — a real browser, which Google accepts). `redirectTo`
   is the custom scheme `world.progra.app://auth/callback`, carrying `next`/`ref`.
2. Supabase redirects there after consent; iOS hands the URL to the app.
3. `<NativeAuthListener/>` (root layout, mounted **for signed-out visitors too**)
   catches `appUrlOpen`, closes the browser sheet, and **navigates the webview to
   `/auth/callback?code=…&next=…&ref=…`** — the same server route the website
   uses. It does not exchange the code itself.

**Why the server can finish a flow the client started.** The PKCE
`code_verifier` is an ordinary cookie (`httpOnly: false`, `path: /`) on
`progra.world`, and neither `createBrowserClient` nor `createServerClient`
overrides the cookie name, so both derive the same storage key. The server
therefore receives the verifier on every request and can exchange against it.
The webview's origin being the real domain is what makes this hold — on a
bundled build (`capacitor://localhost`) the cookie would be cross-origin and
none of this would work.

So native and web converge on one code path: `app/auth/callback/route.ts` does
the exchange, `claim_invite` for `?ref=`, `safeNextPath` on `?next=`, redirect.
Deep-link params are forwarded verbatim precisely so the route's own validation
stays the single authority — a spoofed `world.progra.app://` link can't become
an open redirect, because `safeNextPath` still runs server-side.

> **History worth keeping.** This originally exchanged client-side in the
> listener and failed intermittently with *"invalid flow state, no valid flow
> state found"* — the verifier went missing somewhere between `signInWithOAuth`
> and `exchangeCodeForSession`. Two targeted fixes (a module-scoped in-flight
> guard, then `signOut({ scope: "local" })` before minting the verifier) did not
> resolve it. Routing the code to the server removed the failure class instead of
> chasing the step that lost the cookie. If a client-side exchange is ever
> reintroduced, expect this to come back.

**Manual config:** `world.progra.app://auth/callback` must be in Supabase →
Authentication → URL Configuration → Redirect URLs, and must match
`CFBundleURLTypes` in `ios/App/App/Info.plist`. Google Cloud Console needs no
change — Google always returns to Supabase's `/auth/v1/callback`, which forwards
to our scheme.

> ⚠️ **Known gap: Calendar connect is broken on native.**
> `app/auth/google-calendar/route.ts` server-redirects straight to
> `accounts.google.com`, which the webview hits as an embedded user-agent — the
> same refusal. Its fix differs from sign-in's: that flow sets an `httpOnly`
> CSRF nonce cookie and exchanges tokens server-side, so the deep link must
> re-enter the server route rather than exchange in the client.

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
- **A session's worked time can never exceed 10 hours** (`SESSION_CAP_MS`).
  Enforced in two halves: a display clamp on active sessions in
  `sessionWorkedMs`, and `autoClockOut()` which ends the row at
  `sessionCapEndMs`. There is no cron — the write is triggered lazily by
  `<EnsureSessionCap/>` in the root layout (the `EnsureProfileSync` pattern), so
  it lands on the next page load after the crossing. Until then every surface
  already shows the clamped value, so nothing lies while the write is
  outstanding. The cap governs *live* sessions only: hand-entered history via
  `createSession` is deliberately uncapped. **`week_leaderboard` re-implements
  the cap in SQL** — the `36000000` literal there and `SESSION_CAP_MS` must move
  together.
- **Service-role key: one narrow, server-only use.** All privileged/admin power
  is otherwise `SECURITY DEFINER` RPCs gated by a single `is_admin()` helper
  (holds one UUID). `/admin` checks `is_admin()` to render *and* every `admin_*`
  RPC re-checks it (defense in depth), so a direct RPC call from a non-admin fails
  even if the endpoint leaks. The **one** exception is the session-photo storage
  *write* (`lib/supabase/admin.ts`, used only by `uploadSessionPhoto`): this
  project's Storage service does not authorize uploads from a valid user JWT (it
  treats authenticated tokens as anon at the storage layer, independent of the
  JWT signing algorithm — reads via signed URLs are unaffected). The action
  authenticates the user and verifies session ownership *before* the admin write,
  so the authorization the bucket's INSERT RLS would enforce is done in code. The
  key lives in `SUPABASE_SERVICE_ROLE_KEY` (server env only, never `NEXT_PUBLIC_`,
  never in a client bundle).
- **Take-down = hide.** `admin_take_down_story` nulls `sessions.photo_path`, so
  `can_see_session_photo` no longer matches the object and stops serving the blob;
  `admin_delete_comment` deletes the row. Blob purge from Storage is deferred
  (hygiene, not visibility). Note the session itself survives a take-down — only
  its photo goes.
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

### 2026-07-30 — 10-hour session cap + auto-clock-out **(requires SQL, run by hand)**
- Nothing bounded a session's length: `sessionWorkedMs` had a `Math.max(0, …)`
  floor and no ceiling, so a forgotten clock-out rendered as `168:00:00` and its
  attribution instant slid forward day by day, re-bucketing into whatever week it
  finally ended in. With ~5 real beta users and a friend leaderboard that counts
  active sessions, that became a fairness problem as well as a data one.
- `lib/session.ts` gains `SESSION_CAP_MS` (10h) and three helpers. The clamp in
  `sessionWorkedMs` applies **only when `endedAt === null`** — deliberately, so
  no historical row is retroactively rewritten and no backfill is needed. It
  works because `sessionCapEndMs = startedAt + cap + pausedMs` is exactly the
  instant that makes an ended row read back at the cap.
- New `sessionAttributionEnd` replaces the six independent `endedAt ?? now`
  sites (4× `lib/aggregate.ts`, `app/goals/page.tsx`, and a verbatim duplicate
  deleted from `clock-client.tsx`). Without this the 10h would attribute to
  *today* while running and jump to the crossing day when the write landed;
  with it, **the auto-clock-out write is visually a no-op**.
- `autoClockOut()` takes no arguments on purpose — it recomputes from the stored
  row and the server clock, so a wrong client clock can't trigger or suppress it.
  Writes `ended_at`/`auto_ended_at` = the cap instant, `is_private = true` (draft
  convention — nothing uncomposed reaches the feed), and leaves `paused_ms`
  untouched since an in-progress pause can only have begun after the crossing.
  Guarded by `.is("ended_at", null)` so racing tabs produce exactly one write.
  Uses the full `revalidateSessionSurfaces()`, *not* the `ExceptLive` variant:
  here `/clock/live`'s redirect guard *should* fire.
- Trigger is `<EnsureSessionCap/>` in the root layout, following
  `EnsureProfileSync` — zero writes on normal loads. No `useNow`: an exact
  `setTimeout` crosses the cap live without a single extra render, plus a
  `visibilitychange` re-check for suspended tabs. There is no cron, and the old
  `sweepPastBlocks` lineage died with the planner in July, so enforcement is lazy
  by design.
- Review path: new nullable `auto_ended_at` / `auto_end_reviewed_at` columns
  (`is_private` alone can't distinguish an auto-end from a deliberate draft — the
  gap §5 already flagged). Surfaces as a banner on `/clock/finish` and a muted
  nudge on Progress → Today, fed by `getUnreviewedAutoEnd()`.
- **SQL run by hand:** additive only, no `UPDATE`.
  ```sql
  alter table public.sessions
    add column if not exists auto_ended_at        timestamptz,
    add column if not exists auto_end_reviewed_at timestamptz;
  create index if not exists sessions_auto_end_review_idx
    on public.sessions (user_id, ended_at desc)
    where auto_ended_at is not null and auto_end_reviewed_at is null;
  notify pgrst, 'reload schema';
  ```
- **Still outstanding:** `week_leaderboard` re-implements worked-time math in SQL
  and counts active sessions, so until its body is patched a friend's runaway
  session displays a frozen `10:00:00` while ranking on the uncapped total. Dump
  with `pg_get_functiondef`, wrap the per-session expression in
  `case when s.ended_at is null then least(…, 36000000) else … end` (active-only,
  mirroring the TS clamp), re-run the adversarial JWT check.

### 2026-07-27 — Calendar connect moved out of onboarding, into History
- The redesign onboarding wizard drops its `calendar` step (7 → 6 steps,
  `habits → invite`); the `?step=calendar&status=` deep-link plumbing and the
  OAuth route's write-once `onboarded_at` stamp (which existed only for that
  entry point) are removed. `ConnectFrom` is now `"history" | "settings"`;
  `returnPath` sends `?calendar=connected|error` to both.
- History (month/year views) becomes the calendar surface: a Connect CTA when
  disconnected (`isCalendarConnected` computed in `history/page.tsx`), the
  existing `SyncCalendarButton` when connected, plus the one-shot return toast.
  Settings' connect/disconnect row is unchanged. No SQL.

### 2026-07-27 — Finish screen compose step (draft-private clock-out)
- Redesign Stop / end-via-edit now passes `draft: true` to `clockOut` /
  `editActiveSessionTime`, which sets `is_private = true` on the ended session.
  `/clock/finish` becomes a compose screen — editable notes, add-photo
  (`uploadSessionPhoto` guard relaxed to reject only ended-AND-public), delete
  behind a confirm — and **Post** is the publication moment (feed visibility
  timing moved from Stop to Post). No migration: draft = private under existing
  RLS/storage policies. `updateSession`/`deleteSession` hardened with explicit
  ownership + 0-row checks (were RLS-only silent no-ops on foreign/stale ids).
- **Invariant added:** photo uploads are only accepted while the photo is
  friend-unreachable (session active, or ended-but-private draft).

### 2026-07-25 — Weekly Recap (the Sunday ritual → competitive social loop)
An 8-phase feature, each phase tsc/eslint/vitest/build-green + an adversarial JWT
test on every SQL change. Shipped to `main` (live for all `REDESIGN` users — **no
separate flag**).
- **Nudge + story (P0–P2, P4).** A "your week is ready" navy CTA appears on the
  Progress→Today tab once the week unlocks (Sunday 6pm **local**, via `recapReadyMs`)
  and isn't yet opened (`recap_views`, cross-device); it targets the most-recent
  unlocked week and persists until opened. Opening launches `/recap/[weekStart]` —
  a full-screen `framer-motion` (**first new runtime dep**) 5-panel story. Empty /
  first-week / solo-circle / clocked-nothing states are all softened, and the nudge
  is suppressed for weeks predating the account's `created_at`.
- **Leaderboard (P3, revised).** `week_leaderboard` definer RPC ranks the caller +
  accepted friends. It takes only the week bounds and derives the circle from
  `auth.uid()` (structural isolation — no user-id param). Replicates
  `aggregateRange`/`sessionWorkedMs` exactly so the caller's own total reconciles
  with `computeWeekRecap` — **except** it counts **clocked sessions only** (calendar
  events deliberately excluded: a packed calendar shouldn't win). A friend's private
  sessions count only for the owner (matches feed visibility). So leaderboard total
  ≠ recap `totalTrackedMs` by design.
- **Share image (P5).** `/recap/[weekStart]/card` renders a 1080×1080 PNG via
  `next/og` `ImageResponse` (first in the app; Node runtime to reuse the recap
  reads); the Share button shares it as a `File` (Web Share API → download → text
  fallbacks).
- **Feed post + social (P6a–P6c).** Posting a recap writes a denormalized
  `recap_posts` row (never a synthetic session — keeps aggregation clean) that the
  feed renders as a distinct *"{name} uploaded their weekly recap!"* card.
  Reactions/comments live in **parallel** `recap_reactions`/`recap_comments` tables
  (deliberately not a polymorphic migration — the live session social machinery,
  RLS, `toggle_reaction`, and notification joins stay untouched) gated by a
  `can_see_recap` helper + `toggle_recap_reaction` RPC. Moderation: `"recap"` added
  to the `reports` CHECK + `ReportButton`, `admin_take_down_recap` RPC, and an
  `admin_list_reports` recap branch + admin-queue arm.
- **Invariants added:** recap week windows use `weekWindow` (one tz-correct source);
  the leaderboard is a distinct "clocked focus time" metric, not the recap total;
  recap social uses parallel tables, never touching the session tables; recap posts
  are their own rows, never synthetic sessions.

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
  showed a session ONLY as a complete before+after **story** — photo-less/half-pairs
  stayed private. **Superseded: see "One photo per session" below.**
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

### 2026-07-16 — One photo per session (supersedes Phase 3's pair rule)
- **The pair rule is gone.** `before_photo_path`/`after_photo_path` collapsed to
  a single `photo_path`; the "after" capture, its 10-minute upload tolerance, and
  the before/after concept are deleted. A session carries **one optional photo**,
  taken while it runs (`/clock/live`, `?capture=photo` — the only capture point).
- **`is_private` is now the whole of visibility.** Phase 3 overloaded photo
  completeness to mean "shared", which was a second gate on top of a privacy flag
  that already worked. A photo is now just an attachment with no visibility of its
  own. `lib/storage.ts` no longer claims visibility is "derived from this pair".
- **Profiles show session history, not a gallery.** `listProfileStories` →
  `listProfileSessions` (`lib/db/profile-sessions.ts`), `StoryCard` →
  `ProfileSessionCard`: every finished visible session, photo or not, newest
  first, capped at 50 (pagination is a follow-up). The `"story"` report target
  type **kept its name** — it's a `report_target_type` enum value persisted on
  `reports` rows, so renaming it would mean migrating stored data.
- **Doc correction:** this file previously described `can_see_session_photo` as
  "owner OR admin OR non-private complete-pair friend". That was never true —
  the policy matched `before_photo_path = object_name OR after_photo_path =
  object_name` and already carried `not is_private and ended_at is not null`.
  The pair rule lived only in app code (`stories.ts`, `session/[id]/page.tsx`).
  Verify DDL against Supabase, not against this file (see line ~139).

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
