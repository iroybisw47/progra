# Progra — Project Handoff (for Claude memory)

> **Purpose of this file.** A single, self-contained brief a fresh Claude session
> can read to reconstruct the project's durable context — what Progra is, how it's
> built, the conventions that must be followed, what's forbidden, current status,
> and how the user likes to work. Feed this to a session to seed/refresh memory.
> When code and this doc disagree, the code wins — fix the doc the same session.
>
> _Last updated: 2026-07-14. Repo: `iroybisw47/progra`. Path: `C:\Users\iroyb\Progra\progra`._

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
| Styling | Tailwind CSS v4 (PostCSS), `app/globals.css`; warm palette + Newsreader/Hanken fonts |
| Toasts | `sonner` |
| Auth + DB | **Supabase** (`@supabase/ssr`) — Postgres + RLS + Google OAuth + Storage |
| External | Google Calendar API v3 (OAuth token on the profile, refreshed on demand) |
| Deploy | **Vercel on push to `main`** (GitHub `iroybisw47/progra`). PWA via `app/manifest.ts` |
| Validation | **None** — no Zod/Yup/etc. (hand-rolled guards + DB CHECK constraints) |

---

## 3. Architecture (the core mental model)

Strict, repeating layering — learn once, every feature reads the same:

```
Browser (PWA)
  → proxy.ts (Next 16's renamed middleware) → lib/supabase/proxy.ts refreshes the
    auth cookie on every matched request. CRITICAL: no code runs between
    createServerClient and getUser() — reading cookies in between breaks refresh.
  → app/<route>/page.tsx        Server Component. Auth-gates, reads via lib/db/*,
                                 Promise.all for parallel reads, passes plain props.
  → app/<route>/<route>-client.tsx  "use client". UI + local state; calls actions.
  → app/actions/<domain>.ts     "use server". Mutations. Re-check auth → write →
                                 revalidatePath() every affected route.
  → lib/db/<domain>.ts          "server-only" READS. Map snake_case → camelCase.
                                 The ONLY place that SELECTs.
  → Supabase (Postgres + RLS)   RLS scopes every row to auth.uid().
```

- **Reads** live in `lib/db/*` (`server-only`, no `"use server"`). **Writes** live in
  `app/actions/*` (`"use server"`). A page may call `lib/db` directly; a client
  component may **only** call actions.
- **Row mapping centralized:** each `lib/db/*` owns a `rowToX` mapper + an `X_COLUMNS`
  constant so a query can't forget a column.
- **Cache invalidation explicit:** every mutation ends with `revalidatePath()` for every
  route whose data it touched.
- **Three Supabase clients:** `lib/supabase/server.ts` (server components/actions),
  `client.ts` (browser), `proxy.ts` (the cookie refresher).
- **Auth helpers** (`lib/auth/require-user.ts`): `getCurrentUser` is `react.cache`-wrapped
  (one auth round-trip/request); `requireUser()` redirects to `/login`; `getOptionalUser()`
  returns null.

---

## 4. Route map

All routes auth-gated, sharing `BottomNav` (rendered in layout only when signed in).
Social routes (`/me`, `/friends`, `/profile/[username]`, `/admin`) + the feed at `/`
are gated by `SOCIAL_ENABLED`; flag off → they 404 (or `/` falls back to the dashboard).

| Route | Server | Client | Purpose |
|---|---|---|---|
| `/` | `app/page.tsx` | — | Home. Flag off → dashboard (`components/dashboard.tsx`). Flag on → social **feed** (`components/feed.tsx`). |
| `/me` | `app/me/page.tsx` | — | "You" tab (social on): the dashboard, relocated off Home. Shows Moderation link if `is_admin()`. |
| `/friends` | `friends/page.tsx` | `friends-client.tsx` | Friend search/requests/blocked. |
| `/profile/[username]` | `profile/[username]/page.tsx` | `profile-actions.tsx` | Public profile: identity + a friend's non-private goals/habits + photo **stories**. |
| `/admin` | `admin/page.tsx` | `admin-reports.tsx` | Moderation queue — social on **and** `is_admin()` only. |
| `/onboarding` | `onboarding/page.tsx` | `onboarding-client.tsx` | First-run wizard; Home redirects here while `profiles.onboarded_at` is null. |
| `/clock` `/goals` `/habits` `/history` `/recap` `/sessions` | each `page.tsx` | each `*-client.tsx` | Tracker surfaces. |
| `/search` | `search/page.tsx` | — | Static "coming soon" placeholder (no data). |
| `/login` `/auth/callback` `/auth/signout` | routes | — | Google OAuth. |

> Note: there is **no `/calendar` route** (calendar events surface in `/history` and `/clock`).

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
- **Optimistic updates: NONE.** Universal pattern is `useTransition` → call action →
  `router.refresh()` on success (server re-renders truth); `pending` disables the control.
  A shared `run(action, {okMsg, then})` helper wraps it. No local state mutated ahead of the server.
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
- **No service-role key in user-facing paths** — none exists in the repo, keep it that way.
  Privileged power = `is_admin()`-gated `SECURITY DEFINER` RPCs, never a god-key.
- **Reads only in `lib/db/*` (`server-only`); writes only in `app/actions/*` (`"use server"`).** Never mix.
- **`"use server"` files export only async functions** — constants/types go to `lib/*` (build breaks otherwise).
- **Every mutation `revalidatePath()`s every affected route.**
- **Never write Next.js code from training-data assumptions.** This Next 16 has breaking changes;
  **read `node_modules/next/dist/docs/` first** (`proxy.ts` not `middleware`; dynamic route params
  are `Promise<{…}>` and must be awaited; etc.). `AGENTS.md` mandates this.
- **Never bypass RLS.** The app relies 100% on `auth.uid()` scoping; social reads must be provably
  DB-gated. Prove RLS/security changes with the adversarial JWT test before prod.
- **No new dependencies without asking.**
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
- **3** — `session-photos` bucket; `uploadSessionPhoto` (sharp `.rotate().resize(1600).jpeg(80)` — **the** EXIF/GPS-strip security boundary; client canvas downscale only bakes orientation); skippable before/after capture in clock flow; profile **stories** (complete-pair only — a session shows on a profile ONLY if it has both photos; **the feed is intentionally photo-free**); storage read policy `can_see_session_photo` tightened to owner/admin/non-private-complete-pair-friend.
- **4** — write-only `reports` + `report-button.tsx`; `/admin` queue gated by `is_admin()` (**no service-role key**; `admin_*` self-gating; take-down = null photo cols / delete comment); account deletion (`delete_own_account()` cascade + storage blob purge + type-to-confirm UI). 14-check admin/reports test + deletion-scoping test passed.

**Admin identity:** the user (`tapa@quantluxdigital.io`) is the sole admin; UUID
`5da4f579-b469-42cf-8dd5-de76121dd8b9` is hard-coded in `is_admin()`.

**Open items (the user's, before inviting real people):**
1. Set `NEXT_PUBLIC_SOCIAL_ENABLED=1` in **Vercel** + redeploy (build-time inlined — a plain env change won't take without a rebuild).
2. On-device dogfood (can't be driven headlessly): photo capture; account deletion end-to-end (storage emptied, signed out, fresh re-onboarding, a friend's data intact); report → `/admin` → takedown.
3. Then invite people. Deploying with the flag ON to test is low-risk while the user is the only real account.

All Phase-4 SQL is confirmed run.

---

## 9. Working relationship / preferences

- **User:** tapa@quantluxdigital.io. Personal project; solo. Works from an uncommitted tree —
  commit/push only when asked (they said "deploy" = commit all + push `main`).
- **Feedback prefs:** wants stack/platform conflicts surfaced for a decision, not worked around.
  Reskin is recolor-only. Green-lights social phases one at a time.
- **Docs workflow:** log changes in `CHANGELOG.md` (dated, newest first, `HH:MM` prefixes) as work
  happens; refresh `ARCHITECTURE.md` at the end of a feature set (there's an `/update-arch` skill).
- **Roadmap:** `.claude/plans/kill-the-plan-tab-eventual-bachman.md` holds the approved social plan.
- **Runtime gotcha:** orphaned `next dev` processes can hold port 3000 after a stop — kill the PID
  (PowerShell `Stop-Process -Id <PID> -Force`) then restart.

---

## 10. Pointers

- `AGENTS.md` / `CLAUDE.md` — agent instructions (read Next docs before coding).
- `ARCHITECTURE.md` — cumulative system map (current truth).
- `CHANGELOG.md` — dated change log.
- Existing memory files: `progra_project`, `update_architecture_doc`, `supabase_auth_setup`,
  `nextjs_16_docs`, `feedback_flag_stack_issues`, `feedback_reskin_recolor_only`,
  `progra_changelog`, `social_v2_roadmap`.
