# Changelog

A running log of changes, grouped by date (newest first). Section headings are
prefixed with the commit time (local, `HH:MM`) the work landed — a proxy for
when it was done, not a start/stop work timer.

## 2026-08-15

### · Editorial redesign — eight screens rebuilt against the new design package
The whole app moves onto the design handoff's flat, paper-like language: white
screens split by hairlines and 10px uppercase section labels instead of stacked
shadcn cards, Newsreader for headings and display numbers, Hanken Grotesk for UI
text, and a nine-color accent palette that every category, goal and habit draws
from and keeps everywhere it appears.

Screen by screen: **Progress** (donut + serif week total + legend, session rows,
a one-tap habit pill grid, goal quota rows; Today/Week replace the three
sub-tabs and the Sessions header links to /history); **Clock** (compact clock-in
form with folded note + two expanding chips, navy CTA, and everything else moved
to an inset quiet zone) and the **live timer** (224px ring in the session's own
color with a 40px serif elapsed time); **Feed** (flat divider-separated posts,
tinted initials avatars, kudos/comment pill group); **Friends** (search,
requests, expandable leaderboard rows with per-goal bars and a "resets in" clock,
friends list); **You** and the **friend profile** (identity block, serif stats,
shared goal/habit components, compact date-grouped session rows); and a rebuilt
**onboarding** — eight steps including a fast-forwarded practice clock-in and a
practice post, with the goal and picked habits created for real.

Notable non-visual bits: `goalColor()` derives a stable palette hue from a goal's
id (goals have no color column), the category picker now offers the nine palette
colors while the previous twelve stay valid on write, and `LeaderboardGoal`
carries its goal id so a goal looks the same on every surface. Settings was left
alone at the user's request.

## 2026-08-03

### · Push token writes go through a definer RPC — **SQL run**
Probing production turned up that `device_tokens` already existed with a PK on
`(user_id, token)`, so the feature's own `create table if not exists` had
silently no-opped: no `id`, no `created_at`, and **no unique index on `token`
alone**. `saveDeviceToken`'s `upsert(onConflict: "token")` would have failed
`42P10` on every registration — push had never once succeeded.

Rather than reshape a production table, writes now route through
`save_device_token` (SECURITY DEFINER), which works with the existing PK and
fixes the sharper problem the composite key creates: a phone used by two
accounts would otherwise keep **both** rows, so the previous user's
notifications keep arriving on a device that isn't theirs. The RPC deletes any
other user's claim on the token first — a cross-owner delete owner-only RLS
cannot perform.

Hardened the way the other definer functions are: no user-id parameter (the
caller comes from `auth.uid()` internally, so it can only ever act for itself),
`set search_path to ''` with everything schema-qualified, and
`revoke ... from public, anon` since definer functions are `EXECUTE`-to-`PUBLIC`
by default. Verified anon gets `42501 permission denied`.

### · Auto-ended sessions are worth ZERO hours, everywhere — **requires SQL**
Changed from "a capped session counts as exactly 10h". Hitting the 10-hour cap
means a clock-out was missed, so the hours aren't real and shouldn't earn goal
progress, recap totals or leaderboard rank.

- `sessionWorkedMs` returns 0 when `autoEndedAt` is set. Enforcing it in the one
  source of truth is what keeps goals, recaps, rollups, feed and profile cards
  agreeing without a per-surface rule.
- `SessionTiming` gained an **optional** `autoEndedAt`. Optional on purpose: live
  surfaces (nav ticker, clocked-in strip, running timer) build a minimal payload
  for a session that is by definition still active, and an active session can
  never be auto-ended — so omitting it is always correct there, and no call site
  needed changing.
- Not punitive, and not a data rewrite: it's a read-time rule over
  `auto_ended_at`. The finish screen's review flow lets you delete the session and
  re-add the real hours as a past session — an ordinary row with no
  `autoEndedAt`, which counts in full. Clearing the column also restores the time.
- Finish-screen copy now says the session counts as 0 and how to recover the
  hours; without it the big "0s" reads as a bug.
- Two consequences worth knowing: the auto-clock-out write is **no longer
  visually a no-op** — your weekly total drops by up to 10h when it lands, which
  is the intended signal but looks abrupt the first time. And 4 new tests cover
  the rule (73 total, was 69).

**SQL — `week_leaderboard` is the one surface that computes its own totals**, so
it needs the same rule or it disagrees with everything else. Two edits to the
`sess` CTE, body otherwise byte-identical (dump first with `pg_get_functiondef`;
it's `SECURITY DEFINER` and carries the `auth.uid()`-derived circle isolation):

```sql
-- 1. exclude auto-ended sessions, in the WHERE clause
and s.auto_ended_at is null

-- 2. clamp STILL-RUNNING sessions to the cap, wrapping the sum's expression.
--    auto_ended_at is only set once a session ends, so without this a friend
--    who is over 10h but hasn't been swept yet (they haven't opened the app)
--    still ranks on the full uncapped total — the exact abuse case the cap
--    exists to stop. Mirrors sessionWorkedMs's active-session clamp.
least(
  greatest(0, <existing expression>),
  case when s.ended_at is null then 36000000::bigint
       else 9223372036854775807::bigint end
)
```

### · Native sign-in working — the nonce fix
Two things stood between the rebuilt picker flow and a working sign-in, and the
first masked the second for several rounds.

**`forcePrompt: true` is load-bearing.** `GoogleProvider.swift` branches on
`hasPreviousSignIn() && !forceAuthCode`, and the `restorePreviousSignIn()` side
**never passes our nonce** — it returns a cached token carrying a nonce we never
chose. Once you've signed in on a device that branch is taken forever, so no
nonce value could ever match and sign-in failed permanently with "nonces
mismatch". `forcePrompt` sets `forceAuthCode`, forcing the branch that honours
the nonce, and restores the account picker lost when moving off the browser flow.

**The pairing is SHA-256 (hex) to Google, raw to Supabase** — the standard OIDC
arrangement `auth-js` documents and Apple's flow uses. Omitting the nonce fails
too ("passed nonce and nonce in id_token should either both exist or not"),
because GIDSignIn mints its own when none is supplied.

The debugging is the transferable part. Three pairings were tried and each
"disproved" a hypothesis — but every measurement was taken against a **cached**
token, so none of them proved anything. What actually settled it was surfacing
the token's real `nonce` claim on-device: 43 base64url chars, i.e. 32 random
bytes, which a quick check showed was not our hash in another encoding
(`base64url(ours)` = `6HNDjtpJ…` vs claim `BPmbhKiF…`). Unrelated values ruled
out an encoding mismatch and pointed straight at the Swift branch. That
diagnostic should have gone in three attempts earlier instead of reasoning from
documentation about state that wasn't observable.

The nonce diagnostic now logs server-side rather than surfacing in the UI.

### · Native sign-in rebuilt on the OS Google picker — **requires dashboard + Xcode work**
The browser-based OAuth flow never worked in the iOS shell. It failed every time
with Supabase's `flow_state_not_found`, and four fixes did not move it: a
module-scoped in-flight guard, `signOut({ scope: "local" })` before the flow,
moving the exchange server-side, then moving the *verifier write* server-side.
An on-device diagnostic finally showed the verifier cookie **and** the auth code
were both present and correct at exchange time — which exhausted every
explanation reachable from this codebase, since `flow_state_not_found` is a
Supabase **server** error about its own `auth.flow_state` record, not a
complaint about our cookie.

So the apparatus is gone rather than patched again. No browser hop, no auth code,
no flow state, no code_verifier, no deep link.

- `@capgo/capacitor-social-login` (peer `>=8.0.0`, matches our Capacitor 8; the
  common `@codetrix-studio` plugin is Capacitor 6-only and
  `@capacitor-firebase/authentication` would drag in a whole Firebase project).
- `google-sign-in-button.tsx` native branch: `SocialLogin.login()` shows the OS
  account picker and returns a Google **idToken**. Web branch untouched.
- `app/actions/native-auth.ts`: `signInWithGoogleIdToken` calls
  `supabase.auth.signInWithIdToken()` **server-side**, then `claim_invite` for
  `?ref=`, and returns a `safeNextPath`-resolved destination the client
  hard-navigates to. Server-side because the Supabase server client writes the
  session as a real `Set-Cookie` header (WebKit commits it immediately) whereas
  the browser client writes via `document.cookie`, which WKWebView flushes
  lazily — and every page here is server-rendered from that cookie.
- Deleted `components/native-auth-listener.tsx` and its layout mount. With no
  deep link in the auth path it was dead code, and leaving it would invite
  reintroducing the flow that failed.
- Missing-config failure is explicit: a blank `NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID`
  throws a named error instead of an opaque native one.

**Config, all four required or sign-in fails with an audience error:** a Google
Cloud **iOS** OAuth client for bundle `world.progra.app`; that id in
`NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID` (local + Vercel); its **reversed** form in
`Info.plist` `CFBundleURLTypes`; and the id in Supabase → Auth → Providers →
Google → Authorized Client IDs.

**Unlike every previous fix, this needs a new iOS build** — `npx cap sync ios`
plus an Xcode rebuild. The webview-only deploy path isn't enough once a native
plugin is involved.

ARCHITECTURE §7.1 records why the browser flow was abandoned, so it doesn't get
reintroduced.

## 2026-07-31

### · Native Google sign-in (Capacitor iOS) — **requires a Supabase dashboard change**
Sign-in was broken in the new iOS shell. `capacitor.config.ts` points the webview
at `https://progra.world`, and Google **refuses OAuth inside an embedded webview**
(`disallowed_useragent`) — so letting Supabase navigate the current window to
`accounts.google.com`, which is what the web flow does, dead-ends in the app.

Native now opens consent in the **system browser** and returns through the custom
scheme already registered in `Info.plist`:

- `lib/native.ts` — `isNativeApp()` (window-guarded, since these components are
  still server-rendered) and `NATIVE_AUTH_REDIRECT`. The same client bundle
  serves the website and the app, so every native branch gates on this.
- `google-sign-in-button.tsx` — native branch uses
  `signInWithOAuth({ skipBrowserRedirect: true })` to get the consent URL without
  navigating, then `@capacitor/browser`'s `Browser.open()`. The redirect target is
  built by hand: the WHATWG URL parser mangles custom schemes, so `new URL()` +
  `searchParams` isn't safe there. Loading state releases after the sheet opens so
  cancelling doesn't strand the button. **Web path unchanged.**
- `components/native-auth-listener.tsx` — mounted app-wide in the root layout,
  deliberately **not** gated on `user` (the visitor is signed out at the moment it
  must be listening). Closes the sheet, then `exchangeCodeForSession(code)` — the
  auth *code* parsed off the query, not the URL — then replays the web route's
  behavior: `claim_invite` for `?ref=` (failures swallowed; attribution must never
  block sign-in) and a hard `window.location.assign(safeNextPath(next))`.
- Plugins are dynamically imported inside handlers, keeping native-only code out
  of the web bundle and off the SSR path.
- `@capacitor/cli` moved to `devDependencies` — it was in `dependencies`, so
  Vercel installed it on every build.

**Why the client-side exchange is sound:** the webview's origin *is*
`progra.world`, so cookies `createBrowserClient` writes are first-party and the
Next server reads them on the next navigation. On a bundled build
(`capacitor://localhost`) they'd be cross-origin and this wouldn't work.

`app/auth/callback/route.ts` is untouched — web still uses it. No SQL.

**Dashboard step (blocks native sign-in):** add
`world.progra.app://auth/callback` to Supabase → Authentication → URL
Configuration → Redirect URLs. Supabase refuses to redirect to an unlisted
target, so without it consent completes and dead-ends. Google Cloud Console needs
no change.

**Known gap:** Calendar connect (`/auth/google-calendar`) is still broken on
native for the same embedded-webview reason. Its fix differs — that flow sets an
`httpOnly` CSRF nonce cookie and exchanges tokens server-side, so the deep link
has to re-enter the server route rather than exchange client-side.

## 2026-07-30

### · 10-hour session cap + auto-clock-out — **requires SQL (run by hand)**
Nothing bounded a session's length. `sessionWorkedMs` had a floor and no ceiling,
so a forgotten clock-out rendered as `168:00:00`, and because a session is
attributed to the single instant of its end, that runaway total slid forward day
by day into whatever week it finally ended in. With ~5 beta users and a friend
leaderboard that counts active sessions, it was a fairness problem too.

A session's **worked time** (pauses excluded) can now never exceed 10 hours.
The live timer freezes at `10:00:00` and the session is closed out at the instant
the cap was hit — saved **private**, never auto-posted to the feed.

- **`lib/session.ts`** — new `SESSION_CAP_MS`, plus `isOverSessionCap`,
  `sessionCapEndMs`, `sessionAttributionEnd`. The clamp in `sessionWorkedMs`
  applies **only to active sessions**, so historical rows read back exactly as
  stored: no backfill, no rewritten past totals. It works because
  `sessionCapEndMs = startedAt + cap + pausedMs` is precisely the end instant
  that makes a row read back at exactly the cap.
- **Attribution unified** — `sessionAttributionEnd` replaces six independent
  `endedAt ?? now` computations (4× `lib/aggregate.ts`, `app/goals/page.tsx`,
  and a verbatim duplicate deleted from `clock-client.tsx`). Effect: the
  auto-clock-out write is *visually a no-op* — no total moves when it lands.
- **`autoClockOut()`** takes no arguments by design; it recomputes from the
  stored row and the server clock, so a wrong or hostile client clock can neither
  trigger it early nor suppress it. `paused_ms` is written back unchanged (an
  in-progress pause can only have begun after the crossing). Guarded with
  `.is("ended_at", null)` so racing tabs produce exactly one write. Uses the full
  `revalidateSessionSurfaces()` — unlike Stop, `/clock/live`'s redirect guard
  *should* fire here.
- **`<EnsureSessionCap/>`** in the root layout, following `EnsureProfileSync`:
  zero authed writes on normal loads. No `useNow` subscriber — an exact
  `setTimeout` crosses the cap live without an extra render, with a
  `visibilitychange` re-check for suspended mobile tabs. There's no cron, so
  enforcement is lazy by design; until the write lands every surface already
  shows the clamped value, so nothing lies in the meantime.
- **Review path** — new nullable `auto_ended_at` / `auto_end_reviewed_at`
  (`is_private` alone can't tell an auto-end from a deliberate draft). Banner on
  `/clock/finish` and a muted nudge on Progress → Today via `getUnreviewedAutoEnd()`.
- Manual entries over 10h (`createSession`, "Add past session") stay uncapped —
  the cap governs auto-accruing live sessions, not user-entered history.
- 16 new tests in `lib/session.test.ts` (69 total, was 53).

```sql
-- Additive and idempotent. No UPDATE: historical rows are untouched.
alter table public.sessions
  add column if not exists auto_ended_at        timestamptz,
  add column if not exists auto_end_reviewed_at timestamptz;

create index if not exists sessions_auto_end_review_idx
  on public.sessions (user_id, ended_at desc)
  where auto_ended_at is not null and auto_end_reviewed_at is null;

notify pgrst, 'reload schema';
```

**Outstanding:** `week_leaderboard` re-implements worked-time math in SQL *and
counts active sessions*, so until its body is patched a friend's runaway session
shows a frozen `10:00:00` while ranking on the uncapped total. Dump it with
`pg_get_functiondef`, wrap the per-session expression in
`case when s.ended_at is null then least(…, 36000000) else … end` (active-only,
mirroring the TS clamp), then re-run the adversarial JWT check.

## 2026-07-27

### · Calendar connect moved out of onboarding, into History
The redesign onboarding wizard loses its **calendar step** — now 6 steps
(welcome→about→goal→categories→habits→invite). Removed from `onboarding-client-v2.tsx`:
the step, its script/copy, `CalendarBody`, the Connect CTA + "Skip for now", the
`?step=calendar&status=` deep-link props/toast, and `SHOW_UNVERIFIED_WARNING`;
`onboarding/page.tsx` sheds the searchParams plumbing. `lib/google/connect.ts`:
`ConnectFrom` is now `"history" | "settings"` and `returnPath` sends
`/history?calendar=connected|error`; the OAuth route (`app/auth/google-calendar/route.ts`)
drops its write-once `onboarded_at` stamp (existed only for the onboarding entry).
**History (month/year views) is now the calendar surface**: when disconnected, the sync
slot shows a **Connect Google Calendar** CTA (`?from=history`, with the unverified-app
note) and the OAuth flow returns to History with a one-shot toast (settings-client
pattern); when connected, the existing `SyncCalendarButton`. `history/page.tsx` computes
`isCalendarConnected` + the return status and passes both through `HistoryClient`.
Settings' connect/disconnect row unchanged; `syncCalendar`'s not-connected error copy now
mentions History. **No SQL required.**

### · Finish screen becomes a compose step (notes + photo + delete before Post)
Stopping the clock no longer publishes instantly. `clockOut` and `editActiveSessionTime`
gain a `draft` flag (passed only by the redesign live timer — legacy flow and onboarding
still publish at clock-out) that marks the ended session `is_private = true`, so it stays
hidden from friends until the finish screen's **Post** applies the chosen visibility
(public by default; "Save privately" keeps it hidden). Existing RLS + the
`can_see_session_photo` storage policy already gate on `NOT is_private`, so drafts and
their photos are structurally invisible — **no SQL required**. `/clock/finish` grows an
editable **Notes** card (prefilled from in-session notes), an **Add photo** option
(`uploadSessionPhoto`'s ended-session guard relaxed to "ended AND public" — uploads stay
inside the friend-unreachable window), and a **Delete session** button behind an
`AlertDialog` for accidental clock-ins. Abandoning the screen leaves the session saved
but private (indistinguishable from deliberately-private; an "unposted" nudge would need
a `posted_at` column — out of scope). Hardening: `updateSession`/`deleteSession` now
check `getCurrentUser` + `.eq("user_id", …)` + a 0-row guard (previously RLS-only, where
a stale/foreign id silently "succeeded"), matching `uploadSessionPhoto`'s pattern.

## 2026-07-25

### · Weekly Recap — Phase 6c (moderation)
Recap posts are now reportable + takedown-able. `"recap"` added to `ReportTargetType`
(`lib/social/reports.ts`) + the action's `TARGET_TYPES` + the `reports.target_type` DB CHECK.
A **Report** flag sits in the recap feed card's social footer (`ReportButton targetType="recap"`).
New `admin_take_down_recap` RPC (deletes the recap_posts row — cascades its reactions/comments)
+ `takeDownRecap` admin action; the admin moderation queue (`app/admin/page.tsx` +
`admin-reports.tsx`) gains a `recap` target arm — preview (week + hours + owner) and a
"Take down recap" button. **Requires SQL** (CHECK update + `admin_take_down_recap`; and the
`admin_list_reports` RPC extended to embed the recap preview — run by hand).

### · Weekly Recap — Phase 6b (reactions + comments on recap posts)
Kudos + comments on posted recaps, via **parallel tables** (`recap_reactions` /
`recap_comments`) — chosen over a polymorphic migration so the live session social tables,
RLS, `toggle_reaction` RPC, and notification joins stay untouched. Mirrors the session
machinery: a `can_see_recap` SECURITY DEFINER helper (owner-or-accepted-friend, like
`can_see_session`), a `toggle_recap_reaction` RPC (atomic insert-or-delete, re-checks
visibility + emoji), reactions readable-only (writes via the RPC), comments insert-own-on-
visible / delete-own-or-recap-owner. New `lib/db/recap-social.ts` (`listRecapKudos`,
`listRecapComments`, batch-loaded in `feed-v2` alongside the session ones) + `app/actions/
recap-social.ts` (`toggleRecapKudos`, `addRecapComment`, `deleteRecapComment`). The recap
feed card grows a social footer: `RecapKudosButton` (optimistic heart, mirrors `KudosButton`)
+ an inline `RecapComments` thread + composer. **Requires SQL** (both tables + helper + RPC +
RLS + indexes — run by hand). Moderation is 6c.

### · Weekly Recap — Phase 6a (post to feed — the recap card)
Recaps can now be posted to the friends feed. New `recap_posts` table (own row, never a
synthetic session — can't contaminate aggregation) stores a **denormalized summary**
(total tracked ms, clocked rank, circle size, top categories jsonb, caption) so the feed card
renders without recomputing. New `postRecap(weekStart, caption)` action (`app/actions/recap.ts`)
computes the week server-side and upserts on `(user_id, week_start_ms)` — re-posting a week
updates rather than duplicates. The story's final panel gains a caption box + "Post to feed"
(alongside Share). `lib/db/feed.ts` adds a `RecapFeedItem` (`kind:"recap"`) to the `FeedEntry`
union + `listRecapPosts` (friends-only, rolling 7-day window, mirrors `listFriendJoins`);
`feed-v2.tsx` merges/sorts it in and renders the new `components/v2/recap-feed-card.tsx` —
a distinct *"{name} uploaded their weekly recap!"* card over a navy-tinted summary. The legacy
flag-off `feed.tsx` is narrowed to its two kinds (recaps are redesign-only). **Reactions +
comments on recap posts are Phase 6b** (parallel `recap_reactions`/`recap_comments` tables —
chosen over a polymorphic migration to keep the live session social tables untouched).
Moderation is 6c. **Requires SQL** (recap_posts + RLS — run by hand).

### · Weekly Recap — Phase 5 (shareable image)
The final story panel now shares a real **1080×1080 PNG**, not just text. New OG route
`app/recap/[weekStart]/card/route.tsx` renders the week's summary (navy card: total tracked
hours, top categories with swatches, rank among friends, `progra.world`) via `next/og`'s
`ImageResponse` — the first `ImageResponse` in the app, on the default Node runtime so it
reuses `computeWeekRecap` + `getWeekLeaderboard` + auth. Satori constraints honored (flexbox
only, `display:flex` on every multi-child node, concrete hex swatches since it can't resolve
CSS vars). The Share button (`recap-story.tsx`) now fetches that PNG and shares it as a
`File` via the Web Share API (`navigator.canShare({files})`), with graceful fallbacks:
image download on desktop browsers, then plain-text share → clipboard if generation fails.
No SQL, no new deps (`next/og` ships with Next 16).

### · Weekly Recap — Phase 4 (empty / first-week / edge polish)
Hardens the story for real-world edges. (1) The Progress nudge no longer fires for a week
the user wasn't around for — `loadProgressData` suppresses it when the target week ended
before the account's `created_at`, so a brand-new user isn't pointed at an empty pre-signup
recap. (2) The number panel shows a calm "A quiet week — a fresh start begins Monday" instead
of a literal "0s" when nothing was tracked. (3) The rank panel shows "You sat this one out —
clock in next week" (still listing the circle) when you clocked nothing, instead of a hollow
"#N". The existing solo-circle fallback, zero-goals, and zero-category empty states are
unchanged. No SQL, no new deps.

### · Weekly Recap — Phase 2b (the "Your rank" panel)
Wires the leaderboard into the story. `/recap/[weekStart]/page.tsx` now fetches
`getWeekLeaderboard` in parallel with the recap and passes it to `recap-story.tsx`, which
grows to **five panels** — the rank panel slots in at index 3 (between Goals and the card).
It shows your big `#rank` + "of N in your circle", then the ranked list (avatar · name ·
clocked time), your row highlighted. Solo circles (no friends, or nobody else clocked in)
get a "you're flying solo — invite friends" nudge instead of a lonely 1-of-1. (Phase 4
refines the empty/edge copy.)

### · Weekly Recap — Phase 3 revised: leaderboard ranks CLOCKED SESSIONS ONLY
The leaderboard now excludes imported calendar events — it ranks time you actively clocked,
not a packed calendar. The RPC's events CTE + `event_exclusions` anti-join were removed;
session math (pause handling, `now` capped at week end, private-for-owner-only) is unchanged.
**Consequence:** the leaderboard total intentionally no longer equals `computeWeekRecap`'s
`totalTrackedMs` (which counts events) — it's a distinct "clocked focus time" metric. Surfaced
during Phase 3 verification when a friend's 34h turned out to be an imported calendar.

### · Weekly Recap — Phase 3 (circle leaderboard RPC)
The "Your rank" data layer. New `week_leaderboard(p_week_start_ms, p_week_end_ms)`
SECURITY DEFINER function ranks the caller + their accepted friends by total tracked time.
It takes **only** the week bounds and derives the circle from `auth.uid()` + the
`friendships` table — there is no user-id parameter, so a caller can never rank against
anyone outside their own accepted friends (structural isolation). The math replicates
`aggregateRange`/`sessionWorkedMs` exactly (per-endpoint ms truncation, banked + in-progress
pause, `now` capped at week end) plus the `event_exclusions` anti-join, so the caller's own
row reconciles with `computeWeekRecap`'s `totalTrackedMs` — exactly for a closed week.
**Privacy:** a friend's private sessions count only for the owner (`user_id = auth.uid() OR
NOT is_private`), matching the feed's `are_friends AND NOT is_private` visibility — no leaking
the aggregate of hidden sessions. `lib/db/leaderboard.ts` (`getWeekLeaderboard`, cache()'d)
wraps the RPC and derives avatar URLs. **Requires SQL** (the function + grants — run by hand).
Wiring into the story's rank panel is Phase 2b.

### · Weekly Recap — Phase 2a (`/recap/[weekStart]` full-screen story)
The recap itself: a full-screen, swipeable story. New dynamic route
`app/recap/[weekStart]/page.tsx` (`force-dynamic`, `requireUser`, resolves the window via
`weekWindow` — snapping any date to its Monday, falling back to the current week for junk
params) feeds `recap-story.tsx`, a `motion`-driven client sequence of **four panels**: (1)
**The number** — a count-up of `totalTrackedMs` in human format (`animate()` onUpdate, honors
reduced motion); (2) **Where it went** — the shared `CategoryDonut`; (3) **Goals** —
`GoalProgressBar` rows + highlights; (4) **Your week, in a card** — the existing `RecapCard`
+ a working text Share (Web Share API → clipboard fallback). Navigation is swipe (pointer) +
footer Back/Next + tappable progress pips + arrow keys + Escape; a close X returns to
Progress. Opening the route marks the week seen (`markRecapOpened` on mount, idempotent with
the nudge's mark), so a direct link also clears the nudge. The Progress nudge now links to
`/recap/{weekStart}` (was the interim `/recap?w=`). **Adds `motion` (framer-motion's current
package) — the first new runtime dependency.** The "Your rank" leaderboard panel is Phase 2b
(inserts at index 3 once the Phase 3 RPC exists); the shareable *image* is Phase 5, posting
to the feed Phase 6. Empty/first-week polish is Phase 4.

### · Weekly Recap — Phase 1 ("your week is ready" nudge on Progress)
The recap ritual's entry point. A tappable "Your week is ready" banner appears at the top
of Progress (above the Today/Week/History tabs) once the most recent week's recap has
unlocked — Sunday 6pm in the user's own timezone (`isRecapReady` from Phase 0) — and it's
still unopened. It targets the current week on Sunday evening, then the just-ended week once
a new week begins, so an **unopened nudge persists into the new week** until opened. Tapping
marks the week opened (across devices) and opens the recap (interim: the existing `/recap?w=`
route; Phase 2 swaps in the full-screen story). New: `recap_views` table (`(user_id,
week_start_ms)` PK, owner-only RLS, INSERT+SELECT) with `lib/db/recap-views.ts`
(`hasOpenedRecap`, folded into `loadProgressData`'s parallel wave — no extra latency wave)
and `app/actions/recap.ts` (`markRecapOpened`, resolves the tz-correct `week_start_ms`
server-side via `weekWindow` so it always matches what the nudge checked). `components/v2/
recap-nudge.tsx` is the client banner (best-effort mark → navigate). Emptiness / first-week
suppression is deferred to Phase 4. **Requires SQL** (recap_views table + RLS — run by hand).

### · Weekly Recap — Phase 0 (week-window helper + Sunday-6pm gate math)
Foundation for the Weekly Recap feature (plan: `.claude/plans/weekly-recap.md`). Purely
additive to `lib/dates.ts`; no route/component/SQL changes. New `weekWindow(tz, weekStart?)`
→ `{ weekStartISO, weekStartMs, weekEndMs }` centralizes the Monday→Sunday window that
Progress home and `/recap` each inlined, so the recap widget, the `/recap/[weekStart]`
route, and the leaderboard RPC caller all agree on one boundary. New `recapReadyMs(weekStart,
tz)` / `isRecapReady(...)` compute when a week's recap unlocks — Sunday 6pm in the user's own
timezone — resolved via the same two-pass offset technique as `zonedDayStartMs` so it lands
on 6pm wall-clock even across a DST transition (a naive `midnight + 18h` is an hour off on
spring-forward Sundays; tested against LA's 2026-03-08 spring-forward, which is a Sunday).
8 new unit tests in `lib/dates.test.ts` (west/east-of-UTC + boundary + DST). Existing callers
(`loadProgressData`, `/recap`) left untouched — Phase 1+ adopts the helper.

### · Invite links — PR 2 (onboarding invite step + empty-feed share)
Surfaces the invite link (PR 1's `/i/{username}`) at two moments. New shared client
component `components/v2/invite-share.tsx`: a Share button (Web Share API, reusing the
`recap-client` pattern) + a Copy-link row; the actual URL is built from
`window.location.origin` at click time (hydration-safe, no effect). Onboarding
(`onboarding-client-v2.tsx`) gains a new final **invite** step after calendar with
witnessing copy ("they'll see you show up… keep each other honest") + the share card +
an "Enter Progra" finish (the finish action moved off the calendar step, which now
advances to invite); the top-right skip is hidden on the invite step. The empty-feed
state (`feed-v2.tsx`) now shows the same share card (viewer handle via cached
`getProfile`) plus a subtle "find people already on Progra" link. No new SQL. Copy is
witnessing-only (no leaderboard/recap-post promise); suggested-friends reuse and
recap-posting are deferred.

### · Invite links + referral attribution — PR 1 (code)
A logged-out stranger can open `/i/{username}`, sign up with Google, and land already
friends with the inviter, with `profiles.referred_by` recorded. New public route
`app/i/[username]/page.tsx` (+ `loading.tsx`) — no auth gate (`getOptionalUser`), reuses
`getPublicProfileByUsername`; handles all four caller states (logged-out landing ·
logged-in-other → claim + `/profile` · self → `/me` · unknown handle → a public
"invite not found" card, not `notFound()`). The inviter rides through OAuth as a `?ref=`
query param: `GoogleSignInButton` gained a `referrer` prop (named `referrer`, not `ref`,
which React would intercept) that sets `?ref=`, and `/auth/callback` calls
`claim_invite({ p_username })` after the code exchange — wrapped so attribution can never
block sign-in. `Profile` gains `referred_by` (omitted from `ClientProfile` /
`toClientProfile`). **Requires hand-run SQL** (not yet applied): the `referred_by` column
(`on delete set null` — a deliberate exception to the auth.users cascade rule), an anon
SELECT grant on `public_profiles`, and the `claim_invite` SECURITY DEFINER RPC (validates
self/blocked, sets `referred_by` once, upserts an `accepted` friendship; idempotent). PR 2
(onboarding invite step + empty-feed reuse) is separate.

### · Fix: History month/year label off by a day → wrong month/year (tz)
The real cause of "deployed History shows June 2026 / year 2025." The month/year
period **anchor** was built as `new Date(year, month, 1)` = midnight in the *server's*
tz (UTC on Vercel), passed to the client as a timestamp, and formatted by
`periodLabel` in the *browser's* tz. For a viewer west of UTC that instant rolls back
a day: midnight-UTC-Jul-1 → "June" locally, midnight-UTC-Jan-1-2026 → "2025". (Week was
already immune — its timestamps are zoned to the user's stored tz; and local dev was
immune because the dev server runs in the user's own tz.) Fix: `app/history/page.tsx`
now derives the current year/month from the user's stored tz (`todayInTimeZone`, like
the week/recap) and passes them as **numbers**; `history-client.tsx` builds the label
client-side from those numbers (`new Date(year, monthIndex, 1)` — construction and
formatting in one tz), so it can't roll back. The earlier `force-dynamic` change
stays (correct, unrelated).

### · Fix: frozen "current period" dates on deployed (force-dynamic)
Deployed History showed the year as 2025 / month as June when it was July 2026 — a
year being wrong mid-year can't be timezone (that only shifts a day), so the page's
`new Date()` was frozen by a cached/prerendered render. Added
`export const dynamic = "force-dynamic"` to the three pages that display the current
absolute period — `app/page.tsx` ("Today · {date}"), `app/history/page.tsx`
(month/year/week), `app/recap/page.tsx` (current week) — so each is re-run per
request with a live clock and never served from the Full Route Cache. Note: a
**redeploy is required** to replace the already-frozen production output. (Timezone
consistency for History month/year — server-UTC vs the user's stored tz — is a
separate latent issue, left as a follow-up.)

### · History: tap a category to see its sessions (restored drop-down)
The per-category drill-down is back on every /history view: tap a category row
(under the donut) to expand the individual sessions/events that make up its time
(title · source tag · date · hours) — the feature the old month/year card had,
now on week/month/year alike. Wired through the shared `CategoryDonut` via an
optional `items` map; month/year reuse `rollup.categoryItems`, and the week now
carries `categoryItems` too (added to `computeWeekRecap` via `buildCategoryItems`).
The Progress Today/This-week heroes pass no items, so they stay non-expandable.

### · Unified category donut: centered donut + per-category bars
Every category breakdown now uses one shared presentation (`components/v2/category-donut.tsx`):
a centered donut with the period total in the middle, then each category as a row
with a colored bar sized to its share of the total (hours + percent on the right).
Applied to Progress → Today, Progress → This week, and all three /history views
(week/month/year). Replaces the old donut + text legend everywhere; retired the
`Legend` component and the `WeekSummary` `heroDonut` prop. Goal-quota bars on the
week views are unchanged.

### · History revamp: 3 focused entry points + donut month/year
The Progress tab's History view is now three buttons — **Past weeks / Past months /
Past year** — each opening a **focused** single-period view on `/history` (no page
header, no week/month/year switch; just a "Back to history" link, the Previous/Next
scrubber, and the period's donut). "Back to history" returns to the Progress History
sub-tab via `/?tab=history` (ProgressClient now accepts an `initialTab`). Replaces the
old month-donut preview + "Full history" link; also drops the per-load month rollup
that only fed that preview (a small perf win). The **month** and **year** views now
use the same clean donut + category legend as the week (built from the rollup's
`categoryRows` + `totalTrackedMs` — no new server work), replacing the big-number +
bars analytical card. The period-scoped calendar actions (auto-categorize/review +
Sync Google Calendar) stay, since that's currently the app's only Sync entry point;
the expandable per-category audit, per-item delete/exclude, and goal bars were
dropped. Week view content unchanged.

### · Fix: Notifications panel unclosable under the iOS notch
The Friends notifications slide-over is `position: fixed`, so it was anchored to
the raw viewport and ignored the app's global `body` safe-area padding — on iPhone
its title and X button drew under the status bar / Dynamic Island and couldn't be
tapped, trapping the user in the panel. Added `pt-[env(safe-area-inset-top)]` /
`pb-[env(safe-area-inset-bottom)]` to the sheet popup and offset the close button
by the top inset (`top-[calc(env(safe-area-inset-top)_+_0.75rem)]`, since absolute
children don't inherit the container's padding). `env()` is 0 on desktop, so no
change there. `components/ui/sheet.tsx` only; the centered Dialog was unaffected.

## 2026-07-24

### · Progress tab: big category donut on both Today and This week
The Today view now opens with a large, centered category donut (total hours in the
middle, colored per-category segments around it) plus a compact legend, with
"Sessions today" directly beneath — replacing the old text-only total hero. Today's
segments come from the `perCategory` map `aggregateRange` already computes in
`loadProgressData`, fed through `buildCategoryBreakdown` with the active goals so
colors/labels match the week and month breakdowns.

The **This week** tab gets the same hero donut (via a new `heroDonut` opt-in on the
shared `WeekSummary`, so History's week view keeps its compact side-by-side layout),
with a caption mirroring Today — "This week · {range}" plus "N tracked · M imported"
(week row counts newly exposed from `computeWeekRecap`). The `Donut` center label is
now sizable via a `labelClassName` prop (Today `text-5xl`, This week `text-4xl` since
week totals are larger); hero card spacing tightened. Goals/habits sections unchanged.

### · Feed card footer: comments left of the heart
Swapped the order of the two footer controls on feed session cards so the comment
(speech-bubble) control sits to the left of the like (heart). Counts, links, and
aria-labels unchanged (`components/v2/feed-v2.tsx`).

### · "Sessions today" widget: chronological, named goals, AM/PM ranges
The Progress tab's "Sessions today" list now reads top-to-bottom earliest→latest
(so the live session sits at the bottom), shows the goal name ("Goal: {name}"
instead of a bare "Goal"), and shows a start–end time range for finished sessions
just like imported calendar events — all in 12-hour AM/PM time. New `formatTime12`
helper in `lib/dates.ts` (kept separate from `formatTime`, which still backs the
24-hour `<input type="time">` values in the session dialog); goal titles resolved
in `lib/db/progress.ts` via the feed's `hydrateGoalTitles`; sort flipped to
ascending. The live session keeps a single start time + its pulse dot.

### · Likes/comments notifications — Phase 3 (bottom-nav dot)
Closes the loop: the Friends bottom-nav tab dot now lights on unseen likes/comments
too, not just friend requests, so engagement is noticed without already being on
Friends. One-file change — `getNavBadges()` (`lib/db/notifications.ts`) now ORs
`hasUnseenNotifications()` into the friends dot. The friend-request half still clears
on visiting Friends; the like/comment half clears only on opening the Notifications
panel (shared `notifications_seen_at` stamp), so the nav dot and the bell dot stay
in sync via the existing 90s poll. No new SQL, no UI changes. Feature complete.

### · Likes/comments notifications — Phase 2 (panel + bell)
The visible half of the feature. A bell now sits at the top-right of the Friends
header with a server-seeded "unseen" dot; tapping it opens a right-side slide-over
Notifications panel listing who engaged with your own sessions — 👍 likes collapsed
per post Instagram-style ("C, B and 3 others liked your session '…'"), comments
individual with a body preview. Each row links to the session and closes the panel;
opening the panel clears the dot (stamps `notifications_seen_at`). New
`components/notifications-bell.tsx` (client: lazy-loads on open, marks seen,
renders the list) and `components/ui/sheet.tsx` (a right-edge slide-over over the
existing Base UI dialog primitive — no new dependency). New actions
`fetchMyNotifications` / `markNotificationsSeen` (the latter mirrors
`markFriendsSeen`). `app/friends/page.tsx` seeds the dot via `hasUnseenNotifications`;
the Friends header became a `justify-between` row to host the bell. Reuses
`AvatarInitials` and `formatRelativeTime`. No new SQL (Phase 1 columns cover it).
Still to come (Phase 3): light the Friends *bottom-nav* dot on the same signal.

### · Likes/comments notifications — Phase 1 (data foundation, no UI)
Server-side read layer for "who engaged with my sessions", ahead of the
Notifications panel (Phase 2) and its bottom-nav dot (Phase 3). New
`lib/db/notifications-activity.ts`: `listMyNotifications()` returns recent
engagement by *other* users on *my own* sessions — 👍 likes collapsed per session
(distinct reactors, most-recent first, Instagram-style), comments kept individual,
merged newest-first within a 30-day window. Scope is enforced by an embedded
`sessions!inner` + `sessions.user_id = me` filter (and RLS, the real authority),
excluding my own likes/comments and non-👍 reactions. Also `hasUnseenNotifications()`
— a cheap timestamp-only yes/no for the future poll-driven dot. Labels reuse the
feed's `hydrateGoalTitles` (goal title, else task name); actors resolve through the
`public_profiles` view via `hydrateUsers`.

Adds a `notifications_seen_at` column to the `Profile` type (independent of
`friend_requests_seen_at` so the like/comment dot will clear only on opening the
panel). Requires SQL: a `created_at timestamptz` on `session_reactions` (the table
had no timestamp), the `profiles.notifications_seen_at` column with an existing-user
baseline, and two supporting indexes. No UI yet.

### · Nav notification dots: Feed + Friends tabs
The bottom-nav Feed and Friends tabs now show a small brand-navy dot when there's
something new since you last opened that tab — a friend finished a session or a
new friend joined (Feed), or a new incoming friend request arrived (Friends).
Live clock-ins are excluded, and a dot never shows on the tab you're currently
viewing. Opening the tab clears its dot (stamps a `feed_seen_at` /
`friend_requests_seen_at` timestamp on the profile).

Because the nav lives in the root layout (which doesn't re-render on client tab
navigation), the dots are seeded from server-computed values for a correct first
paint, then kept live by the nav polling a lightweight server action (~90s, paused
while the tab is hidden, immediate re-check on refocus). New `lib/db/notifications.ts`
(`getNavBadges`, timestamp-only reads inside the feed's 7-day window, RLS-scoped)
and `app/actions/notifications.ts` (`fetchNavBadges` / `markFeedSeen` /
`markFriendsSeen`). Requires two new nullable `timestamptz` columns on
`public.profiles` (`feed_seen_at`, `friend_requests_seen_at`).

## 2026-07-23

### · Real app icon: the Progra clock mark (PWA + favicon)
The home-screen (PWA) and browser-tab icons are now the Progra clock mark
instead of the solid-dark placeholders. `scripts/generate-icons.mjs` rewritten
to rasterize the brand-mark SVG via sharp (full-bleed navy so iOS/Android
rounding is clean; glyph inside the maskable safe zone) → regenerated
icon-192/512 + apple-icon + a crisp favicon-32. Manifest theme_color → brand
navy (#1c3a5e), added maskable icon entries, and both manifest/metadata
descriptions refreshed off the stale "weekly planning" copy. Same clock used
by the in-app logo and loading animation.

### · Tap a goal in Progress → clock in with it pre-selected
The "Goals today" cards on the Progress tab are now tappable: they link to
`/clock?goal=<id>`, which seeds the clock-in goal picker with that goal (guarded
against a stale/archived id → falls back to the category picker). Land, type a
task, Clock In. Inert while a session is already active. (`clock/page.tsx` reads
the param; `clock-client` seeds `selectedGoalId`/`pickerMode` via state
initializers — no effect.)

### · /clock reachable while clocked in (compact timer strip)
`/clock` no longer hard-redirects to the full-screen stopwatch while a session
is running, and the stopwatch's minimize chevron now lands on `/clock` (was
Home). While tracking, `/clock` shows a compact live-timer strip at the top
(pulsing dot — amber when paused — · live elapsed · task name · chevron; tap
reopens `/clock/live` for pause/notes/photo/stop) with the full clock tools
below it (categories manager, add past session, week view), so you can add or
edit categories mid-session. The clock-in form is hidden while active (no
double clock-in); legacy (`!REDESIGN`) clock page unchanged.

### · Conversational onboarding (V2 redesign)
The first-sign-in wizard is now a "conversation with Progra": each step shows a
typing indicator, then the title + body copy stream in word-by-word with a
blinking caret, then the controls + a pinned CTA fade up. Tap anywhere while
streaming to fast-forward; `prefers-reduced-motion` mounts everything instantly.
New reusable engine `components/onboarding/conversation.tsx` (state machine +
timings faithful to the design prototype). Wizard grows 5→6 steps (adds "So,
what is Progra?"); `onboarding-client-v2.tsx` rewritten as the presentational
shell around it — all the existing actions/logic are reused unchanged
(setUsername/setProfileIdentity, createGoal + quota stepper, the 3-state
calendar step + deep-link, AvatarPicker, completeOnboarding/skip). Per the
recolor-only convention, the handoff's warm-green palette maps onto Progra's
live navy V2 tokens — structure/type/motion/copy match the handoff, colors are
ours. Kept the shipped react-easy-crop cropper (no custom rebuild). New
keyframes in globals.css (word-in/pop-in/dot-bounce/caret-blink) with a
reduced-motion guard. Legacy flag-off wizard untouched.

### · Security hardening pass (post-audit)
Code-level fixes from a three-agent security review (the two HIGH items —
whether friend-privacy RLS and owner-scoped UPDATE/DELETE policies are actually
deployed — are Supabase-dashboard verifications for the owner, not code):
- **Open redirect closed**: new `safeNextPath()` (`lib/auth/safe-next.ts`)
  rejects off-site `?next=` targets (absolute/`//`/`\`/scheme/userinfo) at both
  sinks — the `/login` signed-in redirect and the OAuth callback's
  `${origin}${next}` concat. Was a phishing primitive on our own domain.
- **`setEventCategory` auth**: added the `getCurrentUser()` guard (the one
  mutation missing it) + verifies the caller owns the assigned category.
- **Admin defense-in-depth**: `resolveReport`/`takeDownStory`/
  `deleteReportedComment` now server-side `is_admin()`-gate before the RPC, so
  a single RPC's internal check isn't the sole barrier.
- **Security headers** (`next.config.ts`): X-Frame-Options DENY,
  X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy on all
  routes. (Full CSP deferred — needs per-host allowlisting; a wrong one breaks
  the app.)
- **Hardening batch**: UUID-validate `targetUserId` before the PostgREST
  `.or()` interpolation in `unblockUser`/`getRelationship`; server-side length
  caps on goal/session/category text (`lib/validate.ts` `capText`); intersect
  AI-returned event ids with the sent batch before upsert; `ClientProfile` type
  + `toClientProfile()` so Google tokens can't be serialized to a client
  component (compile error, not runtime leak).

Deferred (not code / bigger): RLS verification (owner's dashboard task), rate
limiting (needs Vercel KV), full CSP.

### · Nav tabs fully prefetch (kills first-tap slowness in prod)
`prefetch={true}` on all 5 bottom-nav links: routes prefetch their DATA in
the background (not just the loading skeleton), so the first tap on a tab is
instant — and fully-prefetched pages use the 5-minute static staleTime
instead of 30s, widening the instant-switch window. Production-only behavior
(dev's compile-on-first-visit slowness is inherent to dev mode and unchanged).
Cost: ~5 background page-fetches per full load. Heavier levers (per-page
RPCs, Realtime, PPR) deliberately deferred past feature launches.

### · Onboarding welcome: Name field
The welcome step now collects a display Name (optional, 50 chars, "Shown to
friends alongside your handle") above the username claim; saved via the
existing setProfileIdentity after setUsername (same ordering as the Settings
identity save). Replay seeds the current name; the avatar preview uses the
live name for initials. Header copy: "First, tell us who you are."

### · Fix: /friends crashed on handle-less profiles
A signed-in-but-never-onboarded account (no username yet — now reachable via
the calendar connect flow stamping onboarded_at) crashed the Friends page:
`listSuggestedUsers` didn't exclude null usernames and `initialsOf` called
`.slice` on null. Fixed at both layers: suggestions and `hydrateUsers` now
skip handle-less profiles (they can't be linked to anyway — matches
`search_users`' DB-side filter), and the initials helper falls back to "?"
instead of crashing if one ever slips through.

### · Avatar crop: choose what shows
Picking a profile photo now opens a pan/zoom crop dialog (round viewport —
"the circle is what everyone sees") before upload, via the newly approved
`react-easy-crop` dependency (lazy-loaded chunk, stays out of critical
bundles). Flow: pick → `downscaleImage(1600)` normalizes EXIF orientation
(react-easy-crop assumes upright pixels) → drag/pinch/slider framing → new
`cropToSquareJpeg` (`lib/images/crop.ts`) bakes the chosen frame to a 512px
square client-side → existing `uploadAvatar`. Server pipeline unchanged
(sharp still validates/re-encodes as the security boundary; its cover-crop is
now a no-op). Crop is baked in at upload — re-crop = re-upload (no originals
kept, deliberate). Both picker surfaces (Settings, onboarding) get it free.

### · Profile pictures
Users can upload a profile photo, shown at every avatar site (feed cards +
joins, clocked-in strip, comments, session detail, friends rows, search
results, profile page, /me, Settings). Storage: PUBLIC `avatars` bucket —
stable immutable URLs (fresh `avatar-<uuid>.jpg` per upload = cache-busting;
old blob removed best-effort), sharp square-crop 512px re-encode strips
EXIF/GPS (same boundary as session photos). Upload/remove via new
`app/actions/avatar.ts` (admin-client storage write after session-derived
path — the service-role storage-write pattern now covers session photos AND
avatars); picker (`components/avatar-picker.tsx`) lives in the Settings
edit-profile dialog and the onboarding welcome step (optional). Data:
`profiles.avatar_path` + recreated `public_profiles` view + extended
`search_users` RPC (SQL run by hand); `PublicUser.avatarUrl` plumbed through
`hydrateUsers`/suggested/profile/search; `AvatarInitials` renders the photo
when present, initials otherwise. Account deletion purges the avatar blob
(owner-delete storage policy).

### · Incremental Google Calendar auth + onboarding step 5
Calendar scope is now decoupled from sign-in — new users sign in with basic
Google scopes only (no unverified-app screen, no verified-user-cap impact) and
calendar access is an opt-in connect flow. Phases:
**(1) Sign-in stripped** — `signInWithOAuth` requests default scopes only;
the sign-in callback no longer captures provider tokens (it used to overwrite
the stored calendar tokens with a calendar-useless one + fresh expiry on every
re-login — token writes are now exclusively the connect flow's).
**(2) Connectedness is a data predicate** — `isCalendarConnected(profile)`
(refresh token + `google_scopes` contains the calendar scope) in
`lib/auth/profile.ts`; `syncCalendar` returns a friendly connect nudge when
false; token refresh self-heals on `invalid_grant` (clears token columns so
surfaces fall back to "not connected" instead of erroring forever).
**(3) Hand-rolled connect flow** — `GET /auth/google-calendar` (stamps
`onboarded_at` first so bailing at Google still leaves you onboarded; nonce
cookie; consent URL with only `calendar.events.readonly` +
offline/consent/include_granted_scopes) and its callback (session-bound
identity, state validated before exchange, scope-echo + refresh-token checks,
standard RLS client writes, `revalidateCalendarSurfaces()`), plus a
best-effort-revoke `disconnectGoogleCalendar` action.
**(4) UI** — onboarding v2 gains a 5th "See your whole week" step
(connect / skip-for-now / connected states, deep-linked back from Google via
`?step=calendar&status=`); Settings' calendar row gains Connect/Disconnect;
both show a `NEXT_PUBLIC_SHOW_UNVERIFIED_WARNING`-gated walkthrough of
Google's "Advanced → Go to progra.world (unsafe)" screen until verification
clears. Requires (user actions): `google_scopes` column + legacy backfill SQL,
redirect URIs in Cloud Console, consent screen In production, warning env var.

### · Progress Today: calendar events appear in "Sessions today"
Imported Google Calendar events now show as rows in the Today widget alongside
clocked sessions, in the identical row layout: title bold, category (colored)
underneath with the event's start–end time range, overall duration on the
right, plus a small calendar glyph for provenance (same marker as the clock
day view). Newest-first merge; no new queries — the day's events were already
fetched for the hero total ("N tracked · M imported", which now matches the
visible rows). `SessionToday` rows gained `kind` + `endedAt`; session rows
render exactly as before.

### · History: browse past weeks (in the This-week format)
`/history` gains a **Week** segment next to Month/Year (`?view=week&w=YYYY-MM-DD`,
Monday-anchored in the user's timezone — same anchoring as /recap, same
prev/next scrubber as month/year). Deliberately NOT the month/year analytical
card: the week view renders the exact This-week presentation from the Progress
tab — donut + category legend + goal quota bars — via a new shared
`components/v2/week-summary.tsx` that both surfaces now render (extracted
from `progress-client.tsx`'s WeekView; zero visual change there), so the two
formats can never drift. Data via the existing `computeWeekRecap`. A muted
"Weekly recap →" link connects each week to `/recap?w=`. Month/year views
unchanged (hoisted into a `RollupBody` component, same look and delete flows).

### · Production latency pass: region pin, local auth, last waterfalls, client cache
Diagnosed extreme slowness on the deployed site. Root causes and fixes:
**(1) Region mismatch** — Vercel functions ran in the iad1 default while
Supabase is us-west-1, so every query/auth hop crossed the country; new
`vercel.json` pins functions to sfo1 (verified live: `x-vercel-id` now
`sfo1::sfo1`). **(2) Network auth hop everywhere** — `getCurrentUser()` and
all 30 direct `auth.getUser()` calls in server actions hit the Supabase Auth
server per render/tap; `getCurrentUser` now verifies the JWT locally via
`getClaims()` (asymmetric signing keys are active) returning `{ id, email }`,
and every action uses it — zero auth network hops in the request path (RLS
remains the authority on every query). **(3) Last two query waterfalls** —
feed comments/reactions now chain off `listFriendFeed` alone inside one
`Promise.all` (was: gated on the whole first wave); `/clock`'s events fetch
joined its parallel block via `fetchEventsRaw` (its "after categories" comment
had gone stale in the phase-1 split). **(4) Client cache** — experimental
`staleTimes.dynamic = 30`: tab switches within 30s reuse the cached page
payload; safe since every mutation revalidates its surfaces (own changes still
instant, friends' activity lags ≤30s, feed poll/refocus unaffected).

## 2026-07-22

### · Landing: new summary + feature blurb
Signed-out landing tagline is now "The first community-based productivity
app." Below the hero, a three-row
feature blurb (timer/calendar/friends icons) spells out the core features —
including that connecting Google Calendar is optional and read-only, so the
calendar integration is visible to signed-out visitors and OAuth reviewers.

### · Narrower Google OAuth scope: calendar.events.readonly
Sign-in now requests `calendar.events.readonly` instead of the broader
`calendar.readonly` (app/login/google-sign-in-button.tsx — the only place the
scope appeared). The sync only calls the events API, which the narrower scope
fully covers; existing users pick it up on next sign-in (the flow already
forces the consent prompt). The Google Cloud Console consent-screen scope
list must be updated to match before verification.

### · Signed-out landing: accurate copy + legal footer
The landing tagline claimed a weekly planner that no longer exists ("Plan
your week…"). Rewritten to what the app actually does — log study sessions,
see your Google Calendar schedule, track progress with friends — on both the
landing (`SignedOutLanding`, app/page.tsx) and the /login page it funnels to.
The landing also gains a bottom footer ("© 2026 Progra · Privacy Policy ·
Terms of Service") linking the new legal pages; hero stays vertically
centered via my-auto, no scroll introduced. Signed-in experience untouched.

### · Public legal pages: /privacy and /terms
Two plain server-component pages, reachable logged-out (no auth helpers; the
middleware only refreshes sessions, never redirects). The privacy policy
carries the Google OAuth verification requirements for the read-only Calendar
scope: what's collected, Google-data usage limits, the AI-processing
disclosure (Anthropic categorizes event titles only; no ads, no model
training), the verbatim Google API Services User Data Policy / Limited Use
sentence, storage/sharing, revoke + delete instructions
(support@progra.world, 30 days), 13+ age floor. Terms cover the standard
short set (acceptance, eligibility, account, acceptable use, content
ownership with display license, termination, warranty/liability, changes).
Both cross-link each other and Home in a footer.

## 2026-07-21

### · Bundle splitting + feed polish (perf phase 4, final)
First `next/dynamic` usage in the app: the four click-gated dialogs now load as
lazy chunks after hydration instead of shipping in the critical bundles —
`ManageHabits` (485 lines, was always in the Progress tab bundle),
`SessionDialog` (405) + `EventCategoryDialog` + `SessionPhotoStep` (from
`/clock`), `SessionPhotoStep` (from `/clock/live`), and
`CategorizationReviewDialog` (from `/history`). All hosts are client
components (`ssr: false` requirement per the bundled Next 16 docs); type-only
imports (`SessionDialogMode`) stay static. Onboarding wizards deliberately NOT
converted — they're imported by a server page, so only the rendered variant's
chunk ships anyway. Also: feed poll default slowed 30s → 60s
(`feed-live-poll.tsx`; refresh-on-refocus unchanged and covers tab reopens —
each tick re-renders feed + layout, so this halves background load), and all
six signed-URL session photos gained `loading="lazy" decoding="async"` (feed's
full-bleed scroller being the one that matters; aspect boxes already existed,
so no layout shift). This completes the 4-phase performance pass.

### · Mutation performance pass: one round-trip per action
Every mutation used to cost two server round-trips — the action POST, then a
client `router.refresh()` GET. Server actions now revalidate all their affected
surfaces themselves (new shared helpers in `lib/revalidate.ts`, replacing
scattered per-action `revalidatePath` lists — several of which were wrong:
reactions/comments revalidated `/` but render on `/feed` + `/session/[id]`;
event categorization/restore missed `/history`). The action's own POST response
carries the updated UI, so ~40 success-path `router.refresh()` calls across
~25 client files are gone. Key details: **session actions revalidate the root
layout** (`revalidatePath("/", "layout")`) because the BottomNav live ticker
renders from the layout; `clockOut`/`editActiveSessionTime(ended)` use a
pages-only variant that skips `/clock/live` so its no-active-session redirect
guard can't race the client's push to the finish screen. Load-bearing refreshes
kept: feed polling, delete-account (clears the signed-in layout), onboarding
error-path resyncs. Also: **`EnsureProfileSync` no longer writes on every page
load** — the layout passes the stored timezone down and the action only fires
when the browser tz actually differs (a real change now revalidates the whole
layout, since day boundaries shift); **`reaction-bar.tsx` is now optimistic**
(same pattern as the kudos heart); session-dialog's delete confirm closes
optimistically. Net effect: button actions settle in one round-trip, habit
toggles/kudos/reactions are instant with server reconcile in the same POST.

### · Client performance pass: 1s-tick isolation
`useNow()` was called at the top of whole screens, so the 1s tick re-rendered
the entire 1037-line clock client (re-running `aggregateWeek` +
`buildCategoryBreakdown` + `dayBreakdown` on every second AND every keystroke),
the live timer, sessions, goals, the feed strip, and — via the root layout —
the bottom nav on every page, even idle. Fixes: **(1)** new `useNowMinute()` in
`lib/hooks.ts` — same shared 1s store, minute-floored snapshot, so
`useSyncExternalStore` bails out 59 of 60 ticks; **(2)** new
`components/ticking.tsx` `<Ticking>` render-prop leaf — the only per-second
render surface; parents stop subscribing entirely. Applied: clock client now
uses `useNowMinute` + `useMemo` on the Maps/aggregations (keystrokes recompute
nothing) with the big timer + paused badge in a `<Ticking>` leaf; live-timer
and the clocked-in strip tick only in their number leaves; sessions/goals
clients (day-label-only) swap to `useNowMinute`; the bottom nav mounts a tick
leaf only while tracking — idle pages now run **no interval at all**; the
onboarding practice timer's own `setInterval` is replaced by a `<Ticking>` leaf
so the wizard stops re-rendering per second. First `useMemo` usage in the repo
(there was none). No visual/behavior change; week totals advance in 60s steps
while clocked in (live timers stay second-live).

### · Server-side performance pass: request dedupe, parallel fetches, skeletons
One Home load was firing ~25–30 Supabase round-trips (uncached helpers re-read
by every composer) behind sequential waterfalls, and 8 routes had no
`loading.tsx`, so tab switches froze on the old page. Fixes: **(1)** domain read
helpers are now per-request cached with React `cache()` — `listCategories`,
`listActiveGoals`, `listActiveHabits`, `listCompletionsInRange`,
`getHabitsWithTodayStatus`, `listSessionsInRange`, `getActiveSession`,
`listFriends` (kills the feed's 3× duplicate friendships read). **(2)**
`listEventsInRange` split into a cached `fetchEventsRaw(startMs, endMs)` (the 3
queries, keyed on the window) + pure `categorizeEvents` so composers sharing a
window share the fetch. **(3)** Waterfalls flattened to single `Promise.all`
waves: `computeRollup` (was 4 sequential awaits), `computeWeekRecap`,
`loadProgressData` (day-window reads merged into the main wave), Home page
(`loadWeekHabits` now parallel with `loadProgressData` via a new
`currentWeekStart(tz)` helper), and the root layout (`getOptionalUser` ∥
`getActiveSession`). **(4)** `loading.tsx` skeletons added for /feed, /goals,
/recap, /me, /friends, /history, /sessions, /categories. **(5)** Middleware
(`lib/supabase/proxy.ts`) now calls `auth.getClaims()` instead of `getUser()` —
local JWT verification instead of a network hop per navigation once the
Supabase project migrates to asymmetric signing keys (falls back to server
validation until then). No behavior/UI change; client-side render work (1s-tick
isolation) is a planned follow-up.

## 2026-07-20

### · Feed session cards restyled to the handoff layout
Feed cards (`components/v2/feed-v2.tsx`) now follow the design handoff: a header
sub-line reading "clocked into ⟨marker⟩ {category} for {duration}" (reusing
`CategoryMarker` — star for goals, colored dot for categories), a prominent title,
a full-bleed photo, and a footer with a duration pill + a single **heart "kudos"**
and a comment count. The comment preview line is kept. Layout-only match — the
current navy theme and heading font are unchanged (no warm palette, no Newsreader).
The emoji reaction bar is replaced by the heart, which stores the existing `👍`
reaction under the hood (new `components/kudos-button.tsx`, optimistic) — **no DB
change**, and it interoperates with the emoji bar still on the session detail page.
`lib/db/feed.ts` now carries the category `color` (from the `public_categories`
view, which already exposed it); `lib/social/reactions.ts` gains `LIKE_EMOJI`.

### · Live timer: edit title/category, and add notes
The `/clock/live` edit dialog now also edits the **title** and **category/goal**
(full picker, like clock-in) alongside start/end time — title/axis save via
`updateSession`, time via the unchanged `editActiveSessionTime` (pause settlement
+ finish routing preserved). A new **Add notes** button (above the photo button)
opens a textarea popup that saves to the session's `description`, which already
surfaces on the feed post for public sessions.

### · Suggested friends: "People on Progra"
`/friends` gains a "People on Progra" section listing every other member with
one-tap **Add** (new `listSuggestedUsers` in `lib/db/friends.ts`; reuses
`sendFriendRequest` + the status buttons, now extracted into a shared
`renderAction`). Excludes yourself, current friends, and people you've blocked;
new members appear automatically once they've set a username (live
`public_profiles` read, capped at 100 for now). Empty state distinguishes "added
everyone" from "no one else yet". No DB change (a someone-blocked-you edge is
deferred to a future definer RPC).

### · Feed tab icon
The redesign's Feed tab now uses a newspaper icon instead of the house
(`components/bottom-nav.tsx`).

## 2026-07-16

### · Session-photo uploads fixed via a server-only service-role write
Photo uploads had silently failed for ~2 months and no session photo ever
rendered. Root cause (found by an isolated `/api/photo-selftest` probe, since
removed): this project's **Storage service does not authorize uploads from a
valid user JWT** — it treats authenticated tokens as `anon` at the storage layer,
so the bucket's INSERT policy (`roles = {authenticated}`) rejects every write
("new row violates row-level security policy"). PostgREST honors the same token
fine (reads and DB writes work), and this held for **both** the project's ES256
signing key **and** after rolling back to legacy HS256 — so it is a Storage-service
auth defect, not the signing algorithm and not app code.

Fix: `uploadSessionPhoto` now performs the storage **write** through a
server-only service-role client (`lib/supabase/admin.ts`) that bypasses the
unsatisfiable storage RLS. The action still authenticates the user and verifies
session ownership first, so authorization is enforced in code; the key stays in
`SUPABASE_SERVICE_ROLE_KEY` (server env, never shipped to the browser). Reads are
untouched (signed URLs don't depend on storage RLS). Verified end-to-end: the
service-role write stores intact JPEG bytes (`ff d8 …`), which also confirms the
current pipeline does **not** corrupt photos — the old corrupt blobs were a
pre-existing legacy artifact, now moot.

**Deploy note:** requires `SUPABASE_SERVICE_ROLE_KEY` in the Vercel environment,
alongside the one-photo schema migration, shipped together.

### · One photo per session — the before/after pair rule is gone
A session now carries **one optional photo**, taken while it runs, and **privacy
alone decides who sees it**. The "after" capture, its 10-minute upload tolerance,
and the whole before/after concept are deleted.

Phase 3 had overloaded photo completeness to mean two things at once — "this
session has photos" *and* "this session is shared" — layering a second gate on
top of `is_private`, which already worked and already drove RLS everywhere else.
`lib/storage.ts` stated the old invariant outright ("visibility is derived from
this pair, never stored as a boolean"); that comment and the rule are both gone.
A photo is now an attachment with no visibility of its own.

- **Capture:** one photo, on `/clock/live` only (`?capture=photo`), while the
  session is active. `uploadSessionPhoto(sessionId, formData)` lost its `kind`
  param; the finish screen's "Add after" button, `AFTER_TOLERANCE_MS` (both the
  server constant *and* its hand-synced copy in `finish-client.tsx`), and the
  legacy clock-out prompt are deleted. The finish screen is now confirmation +
  privacy; its photo block is read-only and omitted entirely when there's none.
  The sharp EXIF/GPS strip, 8 MB cap, and explicit ownership check are untouched.
- **Data:** `before_photo_path`/`after_photo_path` → `photo_path` (`photoPath`);
  new blobs land at `{user_id}/{session_id}/photo.jpg`. `getSessionPhotoUrls` →
  `getSessionPhotoUrl` (single sign). `hydrateSessionPhotoUrls` kept — the batch
  path still matters.
- **Feed:** `FeedItem.photoUrl`. **Deleted `components/session-photo-swipe.tsx`**
  — one photo, nothing to swipe.
- **Profile:** "Stories" is now **Sessions** — a history, not a gallery.
  `lib/db/stories.ts` → `lib/db/profile-sessions.ts`, `story-card.tsx` →
  `profile-session-card.tsx`. Every finished visible session lists, photo or not,
  newest first, capped at 50 (pagination is a follow-up, not a silent cap). Fixed
  the N+1 it had: signing is now one batched call, not one per card. The `"story"`
  **report target type keeps its name** — it's a `report_target_type` enum value
  persisted on `reports` rows, so renaming means migrating data.
- **Detail/admin:** the pair gate at `app/session/[id]/page.tsx` is gone —
  reaching the page already means the session is visible. Admin preview is one
  slot.

**Requires Supabase SQL:** rename/drop the columns, and recreate
`can_see_session_photo`, `admin_take_down_story`, and `admin_list_reports` (all
three reference the old columns by name and break on the rename). See the plan.

**Correction to the entry below:** it claimed the storage policy "declines to
sign a half-pair" and that relaxing it needed SQL. That was wrong, and so was
`ARCHITECTURE.md`'s "non-private complete-pair friend" description that it came
from. The real `can_see_session_photo` matched `before_photo_path = object_name
OR after_photo_path = object_name` and already carried `not is_private and
ended_at is not null` — **no pair rule, no SQL blocker**. The pair rule lived
only in app code. Schema is not in-repo; read the DDL from Supabase, never from
the docs.

### 14:14 · Session photos in the feed (part 1 of 3: complete pairs)
Feed session cards now render the session's photos underneath the stats block —
author row → title/chip/duration/description → **photos** → reactions → comments.
New `components/session-photo-swipe.tsx` swipes between before/after using native
CSS scroll-snap rather than a carousel dependency (a session has at most two
photos); dots appear only when there are two. Photos are visually unlabelled by
design, but Before/After survive as alt text. Raw `<img>` like
`components/story-card.tsx` — srcs are short-lived signed URLs into a private
bucket.

`lib/db/feed.ts`'s `FeedItem` gains `beforeUrl`/`afterUrl`; `listFriendFeed`
already selected the photo columns and was silently dropping them. New
`hydrateSessionPhotoUrls(paths)` in `lib/db/session-photos.ts` signs **every**
photo across **every** card in one `createSignedUrls` call — `getSessionPhotoUrls`
is per-session and would have cost one round trip per card (the N+1
`listProfileStories` still has). It keys its map by the `path` each item echoes
back, never by array index: storage RLS adjudicates each path separately and
reports a refusal as a per-item error rather than failing the batch, so
positional indexing would hand a card someone else's photo. `listClockedInNow` is
deliberately untouched — the clocked-in strip stays photo-free.

**No Supabase change required.** The existing storage policy already serves
complete before+after pairs, which is exactly what this part ships. Sessions with
only *one* photo still render as today's text-only card: the policy declines to
sign a half-pair, the hydrator maps it to null, and the swipe component returns
null. Relaxing that is part 2 (SQL) — after which lone photos appear here with no
further code change.

## 2026-07-15

### · onboarded_at is now write-once (replay no longer resets the join date)
`completeOnboarding` only stamps `onboarded_at` when it's null (via an
`.is(onboarded_at, null)` filter), so replaying onboarding and finishing again no
longer overwrites the original join date. Replay no longer nulls the column
either — the "Replay onboarding" button just navigates to `/onboarding`
directly (it renders for any user), so `replayOnboarding` is removed. This keeps
the "just joined" feed item tied to the true first join. `app/actions/profile.ts`,
`components/replay-onboarding-button.tsx`.

### · Richer feed posts: title, goal/category chip, time, description
Feed session cards now show the **task title** (left), the **goal or category**
chip (top-right) with **time spent** directly under it, and the user's
**description** below. Previously a card showed only the goal-or-taskname label +
duration. The feed data layer (`lib/db/feed.ts`) now carries `title`,
`attribution` ({text, isGoal}), and `description`; goal titles resolve as before
(private goals never leak → no chip), and category names resolve through a new
friend-gated `public_categories` view. `components/v2/feed-v2.tsx`,
`components/feed.tsx`.

**Requires a Supabase change:** create the `public_categories` view (friend-read,
exposes id/name/color). Until applied, category-tracked posts simply show no
category chip — no crash. See the plan/handoff for the exact SQL.

### · Onboarding drops the practice session → "just joined" feed item
Onboarding no longer clocks a real practice session. The redesign wizard is now
four steps (welcome → goal → categories → habits); creating the goal is its only
write, so a new member never leaves a stray micro-session on friends' feeds.
Instead, new members surface on friends' feeds as a **"@username just joined
Progra! Their first goal is Y"** card — a synthetic entry derived from
`profiles.onboarded_at` + their first visible goal, merged chronologically into
the feed (7-day window, no reactions/comments). A goal-less skip shows the plain
"just joined" line and fills the goal in later; a private first goal is omitted.
`app/onboarding/onboarding-client-v2.tsx`, `app/onboarding/page.tsx`,
`lib/db/feed.ts`, `components/feed.tsx`.

**Requires a Supabase change:** add `onboarded_at` to the `public_profiles` view
(otherwise the join item stays empty — no crash). See the plan for the exact SQL.

### · Skip onboarding option (redesign)
The redesign onboarding wizard now has a **Skip** link in the top-right of the
header that completes setup (`completeOnboarding` → stamps `onboarded_at`) and
drops the user straight into the app. It's hidden on the welcome/username step
and only appears once the handle is claimed, so a skipped user always keeps a
public username; the goal / practice / categories / habits steps become
optional. No confirmation dialog — onboarding stays replayable from Settings.
`app/onboarding/onboarding-client-v2.tsx`.

### · Habit & goal privacy toggle — eye button
The redesign's "Manage habits" dialog (Progress tab) had no way to change a
habit's public/private state — the toggle only survived on the legacy `/habits`
page. Each row in "Your habits" now has an eye button left of the edit pencil:
dark/solid when the habit is public (visible to friends), grey + faded when
private. One tap flips it via the existing `updateHabit({ isPrivate })` — no
confirmation dialog — with an optimistic flip and a toast confirming the new
state. `components/v2/manage-habits.tsx`.

The same eye toggle now sits left of the edit pencil on each goal card
(`/goals`), flipping public/private via `updateGoal({ isPrivate })` with the same
optimistic flip + toast. Gated behind `SOCIAL_ENABLED` (like the existing goal
lock indicator and edit-dialog privacy checkbox), so it stays hidden in beta.
`app/goals/goals-client.tsx`.

### · Fix: before-photo capture auto-skipped on clock-in (redesign)
Regression from the clock-flow redirect: clocking in called `router.refresh()`
before opening the before-photo dialog, which tripped the `/clock → /clock/live`
guard and destroyed the dialog — and `/clock/live` had no capture UI, so no
before photo was reachable in the redesign at all.

- **Clock-in** (`app/clock/clock-client.tsx`): in the redesign, `handleClockIn`
  now `router.push("/clock/live?capture=before")` instead of refreshing. Beta
  path unchanged.
- **Live timer** (`app/clock/live/live-timer-client.tsx`): consolidates
  before-photo capture here — `?capture=before` auto-opens the skippable
  `SessionPhotoStep` once (seeded in a `useState` initializer; param stripped on
  mount so a reopen never re-prompts). The read-only pill becomes a tappable
  **"Add before photo"** button until a photo exists, so a skipped photo can
  still be added mid-session. Re-added the `sessionId` prop (passed from
  `app/clock/live/page.tsx`).

### · Redesign bug-fix pass (post-review)
Fixes from a functional review of the redesign work.

- **Clock timing (high):** `editActiveSessionTime` banked an in-progress pause up
  to `now` instead of the chosen end time — finishing a paused session at a past
  time understated (or zeroed) worked time. Now banks only the pause portion
  inside the session window. Also: a still-running start edit that moved the
  start past an in-progress pause could record ~0 worked — the dangling pause is
  now dropped.
- **Clock edit sheet:** datetime-local is minute-resolution, so re-saving crept
  the start earlier each time and an immediate finish could be rejected for
  sharing the start's minute. Untouched start keeps its exact value; an untouched
  end means "finish now".
- **Privacy (medium):** the session-detail page rendered a lone before/after
  photo, breaking the "complete pairs only" rule — a friend could see an unpaired
  before photo. Photos now show only when both exist.
- **Flag footgun:** `SOCIAL_ENABLED` now includes `REDESIGN`, so enabling only
  `NEXT_PUBLIC_REDESIGN` in prod can't leave the Friends/You tabs 404'ing.
- **Manage habits:** `viewWeek` now resets to the current week on open (and on
  week rollover), so a reopen can't land check-offs on weeks-old dates.
- **Minor:** `toggleHabitCompletion` revalidates `/` (Progress); login redirect
  defaults to `/` so the onboarding gate fires.

### · Clock flow — full-screen live timer + Finish & save (Subplan 2)
The deferred clock flow, built behind `REDESIGN`. The existing `/clock` clock-in
page is unchanged; clocking in now takes you to a full-screen live timer you can
minimize and navigate away from (the nav pill keeps ticking), and Stop leads to a
Finish & save screen. Faithful to handoff screens 05/06.

- **`/clock/live`** (`live-timer-client.tsx`) — full-screen per design 05:
  minimize chevron, `● Tracking`/`Paused` status, title + attribution chip +
  description, breathing-glow 62px count-up timer, "Started … · paused …" line,
  before-photo pill, Pause/Resume + Stop. **Edit (top-right)** opens a sheet to
  correct the start time and, if the session's already over, set an end time and
  finish — for when you forgot to clock out.
- **`/clock/finish`** (`finish-client.tsx`) — design 06: session complete,
  duration, attribution, before thumbnail (display-only — a before photo can only
  be added while active), **Add after** (reuses `SessionPhotoStep`, gated to the
  10-min upload window), **Private** toggle, Save → Progress.
- **Actions:** `clockOut()` now returns the ended session id (so the flow can
  route straight to finish); new `editActiveSessionTime({ startedAtMs, endedAtMs })`
  adjusts an active session's start and optionally ends it (settling pause). No
  schema change.
- **Wiring:** the nav center button points at `/clock/live` while tracking;
  `/clock` redirects there when `REDESIGN` && a session is active, so the old
  inline timer never shows in the redesign. New `resolveAttribution` helper and a
  `ToggleSwitch` primitive; added a `breathe` keyframe. `ClockClient` is untouched.

### · Progress tab — habit check-off + Manage habits
Made habits actionable from the Progress tab (redesign). No schema or action
changes — `toggleHabitCompletion` already allowed past days, and habit CRUD
already existed; this is all presentation.

- **Today view:** the "Habits today" list is now tappable (optimistic toggle of
  today's completion), and always renders so the Manage entry point is reachable
  even with zero habits.
- **Manage habits dialog** (`components/v2/manage-habits.tsx`), opened from a
  "Manage" button in both Today and This-week: an **editable week grid** you can
  page back through (last `HABIT_HISTORY_WEEKS` = 8 weeks) to backfill any past
  or current day, plus **add / rename / recolor / delete** habits (delete =
  archive; checked days stay in history). Reuses `ColorSwatches` and the habit
  actions.
- The Progress loader now fetches 8 weeks of completions (`loadWeekHabits` →
  `{ habits, completions, minWeekStart }`); the This-week grid ignores
  out-of-week dates so the wider window is harmless.

## 2026-07-14

### 18:00 · V2 redesign — front-end restructure (behind `NEXT_PUBLIC_REDESIGN`)
The bulk of the `design_handoff_progra_v2` restructure, built as parallel
components behind the new `REDESIGN` flag (Subplan 0's global recolor already
shipped the white/navy/PT-Sans theme app-wide). New information architecture:
**Progress · Feed · [Clock] · Friends · You**. Everything reuses the existing
data layer and server actions — this is a presentation/composition layer only,
no schema changes. Clock flow (Subplan 2) is intentionally still deferred.

- **Progress tab (Home).** `app/page.tsx` gains a `REDESIGN` branch rendering
  `components/v2/progress-client.tsx` — a segmented Today / This week / History
  view. Today = tz-correct day window (`loadProgressData` in `lib/db/progress.ts`)
  with total, sessions-today, week-to-date goal quotas, and habits-today; This
  week = `computeWeekRecap` + a hand-rolled SVG `components/v2/donut.tsx` +
  `HabitWeekGrid` + share-as-text; History = current-month rollup donut with a
  link to the full `/history` browser.
- **Feed tab.** New `/feed` route (`components/v2/feed-v2.tsx`); live "clocked in
  now" strip + friends' recent sessions. Comment threads collapse to a count +
  one preview that tap through to the new session detail page.
- **Session detail.** New `/session/[id]` + `getSessionForViewer`
  (`lib/db/session-detail.ts`) — RLS-gated composition (author, goal label,
  before/after signed URLs, reactions, full comment thread + composer, report).
  Invisible/private sessions 404.
- **Friends tab.** Restyled `app/friends/friends-client.tsx` to V2 (avatars in
  rows, request-count badge, caption tokens).
- **Onboarding (5 steps) + Sign in.** New `onboarding-client-v2.tsx` (welcome +
  handle → first goal → practice timer → categories → habits intro), dropping the
  spotlight tour; reuses `setUsername`/`createGoal`/`clockIn`/`clockOut`/
  `completeOnboarding`. Login restyled with a real tagline + a post-deletion
  notice (`?deleted=1`, which `HoldToDelete` now lands on).
- **Moderation queue + report sheet.** Restyled `app/admin/admin-reports.tsx`
  (reason chip, V2 tokens) and the `report-button.tsx` trigger.
- Earlier this session (already landed): Subplan 0 foundation (flag, theme, nav
  ticker), Settings hub, You/friend profiles + `HabitWeekGrid`, and the
  standalone `/categories` route with keyword rules.

### 10:00 · Social v2 — Phase 4 (moderation + account deletion) & first deploy
The last roadmap phase and the safety gate for exposing social beyond your own
circle: users can report content, you can take it down, and anyone can delete
their account. All behind `SOCIAL_ENABLED`. **Shipped to `main`** (Vercel
auto-deploy) — dark unless `NEXT_PUBLIC_SOCIAL_ENABLED=1` is set in the host.

- **Reporting (write-only for users).** New `reports` table with an INSERT-only
  RLS policy — a reporter can file but never read reports; only the admin can,
  via definer RPCs. Fixed reason set + optional note (`lib/social/reports.ts`).
  `app/actions/reports.ts` → `reportContent`; a `Flag` control
  (`components/report-button.tsx`) wired onto other people's stories, feed
  comments, and profiles (never your own content).
- **Admin moderation — no service-role key.** All admin power is `SECURITY
  DEFINER` RPCs gated by a single `is_admin()` helper (holds one UUID); the
  god-key stays out of the codebase entirely. `/admin` (`app/admin/`) 404s
  everyone but the admin and lists open reports with an embedded target preview
  (comment body / story photos re-signed for review via an `is_admin()` branch
  in `can_see_session_photo`). Take-down = hide immediately: `admin_take_down_story`
  nulls the photo columns (drops it from every profile + stops the storage
  policy serving it), `admin_delete_comment` deletes the row; `admin_resolve_report`
  flips status off the queue. A "Moderation" link appears on `/me` only when
  `is_admin()`. `app/actions/admin.ts` wraps the RPCs (which self-gate).
- **Account deletion.** `delete_own_account()` (`SECURITY DEFINER`, reads
  `auth.uid()` internally so it can only ever delete the caller) clears the
  polymorphic reports about the user, then deletes the `auth.users` row — every
  owned table is `ON DELETE CASCADE`, confirmed via `pg_constraint`, so one
  delete cascades sessions/comments/reactions/goals/categories/habits/
  calendar/friendships/profile. `app/actions/account.ts` → `deleteAccount`
  removes the user's photo blobs from Storage first (rows are gone after), then
  calls the RPC and signs out; type-to-confirm UI (`components/delete-account-button.tsx`)
  on `/me`.
- **Verified:** tsc/eslint/build + 45 tests green; a 14-check adversarial JWT
  suite confirmed non-admins are locked out of every admin surface, reports are
  unreadable to users and unspoofable, and take-down actually removes content;
  a scoping test confirmed deletion refuses unauthenticated and touches only the
  caller. Pre-deploy security pass: every social route flag-gated, no
  service-role key anywhere, all social reads behind RLS.

## 2026-07-13

### 09:03 · Social v2 — Phase 3 subplan 3: profile story cards
The photo viewing surface. A session appears on a profile ONLY as a complete
before+after **story card**; photo-less / half-complete sessions stay private
(no "share anyway" toggle — the complete pair is the share). Behind
`SOCIAL_ENABLED`; report/takedown still deferred to Phase 4.

- `lib/db/stories.ts` → `listProfileStories(userId)`: complete-pair sessions
  (`before_photo_path` AND `after_photo_path` not null, partial-index-backed),
  RLS-filtered, with batched signed before/after URLs via `getSessionPhotoUrls`.
  Rows whose URLs don't sign (storage denied) are dropped — belt-and-suspenders
  with the tightened storage policy.
- `components/story-card.tsx`: before/after images side-by-side + label +
  duration + when.
- `app/profile/[username]/page.tsx`: the plain "Recent sessions" text list is
  **replaced** by a "Stories" section (enforcing photo-less = private on the
  profile); Goals-this-week + Weekly-habits aggregates kept.
- Also this session: tightened the **storage read policy** so a friend's signed
  photo URLs resolve only for non-private, complete-pair sessions
  (`can_see_session_photo`) — closes the enumeration/private-photo gap.

### 22:04 · Social v2 — Emoji reactions on the feed
The deferred Phase 2 interaction, added alongside comments. Behind
`SOCIAL_ENABLED`; requires the `session_reactions` table + `toggle_reaction`
RPC (run separately).

- Fixed palette 👍 🔥 💪 👏 🎯 (`lib/social/reactions.ts`, shared by action,
  reader, UI, and enforced again in the RPC). Tap to react, tap again to remove.
- `session_reactions` table: RLS **SELECT mirrors session visibility** (reuses
  the `can_see_session` helper); writes go only through the `toggle_reaction`
  SECURITY DEFINER RPC (atomic insert-or-delete, re-checks visibility + emoji),
  so a reaction can't target a session you can't see or be forged.
- `app/actions/reactions.ts` (`toggleReaction`), `lib/db/reactions.ts`
  (`listReactionsForSessions`, batched + aggregated + `mine` flag),
  `components/reaction-bar.tsx` (highlights your reactions, shows counts), wired
  into each feed item above the comment thread.

### 21:51 · Social v2 — Phase 3 PR 2: photo capture in the clock flow
Optional before/after capture, behind `SOCIAL_ENABLED` (photo columns/bucket
from PR 1 required). Skipping is one tap and equal-weight — never a guilt
pattern; the timer never waits on a photo.

- `components/session-photo-step.tsx`: a `Dialog` with a camera input
  (`<input type="file" accept="image/*" capture="environment">` — not
  getUserMedia, for iOS PWA reliability), an equal-weight Skip, preview +
  Retake, and an uploading state. Downscales client-side then calls
  `uploadSessionPhoto`. Errors toast and keep the session intact for retry.
- Wired into `app/clock/clock-client.tsx`: the before step opens after clock-in
  (timer already running), the after step after clock-out (session already
  ended; profile hint shown only when a before photo exists). Dismissing never
  cancels the session.
- `clockIn` now returns the new `sessionId`; `lib/images/downscale.ts` does a
  canvas downscale (≤1600px/JPEG 0.8) that bakes in EXIF orientation before the
  server re-encode; the active-session card shows the before-photo thumbnail via
  a signed URL from `getSessionPhotoUrls`.

### 21:34 · Social v2 — Phase 3 PR 1: server-side photo pipeline
Server side only, no UI — inert until the capture UI (PR 2) lands, so safe to
ship now. Requires the `session-photos` bucket + photo columns (run separately).

- `app/actions/session-photos.ts` → `uploadSessionPhoto(sessionId, kind,
  formData)`: validates the file (image/*, ≤8 MB), enforces ownership
  explicitly (friend-read RLS means a non-empty session read no longer implies
  ownership), applies the timing rules (`before` → active; `after` → ended
  within a 10-min upload tolerance), re-encodes with **sharp**
  (`rotate().resize(1600).jpeg(80)`) which strips all EXIF/GPS, upserts to
  `{user_id}/{session_id}/{kind}.jpg`, and records the path on the session.
- `lib/db/session-photos.ts` → `getSessionPhotoUrls`: 1-hour signed URLs for the
  private bucket (batched when both photos exist).
- `sessions` read layer (`lib/db/sessions.ts`, `lib/storage.ts`) gains
  `beforePhotoPath`/`afterPhotoPath`; test factories updated.
- Verified: tsc/eslint/tests/build green; a direct sharp run confirmed a
  3000×2000 EXIF/GPS image comes out 1600×1067 with 0 EXIF bytes.
The deferred Phase 2 live element. Behind `SOCIAL_ENABLED`; no new tables/SQL.

- A "Clocked in now" strip at the top of the feed shows friends *currently* in a
  session (`listClockedInNow` in `lib/db/feed.ts` — active sessions,
  `ended_at IS NULL`, reusing the feed's friend-read RLS so private/non-friend
  active sessions never appear). Each row: avatar → profile, goal/task label, a
  live worked-duration (client-side second tick via `useNow`), and a
  working/paused dot.
- "Live" = polling, not Realtime: `components/feed-live-poll.tsx` refreshes the
  server read every 30s, pausing while the tab is hidden and refreshing on
  refocus, so new clock-ins/outs surface within ~30s.
- `sessionWorkedMs`/`isPaused` (`lib/session.ts`) widened to accept just the
  timing fields so the client computes the live duration from a minimal payload.
- New: `components/{clocked-in-strip,feed-live-poll}.tsx`. Empty strip renders
  nothing; the feed's empty-state now hides when someone is clocked in.

## 2026-07-11

### 21:39 · Social v2 — Phase 2 (the feed + comments)
All behind `NEXT_PUBLIC_SOCIAL_ENABLED`; with the flag off the beta is
unchanged (Home stays the personal dashboard, `/me` 404s, no feed/comments).

- **Home becomes the feed.** When social is on, `/` renders friends' recent
  finished sessions (`lib/db/feed.ts` → `listFriendFeed`, batched over accepted
  friends, RLS-gated so only non-private / accepted-friend rows appear); the
  personal dashboard (time this week, goals, habits, recap/history, profile)
  moves to a new **You** tab at `/me`. The dashboard was extracted verbatim into
  `components/dashboard.tsx` and is shared by both mount points, so the flag-off
  path is byte-identical to before. Bottom nav swaps its Search slot for **You**
  when the flag is on.
- **Comments** (`session_comments` table): freeform text (1–500 chars) on feed
  sessions. Visibility **mirrors session visibility** — a new `can_see_session`
  `SECURITY DEFINER` helper encodes `owner OR are_friends AND NOT is_private`
  once, and the SELECT/INSERT/DELETE policies build on it (+ `owns_session` for
  owner-moderation delete). A comment can never reveal a session you couldn't
  already see, authorship can't be forged, and deletes are limited to the author
  or the session owner. Proven with a 10-point adversarial JWT test.
- New: `app/actions/comments.ts` (`addComment`/`deleteComment`),
  `lib/db/comments.ts`, `components/{feed,comment-composer,delete-comment-button}.tsx`,
  `lib/dates.ts` `formatRelativeTime` ("12m ago").
- Deferred: live "clocked in now" strip, emoji reactions, report/abuse tooling
  (Phase 4), realtime, session photos (Phase 3).

### 20:48 · Social v2 — Phase 0 (security foundation) + Phase 1 (profiles)
All behind `NEXT_PUBLIC_SOCIAL_ENABLED` (off in the beta), so nothing here
affects the live single-user app.

- **Public identity:** `username`/`display_name`/`bio` on `profiles` (unique
  index on `lower(username)`); `public_profiles` view exposing only those
  fields; username onboarding + validation (`lib/social/username.ts`).
- **Friend graph:** `friendships` table (pending/accepted/blocked) with RLS
  that hides blocks from the blocked party; consent-critical mutations
  (`accept_friend_request`, `block_user`) routed through `SECURITY DEFINER`
  RPCs; prefix-search directory (`search_users`, block-aware). Minimal
  `/friends` UI (search, incoming/outgoing requests, friends, blocked).
- **Per-item privacy:** `is_private` on goals/habits/sessions (new items
  shared, pre-existing back-filled private); `PrivacyToggle` in edit dialogs +
  a lock indicator on private items.
- **RLS friend-read rewrite (load-bearing):** SELECT policies loosened from
  owner-only to `owner OR are_friends AND NOT is_private`; own-view reads
  hardened first with explicit `.eq("user_id", me.id)` so friends' rows can
  never leak into your own screens. Verified with a 5-persona adversarial
  test (JWT impersonation).
- **Profile pages (`/profile/[username]`):** identity header, per-person
  friend actions, own-profile edit (display name + bio), and a friend's
  non-private goals/habits/recent-sessions via `*ForUser(userId)` read
  helpers. Blocked pairs 404 (block stays invisible). Entry points from Home
  and `/friends`.
- **Dev config:** pinned `turbopack.root` in `next.config.ts` to stop a stray
  home-dir lockfile from wedging the dev server.

## 2026-07-10

### 23:40 · AI-categorizer cost cap for beta
- Per-run cap (`MAX_EVENTS_PER_RUN = 300`) on `categorizeEventsInRange`: a
  single Auto-categorize press sends at most 300 uncategorized events to the
  model (~4 Haiku calls); the rest finish over repeat presses (idempotent).
  The `ok` result gained `remaining`; the three trigger buttons (Home, Clock,
  History) show a "N more, tap again" hint.
- Global kill-switch: `DISABLE_AI_CATEGORIZATION=1` (env) makes the action
  return "Auto-categorization is paused right now." before any Anthropic call
  — keyword-rule categorization still applies at read time, so nothing breaks.
  One Vercel env change stops all AI spend.

### 23:13 · Onboarding — History tour step (calendar sync + auto-categorize)
- New `tour-history` step between the Home and Habits tours (wizard is now
  9 steps): a History-page replica showing the real current-month rollup
  (`computeMonthRollup` fetched in `app/onboarding/page.tsx`), with two
  sequential spotlights over the calendar actions.
- Spotlight 1 wraps a **live** `SyncCalendarButton` — users can pull their
  Google Calendar in during onboarding; its `router.refresh()` updates the
  month total in place (`syncCalendar` now also revalidates `/onboarding`).
- Spotlight 2 is a static replica of the Auto-categorize button (real
  uncategorized count when there is one) explaining AI categorization,
  precedence (manual > rules > AI), and the review popup — and that the
  button lives on /history.
- Home tour's History-card spotlight button relabeled "Go to Habits" →
  "See History".

### 23:05 · Onboarding flow for new users
- New /onboarding first-run wizard recreated from the Claude Design handoff
  (`design_handoff_onboarding/`): welcome → how it works → set first goal
  (quota stepper → real `createGoal`) → practice clock-in (real
  `clockIn`/`clockOut`, live ticker, success banner) → categories explainer →
  spotlight tour of Home (recap, history) and Habits. Tour screens render the
  user's REAL week data (the practice session shows up in "Time this week").
- Gate: new nullable `profiles.onboarded_at` column (added via Supabase SQL,
  not in-repo); Home redirects to /onboarding while null. OAuth callback
  default landing changed /clock → / so brand-new users hit the gate.
- Retest: "Replay onboarding" button on Home's Profile card
  (`replayOnboarding` action nulls the stamp; each replay runs the real flow
  and creates a real goal + session, deletable afterwards).
- `completeOnboarding`/`replayOnboarding` actions in `app/actions/profile.ts`;
  `BottomNav` gained an `activePath` override (hidden during wizard steps,
  shown decoratively on tour screens); `fade-up`/`pulse-dot` keyframes in
  globals.css. Practice step adopts an already-running session on replay
  instead of tripping the one-active-session constraint.

### 22:20 · Design sync to Claude Design + BottomNav hardening
- Synced the app's client-safe component surface (20 components: 12 shadcn/ui
  primitives + 8 custom widgets) to a "Progra Design System" project on
  claude.ai/design, with the warm palette, Hanken/Newsreader fonts, and
  authored preview cards. Sync config lives in `.design-sync/`.
- `BottomNav` now falls back to `""` when `usePathname()` returns null (it
  does outside a Next router, e.g. standalone design previews) instead of
  crashing in the tab matchers.

### 21:45 · Search tab placeholder
- New /search route in Plan's old nav slot (magnifying-glass icon, second tab).
  Static teaser page for now: "Coming soon…" with a hype line about searching
  sessions, goals, habits, and calendar events. No data, no client component.

### 21:30 · Plan tab removed — whole planner subsystem deleted
- Deleted the /plan route (weekly grid, Generate, block edit dialogs) and its
  nav tab; bottom nav is now 4 tabs (Home, Clock, Goals, Habits).
- Removed the entire scheduled-blocks subsystem: `app/actions/scheduled-blocks.ts`,
  `lib/db/scheduled-blocks.ts`, the greedy placement engine (`lib/placement.ts`),
  and the missed-block sweep + "Needs reslotting" card (`missed-blocks-card.tsx`),
  including its instance on Home.
- Session plans killed everywhere: `app/actions/session-plans.ts` and
  `lib/db/session-plans.ts` deleted (all CRUD was already dead code), orphaned
  `plan-picker.tsx` removed. Vestigial `sessions.session_plan_id` dropped from
  the `Session` type, `SESSION_COLUMNS`, and the clock-out plan-flip branch —
  goal attribution already went directly through `sessions.goal_id`.
- `listBusyTimes`/`BusyInterval` removed from `lib/db/calendar-events.ts`
  (planner-only); `syncCalendar` no longer revalidates /plan.
- Supabase: `scheduled_blocks`, `session_plans`, and `sessions.session_plan_id`
  to be dropped via SQL editor (schema is not in-repo).

### 20:39 · Session history — Google Calendar events in the feed
- /sessions previously read only the `sessions` table, so synced calendar
  events (separate `calendar_events` table) could never appear. New merged
  read (`lib/db/history.ts` `listHistoryPage`) pages sessions and past events
  together by start time; events carry their resolved category and a
  "Calendar" badge, count toward day totals, and respect the category filter
  chips (exclusions stay hidden).
- New `listPastEventsPage` in `lib/db/calendar-events.ts` (cursor-paginated,
  ended events only, batches past JS-side exclusion/category filtering so a
  sparse category doesn't end pagination early); categorization mapping
  extracted to a shared `toDayEvents` helper.
- `syncCalendar` now also revalidates `/sessions`.

## 2026-07-09

### 22:48 · Habits — average per day uses elapsed days
- The weekly "Average per day" stat now divides by days elapsed so far this
  week (Mon..today) instead of a flat 7, so mid-week averages aren't dragged
  down by days that haven't happened yet.

### 22:45 · Habits — edit dialog (rename + palette color)
- Habit rows on /habits gained a pencil next to the archive X: opens the same
  rename + 12-swatch color dialog categories got. New `updateHabit` action
  (palette-validated, revalidates `/habits` + `/`).
- New habits now auto-assign from the shared 12-color palette
  (`lib/category-colors.ts`) instead of the old private 8-color list; existing
  habit colors are untouched until edited. Swatch grid extracted to shared
  `components/color-swatches.tsx` (clock's category dialog now uses it too).
- archive/create habit actions also revalidate `/` (home shows habits).

### 22:40 · Week widgets — sectioned Goals / Categories layout
- The home "Time this week" card and /clock's This week widget now share a
  sectioned layout (`components/week-breakdown.tsx`): total hours first, then
  a "Goals · Xh" section (starred rows, "Goal:" prefix dropped — the heading
  says it), then "Categories · Xh". Bars still scale against the largest row
  across both sections so lengths stay comparable.

### 22:34 · Goal rows get a star marker
- Synthetic "Goal: {name}" rows in every category breakdown (home week card,
  /clock This week, /history, recap card) now show a small filled star instead
  of a color dot. New shared `components/category-marker.tsx` renders the
  star/dot; `CategoryBreakdownRow` gained `isGoal`.

### 22:29 · Clock — category editing + 12-color palette
- Categories card on /clock: each row shows its color dot plus a pencil that
  opens an edit dialog — rename and/or pick a color from a fixed 12-swatch
  palette (`lib/category-colors.ts`; muted hues that read on light and the
  clock's dark mode). Tap the selected swatch again to clear the color.
- New `updateCategory` action (name/color patch; color validated against the
  palette server-side; 23505 → duplicate-name error). Revalidates `/`,
  `/clock`, `/history`, `/recap` since names/colors render everywhere.
- Colors now show as dots in the clock-in category picker chips and the
  "This week" breakdown rows (history/recap already rendered them).

### 22:16 · History breakdown — sort by recency
- Category dropdown items now list most recent first (was: biggest time
  contributor first).

### 22:08 · History breakdown — item dates + delete
- Each item in a category's expanded breakdown now shows the date it happened
  ("Jun 24") next to its hours. `CategoryItem` gained an `id` field to make the
  rows identifiable.
- Items can be deleted from the dropdown: a grey X to the left of each row
  (hover-reveal on pointer devices, always visible on touch) opens a confirm
  dialog. Sessions are deleted for real; calendar events are **excluded**
  (hidden from Progra, kept on Google Calendar — they'd re-sync otherwise) via
  the existing `event_exclusions` path.
- `deleteSession` and `excludeEvent` now also revalidate `/history` and
  `/recap` so totals update immediately after a delete.

### 22:00 · Recap restructure — categories lead, tz-correct weeks
- Recap hero is now **total tracked hours across categories** (sessions +
  calendar), not goal-focused hours. Category breakdown renders first, then the
  goal quota bars under a "By goal · Xh focused" section — each section carries
  its own total. Share text follows the same order.
- Removed the sessions/habit-checks/blocks counts row and the "Most time on X"
  highlight. Kept "Hit quota on…" and the closing "That's a wrap on your week."
- **Week boundary fix:** recap weeks were computed with server-local time (UTC
  on Vercel), so the "week" started Sunday evening local time. Boundaries now
  come from the profile timezone via new `lib/dates.ts` helpers
  (`zonedDayStartMs`, `mondayOfDateISO`; DST-aware, unit-tested). Recap's
  per-goal totals also switched from `aggregateWeekByGoal` (derived its own
  server-local week) to `aggregateRangeByGoal` on the same corrected window.
- `computeWeekRecap` no longer fetches blocks/habits (leaner query set);
  `WeekRecap` dropped the count fields.
- ⚠️ Other week surfaces (home, /clock, /goals, /history) still use
  server-local `startOfWeek(new Date())` and can disagree with the recap near
  week edges — migrate them to the same tz helpers in a follow-up.

## 2026-07-07

### 13:30 · Goals revamp — clock straight into a goal
- Goals are now just a title + weekly quota (editable — pencil on each goal
  card). Dropped the "planned sessions" sub-tasks from the goal flow.
- Clock page: the category selector is now a **Category / Goal** toggle — pick a
  category *or* a goal (mutually exclusive) and clock in. No planning step;
  goal time accrues the moment you clock out.
- A session now links straight to a goal (`sessions.goal_id`) instead of the old
  `session → session_plan → goal` indirection. `aggregateRangeByGoal` reads
  `goalId` directly across home / goals / history / recap.
- Goal-clocked time shows as a synthetic **`Goal: {name}`** row (one accent
  colour) in the "Time this week" and History category breakdowns, reconciling
  with the totals; History tap-to-expand lists a goal's sessions (tagged
  `goal`).
- Goals tab: each goal shows its quota bar plus **this week's sessions** under
  it (task, length, time range, day).
- Session edit dialog can now switch a past session between a category and a
  goal after the fact.
- Requires a one-time DB migration: `alter table sessions add column goal_id
  uuid references goals(id) on delete set null;`. The `/plan` planner is
  untouched (still uses `session_plans`).

### 12:18 · Calendar sync range + History breakdown
- Widened the Google Calendar sync window from −30/+90 days to −365/+90, so a
  full rolling year of history syncs (the month/year History views had no older
  data to show). Sync is a manual, paginated button, so a year of events is fine.
- Sync now revalidates `/history`, `/recap`, and `/plan` (not just `/clock` and
  `/`), so those views no longer render stale after a sync.
- Added a "Sync Google Calendar" button to the History month & year views, below
  the categorize/review button.
- History category rows are now expandable: tap a category to see every session
  and calendar event making up its total, each tagged by source
  (clock / rule / manual / AI / uncat). Items reconcile exactly with the bar —
  same attribution as the totals (`lib/aggregate.ts#buildCategoryItems`).

## 2026-07-02

### 01:01 · AI event categorization
- Auto-categorize Google Calendar events into your categories with Claude
  (Haiku), server-side via a Next.js server action. Confident title→category
  matches are stored as `source: "ai"` in `event_categorizations`; manual
  overrides and keyword rules still win over AI guesses.
- History (month & year): added an "Auto-categorize N uncategorized events"
  button scoped to the period on screen, so historical months/years can be
  sorted (the /clock button only scans a rolling −30/+90-day window).
- Review popup: after categorizing, a dialog lists every event the AI just
  labeled, grouped by category, with one-tap **Change** (re-assign) or **Hide**
  per event. Corrections write a manual override that supersedes the AI row.
- The History button persists once everything's sorted, flipping to
  "Review N auto-categorized events" (re-opens the popup from stored decisions,
  no model call) so past choices stay editable. Newly added calendar events
  flip it back to categorize mode automatically.
- Categorizer now surfaces real failures (e.g. a missing/invalid
  ANTHROPIC_API_KEY) instead of silently reporting "nothing to categorize".

### 01:27–01:39 · Mobile / PWA layout
- Fixed content rendering under the iOS status bar / notch (headers "shifted too
  high") and behind the bottom nav on phones. The app now insets by
  `env(safe-area-inset-top)` / `env(safe-area-inset-bottom)` at the shell level;
  these are 0 on desktop, so it's a phone-only change. Root cause was
  `viewport-fit=cover` + a black-translucent iOS status bar with no safe-area
  padding on the content.
- Tightened the bottom nav: shortened the bar (88px → 64px) and anchored the tab
  icons to the bottom so they sit just above the home indicator instead of
  floating in the middle of an over-tall bar (the "bar too high up" look).

## 2026-06-30

- Created this changelog.
