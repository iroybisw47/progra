# Progra — Project Handoff (for Claude memory)

> **Purpose of this file.** A single, self-contained brief a fresh Claude session
> can read to reconstruct the project's durable context — what Progra is, how it's
> built, the conventions that must be followed, what's forbidden, current status,
> and how the user likes to work. Feed this to a session to seed/refresh memory.
> When code and this doc disagree, the code wins — fix the doc the same session.
>
> _Last updated: 2026-07-23. Repo: `iroybisw47/progra`. Path: `C:\Users\iroyb\Progra\progra`._
> _Major updates since 07-14: V2 REDESIGN live at progra.world; 5-part performance
> overhaul (§8.5); auth/mutation conventions CHANGED (§3, §6 — old patterns now
> forbidden); Google OAuth verification prep (§8.6); History week view via shared
> WeekSummary (07-23); complete feature inventory added (§4.5)._

---

## 1. What Progra is

A personal productivity **PWA** (installs to the iPhone home screen), **evolving from a
single-user time tracker into a friends-based social network**. The single-user tracker
is the live beta; the entire **social v2** build ships behind a feature flag
(`SOCIAL_ENABLED` / `NEXT_PUBLIC_SOCIAL_ENABLED`) so the beta is untouched while social
is dark.

The tracker's four loops: **Goals** (weekly hour quotas), **Clock** (in/out/pause,
optionally attributed to a goal), **Track** (Google Calendar sync + categorization,
per-category/goal time across week/month/year), **Reflect** (Sunday recap + history
rollups). Plus habits and a first-run onboarding wizard.

> `SPEC.md` describes a v0 (clock-in only, localStorage, no auth). It is **historical** —
> the app today is Supabase-backed and authenticated. Treat `SPEC.md` as an origin
> artifact, `ARCHITECTURE.md` as current truth.

---

## 2. Tech stack

| Concern | Choice |
|---|---|
| Framework | **Next.js 16** (App Router, Turbopack) — APIs differ from older Next; see §7 |
| Language | TypeScript 5, React 19 |
| UI | shadcn/ui (Nova preset) on **Base UI** primitives (`components/ui/*`), Lucide icons |
| Styling | Tailwind CSS v4 (PostCSS), `app/globals.css`; V2 uses **PT Sans** everywhere (heading slot aliased) |
| Toasts | `sonner` |
| Auth + DB | **Supabase in us-west-1** (`@supabase/ssr`) — Postgres + RLS + Google OAuth + Storage. **Asymmetric JWT signing keys (ES256) active** — local `getClaims()` verification works |
| External | Google Calendar API v3 (OAuth token on the profile, refreshed on demand). Scope: **`calendar.events.readonly`** (narrowed 2026-07-22) |
| AI | `@anthropic-ai/sdk` server-only — categorizes event titles (`lib/anthropic/`); kill switch `DISABLE_AI_CATEGORIZATION` |
| Deploy | **Vercel on push to `main`** (GitHub `iroybisw47/progra`), functions **pinned to sfo1 via `vercel.json`** (co-located with the DB — do not remove). PWA via `app/manifest.ts` |
| Validation | **None** — no Zod/Yup/etc. (hand-rolled guards + DB CHECK constraints) |

---

## 3. Architecture (the core mental model)

Strict, repeating layering — learn once, every feature reads the same:

```
Browser (PWA)
  → proxy.ts (Next 16's renamed middleware) → lib/supabase/proxy.ts refreshes the
    auth cookie via getClaims() (LOCAL Web-Crypto JWT verification — no network).
    CRITICAL: no code runs between createServerClient and the auth call.
  → app/<route>/page.tsx        Server Component. Auth-gates, reads via lib/db/*,
                                 ONE Promise.all wave (chain dependents off the
                                 specific promise they need), passes plain props.
  → app/<route>/<route>-client.tsx  "use client". UI + local state; calls actions.
  → app/actions/<domain>.ts     "use server". Mutations. getCurrentUser() guard →
                                 write → revalidate*Surfaces() from lib/revalidate.ts.
  → lib/db/<domain>.ts          "server-only" READS, ALL wrapped in per-request
                                 React cache(). Map snake_case → camelCase.
                                 The ONLY place that SELECTs.
  → Supabase (Postgres + RLS)   RLS scopes every row to auth.uid() — the real
                                 authority; app-side auth is identity, not security.
```

- **Reads** live in `lib/db/*` (`server-only`, no `"use server"`). **Writes** live in
  `app/actions/*` (`"use server"`). A page may call `lib/db` directly; a client
  component may **only** call actions.
- **Every `lib/db/*` helper is `cache()`-wrapped** (per-request dedup). Primitive args
  only — for array/object args, split into a cached raw fetch keyed on primitives + a
  pure transform (pattern: `fetchEventsRaw`/`categorizeEvents` in `lib/db/calendar-events.ts`).
- **Row mapping centralized:** each `lib/db/*` owns a `rowToX` mapper + an `X_COLUMNS`
  constant so a query can't forget a column.
- **Cache invalidation centralized:** every mutation calls its matching
  `revalidate*Surfaces()` helper from **`lib/revalidate.ts`** (never scattered
  `revalidatePath` literals). Session actions use `revalidateSessionSurfaces()` (root
  **layout** — the BottomNav ticker depends on it); actions followed by a client push
  away from `/clock/live` use `revalidateSessionSurfacesExceptLive()`. The action's own
  POST carries the updated UI — **clients do NOT `router.refresh()` after actions**
  (exceptions: feed poll, delete-account, onboarding error-path resyncs).
- **Three Supabase clients:** `lib/supabase/server.ts` (server components/actions),
  `client.ts` (browser), `proxy.ts` (the cookie refresher). Plus the ONE service-role
  exception: `lib/supabase/admin.ts`, used ONLY by `uploadSessionPhoto` (Storage rejects
  user-JWT uploads as anon; ownership is verified in the action first).
- **Auth helpers** (`lib/auth/require-user.ts`): `getCurrentUser` is `react.cache`-wrapped
  and verifies the JWT **locally via `getClaims()`**, returning `{ id, email }` — zero
  auth-server round-trips in the request path. **Never call `supabase.auth.getUser()`**
  in pages/actions (all 30 former sites swapped 2026-07-23). `requireUser()` redirects
  to `/login`; `getOptionalUser()` returns null.
- **Client rendering rules:** second-precision timers ONLY inside `<Ticking>` leaves
  (`components/ticking.tsx`, the sole `useNow()` consumer); everything else uses
  `useNowMinute()`; heavy client derivations get `useMemo`. Click-gated dialogs are
  `next/dynamic(..., { ssr: false })` lazy chunks. `experimental.staleTimes.dynamic = 30`
  is ON — safe only while the revalidation rule above holds.

---

## 4. Route map

**`REDESIGN` (implies `SOCIAL_ENABLED`) is ON in production.** V2 IA: bottom nav is
Progress `/` · Feed `/feed` · [Clock center FAB] · Friends `/friends` · You `/me`.
All routes have `loading.tsx` skeletons. `BottomNav` renders in the layout only when
signed in; its center FAB live-ticks while a session runs.

| Route | Server | Client | Purpose |
|---|---|---|---|
| `/` | `app/page.tsx` | `v2/progress-client.tsx` | **Progress tab** (Today / This week / History) + onboarding gate. Signed-out → landing (hero, feature blurb, direct Google sign-in button, legal footer). |
| `/feed` | `feed/page.tsx` | `v2/feed-v2.tsx` (server) | Friends' finished sessions (with photos), clocked-in-now strip, join announcements, kudos/comments. 60s poll + refocus refresh. |
| `/clock` | `clock/page.tsx` | `clock-client.tsx` | Clock-in form + week view. Active session redirects to `/clock/live` (full-screen timer) → `/clock/finish` (save/privacy/photo). |
| `/me` | `me/page.tsx` | — | "You" tab: identity, week quotas, habits, photo sessions, Settings link. |
| `/friends` `/profile/[username]` `/admin` | pages | clients | Social surfaces (unchanged model, §8). |
| `/goals` `/habits` `/history` `/recap` `/sessions` `/categories` `/settings` `/session/[id]` | pages | clients | Tracker + detail surfaces. |
| `/onboarding` | `onboarding/page.tsx` | `onboarding-client-v2.tsx` (REDESIGN) / `onboarding-client.tsx` (legacy) | First-run wizard; Home redirects here while `profiles.onboarded_at` is null. |
| `/privacy` `/terms` | plain server pages | — | **Public legal pages** (render logged-out; Google OAuth verification content). |
| `/search` | `search/page.tsx` | — | Static "coming soon" placeholder. |
| `/login` `/auth/callback` `/auth/signout` | routes | — | Google OAuth. Landing hero starts OAuth directly; `/login` remains for errors/`?next`/deleted-notice. |

> Note: there is **no `/calendar` route** (calendar events surface in `/history` and `/clock`).

---

## 4.5 Complete feature inventory (everything a user can see/do — verified 2026-07-23)

### Signed-out landing (`/`)
- Hero: "Progra — The first community-based productivity app."; "Sign in with Google" starts OAuth directly (no `/login` stop)
- Feature blurb (sessions / optional read-only Google Calendar / friends); iOS add-to-home hint; footer → Privacy/Terms

### Home = Progress tab (`/`, signed-in; redirects to `/onboarding` if not onboarded)
- Segmented Today / This week / History
- **Today:** hero total w/ "N tracked · M imported"; sessions-today list (live pulse on active); goals-today grid (progress bars, % + hours-left); habits tap-to-check (optimistic) + Manage dialog
- **This week:** shared `WeekSummary` (total + category segs + goal quota bars); habits Mon–Sun grid; "Share week as text" (clipboard)
- **History:** month donut + legend; "Full history" link (browse by week/month/year)
- Habit manager (lazy dialog): paginate back ≤8 weeks to backfill any day; add/rename/recolor/delete habits; per-habit privacy eye

### `/onboarding`
- **V2 wizard (4 steps):** progress dots + Skip; claim username (live validation); first goal w/ quota stepper (1–40h); categories explainer; "You're all set"
- **Legacy wizard (8–9 steps, flag-off):** welcome → username → how-it-works → goal → LIVE practice clock-in/out (adopts running session) → categories → Home/History/Habits spotlight tours (History tour has a live Sync button) → finish stamps `onboarded_at` (write-once, preserves join date)

### `/clock` · `/clock/live` · `/clock/finish`
- Clock-in: task + optional description + Category OR Goal (mutually exclusive); redesign → `/clock/live?capture=photo`
- `/clock` extras: clock-only dark/light theme (localStorage); "Add past session" dialog; categories manager (add/rename/recolor/delete, dedupe); this-week card w/ per-weekday bars → tap day for session+event breakdown; event rows → categorize/hide dialog (optimistic hide + undo); Session history link
- `/clock/live` (full-screen, redirects away if no active session): breathing-glow live timer; notes sheet; add photo (only while running; auto-opens once from `?capture=photo`); Pause/Resume; Stop → finish; edit sheet (task, category/goal, start time, "Still running" off → set end and finish); minimize → Home
- `/clock/finish`: worked total + attribution + description + photo; private-session toggle; Save → Home

### `/feed` (+ `/session/[id]`)
- 60s live poll (pauses hidden, refreshes on refocus); "Clocked in now" strip w/ per-row live durations + paused dots
- Cards: author, "clocked into ⟨marker⟩ X for D", title/description, full-bleed photo, duration pill, kudos heart (optimistic), comment count + preview; "just joined Progra" announcements (with first goal); Find-friends empty state
- `/session/[id]` (RLS-gated): full photo, emoji reaction bar (optimistic), comment thread (delete own, report others), composer, Report button

### `/goals` · `/habits` · `/categories`
- Goals: per-goal card (quota, progress bar, this-week sessions w/ relative times), add/edit/archive, privacy eye (optimistic), back-link respects `?from=progress`
- Habits: today check-list (optimistic, strike-through), add/edit (name/color/privacy)/archive, weekly grid
- Categories: list w/ color + keyword-rule chips; new/edit dialog (name, palette, keyword rules for auto-filing); delete (sessions → Uncategorized); precedence manual > rule > AI

### `/history` · `/recap` · `/sessions`
- History: Week/Month/Year switch + prev/next scrubber. Week = shared `WeekSummary` + "Weekly recap →". Month/Year = hero total, expandable per-category items w/ provenance tags (clock/goal/rule/manual/AI/uncat) + delete session / exclude event; by-goal bars; sessions-completed count; period-scoped auto-categorize/review + global Sync button
- Recap: screenshot-friendly weekly card (range, hero total, category bars, goal quota bars, highlights); prev/next week; "Share this week" (Web Share → clipboard fallback)
- Sessions: day-grouped list w/ day totals, category filter chips (incl. Uncategorized), session + calendar-event rows, "Load older" pagination

### `/me` · `/friends` · `/profile/[username]` · `/settings` · `/admin`
- Me: identity card + Settings gear; goal quotas this week; habits grid; own sessions (incl. private, w/ photos)
- Friends: debounced search; "People on Progra" discovery; contextual Add/Requested/Accept/Friends; incoming (accept/decline + badge) / outgoing (cancel); friends (remove/block); blocked (unblock)
- Profile: public identity for any signed-in user; relationship actions + Block + Report; goals/habits/sessions visible to self+friends only (RLS filters private)
- Settings: edit profile dialog (display name, username w/ availability check, bio); timezone picker; Calendar connected indicator; Your-data links; "Replay onboarding"; admin-only report-queue link w/ badge; sign out; hold-to-delete account
- Admin: report queue (reason/target/reporter/note), target previews (re-signed photo URLs), take down photos / delete comment / mark actioned / dismiss

### `/search` · `/privacy` · `/terms`
- Search: "coming soon" placeholder. Legal pages: public, logged-out-renderable (OAuth verification content, support@progra.world, 13+)

### Cross-cutting
- **Bottom nav:** 5 tabs, hidden during onboarding; center FAB idle=Clock icon, tracking=live ticking label (pulsing) → `/clock/live`, paused=grey "Paused"; ticker only mounts while tracking
- **PWA:** manifest (standalone, icons), Apple meta, theme-color light/dark, add-to-home hints
- **Calendar+AI:** read-only sync (365d back/90d fwd) into mirror table; keyword rules → AI (Anthropic) on titles → review dialog (inline re-assign or hide w/ undo); event dialog (set category / revert-to-auto / hide); exclusion = hidden from totals, stays on Google
- **Photos:** one per session, captured while running only (camera capture, client downscale 1600px, server sharp re-encode strips EXIF/GPS); private bucket + 1h signed URLs; private session hides photo
- **Avatars:** optional profile photo (Settings edit-profile dialog + onboarding welcome step) with a pan/zoom crop step at upload (`react-easy-crop`, lazy chunk; crop baked in — re-crop = re-upload); PUBLIC `avatars` bucket, immutable per-upload URLs, sharp 512px square re-encode (EXIF-stripped); shown at every avatar site via `AvatarInitials`'s `avatarUrl` prop (initials fallback); purged on account deletion
- **Privacy flags:** `is_private` on sessions/goals/habits, RLS-enforced; own surfaces show Lock icons
- **Timezone:** per-profile, drives all day/week boundaries; auto-syncs when device tz differs; locale labels formatted client-side
- **Moderation:** report stories/comments/profiles (reason + note, admin-only visibility)
- **Optimistic everywhere it's a toggle**; undo toasts on event hide; share-as-text on week + recap

---

## 5. Data model & Supabase objects

> Schema is **NOT in the repo** — reconstructed from queries. Confirm against Supabase for DDL.

**Tracker tables:** `profiles` (one/user; Google tokens, timezone, `onboarded_at`),
`categories`, `sessions` (clock record; `started_at`/`ended_at`/`paused_ms`/`paused_since`/
`category_id`/`goal_id`; partial unique index = one active session/user → error `23505`),
`goals`, `calendar_events` (upsert on `(user_id, google_event_id)`), `event_categorizations`,
`event_exclusions`, `habits` (+ `habit_completions`).

**Social v2 additions:**
- Columns: `is_private` on sessions/goals/habits; `before_photo_path`/`after_photo_path` on sessions.
- `public_profiles` **view** (id/username/display_name/bio only).
- Tables: `friendships` (`requester_id`/`addressee_id`/`status` pending·accepted·blocked/`blocked_by`),
  `session_comments` (`body` 1–500), `session_reactions` (fixed emoji palette),
  `reports` (Phase 4; `target_type` story·comment·profile, polymorphic `target_id` with **no FK**,
  reason set, note, status; **INSERT-only RLS**).
- **Storage:** private `session-photos` bucket, path `{user_id}/{session_id}/{kind}.jpg`,
  1-hour signed URLs.
- **RPCs (`SECURITY DEFINER`):** `are_friends`, `are_blocked`, `accept_friend_request`,
  `block_user`, `search_users`, `can_see_session`, `owns_session`, `toggle_reaction`,
  `can_see_session_photo`, and the Phase-4 set: `is_admin`, `admin_list_reports`,
  `admin_resolve_report`, `admin_take_down_story`, `admin_delete_comment`, `delete_own_account`.

**RLS model (load-bearing):** SELECT policies are `owner OR are_friends AND NOT is_private`.
Own-view reads in `lib/db/*` **also** filter `.eq("user_id", me.id)` (defense-in-depth).
Cross-user reads (`*ForUser(userId)`, `listFriendFeed`, `listProfileStories`) omit that
filter and let friend-read RLS decide. **Every FK to `auth.users` is `ON DELETE CASCADE`**
(verified via `pg_constraint`) — this is what makes account deletion a single cascade.

---

## 6. Conventions (verified against code)

- **Naming.** Actions: verb-first camelCase (`addComment`, `toggleReaction`, `reportContent`,
  `clockIn`). DB reads: `list*` (collections), `get*` (one/derived), `*ForUser(userId)`
  (cross-user). Mappers `rowToX`; column constants `X_COLUMNS`. Client files kebab-case →
  PascalCase export; page shells strictly `<route>-client.tsx`. RPCs snake_case `verb_noun`;
  boolean predicates read as English (`are_*`/`is_*`/`can_*`/`owns_*`); admin ones `admin_`-prefixed.
- **Error handling.** Actions **return, never throw**: `type Result = { ok: true } | { error: string }`
  (may carry payload, e.g. `{ ok:true, sessionId }`). Clients surface `error` via `sonner` toasts.
  DB reads return empty/null, never throw. Google layer throws typed `GoogleAuthError`. Definer
  RPCs `raise exception`; the action catches → generic `{ error }`.
- **Mutation pattern (CHANGED 2026-07-21, replaces the old "no optimistic + refresh" rule).**
  `useTransition` → optionally `useOptimistic` flip → `await action` → done. **No
  `router.refresh()` on success** — the action's revalidation delivers fresh props in the
  same POST, which also reconciles/discards the optimistic layer. Optimistic surfaces:
  habit toggles, kudos, reactions, event-hide, privacy toggles, delete-confirms.
  Data-entry dialogs (session save, settings identity, etc.) deliberately close AFTER the
  await so form state survives errors. The shared `run(action, {okMsg, then})` helpers
  no longer refresh.
- **Validation.** No schema library. Hand-rolled guards (`getUser()` first, then explicit
  membership/length checks, trim+slice to max) **plus DB CHECK constraints** enforcing the same
  sets. Shared allowed-value lists live in `lib/social/*.ts`.
- **Migrations.** Schema not in repo; **no Supabase CLI, no migration files.** DDL/RLS/RPCs are
  run **by the user, by hand, in the Supabase dashboard SQL editor**. Claude hands over
  idempotent, all-SQL blocks (`create table if not exists`, `create or replace function`,
  `drop policy if exists` + recreate). The SQL editor may split statements / not honor a wrapping
  `begin…rollback` and does **not** reliably persist temp tables across statements — prefer a
  single self-contained `DO`/function that cleans up after itself, and to show test output use a
  permanent `returns setof text` helper + `select * from it` (notices are often hidden).
- **Verify suite:** `npx tsc --noEmit` (ignore `.next/`), `npx eslint`, `npx vitest run` (45 tests),
  `npm run build`. Each security-sensitive change also gets an **adversarial JWT test** (impersonate
  via `set_config('request.jwt.claims', …)` + `set local role authenticated`).

---

## 7. FORBIDDEN — negative constraints (these matter most)

- **Never query Supabase from a client component.** Client → actions (writes) only; reads →
  server `page.tsx` via `lib/db/*`.
- **No service-role key in user-facing paths** — with ONE documented pattern-exception:
  **Storage WRITES** go through `lib/supabase/admin.ts` after explicit in-action ownership/
  identity verification (Storage rejects ALL user-JWT uploads as anon). Current call sites:
  `uploadSessionPhoto` and `uploadAvatar`/`removeAvatar`. Everything else is anon-key + RLS;
  privileged power = `is_admin()`-gated `SECURITY DEFINER` RPCs, never a god-key.
- **Reads only in `lib/db/*` (`server-only`); writes only in `app/actions/*` (`"use server"`).** Never mix.
- **`"use server"` files export only async functions** — constants/types go to `lib/*` (build breaks otherwise).
- **Every mutation calls its `revalidate*Surfaces()` helper (`lib/revalidate.ts`)** — never
  scattered `revalidatePath` literals, never a client `router.refresh()` on success.
- **Never call `supabase.auth.getUser()` in pages/actions** — use `getCurrentUser()`
  (local `getClaims()`); RLS is the security authority.
- **Never call `useNow()` at the top of a screen** — tick inside a `<Ticking>` leaf;
  quantize everything else with `useNowMinute()`.
- **New read helpers must be `cache()`-wrapped; new dialogs must be `next/dynamic` lazy.**
- **Don't remove `vercel.json`'s sfo1 pin or `staleTimes.dynamic`** without a decision —
  both are load-bearing perf infrastructure.
- **Never write Next.js code from training-data assumptions.** This Next 16 has breaking changes;
  **read `node_modules/next/dist/docs/` first** (`proxy.ts` not `middleware`; dynamic route params
  are `Promise<{…}>` and must be awaited; etc.). `AGENTS.md` mandates this.
- **Never bypass RLS.** The app relies 100% on `auth.uid()` scoping; social reads must be provably
  DB-gated. Prove RLS/security changes with the adversarial JWT test before prod.
- **No new dependencies without asking.** (Approved so far: `react-easy-crop`
  2026-07-23 — the avatar crop dialog, lazy-loaded only.)
- **Reskin = recolor only** (warm palette + Newsreader/Hanken). Never change layout/spacing/widget sizes.
- **Don't start a social phase unprompted** — the user green-lights each phase individually.
- **Sentinel-enforced:** no tool-writes to `.claude/settings*.json` or `.sentinel.yaml`; no reads of `.env*`/credentials.
- **Flag stack/platform conflicts for a decision** — surface them, don't silently work around.

---

## 8. Social v2 status — ALL PHASES 0–4 BUILT + DEPLOYED (2026-07-14)

Everything is on `main` behind `SOCIAL_ENABLED`. Detail is in `CHANGELOG.md` (dated) and
`ARCHITECTURE.md` (refreshed through Phase 4).

- **0/1** — usernames, `friendships`, `is_private`, RLS friend-read rewrite, `/profile/[username]`. 5-persona JWT test.
- **2** — feed IS Home; dashboard → `/me`; comments; emoji reactions; live "clocked in now" strip (30s poll, not Realtime). 10-point comments test.
- **3** — `session-photos` bucket; `uploadSessionPhoto` (sharp `.rotate().resize(1600).jpeg(80)` — **the** EXIF/GPS-strip security boundary; client canvas downscale only bakes orientation). **SUPERSEDED since (V2, ~07-19): ONE photo per session** (`photo_path`), captured while the session runs (clock flow / live timer); **the feed DOES show photos** (full-bleed on session cards) and profiles show photo sessions. Storage read policy `can_see_session_photo` gates by the session's `is_private` alone.
- **4** — write-only `reports` + `report-button.tsx`; `/admin` queue gated by `is_admin()` (**no service-role key**; `admin_*` self-gating; take-down = null photo cols / delete comment); account deletion (`delete_own_account()` cascade + storage blob purge + type-to-confirm UI). 14-check admin/reports test + deletion-scoping test passed.

**Admin identity:** the user (`tapa@quantluxdigital.io`) is the sole admin; UUID
`5da4f579-b469-42cf-8dd5-de76121dd8b9` is hard-coded in `is_admin()`.

Flags are **ON in production** (REDESIGN + SOCIAL). All Phase-4 SQL is confirmed run.
The V2 redesign (2026-07-15 → 07-20, see CHANGELOG) rebuilt the front-end IA on top of
this model: Progress home, full-screen live timer, finish screen, feed cards with
photos + kudos, suggested friends, onboarding v2.

---

## 8.5 Performance architecture (2026-07-21 → 07-23 — all shipped, all load-bearing)

Five passes, each in `CHANGELOG.md`; the resulting RULES are in §3/§6/§7. Summary:

1. **Server round-trips**: `cache()` on all read helpers; `fetchEventsRaw`/`categorizeEvents`
   split; waterfalls flattened (~25-30 Supabase calls per Home load → ~8 parallel);
   `loading.tsx` on every route; middleware auth → local `getClaims()`.
2. **1s-tick isolation**: `useNowMinute()` + `<Ticking>` leaf (`components/ticking.tsx` is
   the ONLY `useNow` consumer); `useMemo` on clock aggregations; idle pages run no timer.
3. **Single round-trip mutations**: `lib/revalidate.ts` surface helpers; ~40 client
   `router.refresh()` calls removed; `EnsureProfileSync` writes only on real tz change;
   reaction bar optimistic.
4. **Bundles**: 5 click-gated dialogs are `next/dynamic ssr:false` chunks; feed poll 60s;
   signed-URL photos `loading="lazy" decoding="async"` (raw `<img>` is deliberate —
   signed URLs into a private bucket; keep it).
5. **Deployed latency (07-23)**: `vercel.json` pins functions to **sfo1** (were iad1 vs
   us-west-1 DB — cross-country per query; verified fixed via `x-vercel-id: sfo1::sfo1`);
   fully local JWT auth (`getCurrentUser` + all 30 action sites); feed extras chain off
   `listFriendFeed` alone; `/clock` events joined its parallel wave;
   `staleTimes.dynamic = 30`.

**Known open levers (un-implemented, in rough priority):** `prefetch={true}` on the 5 nav
links (full-data prefetch + 5-min static staleTime); narrow `getProfile`'s `select("*")`
(drags Google tokens every render); dedupe feed's double `hydrateGoalTitles`/`hydrateUsers`;
optimistic data-entry dialogs; Supabase Realtime instead of the feed poll; per-page
Postgres RPCs (heavy — only if measurements demand).

---

## 8.6 Google OAuth verification (in flight, 2026-07-22 → 23)

- Scope narrowed to **`calendar.events.readonly`** (sole request:
  `app/login/google-sign-in-button.tsx`; sync only calls the events API;
  `prompt=consent` re-consents existing users). Repo has zero stale `calendar.readonly`.
- **`/privacy` + `/terms`** public pages: verbatim Google API Services User Data Policy /
  Limited Use sentence, AI-processing disclosure (Anthropic categorizes event titles only;
  no ads, no training), revoke link + delete-by-email (support@progra.world, 30 days),
  13+ clause. Landing: "The first community-based productivity app." + 3-row feature
  blurb (spells out optional read-only Calendar for reviewers) + legal footer + hero
  button starts OAuth directly.
- Calendar mechanics for the reviewer story: manual Sync button → `syncCalendar` →
  events API (365d back / 90d forward) → mirrored into `calendar_events`; page reads
  never hit Google.
- **User still owes the Cloud Console**: declare the narrowed scope on the consent
  screen; enter `https://progra.world/privacy` + `/terms`; submit. A scope-justification
  draft (feature mapping + why-no-narrower-scope) was written 2026-07-23.

---

## 9. Working relationship / preferences

- **User:** tapa@quantluxdigital.io. Personal project; solo. Works from an uncommitted tree —
  commit/push only when asked (they said "deploy" = commit all + push `main`).
- **Feedback prefs:** wants stack/platform conflicts surfaced for a decision, not worked around.
  Reskin is recolor-only. Green-lights social phases one at a time.
- **Docs workflow:** log changes in `CHANGELOG.md` (dated, newest first, `HH:MM` prefixes) as work
  happens; refresh `ARCHITECTURE.md` at the end of a feature set (there's an `/update-arch` skill).
  **`ARCHITECTURE.md` has NOT been refreshed for the V2 redesign or the perf passes — stale; this
  doc + CHANGELOG are more current until it is.**
- **Roadmap:** `.claude/plans/kill-the-plan-tab-eventual-bachman.md` holds the approved social plan.
- **Pre-existing lint debt (not regressions, don't "fix" casually):** `Date.now()` react-hooks/purity
  errors in a few server components; `set-state-in-effect` in onboarding-client, manage-habits,
  categorization-review-dialog.
- **Verification style:** tsc → eslint (changed files) → vitest (45) → `npm run build` → signed-out
  HTTP route smoke → after deploys, prod probes (`x-vercel-id`, TTFB). "Deploy" = commit + push `main`.
- **Runtime gotcha:** orphaned `next dev` processes can hold port 3000 after a stop — kill the PID
  (PowerShell `Stop-Process -Id <PID> -Force`) then restart.

---

## 10. Pointers

- `AGENTS.md` / `CLAUDE.md` — agent instructions (read Next docs before coding).
- `ARCHITECTURE.md` — cumulative system map (current truth).
- `CHANGELOG.md` — dated change log.
- Existing memory files: `progra_project`, `update_architecture_doc`, `supabase_auth_setup`,
  `nextjs_16_docs`, `feedback_flag_stack_issues`, `feedback_reskin_recolor_only`,
  `progra_changelog`, `social_v2_roadmap`, `supabase_storage_service_role`,
  `progra_perf_roadmap` (perf phases + conventions).
