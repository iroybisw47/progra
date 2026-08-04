# Progra — Handoff: updates 2026-07-30 → 08-03

> Supplements `HANDOFF.md` (the durable project brief, last full update 2026-07-23).
> This captures the 07-30 → 08-03 wave so a fresh Claude session can catch up fast.
> Full per-change detail is in `CHANGELOG.md` (newest first) and `ARCHITECTURE.md`
> (refreshed through this wave). When code and this doc disagree, the code wins —
> fix the doc the same session.
> All shipped to `main` (`iroybisw47/progra`).
>
> ⚠️ **Repo path changed: `/Users/ishaanroybiswas/progra`** (migrated from Windows
> to macOS 2026-07-30). Any `C:\Users\iroyb\…` path in older docs is dead.
> The previous wave (07-24 → 07-25) is folded into `ARCHITECTURE.md`/`CHANGELOG.md`.

---

## ⚠️ SQL state — read first (schema is NOT in the repo; the user runs it by hand)

**Already run, backing shipped features:**
```sql
-- 10-hour session cap: provenance + review marker. Nullable, no backfill —
-- auto_ended_at IS NULL means "the user ended this themselves".
alter table public.sessions
  add column if not exists auto_ended_at        timestamptz,
  add column if not exists auto_end_reviewed_at timestamptz;

create index if not exists sessions_auto_end_review_idx
  on public.sessions (user_id, ended_at desc)
  where auto_ended_at is not null and auto_end_reviewed_at is null;
```

```sql
-- week_leaderboard now excludes auto-ended sessions AND clamps still-running
-- ones to the cap, mirroring sessionWorkedMs. Verify with:
--   select pg_get_functiondef('public.week_leaderboard(bigint,bigint)'::regprocedure)
--     like '%auto_ended_at%', ... like '%36000000%';   -- both true
```

```sql
-- Push tokens. NOTE the table pre-existed with a PK on (user_id, token) — the
-- original `create table if not exists` silently no-opped, and there is no
-- unique index on `token` alone (so a plain upsert onConflict:"token" fails
-- 42P10). Writes therefore go through this definer RPC, which also reassigns a
-- token away from a previous owner — a delete owner-only RLS can't perform, and
-- without which a phone that changes hands keeps receiving the old account's
-- notifications.
create or replace function public.save_device_token(p_token text)
returns void language plpgsql security definer set search_path to ''
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_token is null or length(trim(p_token)) = 0 then raise exception 'token required'; end if;
  delete from public.device_tokens where token = trim(p_token) and user_id <> auth.uid();
  insert into public.device_tokens (user_id, token, updated_at)
  values (auth.uid(), trim(p_token), now())
  on conflict (user_id, token) do update set updated_at = now();
end;
$$;
revoke all on function public.save_device_token(text) from public, anon;
grant execute on function public.save_device_token(text) to authenticated;
```

**Nothing SQL-side is pending.**

---

## Features shipped

### 10-hour session cap + auto-clock-out
- A session's worked time is capped at `SESSION_CAP_MS` (10h) in `lib/session.ts`.
  The live timer freezes at `10:00:00`; `autoClockOut()` (`app/actions/sessions.ts`)
  ends the row at `sessionCapEndMs` = `startedAt + cap + pausedMs`.
- **Cap basis is WORKED time, pauses excluded** — a paused session freezes below
  the cap and can never trip it.
- **An auto-ended session is worth ZERO worked time, everywhere** (changed
  2026-08-03 from "counts as exactly 10h"). `sessionWorkedMs` returns 0 when
  `autoEndedAt` is set, so goals, recaps, rollups, feed and leaderboard agree with
  no per-surface rule. Hitting the cap means a clock-out was missed, so the hours
  aren't real. Read-time rule over `auto_ended_at` — clearing the column restores
  the time. Recovery path: delete the session on `/clock/finish` and re-add the
  real hours as a past session (an ordinary row, counts in full).
- No cron exists. Enforcement is lazy via `<EnsureSessionCap/>` in the root layout
  (the `EnsureProfileSync` pattern) — zero writes on normal loads, an exact
  `setTimeout` for the crossing, `visibilitychange` re-check for suspended tabs.
- `listClockedInNow` drops over-cap sessions: your client never writes to a
  *friend's* row, so a forgotten clock-out would otherwise sit in the strip
  forever, frozen at 10:00:00, reading as actively working.
- `sessionAttributionEnd` replaced six independent `endedAt ?? now` sites so the
  day/week bucket doesn't move when the write lands.

### Native iOS app (Capacitor) + Google sign-in
- `capacitor.config.ts` sets `server.url = https://progra.world` — the shell is a
  **thin webview over production**, so the same client bundle serves both, and
  **JS changes ship via Vercel with no Xcode rebuild**. Native/plugin/Info.plist
  changes DO require `npx cap sync ios` + an Xcode build.
- Sign-in uses the **OS Google account picker**, not a browser:
  `SocialLogin.login()` (`@capgo/capacitor-social-login`) → idToken →
  `signInWithGoogleIdToken` (`app/actions/native-auth.ts`) calls
  `supabase.auth.signInWithIdToken()` **server-side** → `claim_invite` for `?ref=`
  → hard navigate. Server-side because the Supabase server client writes the
  session as a real `Set-Cookie`; the browser client writes via `document.cookie`,
  which WKWebView flushes lazily and can drop.
- Config (all four, or sign-in fails with an audience error): a Google Cloud
  **iOS** OAuth client for bundle `world.progra.app`; that id in
  `NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID` (local + Vercel); its **reversed** form in
  `Info.plist` `CFBundleURLTypes`; the id in Supabase → Auth → Providers → Google →
  Authorized Client IDs. All currently done.

### Push notification registration
- `<PushRegistration/>` (root layout, gated on `user`) requests permission,
  registers, and calls `saveDeviceToken`. Listeners attach **before** `register()`
  — the `registration` event fires asynchronously and attaching after can miss it.
  `register()` runs only on an explicit grant.
- `App.entitlements` is `aps-environment: development` — needs `production` for
  TestFlight/App Store.

### Refer a friend
- Navy CTA on Progress → Today (between the donut and Sessions today) → `/refer`,
  which reuses `InviteShare` (the same component onboarding's invite step uses).
  Deliberately NOT `/i/{username}` — that's the public landing the *recipient*
  sees, and opening your own bounces to `/me`.
- Behind `NEXT_PUBLIC_REFER_ENABLED`. Build-time inlined, so flipping needs a redeploy.

### One session card across Feed / You / profiles
- `components/v2/session-card.tsx` (extracted from FeedV2's inline JSX) now renders
  all three. `ProfileSessionItem` IS `SessionCardItem`, so the readers can't drift.
- Fixed a data bug: `listProfileSessions` only hydrated goal titles, so
  category-tracked sessions had no attribution at all. Now reuses the feed's
  `resolveFeedAttribution` + `hydrateCategoryNames` — the former encodes a privacy
  rule (a *private* goal yields no chip rather than falling through to a category
  name), so it must never be reimplemented.
- Author header omitted on You/profiles (the page already says whose it is);
  private sessions show a lock chip instead of the likes/comments row.

---

## New / notably-changed files
- `lib/session.ts` — `SESSION_CAP_MS`, `isOverSessionCap`, `sessionCapEndMs`,
  `sessionAttributionEnd`; `SessionTiming` gained an **optional** `autoEndedAt`
  (live surfaces pass a minimal payload for a session that can't be auto-ended).
- `components/ensure-session-cap.tsx`, `components/push-registration.tsx` (new
  root-layout client leaves, both no-ops until they have work).
- `app/actions/native-auth.ts`, `app/actions/device-tokens.ts` (new).
- `lib/native.ts` (`isNativeApp()`, imports `@capacitor/core`) and
  `lib/native-auth.ts` (`GOOGLE_IOS_CLIENT_ID`, **no** Capacitor import — a
  `"use server"` action needs it; keep them separate).
- `components/v2/session-card.tsx`, `components/v2/refer-friend-button.tsx`,
  `components/v2/auto-end-nudge.tsx`, `app/refer/page.tsx` (new).
- `components/profile-session-card.tsx`, `components/native-auth-listener.tsx`
  (**deleted** — see open threads).
- `ios/` scaffold, `capacitor.config.ts`.

---

## Open threads / known state (read before touching related code)

- **`forcePrompt: true` in `SocialLogin.login()` is LOAD-BEARING, not a UX
  preference.** `GoogleProvider.swift` branches on
  `hasPreviousSignIn() && !forceAuthCode`; the `restorePreviousSignIn()` side
  **never passes our nonce** and returns a cached token. Once a device has signed
  in that branch is taken forever, so removing this breaks sign-in for every
  returning user while first-time sign-in still works — brutal to diagnose cold.
- **Do NOT reintroduce browser-based OAuth on native.** It failed every time with
  Supabase's `flow_state_not_found` across four fixes. `ARCHITECTURE.md` §7.1
  records the full history. The nonce pairing is SHA-256 (hex) → Google, **raw** →
  Supabase; omitting a nonce also fails, since GIDSignIn mints its own.
- **Calendar connect is BROKEN on native.** `/auth/google-calendar` server-redirects
  straight to `accounts.google.com`, which the webview hits as an embedded
  user-agent and Google refuses. Its fix differs from sign-in's: it sets an
  `httpOnly` CSRF nonce cookie and exchanges tokens server-side, so the deep link
  must re-enter the server route. Unfixed, documented.
- **`device_tokens` has a composite PK `(user_id, token)`**, not a unique `token`.
  The table pre-existed, so the original `create table if not exists` no-opped —
  it has no `id` or `created_at` either. A plain upsert on `token` fails 42P10, so
  writes go through the `save_device_token` definer RPC, which also deletes any
  prior owner's claim on that token. Don't "simplify" it back to a direct upsert:
  that reassignment delete is what stops a reassigned phone receiving the previous
  account's pushes, and owner-only RLS cannot do it.
- **The custom URL scheme `world.progra.app://` is still registered** in
  `Info.plist` but nothing uses it now that the deep-link auth listener is gone.
  Harmless; don't wire auth back onto it.
- **`.claude/` is gitignored except `.claude/commands/`** (changed this wave so
  slash commands survive machine moves). `.sentinel.yaml` did NOT survive the
  migration — the agent-runtime guard `ARCHITECTURE.md` §9 describes is not active.
- **Baselines for verification:** `npm test` = **73 passing**; `npm run lint` = **10
  pre-existing errors** (must not grow — they're all `react-hooks/set-state-in-effect`
  and `Cannot call impure function`, none introduced this wave); `tsc --noEmit` and
  `npm run build` clean.
- Conventions unchanged from `HANDOFF.md` §3/§6 (reads in `lib/db/*` with `cache()`,
  writes in `app/actions/*` ending in a `lib/revalidate.ts` helper, RLS as the
  security authority). Everything new this wave follows them.
