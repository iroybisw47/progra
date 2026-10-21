# Changelog

A running log of changes, grouped by date (newest first). Section headings are
prefixed with the commit time (local, `HH:MM`) the work landed — a proxy for
when it was done, not a start/stop work timer.


## 2026-10-20

### 23:45 · Streaks P6: release prep (feat/streaks, dark)
- **Onboarding notify copy, flag-gated.**
  - With `STREAKS && SOCIAL_PUSH` on, v2's notify card lists "An evening reminder while your streak is still open" and stops promising "no streaks".
  - v3's `notifyReasons` takes an optional `streaks` and lists the same line, with a test.
  - Flag off, both are unchanged.
- **`docs/SCREENS.md`:** the `STREAKS` flag context, plus S73 (the badge), S74 (the announcement card) and D35 (the sheet).
- **`MORNING.md`** at the root has status by phase, the decisions, what's blocked and how to test.
- **Blocked on the owner:**
  - The SQL isn't in prod: the Supabase MCP is read-only here.
  - The launch date, the announcement copy, the patch note and the device check.
  - `habit-step.tsx:30`'s "next to your goals" copy.
- **Gate:** tsc and eslint are clean, vitest passes 1469 of 1469, and the build passes.

### 23:20 · Streaks P5: the 7pm reminder and the freeze note (feat/streaks, dark)
- **`app/api/cron/streaks/route.ts`** is the second scheduled job. It uses recap-ready's `CRON_SECRET` check (verified on `next start`: 401 with no bearer or a wrong bearer). With `STREAKS` off it returns a no-op 200. Each run:
  1. `settle_all_streaks()` records closed days and freezes even for people who don't open the app;
  2. then, with `SOCIAL_PUSH` on, `streak_push_candidates()`;
  3. then `sendStreakPush` for each candidate, serially.
- **`lib/push/streak-push.ts`** (pure, tested) holds the copy, the keys and the TTLs.
  - **Reminder**, 19:00–21:59 local, for a streak of 3 or more with today not yet counted: "Today's still open". The tap goes to `/clock`, and the 2h TTL means it can't land after the evening.
  - **Freeze**, 08:00–21:59 the morning after: "A freeze kept your streak going". The tap goes to `/me`.
  - The tone test bans lose/break/miss.
- **`lib/push/send-streak-push.ts`** is the recap sender's pipeline:
  1. re-read the opt-out;
  2. claim the `push_log` key `streak-<kind>:<uid>:<day>`;
  3. read the tokens and send to APNs;
  4. delete `gone` tokens;
  5. write `notification_log` (`streak_reminder` / `streak_freeze`, added to `NOTIFICATION_TYPES`).
- **Other code:**
  - Streak pushes share the existing push switch, and Settings' label now names streaks.
  - **There is no friend push**, by the owner's call.
- **SQL** (`.claude/plans/streaks.sql`):
  - STEP 3 adds `settle_all_streaks`, `streak_push_candidates` and the `notification_log` type CHECK. The quiet hours (22:00–07:59) live in the RPC.
  - STEP 4 is the pg_cron/pg_net/Vault schedule. Neither is installed in prod yet.
  - The harness now passes 129 checks, with all 21 mutants caught.
- **Docs:** AGENTS.md's "one job" is now two, and service-role kind (3) names the streak sender. ARCHITECTURE.md and `lib/supabase/admin.ts` are updated to match.
- **Gate:**
  - tsc and eslint are clean.
  - vitest passes 1469 of 1469.
  - The build passes.
  - On `next start`, `/dev/streaks` renders the not-found page (same as `/dev/friends-v3`), and `/me`, `/feed` and `/profile/x` redirect to `/login` signed out.

### 22:40 · Streaks P4: a friend's streak on their profile (feat/streaks, dark)
- `/profile/[username]` reads `getFriendStreak` in the same parallel wave as the nudge state. The RPC re-checks friendship and blocks itself, and it returns the friend's **shared-only** current and longest, never their freezes.
- The badge rides the name's last line (`flex-wrap`). It shows from 2 days and only for an accepted friend, never before launch. Your own page there shows your full streak instead.
- The friend sheet says "Counts shared sessions and habits".

### 22:30 · Streaks P3: your badge, its sheet, the announcement card (feat/streaks, dark behind `STREAKS`)
- **Reads and writes:**
  - `lib/db/streaks.ts` has `getMyStreak` and `getFriendStreak`, `cache()`'d RPC reads that return null when the flag is off, the SQL is missing, the DB switch is off, or on error. It logs once when the DB launch date and `STREAK_LAUNCH_DATE` differ, and the DB wins.
  - `app/actions/streaks.ts` has `settleMyStreak` and `dismissStreakAnnouncement`. `revalidateStreakSurfaces()` covers `/me`, `/feed` and `/profile/[username]`.
- **`lib/streaks-view.ts`** (pure, 20 tests) holds the RPC mappers and these rules:
  - your badge shows from 1 and dims while at risk;
  - a friend's badge shows from 2;
  - "N of 2 freezes left in October";
  - the announcement shows before launch until dismissed, then once more on or after Day One, and **never renders placeholder copy in a production build**.
- **UI:**
  - `StreakBadge` is a fire-and-days pill in the palette's orange. It's `shrink-0`, so the name truncates first, and a 400-day badge fits at 393px. It dims when at risk and gains a quiet ring at 7/30/100.
  - `StreakSheet` is lazy-loaded. It shows current and longest, the milestone marks, the freezes line and the at-risk line.
  - `StreakAnnouncement` is a dismissible card on `/me`, under the stats, and on `/feed`, under the header. Its copy is the owner's `STREAK_ANNOUNCEMENT_COPY`, which is still `[ANNOUNCEMENT COPY]`.
- **`EnsureStreakSettled`** fires the settle action only when the read reports unsettled closed days. It's mounted with the announcement slot on `/me` and `/feed` rather than in the root layout, so the streak RPC isn't added to every page.
- **Telemetry:** `streak_sheet_opened {own}` and `streak_announcement_dismissed {phase}`.
- **Dev preview:** `/dev/streaks?fixture=…[&sheet=1]`, with 12 fixtures. It 404s in production.
- **Gate:**
  - tsc is clean.
  - eslint is clean on changed files, apart from the accepted `Date.now()` debt.
  - vitest passes 1463 of 1463.
  - The build passes.
  - Signed out, `/me`, `/feed` and `/profile/x` redirect to `/login`.
  - Every fixture was screenshotted at 393×852 with no horizontal overflow.
  - Progra has no dark mode, so there is only a light check.

### 21:25 · Streaks P1: the rules, pure (branch feat/streaks)
- **Plan:** `.claude/plans/streaks.md` and `streaks-P1..P6.md`. The owner's scope is a personal streak, plus a friend's shared-only streak on their profile. There is no friend at-risk push, no pair streaks and no feed badge. Closed days are final, the reminder is at 7pm, and the launch date is still to be decided.
- **`lib/streaks.ts`** holds the pure rules: `streakDayOf` / `closeMs` (04:00 cutoff, DST-correct through the newly exported `zonedWallClockMs`), `sessionQualifies` (5 minutes of worked time through `sessionWorkedMs`), `tickDay`, `dayFacts`, `walkDays`, `streakState` and `milestoneFor`.
  - A habit tick counts for the streak day it was *made* in, and only when it's for that day or the calendar day after. Backfills never count.
  - A freeze bridges a missed day without adding to the count. There are two per calendar month, and a freeze is never used at streak 0.
  - Ledgered (settled) days are final.
  - The shared count, the one friends see, skips private-only days. Ledgered freezes still bridge it.
- **`lib/streaks-config.ts`** holds the knobs: `STREAK_LAUNCH_DATE = null` (pre-launch everywhere), the cutoff, 5 minutes, 2 freezes, the 7pm reminder, the milestones 7/30/100, and the friend minimum of 2.
- **The `STREAKS` flag** (`NEXT_PUBLIC_STREAKS`) means the SQL has run. Nothing reads it yet.
- **`lib/streaks.fixtures.json`** holds 31 cases and 15 day-boundary checks, which the P2 SQL harness will run too. The cases cover the 1am-on-launch-day edge, LA and London DST in both directions, paused time, auto-ended sessions, midnight-crossers, running sessions, ledger finality, a timezone change, and shared vs full counts.
- **Gate:**
  - tsc and eslint are clean.
  - vitest passes 1442 of 1442, with 65 new tests. Three deliberate rule breaks were each caught: a midnight cutoff (17 failures), 3 freezes (29), and private sessions counting as shared (1).
  - The build passes.

### 18:10 · Onboarding ends on the notifications ask, in v2 and v3
- **Owner's request:** the notifications slide should be the last step of onboarding, in both v2 (live) and v3 (dark).
- **v2:** the order is now welcome → how → goal → habit → clock → post → friends → **notify** (`STEPS`, `lib/onboarding.ts`). Whichever step is last finishes the run (`isLast` → `finish()`):
  - In the app, notify is last. "Enable notifications" shows iOS's dialog, then finishes on any answer, and "Skip for now" finishes without asking. On an already-answered device the CTA reads "Start my week".
  - Find friends now reads "Continue" / "Continue without sharing" there.
  - On the website, where notify isn't shown, Find friends is still last and still finishes ("Start my week").
- **v3:** the order is now … friends → ready → **notify** (`V3_STEPS`, `SCREEN.ready = 5`, `SCREEN.notify = 6`).
  - When notify is part of the run, "Ready?"'s CTA reads "Continue", and the notifications screen does the hand-off. Its "Turn on notifications" is now the prefetched Clock-tab link: iOS's dialog, then the exit and the Clock tab. "Not now" hands off without asking. Back or ✕ while the dialog is up cancels the hand-off.
  - Its section label is now "One last thing".
  - Where notify isn't shown (the website, an answered device, nothing to send), "Ready?" is last and its "Start session" hands off as before.
  - `stepOverNotify` is gone, since a last screen is never stepped over, and `progressFor` simplifies. The dev preview's notifications screen is now `?screen=7`.
- **Analytics:** no SQL. The step names are unchanged, and the dashboard rows follow `STEPS`, so notify now lists last.
  - One small skew: `admin_onboarding_stats` still infers "reached" from v2's old ordinals for anyone without a view event. So a v2 user stopped on Find friends is counted as having passed notify. Every new signup sends view events, so this barely matters.
- **Gate:**
  - tsc and eslint (changed files) are clean.
  - vitest 1377/1377 passes, with new tests for the last step in each flow.
  - The build passes (with the self-link moved aside, then restored).
  - `/dev/onboarding-v3?fixture=ready` was driven in Playwright at 393×852: Ready → Continue → notifications (CTA is the link), Back returns to Ready, and "Not now" plays the hand-off.
  - v2's notify step can't render in a browser (native-only), so it is covered by unit tests only and needs a device check. Not committed.

### 17:40 · In-app survey, answered on load, results on the analytics dashboard
- **Owner's request:** a survey in the app, one question at a time, that members must finish on load with no option to skip. The output goes on the analytics dashboard.
- **Three questions** (`lib/survey.ts`, survey id `2026-10-pricing-social`): what they'd pay for, what would get their friends to join, and how they feel about daily notifications. The copy is the owner's, with light fixes ("would you give you access", the unclosed parenthesis). Each question takes one answer. The "Fuck Progra" option was dropped at the owner's request after the preview, before any SQL ran, so no shipped key changed.
- **The modal** (`components/v2/survey-modal.tsx`, mounted in the root layout):
  - It has no close button, the backdrop is inert (`disablePointerDismissal`) and Escape is ignored. Pick an option, then Next (Submit on the last question).
  - Answers are write-once, so picking and committing are separate steps.
  - It resumes at the first unanswered question, and a failed save toasts and stays put.
  - Shows on `/` only and defers under the weekly-review takeover, like What's New.
  - It outranks What's New and the UW prompt, which wait for the load after it's done, and yields to the plan-complete modal.
- **Storage:** `survey_answers` holds one row per (user, survey, question), storing the option's key. Own rows only; insert and read but no update or delete, and `answered_at` is the server's clock.
  - `answerSurvey` inserts with `ON CONFLICT DO NOTHING`. Once every question has a row it stamps `profiles.survey_done`.
  - The gate (`surveyOwed`) reads that column off the profile the layout already has, so it's free for anyone who has finished. It **fails closed** on a missing column, because a modal you can't leave must never open when its writes would fail.
  - A new survey later means a new `SURVEY.id`. Shipped ids are frozen, since the dashboard groups by them.
- **Dashboard:** a fourth tab, **Survey**, on `/admin/analytics`. It has eligible / started / finished tiles, a bar chart per question with shares, and a respondents table linking to each member's timeline. The internal, segment and cohort filters apply.
  - The data comes from `admin_survey_results()` (an `is_admin()` definer over `analytics_population`), shaped by `lib/survey-results.ts`.
- **SQL:** `.claude/plans/survey.sql`. **The owner reported it run in prod on 2026-10-20**, with STEP 0, 1V and STEP 2 (11/11) all passing. The modal is live from the deploy that ships this code.
  - Proven on PGlite with `nudges-harness/survey.mjs`: STEP 0, STEP 1 run twice, 1V, STEP 2's 11 adversarial checks and the results fixture all pass. All 8 planted mutants are caught.
- **Gate:**
  - tsc and eslint (changed files) are clean.
  - vitest 1376/1376 passes, with 18 new tests for the gate, the keys and results shaping.
  - The build passes (with the self-link moved aside, then restored). The signed-out smoke test serves the landing page at `/`, and `/admin/analytics?tab=survey` is refused.
  - `/dev/survey` was driven in Playwright at 375×667 and 393×852: Escape and a backdrop tap leave it open, Submit closes it after three answers, and `?fail=1` toasts and stays on Q1.
  - Not checked signed in or on a device. Not committed.

## 2026-10-19

### 12:15 · Revert: onboarding step 04 is the three-beat intro again
- **Owner's request:** revert the step 04 practice clock-in (`ca8dcb7`). Keep the Find your friends UW wording.
- **Back as it was at `ed247a9`:** `intro-screen.tsx` and `lib/onboarding-v3-intro.ts`, the reducer's `beat`, the intro motion, the `tracked` preview fixture with `?beat=`, and `/onboarding`'s replay week read.
- **Removed:**
  - The join photo: `uploadJoinPhoto`, `lib/db/join-photos.ts`, `lib/join-photo.ts`, the feed join card's photo, the `deleteAccount` blob removal, and AGENTS.md's call site.
  - The `onboarding_practice_posted` event.
- **Kept:** `FIND_FRIENDS_COPY.uwSub` ("Everyone suggested below is a UW student.") and its test.
- **Left in prod:** `join-photo.sql` had run. Its `join_photos` table, `join-photos` bucket and `can_see_join_photo()` are now unused and harmless. The file's ROLLBACK block removes them; empty the bucket first.

### 09:03 · Find your friends says every suggestion is a UW student
- **Owner's request:** onboarding's add-friends screen should say that everyone suggested is at UW.
- The UW subtitle (`FIND_FRIENDS_COPY.uwSub`) now reads "Your feed is your friends clocking in. Everyone suggested below is a UW student." It replaces "A few people from UW are already here." Of the group headers, only "More at UW" said UW.
- It shows only with the groups (`findFriendsView`). A non-UW student, "You're early" and a failed fetch keep their own copy. It still fits on two lines at 375px.
- **Gate:** tsc clean; vitest on uw-groups, onboarding-v3 and preview (184/184); `/dev/onboarding-v3?fixture=uw-groups` screenshotted at 375 and 393 wide. Not committed.

### 08:57 · Onboarding step 04 becomes a practice clock-in (v3, dark)
- **Owner's request:** build the `design_handoff_progra_step04` handoff. It replaces v3's Screen 4, the three-beat "What Progra is" intro, with a run through the real loop. It is still one wizard screen, with the progress bar at 4/6, and has six phases: `intro → ready → running → ended → post → posted`.
- **Owner's decisions:**
  - **The post is the existing "just joined Progra" card plus a photo.** No synthetic session is created.
  - **The practice 25 minutes are never logged.** The timer is client-only, using rAF and a text node.
- **The six phases** (`app/onboarding/v3/practice-screen.tsx`, logic in `lib/onboarding-v3-practice.ts`):
  - **intro:** a Progress-tab preview built from the real `Donut`, `GoalQuotaRows` and `HabitWeekGrid`, with illustrative data. The wheel spins in, the bar fills and the habit checks pop.
  - **ready:** the Clock tab cut down to 56px goal rows (the first goal preselected, "PICK ONE" only when there are 2+ goals) and a static 25 min timer row.
  - **running:** the title FLIPs up from its row. The clock runs 1s at real speed, then fast-forwards (cubic in-out over 3.4s) and clocks them out. "Clock out", the secondary CTA, ends the run early.
  - **ended:** a check pop, a timer bump, a ring, and a CTA ring.
  - **post:** a dashed photo slot with a Change pill, and "Post without a photo".
  - **posted:** the card as friends see it. The photo FLIPs in from the slot.
  - **Reduced motion:** crossfades only. The timer steps in 5-minute increments.
- **State:** `wizardReducer`'s `beat` is replaced by `demo` + `demoGoal`, which reset whenever Screen 4 is entered. Back mid-run stops the timer.
- **The CTA:** pages through the phases via `practiceCta`.
- **Telemetry:** a new `onboarding_practice_posted { with_photo, ended }` event.
- **Removed:**
  - `intro-screen.tsx`, `lib/onboarding-v3-intro.ts` (and its test), and the intro-only motion (`donutIn`, `panelBump`, `legendRowIn`, the kudos entrances, `TRAVEL.beatSegment`).
  - `/onboarding`'s replay-only week read (`weekSegments`).
  - The `tracked` preview fixture. It is replaced by `practice` and `?demo=intro|ready|ended|post|posted`, which supersede `?beat=`.
- **Join photo (backend):**
  - `uploadJoinPhoto` (`app/actions/join-photo.ts`): sharp re-encode, then an admin-client upload to `join-photos/{uid}/join.jpg` (AGENTS.md exception 1, call site added), then an upsert of the `join_photos` row under RLS.
  - `listFriendJoins` signs it via `hydrateJoinPhotoUrls` (`lib/db/join-photos.ts`), and `feed-v2`'s join card draws it.
  - `deleteAccount` removes the blob.
  - A replay never uploads. A failed upload toasts and stays on the post phase.
- **SQL:** `.claude/plans/join-photo.sql`. **The owner reported it run in prod on 2026-10-19.**
  - Contents: the `join_photos` table (own-row writes, a path pinned to the owner), the private `join-photos` bucket, and the `can_see_join_photo()` definer (owner, admin or accepted friend, as recap posts ask).
  - Proven on PGlite: `nudges-harness/join-photo.mjs`, 33/33 checks, covering owner, friend and admin yes, and pending, blocked, stranger and anon no, plus the write refusals.
  - It must run before `NEXT_PUBLIC_ONBOARDING_V3` flips. Until then the feed shows no photo and an upload toasts.
- **Gate:**
  - tsc is clean. eslint on the changed files is clean apart from the known `Date.now()` purity debt in `feed-v2.tsx`.
  - vitest 1342/1342 passes, with new practice, reducer, preview and motion tests.
  - The build passes (with the self-link moved aside, then restored).
  - The signed-out smoke test redirects to `/login`.
  - Headless screenshots at 393×852 and 375×667 cover every phase, an early clock-out, posting without a photo, Back mid-run, and reduced motion.
  - Not committed.

## 2026-10-18

### 20:39 · Weekly review posts show the wheel of where the week went
- **Owner's request:** a posted weekly review should include the wheel of how you spent your time. The owner also confirmed `friend-suggestions.sql` and `friend-push.sql` have both been run in prod.
- **Where it shows:** on the feed card, on `/review/[id]`, and on the Share slide's preview, so the preview is what gets posted. It is a ring beside a legend of category and time. The feed card lists four rows and counts the rest; the post's page lists them all. `components/v2/review-wheel.tsx` (on the existing `Donut`).
- **No SQL:** `recap_posts.categories` (jsonb) was already written on every post. Nothing drew it, and what it held wasn't fit to draw:
  - **Only the top 4 were stored**, so the ring couldn't add up to the week. `postSlices` (`lib/weekly-review.ts`) now stores the whole week by the "Where it went" rules: time only, a deleted category counted as Uncategorized, largest first, Uncategorized last. Past 6 slices, the smallest fold into "Other", so it still sums to the week.
  - **Private goals' titles were stored as "Goal: <title>" in a friend-readable row.** They are now one "Private goals" slice. A public goal is stored under its own title.
- **Old posts:** `postWheel` still draws them. Their goal rows (the only ones with a "Goal: " prefix) show as plain "Goal", since nothing says which were private. Their null color shows as Uncategorized. A re-post (a caption edit) rewrites the slices.
- **Gate:**
  - tsc and eslint are clean.
  - vitest 1358/1358 passes, with 7 new tests for slices and the old-post read.
  - The build passes (with the self-link moved aside, then restored).
  - Screenshots of `/dev/weekly-review` (feed and post) checked. They caught public goals showing as "Goal", which is fixed.
  - Not committed.

### 20:02 · Weekly recap: a second closing quote
- **Owner's request:** "Life is like a bicycle. To stay balanced, you must keep moving." by Albert Einstein.
- Appended to `RECAP_QUOTES` as entry 1, which is the week of Oct 12, so it's on the recap that opens Monday Oct 19.
- With two quotes the list wraps: the week of Oct 19 shows Edison again unless another quote is added before then.
- Gate: vitest (a new test pins the Oct 12 week to Einstein) and tsc.

### 19:59 · Push notifications for friend requests, sent and accepted
- **Owner's request:** a notification when someone sends you a friend request. The owner also picked "X accepted your request". Invite-link signups are left out.
- **Copy:**
  - To the addressee: **"{name} sent you a friend request"**. A tap opens `/friends`, where Requests is at the top.
  - To the requester: **"{name} accepted your friend request"**. A tap opens the new friend's profile.
- **How:** `lib/push/send-friend-push.ts` is modelled on the nudge sender, and only runs in `after()` once the write has succeeded.
  - `sendFriendRequest` hooks it after the insert; `acceptFriendRequest` hooks it after `accept_friend_request`. Every UI path goes through these two actions, onboarding v3 included.
  - **The recipient comes from the friendships row, never the caller.** The row is re-read at send time:
    - a request must still be `pending` from the actor, so a request undone or blocked first sends nothing (onboarding v3's "✓ Added" undoes in a tap);
    - an accept must be `accepted` by the actor.
  - Then the usual chain: `social_pushes_enabled` opt-out, the `push_log` claim (`friend-request:{id}` / `friend-accepted:{id}`, also the collapse id), tokens, APNs, dead-token prune, and `notification_log`.
  - Gated on `SOCIAL_PUSH`.
- **Pure copy:** `lib/push/friend-push.ts`, with 7 tests.
- **Copy updated:** `NOTIFICATION_TYPES` gains `friend_request` and `friend_accepted` (without them, taps on these pushes were dropped by `validateEvent`). Also the admin usage-tab labels, the Settings social-push caption, and onboarding v3's `notifyReasons` (+1 row).
- **SQL:** `.claude/plans/friend-push.sql` widens the `notification_log.type` CHECK with the two new types. Nothing else changes.
  - It drops the old CHECK by content, so an unexpected name can't leave it standing.
  - **Not yet run.** Until it is, the push still goes out and only its analytics row fails, logged and swallowed.
  - Harness `nudges-harness/friend-push.mjs` slices the real phase1 DDL: ALL PASS, 4/4 mutants caught.
- **Gate:**
  - tsc is clean; eslint is clean on the changed files (settings-client at its baseline).
  - vitest 1350/1350 passes.
  - The build passes (with the self-link moved aside, then restored).
  - Signed out, `/friends` redirects to `/login`.
  - No device check yet.

### 19:50 · Onboarding v3: a notifications screen, after friends
- **Owner's report:** "no prompt to ask for notifications in the onboarding — double check if they work." The owner had been on **the website**.
  - The website never asks, by design: there are no web notifications. Both onboardings already hide the step there.
- **What the check found:**
  - v2's notify step works in the app: it's native-only, explains first, then asks.
  - **v3 had no notification screen.**
    - With `CLOCK_REMINDERS` off, it fired iOS's one-time dialog cold on the hand-off's Clock-in tap, alongside the photo sheet.
    - With it on, which is the local env, nothing asked at all: only the live timer's small "Turn on reminders" pill or Settings could.
    - So a v3 account could finish onboarding with no push token and no reminders.
  - Push registration itself is sound. It reacts to the permission store, so a grant registers the APNs token in the same session. The plugins, SPM packages, entitlements and AppDelegate are all in place.
- **Change:** v3 gets a seventh screen, **notify**, after Find friends and before the ready screen (the owner's placement).
  - It's titled "Stay in the loop" and lists what this build actually sends (`notifyReasons`), so it never promises a reminder that's off.
  - **"Turn on notifications"** shows iOS's dialog, then moves to the ready screen whatever the answer. A grant turns on the daily habit reminder, as v2 did. **"Not now"** moves on without asking.
  - It is shown only while permission is `prompt` and there's something to send. Otherwise it's stepped over in either direction, and the progress bar counts six (`stepOverNotify`, `progressFor`).
  - It reuses the `notify` step name, which the analytics CHECK and allowlist already accept, so **no SQL**.
- **Removed:** the cold Clock-in ask (`asksOnClockIn`, `askNotificationsOnClockIn`, the `askNotifications` prop), so a "Not now" isn't overridden a minute later.
- **Dev preview:** `/dev/onboarding-v3?screen=6` shows it; it passes `notifyPermission="prompt"` because a browser reads "unavailable".
- **Still dark** behind `ONBOARDING_V3`. Shipping needs no new binary.
- **Gate:**
  - tsc and eslint are clean on every touched file.
  - vitest 1343/1343 passes, with new tests for the four helpers and the step list.
  - The build passes (with the self-link moved aside, then restored).
  - Headless screenshot at 500×852 checked; this needs an iPhone check before the flag flips.

### 19:38 · Clock: a bigger, navy "Add past session"
- **Owner's request:** the Add past session button should be larger and navy. Mocked first as three options on a design canvas; the owner picked **B**, a larger navy link.
- **Both places on the Clock tab:** under Clock in, and under the clocked-in strip.
  - Now 15px semibold navy (`text-brand`) with a plus icon. It was 12px grey (`text-caption`) with a "+ " prefix.
  - It is still a link-style button, not a filled one, so the solid Clock in stays the main action.
  - It has a 44px-tall tap area (`h-11`), and presses with `active:scale-[.97]`.
- **Gate:** tsc and eslint are clean; the build passes (with the self-link moved aside, then restored); `/clock` renders.

### 19:33 · Friends: suggested friends under the leaderboard
- **Owner's request:** suggested friends at the top of the Friends page, under the leaderboard.
  - A UW student should see UW students they haven't matched with who share their interests.
  - Then an "other people at UW" section, before People on Progra.
- **Where:** the live Friends tab (legacy `friends-client.tsx`, `FRIENDS_V3` off). The v3 tab is untouched: it has no leaderboard and already has UW groups.
- **New order** (both new sections hide with the board while a search is live): leaderboard → **Suggested friends** → Your friends → **Other people at UW** (UW only) → People on Progra → Sent → Blocked.
- **UW student:** reuses `list_uw_peers` through `listUwPeerGroups()`, so this half needs no SQL.
  - Suggested = the `same_major` + `shared_interest` buckets. Both, because the RPC files someone under major first; an interests-only list would miss a same-major peer who also shares an interest. Owner's call.
  - Other people at UW = `rest`.
  - Those are the first 20 of each bucket. Anyone past that still shows in People on Progra.
  - Only students who switched on "Show me in More at UW" (`uw_listed`) can be suggested.
- **Everyone else:** friends of friends, ranked by mutual friends, shown as "N mutual friends". Owner's call.
  - New definer RPC `list_friend_suggestions(p_limit)` in `.claude/plans/friend-suggestions.sql`. It returns ids and counts only; identity is hydrated through `public_profiles`.
  - Seated callers only.
  - It excludes self, unseated and un-onboarded people, blocks either way, and anyone the caller has any friendships row with.
  - It never says which friend is the mutual one.
  - **SQL not yet run.** Until it is, `listFriendSuggestions()` returns `[]` and the section stays hidden.
- **Code:**
  - `lib/friend-suggestions.ts` is pure, with 6 tests.
  - `listFriendSuggestions` is in `lib/db/friends.ts`.
  - `readSuggestions()` in `app/friends/page.tsx` does one RPC either way, chained off the cached profile.
  - In `friends-client.tsx`: `SuggestionSection`, an optional subline on `UserRow`, and People on Progra now drops anyone listed above it.
- **Gate:**
  - PGlite harness `nudges-harness/friend-suggestions.mjs`: the full matrix passes and all 12 mutants are caught. A pending-first-hop case was added after its mutant survived.
  - tsc is clean; eslint is clean on the changed files.
  - vitest 1341/1341 passes.
  - The build passes with the self-link moved aside, then restored.
  - Signed out, `/friends` redirects to `/login`.

### 19:24 · Habits: tap the week grid to fill in a missed day
- **Owner's request:** "should be able to edit habits on the you page - add in for any day you didn't get it done on the overall chart."
- **What changed:** the this-week habit grid on You and on Progress (Week) can now be tapped in place.
  - Tapping a square for any day up to today checks it off, and tapping again clears it.
  - Future days stay dimmed and do nothing.
  - Before, the grid was display-only and backfilling meant opening the Manage sheet from the "Habits" header.
  - Older weeks, back to `HABIT_HISTORY_WEEKS`, are still reached through that sheet.
- **How:**
  - The optimistic `habitId|date` toggle moved out of `ManageHabits` into `lib/use-habit-toggle.ts`, unchanged. The sheet and both grids use it.
  - `HabitWeekGrid` takes optional `done` and `onToggle` props. With them, its squares are buttons; without them, it renders as before.
  - On You, the section's "x of y" count is now computed from the optimistic set, so it moves with a tap. The `doneThisWeek` prop is gone.
- **No server or SQL change:** `toggleHabitCompletion` already accepted past days and rejected future ones.
- **Gate:**
  - tsc is clean. eslint shows only the two known baseline errors (`Date.now()` in `me/page.tsx`, set-state-in-effect in `manage-habits`).
  - vitest 1335/1335 passes.
  - The build passes with the design-sync `node_modules/progra` self-link moved aside, then restored.
  - Signed out, `/me` redirects to `/login` and `/` returns 200.

## 2026-10-17

### 13:37 · UW info prompt: never shown to registered UW students
- **Owner's request:** "it should not show up to anyone who is already registered as a UW student."
- **The gate:** `uwPromptFor()` now returns nothing for `is_uw = true`, whether or not majors and interests are filled in. Before, it still asked UW students who had nothing filled in.
- **Removed, since nothing reaches it now:**
  - the sheet's skip-to-fields path for cohort members;
  - `savedUwOf`, `uwPromptFirstStep` and `uwPromptInitialListed`;
  - the `saved` prop on the sheet, the card and the layout leaf (the sheet always starts empty and listed);
  - the preview's `member` fixture (it's `/dev/uw-prompt[?fail=1]` now).
- **SQL:** STEP 1V's audience count is now "onboarded members not registered as UW students". The harness was updated and passes 14/14.
- **Gate:**
  - tsc, eslint, vitest 1335 (six tests went with the removed code, one was added).
  - CDP smoke: ask → Yes (no UW switch, listing on) → Save.

### 13:36 · UW info prompt: say what it's for
- **Owner's request:** the prompt should explain itself: "You can now connect with other UW students, fill out your information to do so."
- **The question's body:** "You can now connect with other UW students on Progra. Fill out your major and interests to find people in your major and people into the same things."
- **New intro line above the fields:** "You can now connect with other UW students. Fill out your info to find people in your major and with your interests." Students already in the cohort skip the question, so this is the only explanation they see.
- **The Friends card** is now "Connect with UW students" / "At UW? Fill out your major and interests to connect."
- Copy only, all in `UW_PROMPT_COPY` (`lib/uw-prompt.ts`). Gate: tsc, eslint, vitest. Screenshots of the preview at 393 wide show nothing clipped.

### 13:34 · UW info prompt: ask existing members for their majors and interests
- **Owner's request:** members who joined before UW onboarding never added their UW info. It lives in Settings → Edit profile, but most don't know it's there. A passive announcement wasn't enough: the prompt should come up on load, or be easy to reach.
- **Owner's calls:** a one-time sheet plus a Friends card; a DB column to remember the answer (not localStorage); UW is already on in prod.
- **The sheet** (`components/v2/uw-prompt-sheet.tsx`), opened once on Progress by a root-layout leaf (`uw-prompt-on-load.tsx`):
  - It asks "Are you a UW student?" with three answers: Yes, I'm at UW / No / Not now.
  - Yes shows the Settings block's own majors and interests chip fields and the "Show me in More at UW" switch (`UwFields` with a new `showUwSwitch={false}`). A fresh Yes starts listed, with the disclosure under the switch, as onboarding v3's Yes does. Save goes through `setUwProfile`.
  - A student already in the cohort with nothing filled in skips the question and opens on the fields.
  - It shows only at `/` and never over the weekly review, and it yields to the plan-complete modal and the release note: one dialog per load.
- **The Friends card** (`components/v2/uw-prompt-card.tsx`) sits under the invite on both tabs (v3 and legacy) until the member answers.
  - A tap opens the same sheet, loaded lazily.
  - The ✕ ("Don't ask again") stops asking.
- **What's stored: `profiles.uw_prompt`**
  - null means never asked, so the sheet opens.
  - 'later' means put away unanswered; only the card shows.
  - 'done' means answered, so nothing shows.
  - Every close path writes. `setUwProfile` now stamps 'done' in its own statement, so any UW save (onboarding, Settings, the prompt) counts as an answer.
  - 'later' only replaces null.
  - The gate is `uwPromptFor()` in `lib/uw-prompt.ts`. It fails closed, so nothing shows until the column exists. It also skips anyone already in the cohort with a major or an interest.
- **New action:** `markUwPrompt(stamp)` in `app/actions/uw.ts`, plus `revalidateUwPromptSurfaces()`. New analytics events: `uw_prompt_shown` and `uw_prompt_answered`, with `via` (sheet or card) and `answer`.
- **SQL needed: `.claude/plans/uw-prompt.sql`** (STEP 1, then STEP 1V), hand-run. It adds one nullable text column with a CHECK.
  - Proven on PGlite with `nudges-harness/uw-prompt.mjs`: 14/14, idempotent, and the CHECK admits only null, 'later' and 'done'.
  - Deploy the code first. Nothing shows until STEP 1 runs, and the sheet goes live the moment it does.
- **Known edge:** a v3 signup who answered No before this deploy has no stamp, so they get asked once more.
- **Dev preview:** `/dev/uw-prompt?fixture=new|member&fail=1`.
- **Gate:**
  - tsc, eslint on changed files, vitest 1341 (16 new), `npm run build`.
  - Headless Chrome over CDP on the preview: ask → Yes → a major → Save; No; Escape writes 'later'; a failed save keeps the sheet; the card's ✕.
  - Not checked signed in or on a phone.

## 2026-10-12

### 08:02 · Weekly review: recap-v2.sql fully applied in prod
- **STEP 2 passes in prod: 27/27, all rolled back.** STEP 1 and 1V had already passed.
- Prod is now ready for the code: `recap_posts` has the four new columns and their CHECKs, and the caption CHECK is in.
- **What's left before `NEXT_PUBLIC_RECAP_V2` goes on:**
  - deploy the code (uncommitted), with the flag still off;
  - a signed-in check;
  - flip the flag early on a Monday PT, with a patch note.

### 08:00 · Weekly review: STEP 1 and 1V run in prod; STEP 2 made self-sufficient
- **Owner ran STEP 1 and 1V:** all `ok`.
- **STEP 2 stopped at setup** ("a fixture account is missing"): one of review@ / demo@ / support@progra.world isn't in prod. It now fills any missing fixture account with another existing one. That's safe because the block always ends by raising, so the friendships and posts it sets up are rolled back.
- The two "panel shape" counts (T03, T11) are now scoped to the test's own post, so a real account's real likes can't throw them off.
- Harness: green normally and with demo@ deleted (`--missing-fixture`); 8/8 mutants caught.

### 07:58 · Weekly review: recap-v2.sql STEP 0 checked against prod
- **The owner ran STEP 0.** Prod has 16 posts, 24 likes, 7 comments and no out-of-range captions.
- **Already in prod,** so those parts of STEP 1 are no-ops there:
  - `recap_reactions.created_at` (not null default now()), so every existing like has a real time and the notifications panel needs no SQL;
  - `recap_comments_post_created_idx`, the same definition as STEP 1's;
  - an update-own policy on `recap_posts`, with WITH CHECK;
  - a delete-own policy on `recap_posts`, which leaves room for a later "Delete post" with no SQL.
- **`can_see_recap` and `toggle_recap_reaction`** match the design: owner or accepted friend; true on add and false on remove.
- **The harness mock is now prod, verbatim** (`nudges-harness/recap-v2-mock.sql`).
  - STEP 1 runs twice cleanly, 1V passes, and STEP 2 passes 28/28 locally (27/27 expected in prod). The old like and comment are untouched.
  - All 8 planted bugs are caught, four of them in prod's own policies and functions: visibility ignoring friendship, an update that hands a post away, a toggle without its visibility check, and anyone deleting a comment.

### 07:37 · Weekly review (RECAP_V2): "Share your week" — post it, see it on You, hear about likes and comments
- **Owner's request:** "Page for users to post their weekly review at the end — hours tracked, % towards goals and % habit completion, with a caption. It should show up on You as a post, so you can go back and see it, and you should see when people like and comment on it."
- **Owner's calls:**
  - The page is a slide just before Closing.
  - Friends see the post in their feed and on your profile; you see it on You.
  - Likes and comments reach the notifications panel, and push when SOCIAL_PUSH is on.
- **The Share slide** (`components/recap-story/share-slide.tsx`):
  - "Share your week" over a preview panel: the week, hours tracked, goal % ("of 3 goals"), habit % ("of 4 habits").
  - An optional caption (280 characters, one line). "Post to feed", then "✓ Posted", then on to Closing after a beat. "Not this week" skips it, and so does any tap outside the composer.
  - Revisiting a posted week shows it posted, and the caption can be edited ("Update caption").
  - Typing never turns a page; a tap elsewhere just closes the keyboard. A failed post toasts and keeps the draft.
  - The slide shows only when the week can be posted: its review is out (Monday 6am after it) and the account existed that week.
- **The numbers are the story's:**
  - Goal % is the Weekly goals ring (each goal capped at its quota; 100 only when all are met).
  - Habit % is every tick over every habit-day.
  - Hours is the total tracked.
  - `postWeeklyReview` recomputes all of it on the server from the same reads (`loadReviewPost`); the client sends only the week and the caption. A re-post upserts and keeps `created_at`.
- **Where it shows:**
  - The feed card (`WeeklyReviewCard`, replacing `RecapFeedCard` under the flag) and a "Weekly reviews" section on You and on profiles.
  - **A new page `/review/[id]`**: the post in full, the like pill and the whole comment thread. The owner can delete any comment; non-owners can report. `#c-<id>` lands on a comment.
- **Notifications:**
  - New panel rows "liked your weekly review" (collapsed per post) and "commented on your weekly review", reading recap_reactions/recap_comments on your posts. Each degrades to nothing on error.
  - Pushes for both (`composeRecapPush`, `recap-like:`/`recap-comment:` dedupe keys, `related_kind 'recap'`). The recipient is the recap_posts row's owner, read with the admin client inside `after()` — AGENTS.md exception (2), wording updated.
- **SQL needed: `.claude/plans/recap-v2.sql`, hand-run.**
  - STEP 0 is read-only pre-flight.
  - STEP 1 adds `goal_pct`/`habit_pct`/`goal_count`/`habit_count` with CHECKs, a caption CHECK (NOT VALID), `recap_reactions.created_at` (added without a default first, so old likes don't all read "just now"), two indexes, and an update-own policy only if none exists.
  - Proven on a PGlite mock (`nudges-harness/recap-v2.mjs`): STEP 2 passes 29/29 with and without an existing update policy and with created_at already present, and catches 8/8 planted bugs.
  - The mock was written from the docs (the DDL was never committed), so STEP 0's output has to confirm it before STEP 1 runs in prod.
  - `NEXT_PUBLIC_RECAP_V2` now means "STEP 1 has run". Flipped early, nothing breaks, but nobody can post.
- **Also:**
  - `hasOpenedRecap` and the old card's week labels: the review card labels weeks from `week_start_ms` (`reviewWeekISO`), not `toLocaleDateString`, which put India's weeks a day early.
  - `like_given`/`comment_given` take a `recap_ref`, and there's a new `recap_posted` event.
  - Dev previews: `/dev/recap-story?slide=share[&posted=1][&fail=1]`, `/dev/weekly-review?view=feed|rows|post`.
- **Gate:**
  - tsc, eslint (no new errors), vitest 1325, `npm run build`.
  - Signed-out smoke: `/review/<id>` 404s with the flag off, and the dev previews 404 in prod.
  - Browser checks over CDP: 42/42 across the story, Welcome and Share.
  - Not checked signed in or on a phone.

### 06:51 · Weekly review (RECAP_V2): a welcome on the first one
- **Owner's request:** "should include a welcome to your weekly recap page. Every Monday at 6am You will see how your past week went". A new slide, **Welcome**, sits between Loading and Hours: "Welcome to your weekly recap" over the week's dates, the week as seven tiles with Monday's lit navy and marked 6am, "Every Monday at 6am, you will see how your past week went.", and one line on how to move ("Tap the right side to keep going, and the left side to go back." — this build's own copy).
- **First review only.** It shows until the person has closed a weekly review once. `hasClosedWeeklyReview()` looks for any `recap_views` row from the week of Oct 5 on (the floor splits that week from the week before in every timezone; the old nudge was already off). It fails closed: an error means no welcome. Quitting mid-story leaves it to show again, like the rest of the review.
- The intro curtain now lifts off whichever slide comes first. Preview: `/dev/recap-story?slide=welcome` or `&welcome=1` on any fixture. `recap_slide_viewed` gained `welcome`.
- Gate: tsc, eslint, vitest 1310, CDP checks (Loading → Welcome under the curtain, back stays, on to Hours, 8 pips).

## 2026-10-11

### 22:12 · Weekly review (RECAP_V2), P2–P5: data, the story, opening by itself, the preview
Still dark behind `NEXT_PUBLIC_RECAP_V2`, still uncommitted, and still no SQL.
- **How it opens.** From Monday 06:00 in the user's own timezone, the review of the week that just ended is drawn **in place of Progress** at `/` (no redirect, for the same Next bug the onboarding gate avoids), every time Progress renders, until it's closed once.
  - Closing writes `recap_views` (on close, not on open), and that action's revalidation re-renders `/` as Progress.
  - Quitting the app mid-story brings it back.
  - `getDueReview` fails closed: a bad stored timezone or a failed read means no takeover. `hasOpenedRecap` now fails closed too.
  - Progress's own reads start first and the due check runs beside them, so the usual load waits for nothing new.
  - `?review=later` is the escape hatch if the write fails.
- **`/recap/[weekStart]`** renders the new story under the flag. Its close records the week only once the review is out, and only if it isn't recorded already; the old story is the flag-off fallback.
- **Status bar: no new dependency after all.** The navy slides switch it to light text through Capacitor 8's **built-in** SystemBars plugin.
  - It ships in every binary already: the SPM package has pinned capacitor-swift-pm 8.5.0 since the first build, and CapacitorBridge registers CAPSystemBarsPlugin.
  - Its `setStyle` is the call `@capacitor/status-bar` would have made, so the owner's choice of that plugin isn't needed. Nothing to install, sync or submit.
  - The style goes back to DEFAULT on the way out.
- **Data** (`lib/db/recap-story.ts`, all `cache()`d, all existing tables under RLS):
  - The week from `computeWeekRecap`. Goals and habits created after the week are dropped, and time under a since-deleted category counts as Uncategorized.
  - The friends leaderboard for any week: `getFriendsLeaderboardForWeek`. `getCircleWeekRows` now takes a window; the current week is unchanged.
  - The week's 👍 likes, given and received, in the notifications panel's query shape, current friends only.
  - The 8-week average, read once over the span and then put through `aggregateRange` week by week.
- **The story** (`components/recap-story/`): one file per slide, a header with pips and ✕, a rAF count-up leaf, and the navy ground.
  - The `rc-*` keyframes and `@property --rc-sweep` live in `app/globals.css`, with a `[data-recap]` reduced-motion rule that keeps end states.
  - The view is frozen on mount, so a re-render can't change it mid-read.
  - Taps on controls never turn a page. Exit puts up a white cover at once.
  - Analytics events: `recap_viewed`, `recap_slide_viewed`, `recap_closed`.
  - WhatsNewModal and PlanCompleteModal defer while it holds the screen (`lib/takeover.ts`).
  - A 336px copy of the app icon: `public/progra-logo-336.png`.
- **Dev preview** `/dev/recap-story` (404 in production): fixtures for all 14 handoff frames plus first-week, no-goals, no-habits, solo, quiet and crowd; `&slide=`, `&still=1` and `&inset=59`.
- **Checked:**
  - **Screenshots:** every board frame, taken with headless Chromium at 402×874 @2x, set beside the handoff PNGs. They match.
  - **Fixes from those screenshots:** "5.0h · 43%" stays on one line (the handoff's own frame wraps it), and the habit cells are 8px squares.
  - **Interaction, driven over CDP (22/22):** auto-advance, the curtain, taps by half, swipes, drag slop, keys, the end stops, the pips, the live announcement, ✕ / Esc / CTA, invite taps that don't turn the page, and reduced motion.
  - **Small screens:** no horizontal overflow at 320, 375 or 390pt; long slides scroll.
  - **Gate:** tsc, eslint, vitest 1309, `npm run build`. Signed-out smoke on `next start`: `/` 200, `/recap/2026-10-05` redirects to /login, `/dev/recap-story` 404s.
- **Not checked (needs a signed-in session or a phone):** the in-place open and close on a real account, the What's New deferral, the status bar on a device, and the logo sweep in WKWebView.

### 21:55 · Weekly review (RECAP_V2), P1: the pure core
- **What's being built:** the weekly recap story from `design_handoff_weekly_recap/` (eight slides: Loading, Hours tracked, Where it went, Weekly goals, Habits, Friends, Your rank, Closing), dark behind a new flag `NEXT_PUBLIC_RECAP_V2` (implies REDESIGN, needs no SQL). Plan: `.claude/plans/recap-v2.md`.
- **Owner's calls (2026-10-11):** it opens by itself when someone loads Progra, from **Monday 6am in their own timezone**, for the week that just ended. The owner picked `@capacitor/status-bar` for the navy slides (superseded at 22:12 by the built-in SystemBars plugin, which needs nothing installed). "Weekly average" means the last 8 weeks since signup, quiet weeks included. The closing quote starts with Thomas Edison's "Opportunity is missed by most…"; more are to come from the owner.
- **New, all pure and tested:**
  - `lib/recap-story.ts`: `buildRecapStory` decides every number, line of copy and skipped slide.
  - `lib/recap-story-nav.ts`: the position reducer, tap/swipe classification, status-bar timing and donut arcs.
  - `lib/recap-quotes.ts`: the list is the schedule, from the week of Oct 5.
  - `lib/status-bar.ts`, plus a native-plugin accessor in `lib/native-plugins.ts`.
  - `lib/dates.ts`: `reviewReadyMs` and `dueReviewWeek` (Monday 06:00 local, DST-safe). `recapReadyMs` now shares their wall-clock helper, with no change in behaviour.
- **Leaderboard rows** carry an uncapped `goalCount` (the review's "4 goals this week"). A friend's private goal still isn't counted.

### 16:58 · The weekly recap's "Your week is ready" nudge is off (RECAP_NUDGE)
- **Owner's request:** "implementing new weekly review, disable the one upcoming". Tonight (Sunday) at 6pm local the week of Oct 5's recap would have unlocked and its nudge appeared at the top of Progress. A new weekly review is being built instead, so the nudge now sits behind a new flag, `NEXT_PUBLIC_RECAP_NUDGE`, off unless set: deployed, no nudge tonight or any Sunday after, until the new review replaces it. Setting it to `1` and redeploying brings the old nudge back exactly as it was.
- Off, Progress doesn't read whether the week was opened (`hasOpenedRecap`), so it's one query lighter. Untouched: the recap story (`/recap/[weekStart]`, no in-app link left to a new one), the `/recap` browse page that History links, posted recaps in the feed, and the recap push (already off behind `RECAP_PUSH`, never scheduled).
- Gate: tsc, eslint, vitest (1249), `npm run build`.

### 16:45 · Onboarding v3: Yes to UW opens a full page, not the pop-up (OWNER-FIX-4)
- **Owner's request:** "It should load to the full page, not just a popup when you say Yes to being a UW student". The sheet now only asks the question. Yes holds its selected state, then the sheet goes and a full page comes in its place, the purple tile flying up into the "UW student ✓ Change" bar at its top. The page has the wizard's top row (Back, progress on step 1, the avatar), "Your school" over "Are you a UW student?", the bar, the D2 disclosure, and the optional Major and Interests fields, with the wizard's own "Skip for now" / "Continue" at the bottom. No is unchanged: it saves and goes to Screen 2.
- **Getting around:** Back from the page goes to the welcome, and Continue there goes straight back to the page (no second question) with what was typed still there. Back from Screen 2 lands on the page. Change on the bar asks the question again, the sheet back up over the welcome. A UW student replaying onboarding goes from the welcome straight to their page.
- **Code:** new `app/onboarding/v3/uw-screen.tsx` (the page, from the sheet's former Yes path); `uw-sheet.tsx` cut to the question (no fields, so no keyboard handling, height animation or `max-height` transition any more); the reducer's new `uwPage` (`openUw` closes the sheet and opens the page; `back` from the page; `openUwSheet` goes to the page for a settled Yes; `changeUw` re-asks; any move off Screen 1 clears it); `UW_PAGE_STAGGER`, `uwPageCta`, `boxOf`, and `aboveLiftedCta` back in `frame.ts` for the page's scroll area. Removed: `sheetMorph`, `relativeBox`, `uwOpenPhase`, `UW_STAGGER`, `sheetResize`, the sheet's keyboard lift and caps. Dev preview: `uw-sheet-open` is now `uw-page`.
- **Checked** in the dev preview at 393×852 and 375×667 (reduced motion too): Continue → sheet → Yes → page (Major focused, "Skip for now"); typing turns it to "Continue"; Back → welcome → Continue → page with the draft kept; Change → the question; No → Screen 2; Back → welcome. No console errors. Gate: tsc, eslint, vitest 1249 passed, `npm run build`, signed-out smoke.

### 16:25 · OWNER-FIX-3 review fixes: the UW sheet's taps, keyboard and failures; the welcome's typing
Two reviewers (correctness; interaction and accessibility). Still dark behind `ONBOARDING_V3` + `UW`, still uncommitted.
- **A double tap on Continue no longer answers the UW question.** The sheet rises over where Continue was, so the second tap landed on a tile (saving No and moving on, the question never seen) or on the dimmed welcome (putting the sheet away). Taps now count only once the sheet has finished rising, and only if the finger went down after that (`sheetTapCounts`). Checked by double-tapping in the preview at 250, 450 and 650ms.
- **No one is held on the welcome by a failing UW save.** A No from someone not in the cohort now moves on even if its write fails, quietly, since there was nothing to take out. A cohort member's failed No still toasts and asks again. Before, any lasting `setUwProfile` failure (P11 dropping the old columns under today's code, say) stopped every new user at Screen 1. The plan's P11 now says to ship the code that stops writing those columns first.
- **The tiles warn a UW student what No clears:** "Choosing No takes you out of UW groups and clears your majors and interests.", as Settings does, read with the No tile.
- **Typing on the welcome is ~6× cheaper.** Its fields lived in the wizard shell, so every keystroke re-rendered all six screens: ~25ms a keystroke in dev (~85ms with the CPU slowed 4×), now ~4ms (~16ms). The screen keeps its own fields and tells the shell only whether Continue can go, and whether it's saving.
- **The sheet and the keyboard:** it rides the keyboard only while one of its own fields is focused, so it no longer shoots up and drops when raised with the welcome's keyboard up, and the closed sheet stays put while other screens type. Its height cap now follows the keyboard at the lift's own pace, so its top stays still and its bottom rises, instead of the bottom jumping ~150px in a frame. That's a `max-height` transition, the one layout animation in v3, so it's on the device checklist.
- **Accessibility:** focus stays in the sheet while Yes turns into the bar; the D2 disclosure is read with the Major field; Tab wraps inside the sheet; a hidden Close button for VoiceOver and Switch Control; a taken handle moves focus to Username, and its error is linked to the field (in v2 too); tapping above the sheet while typing only closes the keyboard; focusing Major shows its suggestions too.
- **The sheet loads as its own chunk** (`next/dynamic`, AGENTS.md's dialog rule); its write hook moved to `app/onboarding/v3/uw-writes.ts`.
- **Saves:** the welcome's handle-then-name save is `saveIdentity` (pure, tested with fakes, including a name failing after the handle saved). A save left in flight when someone goes Back and comes forward again no longer pushes the re-entered screen on.
- **Deleted, now unused:** the `checkUsernames` action, `listTakenUsernames`, the username-batch helpers, and the avatar's centre-crop upload path. `lib/db/profiles.ts` and `lib/images/crop.ts` are back to their committed state.
- Gate: tsc, eslint (changed files), vitest 1251 passed, `npm run build`, signed-out smoke.

### 15:34 · Onboarding v3: the welcome screen that's live today, then the UW question as a sheet (OWNER-FIX-3)
- **Owner's request:** "can you keep the original welcome to Progra screen, but then once complete pops up the UW student thing, and then has the new onboarding from there on out". Screen 1 is now v2's welcome screen (`app/onboarding/steps/welcome-step.tsx`, reused, not forked) with the rainbow app icon in place of the navy mark. The UW question is a bottom sheet raised over it once its Continue saves. Screens 2-6 are unchanged.
- **The welcome:** name (optional), username with v2's check, photo through the step's own picker. "Continue" stays disabled until the handle passes `checkUsername`, and is busy while it saves (only what changed). A handle someone else holds shows "That username is taken." under Username and stays; other failures toast. There's no top row on it apart from a replayer's ✕. Back, progress and the 28px avatar fade in from Screen 2. With the keyboard up, the screen moves so both fields clear the lifted CTA.
- **The sheet (UW on):** white, 26px top radius, grab handle. It rises on the keyboard easing and only fades under reduced motion. The tiles, the Yes tile morphing into the purple bar (now measured against the sheet as it grows), the D2 disclosure and the majors/interests quick-add work as before. No saves and moves on. "Skip for now" (or "Continue", once anything is added or typed) saves Yes and moves on, listing the student only on a Yes tapped in the sheet. A tap on the dimmed welcome, a drag down or Escape puts the sheet away unanswered, and Continue brings it back as it was left. A replayer already at UW gets it open on their saved answer. With UW off, Continue goes straight to Screen 2.
- **Removed:** the old Screen 1 (live handle check, suggestions, taken alternatives, the in-screen tiles and keyboard slide-away, the travelling 84px avatar), the helpers only it used, their tests, and the services' `checkUsernames`. The `checkUsernames` action and `listTakenUsernames` are left in place, now unused. v2 is unchanged: the step's new props are all optional, as are `AvatarPicker`'s new `upload`/`remove`. `setUsername`'s taken message moved into a shared constant, with the same words. The `/onboarding` loading skeleton now draws the welcome.
- **Dev preview:** fixtures `welcome`, `welcome-filled`, `taken` (shows the taken path on Continue), `replay`, `uw-sheet`, `uw-sheet-open` and `uw-sheet-no`. The photo picker in the preview writes nothing.
- **Tests:** the welcome's handle rule against v2's, what Continue does with UW on and off, the sheet's state machine (tiles, selecting, open, Change, put away, reopen, Back), each exit's payload, where a replayer starts, and the sheet's motion tokens. Checked in the dev preview at 393×852, with a simulated keyboard and under reduced motion.

## 2026-10-10

### 01:24 · Onboarding v3: review fixes for Screen 2's hours boxes (OWNER-FIX-2)
- **Data integrity (D1):** goals were matched to rows by title on every Continue. With repeated or loosely equal titles, a Back → Continue that changed nothing could move a goal to another row, write its quota to a different account goal (the hidden fourth included), and point Screen 6 and the colors at the wrong row. Each goal now keeps the row it's on: `goalRowIds` in the reducer, aligned with `goals` and `goalHours`. It's filled from the account's ids on prefill, from the row `newGoalHours` matches when a title is typed (it now returns `{ hours, rowId }`), and after every save, full or partial (`savedRowIds` → `setGoalRowIds`). `goalSteps`, `goalColors` and `readyGoal` place a goal by its row first. Only a goal with no row is matched by title.
- **One rule beyond the review's spec:** a goal with no row matches an account goal by title only when its box already holds that goal's quota. Before, typing a listed goal's title a second time and then removing the first copy overwrote that goal's quota with the copy's untouched 5h. Now the copy becomes a goal of its own.
- **The box:** focus keeps the hours in the field and selects them, so screen readers read them and typing replaces them. −, + and the arrow keys leave the new hours selected. Return commits and leaves the field, and Escape puts the hours back. A field left as focus filled it keeps a stored 2.5h or 60h exactly. Whole hours only: "2.5", typed key by key or pasted, commits as 2, not 25, and ".5" keeps the hours (the field shows the point as typed, `hoursFieldText`, and commits `hoursInput`'s whole hours). Three digits are allowed, so 100 snaps to 40 instead of reading as 10. The `pattern` is gone, so a stored 2.5 isn't marked invalid. A full-width IME's text is left alone until the composition ends ("１２" used to come out as 11).
- **Continue** now applies typed hours from every box, not just the first.
- **Layout:** with the keyboard up and a box focused, the rows below it and the title field fade out and go inert (160ms). Nothing sits under the lifted CTA, and a lower row's ✕ can't be hit by a near-miss on Continue. At the cap the title field fades out without moving anything, so "Three is plenty" no longer sits under Continue in Safari on an SE. Return on the third goal moves focus to its hours box. The example chips now also hide at rest when they'd cover the field (`KeyboardFit` `atRest`).
- **Tests:** a seeded property test runs 400 random sessions of adds, removes, hours changes and saves, with injected failures and reloads, duplicate and loose titles, a hidden fourth goal and 2.5h/60h quotas. It checks that a landed save leaves nothing to write, and that account goals are never renamed, recolored or archived and only get quota writes for boxes the person changed. It fails against the old title-only matching. Also new: a reducer fuzz that keeps the three arrays aligned, and the hours-input cases. Checked in the dev preview at 393×852, 375×667 and 375×548, with a simulated keyboard and an IME composition.

### 00:04 · Onboarding v3: weekly hours per goal on Screen 2 (OWNER-FIX-2)
- **Owner's request (2026-10-09):** each goal on Screen 2 gets its weekly-hours quota set in place. A committed goal (Return, or now also leaving the title field) gets a full-width box under its title: − on the left, + on the right in 1-hour steps, and the hours typeable in between. Whole hours 1–40, default 5. Typed hours out of range snap to the nearest limit when the box is left.
- **Motion, in the wizard's own style:** the box rises in 90ms behind its row (`goalHoursIn`; nothing of its own under reduced motion), the number pops on each change, and the box shakes at a limit or on a snap. Rows are two lines now (92px), and the field moves down with them.
- **Writes:** new goals are created at their box's hours, and a goal this run made gets one update with whatever changed. A replayer's existing goal gets a quota-only update when its box changes (the main loop's call), and is still never renamed, recolored or archived. A box left alone writes nothing, even for a stored quota the box can't set (2.5h, 60h). A goal removed and typed back starts at its saved hours (`newGoalHours`), so it writes nothing either.
- **Continue** applies hours still being typed into a box before it saves. With the keyboard up, the focused hours box is kept clear of the CTA, and the example chips hide while it has focus.
- Dev preview: the two fixture goals now hold 10h and 4h, and a new `goals-full` fixture shows Screen 2 at the cap (10, 4 and 6h). Plan: OWNER-FIX-2 note at the end of §3. No SQL: `updateGoal` already takes `weeklyQuotaHours`.
- Tests: the reducer keeps goals and hours aligned, every hours helper, quota-aware `goalSteps`, `afterGoalStep` and `newGoalHours`, the preview fixtures and the `goalHoursIn` spec.

## 2026-10-09

### 22:17 · Owner fix visual check: Screen 6's goal pill
- Screenshotted Screen 6 in the dev preview (`habits`, `friends-added`, `ready-added`, reduced motion). It matches the P7 render at the README's offsets, with the pill naming the first goal in its Screen 2 colour. Tapping "Start session" restarts the preview on Screen 1 and never requests `/clock`. `/dev/first-session-clock` 404s.
- A goal title that wraps (up to 60 characters) now sits left-aligned beside its square, not centered under it (`app/onboarding/v3/ready-screen.tsx`). A one-line title renders exactly as before.

### 22:05 · Owner fix review: D5's flag-off ask and the stamp retry on the normal Clock tab
- **D5 is flag-aware again**, which supersedes the 21:48 D5 bullet. With CLOCK_REMINDERS off, the Clock-in tap on the `?welcome=1` arrival asks for notifications alongside the clock-in. It asks on native only and only if the device has never answered, and nothing on screen changes. A grant turns on the habit-reminder default (`asksOnClockIn`, and `askNotificationsOnClockIn` in `app/clock/finish-onboarding.tsx`). This is legal caller #4 in `lib/notification-permission.ts`. With the flag on, the live timer's band still asks.
- **Stamp retry:** if both of the arrival's stamp tries fail, Clock in tries once more before it clocks in (`settleOnboardingStamp`), because clocking in leaves the page. Before, the account stayed un-onboarded and `/` reopened the wizard after the first session. `onboardingStamper` shares one stamp between the mount and the tap, so `onboarding_completed` is still counted once.
- Plan: new OWNER-FIX-1 entry at the end of §3. D4, D7, P7 and their Schoolwork lines are marked superseded.
- Tests: `asksOnClockIn` and `onboardingStamper` in `lib/clock-handoff.test.ts`.

### 21:48 · Onboarding v3: "Start session" opens the normal Clock tab (owner fix)
- **Owner's call:** "onboarding should just load to the normal clock screen, but with the goal auto selected, not this new one that is generated." This replaces P7's generated first-session Clock and the Schoolwork category (plan D4/D7, R:146-158).
- **Screen 6:** the pill shows the first goal from Screen 2 (its title, in the color Screen 2 drew it), not "Schoolwork". "Start session" is `<Link prefetch={true}>` to `/clock?goal=<id>&welcome=1`, prefetched as soon as Screen 6 is in front, since the screen writes nothing now. The id is the goal's real row after Screen 2's save, for first runs and replays alike (`readyGoal`). The exit animation, the nav-rise flag and the onNavigate cancel are unchanged.
- **`/clock`:** the `?welcome=1` branch is gone. The page is the normal Clock tab for everyone, with the existing `?goal=` preselect. With ONBOARDING_V3 on, `?welcome=1`, and `onboarded_at` still unset, a new leaf (`app/clock/finish-onboarding.tsx`) stamps it once on mount, retries once quietly, and renders nothing. Replayers have nothing to stamp, so the wizard counts their `onboarding_completed` on the tap.
- **Deleted:** `ensureSchoolworkCategory`, `SCHOOLWORK`, `findCategoryByName`, `getWeekMsByTarget`, the first-session Clock and its services, `/dev/first-session-clock`, `lib/first-session*.ts` and their tests, and the Clock-CTA motion (`CLOCK_CTA_IN`, `clockCtaRings`). Beat 2's sample "Schoolwork" segment stays as sample data. `/dev/onboarding-v3`'s "Start session" now plays the exit and restarts on Screen 1.
- **D5:** with CLOCK_REMINDERS off, v3 users get no notification ask during onboarding. The native Clock-in ask lived in the deleted screen. With it on, the live timer's band still asks and turns on the habit default.
- Tests: `lib/clock-handoff.test.ts` (href with and without a goal, when to stamp, the single retry) and `readyGoal` in `lib/onboarding-v3-goals-habits.test.ts`.

### 20:16 · P9d review fixes: UW groups
- Screen 5 fetches the groups as soon as the wizard leaves Screen 1, so
  they're usually in before the screen is. A failure retries on entering
  Screen 5. The wait keeps the plain subtitle: the UW line ("A few people
  from UW are already here") only shows over groups, so it's never shown and
  then taken back.
- Friends tab: "Show more" loads on a tap only. Auto-loading pushed "Your
  friends" and Sent · Blocked down through the whole cohort. Screen 5 still
  loads ahead, now measured against its own scrolling list.
- The Friends tab drops a paged-in person once the fresh first page covers
  their place but leaves them out, i.e. they unlisted, blocked, left or lost
  their seat. Before, they stayed listed with a live Add until the tab
  remounted. Each peer now carries its `onboarded_at`, compared to the
  microsecond. Blocked people are hidden on later pages too.
- A failed UW read on refresh keeps the groups already shown, rather than
  swapping in People on Progra.
- a11y: when a page lands while "Show more" has focus, focus moves to the
  first new row, including when the last page removes the button. Screen 5
  has a status line that stays mounted ("Finding people from UW", then what
  it found). Group counts are part of the heading's name.
- "Show more" and the spoken lines are this build's own copy. Neither R nor
  the plan has them, so the owner should confirm.

### 19:56 · P9d: UW groups on Screen 5 and the Friends tab
Dark behind `NEXT_PUBLIC_UW` (plus `ONBOARDING_V3` / `FRIENDS_V3`); no SQL
run. With UW off, or for anyone not in the cohort, both screens are unchanged.
- Screen 5, for a student who said Yes: the R:131 subtitle and three groups,
  "In {majors joined with &}", "Shares your interests" and "More at UW". Each
  has a count and a reason line under every name. Fetched through the
  services seam when the screen comes into view, since Screen 1 saved the
  answer moments earlier. Fetched again only if that answer changes, so added
  people stay listed as "✓ Added" (P:1199-1200). Quiet placeholder rows while
  loading. "You're early" plus the invite preview when every group is empty.
  The non-UW screen if the fetch fails.
- Friends tab: the groups sit between Requests and Your friends (R:168),
  read in `page.tsx` only for an `is_uw` caller. Add takes a person out of
  their group at once, and the RPC leaves them out after revalidation. For
  these students the groups replace People on Progra, which comes back once
  the groups are empty.
- "More at UW" (and any long group) loads its next page as its last row
  scrolls into view, or on a "Show more" tap. Pages merge without losing or
  repeating anyone when the first page refreshes underneath.
- New `lib/uw-groups.ts` holds the logic, `components/v2/uw-groups.tsx` the
  paging hook and rows, `lib/uw-peers-preview.ts` a fake `list_uw_peers` over
  a made-up cohort. Dev previews: `/dev/onboarding-v3?fixture=uw-groups|uw-early`,
  `/dev/friends-v3?fixture=uw`. No analytics carry majors or interests.

### 19:22 · P9c review fixes: Screen 1 UW
- "Change" is ignored while a Skip/Continue save is in flight, and that save
  only moves on if Yes is still open. Change also blurs the quick-add field.
- A replayer in the cohort starts from their stored answer, so a Skip that
  changes nothing writes nothing. If the wizard sends a replayer back to the
  tiles itself (missing name, lost handle), tapping Yes again keeps their
  listing as it was.
- With UW on, the name gets focus on first load again (R:64). An unlisted
  replayer sees no line under the bar, since only approved copy goes there.
- The bar shows and fades in place, outside the stagger (P:1389). The tile
  press now eases. Header fields stay hidden until placed, so loading on the
  open bar doesn't flash. The focused quick-add field stays in view on short
  phones. Tabbing past the hidden CTA lands on the Yes tile. The answered
  question and the eyebrow are aria-hidden.

### 18:58 · P9c: Screen 1's UW half (tiles, Yes bar, quick-add)
Dark behind `NEXT_PUBLIC_UW` (and `ONBOARDING_V3`); no SQL run. With UW off,
Screen 1 is unchanged (D11).
- "Are you a UW student?" with Yes/No tiles. A tap with an incomplete identity
  shakes and focuses that field. No saves the identity plus `{ isUw: false }`
  during its 780ms hold, then goes to Screen 2. Yes FLIP-morphs into the bar.
  The name and handle shrink into a header beside a 40px avatar, and the
  majors/interests quick-add staggers in on the shared chip field.
- Skip/Continue saves `{ isUw: true, majors, interests, listed }`. `listed` is
  true after a Yes tap, which shows D2's disclosure under the bar. A replayer
  already in the cohort starts on the open bar with their listing as stored.
  Errors toast and stay. A repeat exit with nothing changed writes nothing.
- While the name/handle is focused, the question and tiles slide away (R:72),
  and Continue/Return only close the keyboard. Reduced motion crossfades.
- `setUwProfile` is on the services seam. `/` and `/onboarding` pass the
  profile's UW columns. Dev preview: `uw=1`/`uw=0`, plus `uw-choose`, `uw-open`
  and `uw-no`. New `lib/onboarding-v3-uw.ts` + tests.

### 17:44 · UW SQL (uw-cohort.sql STEP 5) applied to prod
`profiles` gains `uw_majors text[]` (≤3), `uw_interests text[]` (≤6) and
`uw_listed boolean not null default false` (opt-in, D2), with shape CHECKs.
`uw_share_goals` now defaults to false and was set false on all 93 rows (D3).
The one legacy `uw_major` was copied into `uw_majors`, and clubs were left untouched.
New `list_uw_peers(p_bucket, p_limit, p_after_ts, p_after_id)`, a plain-SQL
STABLE definer RPC, buckets listed, seated UW members into same_major /
shared_interest / rest, with per-bucket keyset paging. The caller must be
UW and seated; peers must be UW, listed, seated, onboarded and unlinked.
`uw_peers(int)` is revoked from authenticated. Proven by `nudges-harness/uw.mjs`
(225 checks; 34/34 STEP 5 mutants caught), then STEP 5V 23/23 in prod.
Nothing is visible yet: UW stays off.

### 17:38 · P9b review fixes: chip field focus, paste, radius; the UW save
Dark behind `NEXT_PUBLIC_UW`; no SQL run.
- Chip box radius is 12px (R:85); `rounded-xl` is ~20px in this theme.
- Major suggestions start with R:86's order (Economics, Computer Science, …)
  via `UW_MAJOR_SUGGESTIONS`, a reordering of `UW_MAJORS`, which stays the one
  canonical list.
- Focus never drops to the page: Add hands it to the input, a picked
  suggestion to the one in its place, and at the cap to the box (described by
  "3 of 3…"), not to a ✕ a repeated Return would press. Refused ("Other"),
  duplicate and full outcomes are announced, repeats included.
- A pasted interest list is no longer cut at 48 characters by the input; a
  comma'd duplicate pops its chip; a paste that fills the field leaves no
  hidden draft and says the rest didn't fit.
- Touch targets: ✕ 38×34, Add and suggestions 44px tall.
- UW switches are named by their visible `<label>` (tap the words to flip),
  described by the disclosure / leaving note, which is a live region.
- Settings: the block compares against the profile as the sheet opened, so an
  avatar change mid-sheet can't make an untouched block re-write a stale
  copy; the block is locked while Save runs.

### 17:24 · Settings UW block on chip fields (onboarding v3 P9b, dark behind UW)
No SQL run; nothing changes while `NEXT_PUBLIC_UW` is off (the block isn't rendered).
- **New `components/v2/chip-field.tsx`** (shared with P9c's quick-add), built to
  R:85-87: 44px box, 28px navy chips with a 22px ✕, Return/Add/suggestion adds,
  Return on empty → `onEmptyReturn`, Backspace takes back the last chip, comma
  commits for interests, "Add another" placeholder, `+ {item}` suggestion row
  (substring, picked excluded, none at the cap), new chips pop (opacity-only
  under reduced motion), a polite live region. What gets in is decided by the
  action's own cleaner (`cleanMajors`/`cleanInterests`), via pure
  `lib/chip-field.ts`, so the field can't show a list the DB stores differently.
- **`components/uw-fields.tsx` rebuilt on it:** UW student switch, Major (max 3,
  "Double major? Add both", canonicalized), Interests (max 6, D3 line), and a
  "Show me in More at UW" switch bound to `uw_listed` with the D2 disclosure,
  replacing the goals tile. Specs, block state and `saveUwBlock` in
  `lib/uw-fields.ts`. Still saved by Edit profile's Save (only when the block
  changed; typed drafts committed; leaving clears everything); an error toasts
  and leaves the sheet open. P9a's stopgap bindings are gone, and the block no
  longer imports `onboarding-ui`.
- **Dev preview** `/dev/uw-settings?fixture=member|unlisted|new&save=fail`
  (404 in production), on a fake `setUwProfile` that shows the payload stored.

### 17:08 · P9a review fixes: the Other sentinel, page counts, the Settings save
All dark behind `NEXT_PUBLIC_UW`; no SQL run.
- `cleanMajor` drops "other"/"OTHER"/" Other " too, so typed "other" can't
  match two students on it.
- An empty follow-up page of a UW group reports `total: null` (keep the count
  you had), not 0. A first call still counts an empty bucket as 0.
- Settings' interim tag field runs on the interest limits (6, 48 chars,
  `cleanInterests`), not the clubs ones, so it can't shrink or truncate what
  Screen 1 wrote. Edit profile calls `setUwProfile` only when the UW block
  changed (`isUwProfileChange`), so a stale tab's bio-only save can't re-join
  or re-list anyone.
- **For the SQL workflow / owner (not done here):** `list_uw_peers` returns the
  raw first major, so off-list majors are only hidden *in the app* (comments
  now say "never rendered"); the fix is a SQL whitelist or dropping `major`.
  Its `cand` CTE also lacks `p.seat_no is not null`, so a waitlisted, listed
  account can appear in seated students' groups.

### 16:56 · UW groups: server and lib layer (onboarding v3 P9a, dark behind UW)
Code against `uw-cohort.sql` STEP 5's `list_uw_peers` contract; inert while
`NEXT_PUBLIC_UW` is off (no UW column named, no RPC called). No SQL run.
- **`lib/uw.ts`:** `UW_INTERESTS` (R:87), `cleanMajors`/`cleanInterests`
  (tidy, case-insensitive dedupe, majors canonicalized, caps 3/6, interests
  48 chars so six fit the 300-char CHECK), `listedMajor`/`isListedMajor`, and
  `uwProfilePayload`, the pure join/leave rule. The major list gains Design and
  Environmental Science (R:86). Caps cut by code point now, never mid-emoji.
- **`setUwProfile({isUw, majors, interests, listed})`:** join writes
  `uw_majors`, `uw_interests`, `uw_listed` (true only when sent `true`, D2),
  `uw_share_goals=false`, and nulls `uw_major`/`uw_clubs`; leave clears every UW
  field and unlists. New `fetchUwPeerGroups()` / `fetchMoreUwPeers(bucket,
  cursor)` validate the bucket, UUID and ISO timestamp (kept verbatim: Postgres
  has microseconds).
- **`lib/db/uw.ts` + new `lib/uw-peers.ts`:** `listUwPeerGroups()` (cached)
  builds `{sameMajor, sharedInterest, rest, totals, cursors}`, pages each
  bucket on its own (fetches one extra row to know if there's more), and shows
  a "More at UW" major only when it's on the list (D3). Null on a failed read,
  so the UI never says "You're early" because a request broke.
- **Removed:** v2's UW tick, `uw` step, `saveUw` and UW friends variant (v2 now
  runs without UW), plus the dead `fetchUwPeers`/`listUwPeers`/`matchReason`/
  `UwPeer` that only they used. Nothing calls `uw_peers` any more.
- `Profile` gains the three STEP 5 columns; Settings passes them, and its old
  UW block edits them as an interim until P9b. `UW`'s flag comment now means
  "STEP 5 ran and 5V/5A passed". `docs/SCREENS.md` S12/S14/S14b/S14c/S70.

### 15:45 · Invite links: a request, never a friendship (claim_invite hotfix)
The live `claim_invite` (body captured from prod today) made **any** signed-in
caller of `/i/{username}` an *accepted* friend of that user, with no consent
from them, which opened every friend-only read (sessions, goals, photos, feed).
It also upgraded any pending row to accepted, returned 'blocked' (a block
oracle), and set `referred_by` on long-onboarded accounts.
- **SQL (hand-run, RUN IN PROD 2026-10-09, STEP 1V all ok):** `.claude/plans/invite-hotfix.sql`. A claim
  by a seated, first-run account sends the inviter a *pending* request; an
  onboarded caller sends nothing; no existing row is ever touched; every
  outcome returns 'ok'. Same signature, so `create or replace` keeps grants.
  Proven by `.claude/plans/nudges-harness/invite.mjs`, which first reproduces
  the hole on the live body, then passes the matrix with and without the pair
  index, and catches 14/14 planted bugs.
- **App (needs deploy):** `/i/{u}` no longer calls `claim_invite` for a
  signed-in visitor, since a GET that writes can be triggered by any site
  (SameSite=Lax); it just opens their profile. The signed-out landing now says
  "Join, and they'll get a friend request from you" instead of promising an
  automatic friendship. Caller comments updated.

### 15:10 · Owner decisions on the v3 build (font, logo, photo upload)
Five calls left open by P3–P6, decided by the owner (all as recommended):
- **Newsreader loads its optical-size axis** (`axes: ["opsz"]`, `app/layout.tsx`).
  Every serif line had rendered at the 16px cut, ~4% wider than the handoffs;
  now display sizes cut tighter, as designed (the intro's "And friends keep
  each other going." fits one line again). **App-wide**: every serif heading
  shifts slightly; the font file grows.
- **`/` traces sharp** (`next.config.ts`). First runs onboard at `/`, so the
  avatar upload there could only fail before. Watch Home's cold-start TTFB.
- **Screen 5's invite card shows the rainbow app icon** (`/progra-logo.png`)
  instead of `PrograMark`, which is still the old navy clock.
- Kept as built: the photo saves on pick, not on Continue; a replay's ✕ on an
  existing goal hides it from the wizard but never archives it.

### 07:09 · P8 visual check: the Friends tab against the prototype
Still dark behind `FRIENDS_V3`. No SQL ran. Screenshots of `/dev/friends-v3` (default, empty, search, sheet, reduced motion, with and without the 54/34 safe area) measured against the prototype's Friends tab at 393×852.
- **The search sits 12px under the header text, as in the prototype.** The bell makes the header row 32px where the prototype's is 15px, which pushed the field and everything under it 8.5px lower. The field now sits `pt-1` under the row, and the v3 skeleton does the same (`app/friends/friends-client-v3.tsx`, `components/page-skeleton.tsx`).
- **"Results" in the tab gets the tab's 16px header padding** (P:428), not Screen 5's 14px: `PeopleSearchResults` takes `headerTop="tab"`. Screen 5 is unchanged (`components/v2/people-search.tsx`).
- Everything else matches within a pixel: the invite tile (68px, 38px circle, 15/700), section headers (16/20/8), rows (36px avatar, 13/600 name, 11px subline, 30px ✕ + Accept), hours (13/600 `--body`) and the empty copy. Under reduced motion the invite tile doesn't pulse. No horizontal scroll and no dev overlay. The eyebrow is still ~14px below the prototype's on purpose (`pt-7`, the same on every tab).

### 06:57 · P8 review fixes: the sheet's first open, focus, "Working on"
Still dark behind `FRIENDS_V3`. No SQL ran.
- **The sheet's first tap no longer flashes the tab to its skeleton:** `SentBlockedSheet` is `dynamic(..., { ssr: false })` like every other v2 sheet, so its lazy chunk suspends into its own boundary rather than `/friends`' `loading.tsx`.
- **"Working on" never names a deleted goal:** the week's top goal must still be one of the friend's active shared goals (`FriendGoal` carries `id`), else the next one down, else the oldest shared goal (`lib/friends-tab.ts`, new test).
- **Focus and screen readers:** when a tap removes the focused control (a request answered, Add → "Requested"), focus goes to the row's link or a section heading. Send, decline and cancel are now said through a hidden status line; the sheet has its own, since the modal hides the tab (and the pill) from VoiceOver. Closing the sheet after its row has gone returns focus to "Your friends".
- **Rows** (`components/v2/person-row.tsx`): 11px between ✕ and Accept (P:437-439), the ✕'s touch target widened to 44×44, and the profile links fill the row's full height.
- The sheet fades instead of rising under reduced motion. `/friends` gets a v3 skeleton (`PageSkeleton` `friends-v3`: search, invite tile, rows) so nothing shifts as it streams in. The header keeps the shared `pt-7` tab frame (about 17px lower than R:162's 22px), on purpose.

### 06:40 · Friends tab v3 (P8), dark behind `FRIENDS_V3`
No SQL ran, no patch note yet (it's written at flip time). With the flag off, `/friends` renders exactly as before; the v3 branch returns early in `app/friends/page.tsx` with its own reads.
- **Layout** (`app/friends/friends-client-v3.tsx`, R:161-169, D12): "Friends" + "{n} FRIENDS" ("1 FRIEND") with the NotificationsBell, the people search (while searching, everything else hides), the 68px breathing invite, Requests (✕ decline, Accept → pill "You and {first name} are now friends"), Your friends (links to the profile, "Working on {goal}", this week's hours as "6h 05m", zero-hour friends kept, the README's empty copy), People on Progra, and a quiet "Sent requests · Blocked" row opening a `next/dynamic` sheet (`sent-blocked-sheet.tsx`) with Cancel and Unblock, still the only unblock UI. FeedLivePoll kept; FriendsLeaderboard dropped in v3 only.
- **Rows know the relationship:** search results and People on Progra show Friends / Accept / Requested / Add from the page's own friends and request reads. Every tap shows at once through `useOptimistic` and reverts with a sonner error if the action fails. Writes are the existing actions; a cancel uses `cancelFriendRequest`, so it can't unfriend someone who just accepted.
- **"Working on":** this week's top goal (`getFriendsWeekRows`), else the oldest shared active goal from new `listActiveGoalsForUsers` (`lib/db/goals.ts`, `cache()`d on a canonical id key). It asks only for `is_private = false` and never the caller's rows, filters again in `friendVisibleGoals`, and RLS backs both. The invite names the viewer's oldest non-private goal.
- `PersonRow` gains a plain outlined-button action. Pure rules in `lib/friends-tab.ts`. Dev preview at `/dev/friends-v3?fixture=default|empty|search|sheet` (404 in production; fake services, a stand-in bell). Tests: `lib/friends-tab.test.ts` (including a DST week), `lib/friends-v3-preview.test.ts`.

### 06:22 · P7 visual check: Screen 6 and the first-session Clock against the prototype
Still dark behind `ONBOARDING_V3`. No SQL ran. Screenshots of both screens, normal and reduced motion, measured against the prototype at 393×852.
- **The "Clock in" eyebrow is in Hanken.** It's an `h1`, so the base heading rule gave it Newsreader; `font-sans` puts it back with every other section label (`app/clock/first-session-clock.tsx`).
- **Screen 6's note sits at y=452** (R:151): 25px under the pill instead of 24 (`app/onboarding/v3/ready-screen.tsx`).
- Every other position lands within 0.5px of the prototype: the strip, "Ready?", the pill, the CTAs at y=758 and y=698, the rows, the nav. No skeleton between the exit and the Clock in dev.
- **Left for a decision:** the app loads Newsreader without its `opsz` axis (`app/layout.tsx`), so serif text renders at optical size 16 everywhere; the prototype's is sized to the text. "Ready?" comes out 11px narrower and 17–24px lines about 4% wider. It touches every screen, so it isn't part of P7.

### 06:13 · P7 review fixes: the handoff's timing, focus and redirects
Still dark behind `ONBOARDING_V3`. No SQL ran. Supersedes parts of the 05:49 entry.
- **One CTA through the handoff:** Screen 6's "Start session" no longer hides on the tap. It stays put through the exit, and the Clock's CTA arrives where it was and rides up 60px over 440ms KB at full opacity (`CLOCK_CTA_IN`; a fade under reduced motion), as the prototype's single CTA does (P:1228).
- **Timed from the tap, as R:152 is:** the BottomNav's 240ms delay counts from the tap (`takeNavRise` now returns its time, `navRiseAfter`), so a first run's nav, which mounts only once the stamp lands, rises at once instead of a further 240ms late. The rings start 1100ms after the tap (`clockCtaRingsOnArrival`).
- **The nav never re-rises a bar the server painted** (a load after the tap, `navRiseElapsed`), and reads reduced motion directly, since the hook still says "false" in the hydration commit that consumes the flag.
- **Focus:** the CTA is one `<Link>` on Screen 6 from the start, its `prefetch` flipping from false to true once Schoolwork settles, so the settle no longer swaps a button for a link under a focused user. The first-session Clock focuses its "Clock in" heading when it arrives with focus nowhere.
- **Redirects:** the welcome branch's redirect to `/clock/live` is an explicit `RedirectType.replace` (an action's re-render defaults it to push). A session running on an account whose `onboarded_at` is still unset (`welcomeOutcome` → `"finish"`) now stamps first (`FirstSessionFinish`) instead of redirecting into a loop with no BottomNav. Clock in also retries a stamp still in flight if it then fails. The profile and active-session reads come first, so a redirecting render reads nothing more.
- **Screen 6's pill** shows the Schoolwork row as stored (`ensureSchoolworkCategory` now returns `name` and `color`), matching the Clock's row for a replayer's recolored one.
- **Reduced-motion rings** are drawn 5px outside the button, where an opacity-only pulse can be seen.
- **Device checks to add:** a tap on "Start session" before Schoolwork settles skips the prefetch, so the Clock can arrive through its skeleton (known path); if the ensure fails, Screen 6 still says "Schoolwork" while the Clock preselects the first goal.

### 05:49 · Onboarding v3 P7: Screen 6 and the Clock handoff
Still dark behind `ONBOARDING_V3`. No SQL ran.
- **Screen 6** (`app/onboarding/v3/ready-screen.tsx`, replaces the placeholder): WeekPulse, "Ready?", the Schoolwork pill and `readyNote` with D13's "once they accept" wording. Arriving runs `ensureSchoolworkCategory()` once through the services seam (it replaces `completeOnboarding` there); once it settles, "Start session" becomes a `<Link prefetch={true}>` to `/clock?welcome=1`. A failure toasts nothing; the Clock just opens without Schoolwork.
- **Handoff:** the tap cancels the link's navigation, exits the screen's items, fades the top row, avatar and CTA, sets a one-shot sessionStorage flag, and pushes after the exit (`handoffExitMs`) and the ensure (capped at 5s).
- **`/clock?welcome=1`** (only with the flag on): slim reads (categories, goals, profile; this week's session time only for a replayer via new `getWeekMsByTarget`), redirects to `/clock/live` if a session is running, and renders the new `app/clock/first-session-clock.tsx`. Plain `/clock` is unchanged.
- **First-session Clock:** Schoolwork preselected, then goals (fallbacks: goals alone, then every category), "0h this week" or real hours, the Session section only with `TIMED_SESSIONS`, staggered entrance and 1100ms CTA rings (opacity-only under reduced motion). It stamps `onboarded_at` on arrival (retried on Clock in), clocks in with the item's title as the task name, and replaces to `/clock/live` without `?capture=photo`.
- **D5, flag-aware:** with `CLOCK_REMINDERS` off, the native Clock-in tap asks for notifications beside the clock-in; with it on, the live timer's band asks. Either grant turns on the habit-reminder default (`habitDefaultOnGrant`).
- **BottomNav:** a one-shot rise (110px, 640ms E after 240ms; a fade under reduced motion) when the flag is fresh (`lib/nav-rise.ts`, 15s TTL), consuming it.
- **Live code touched, not behind the flag:** the BottomNav (inert without the flag), `PrimaryButton` (classes moved into `primaryButtonClass`, same output), and the reminders band's grant, which reaches a never-asked device on a `CLOCK_REMINDERS` build and only restates the habit reminder's untouched default.
- Dev preview: `fixture=ready|ready-added` on `/dev/onboarding-v3`, whose Screen 6 now hands off to the new `/dev/first-session-clock?fixture=new|replay|no-school|nothing&timed=0|1`. Tests: `lib/first-session.test.ts`, `lib/first-session-preview.test.ts`, `lib/nav-rise.test.ts`, plus motion, habit-pref and preview additions.

### 05:22 · P6 visual check: invite tile line heights
Rendered Screen 5 (at rest, searching, added, no hits, the hint, reduced motion) against the prototype at 393×852. Layout, type, colours and copy match. The pulse runs only at rest and is off under reduced motion.
- **Fixed:** `InviteTile`'s sub line used `leading-tight` (15px). Both lines now keep the inherited 1.5, as P:294 does, so the title sits at y=211.5 like the prototype's instead of 1.5px lower.
- Expected differences: the link card shows the App Store URL (D9). The serif title is about 4% wider because Newsreader loads without its `opsz` axis, which is app-wide and was already noted under P4.

### 05:14 · P6 review fixes: Screen 5 knows existing friendships
Still dark behind `ONBOARDING_V3`. No SQL ran. Supersedes two points in the 04:57 entry.
- **Results know who you already know.** New `getFriendRelations()` (`lib/db/friends.ts`, `cache()`d) is read by `/` and `/onboarding`. Search rows show "Friends", Accept (new `acceptFriendRequest` in the services seam), or "✓ Added" for a request already out, so a reload, a replay or an `/i/` link's request no longer offers an Add that can only fail.
- **Undo can't unfriend.** New `cancelFriendRequest(id)` deletes only the caller's own *pending* row; if the other person already accepted, it says so and the toggle stays on. Onboarding no longer uses `removeFriendship`.
- **First-add ring is off under reduced motion** (`MOTION.firstAddRing.reduced = null`, as P:1177).
- **Taps and a11y:** the search wrapper's 44px dead band over the results is gone (`pointer-events`). The 30px row buttons now have a 44px-tall hit area. Add's accessible name is the visible word plus the name, with no `aria-pressed`. Focus on Cancel counts as field focus, and Return, Escape and Cancel park focus on the field row instead of `<body>`. Row errors drop the keyboard before the toast so it can be read.
- Dev preview: `fixture=friends-added` now seeds through `relations`, and a new `friends-known` shows Friends/Accept rows.

### 04:57 · Onboarding v3 P6: Screen 5, find your friends (non-UW)
Still dark behind `ONBOARDING_V3`. No SQL ran.
- **Screen 5 replaces its placeholder** (`app/onboarding/v3/find-friends-screen.tsx`):
  the title, the breathing navy "Invite your friends" button, search, and a
  note over a preview of what the group chat gets (the message in a navy
  bubble, then a link card with the App Store URL that is actually sent, D9).
  The UW groups wait for P9d.
- **Inviting** goes through `shareInvite` with `inviteText(goal 1)`. Toasts
  are the pill's "Invite shared" / "Invite link copied"; after a share the
  button reads "Sent. Send it to another chat" (no chat name, D9). The pulse
  is on a wrapper so the press scale still works, and stops off-screen, on a
  hidden page, while searching and on unmount; never under reduced motion.
- **Search mode** (focused or non-empty): the title and invite exit up, the
  field slides up 174px, results list from y=168 with "Cancel". Two
  characters after "@", at most 5, the README's hint and no-hit copy.
  Prefix match only, since SQL-2 isn't run (D10).
- **Add sends a real request on the tap**, and "✓ Added" takes it back
  (`removeFriendship(requestId)`). Taps queue per person, and a failure
  toasts and reverts. A result who's already a friend or pending can't be
  told apart by `searchUsers`, so its Add fails with the generic toast.
  Added people live in the shell, so they survive Back. The CTA is "Skip for
  now", then "Continue · {n} added", with a ring pulse on the first add
  (opacity-only under reduced motion; `MOTION.firstAddRing.reduced` was null).
- **Shared with P8's Friends tab:** `components/v2/{invite-tile,people-search,person-row}.tsx`
  (a 68px tile size; Friends / Requested / Accept / hours row variants) and
  the pure `lib/find-friends.ts`, tested in `lib/find-friends.test.ts`.
- Services seam gains `searchUsers`, `sendFriendRequest`, `removeFriendship`
  and `shareInvite`; the dev preview fakes them (seven made-up people) and
  adds `fixture=friends-search|friends-added|friends-nohits` and `q=`.

### 04:38 · P5 visual pass (Screen 4)
Still dark behind `ONBOARDING_V3`. No SQL ran.
- Rendered all three beats (and Beat 2 under reduced motion) against the
  prototype at 393 × 852: boxes, fonts, colors and strings match, glyph for
  glyph on Beats 1 and 3. One fix: the post, week and activity cards are
  16px radius (R:113, R:114, R:122). `rounded-2xl` resolves to 25.92px in
  this theme.
- Not changed: with two goals, Beat 2's five legend rows don't fit the panel.
  The prototype cuts off the last row; ours scales the beat to 0.92, as
  planned. Beat 3's caption wraps to two lines because of the app-wide
  Newsreader `opsz` gap noted under P4: it measures 363px against a 353px box.

### 04:29 · P5 review fixes (Screen 4)
Still dark behind `ONBOARDING_V3`. No SQL ran. Supersedes two lines of the
04:14 entry below.
- **Beat 1's caption keeps "■ {goal 1}" on one line**, as the prototype
  does; only a run wider than the caption lets the title wrap after its
  first word. The post's goal title wraps instead of truncating.
- **Daniel's "nudged you" card is back with `NUDGES` off**: D15 hides only
  Screen 3's nudge pill and line, and R:122 has four cards.
- **Reduced motion: the kudos avatars fade in together** at 500ms (plan P5,
  R:54 "no list stagger"), not 150ms apart.
- Beat 2's card no longer shrinks on the 852 frame (the beat's bottom
  padding stopped counting toward fit-to-panel), and leaving Beat 2 lets
  the donut and legend finish under the fade instead of flashing whole.
- Screen readers: the live region is filled just after Screen 4 turns
  active and says "1 of 3." first; the made-up feed and activity are hidden
  behind a one-line "Example: …" summary (a replayer's real week is still
  read out); hidden Previous/Next buttons give VoiceOver and Switch Control
  the panel's moves. A photo in the panel can't start a native image drag.
- `getWeekCategorySegs` takes its window from `weekWindow`, and
  `/onboarding` reads it only for a replayer. A replay still re-reads it on
  each Screen 2 and 3 save (they revalidate the route); accepted.

### 04:14 · Onboarding v3 P5: Screen 4, the intro
Still dark behind `ONBOARDING_V3`. No SQL ran.
- **The intro replaces Screen 4's placeholder** (`app/onboarding/v3/intro-screen.tsx`):
  three beats under a 3-segment progress, each a caption over a 420px
  preview panel. Beat 1 is the person's own post ("Day one", their name and
  avatar, goal 1 in its color) collecting three kudos; Beat 2 is the real
  `CategoryDonut`, spinning in with staggered legend rows; Beat 3 is the four
  activity cards, Daniel's naming their first habit. "Next" pages the beats
  and "Continue" (or "Skip intro") goes on to Screen 5. No auto-advance.
- **Moving:** tap the panel's right two thirds or left third, swipe more than
  36px across, or use the arrow keys. Back from beat 1 bumps the panel. A
  drag that's neither a tap nor a swipe does nothing (the prototype counted
  it as a tap, which could go the wrong way). The caption is read out
  through a live region.
- **Beat 2 shows a replayer's real week** when they've tracked time
  (`getWeekCategorySegs` in `lib/db/progress.ts`, the Week tab's own
  numbers, read only by `/onboarding`); otherwise the sample split.
- Reduced motion: crossfades only, with no donut spin, list stagger or bump
  (the kudos avatars keep the prototype's sequenced fade-in). On a
  short phone the beats scale to fit the panel and a long goal steps the
  caption's font down instead of overflowing. With `NUDGES` off, Daniel's
  "nudged you" card is left out, as Screen 3's nudge line is.
- Dev preview: `?beat=1..3`, and a `tracked` fixture for a real week.

### 03:55 · P4 visual pass (Screens 2 and 3)
Still dark behind `ONBOARDING_V3`. No SQL ran.
- Rendered Screens 2 and 3 against the prototype at 393 × 852: every box,
  font, color and string matches. Three sub-pixel fixes: the goals list and
  field sit at y=240, not 240.5; the Return hint uses the prototype's 1.5
  line height; Screen 3's chips start at y=244, not 242.85.
- Open, not P4's to change: the app's Newsreader has no optical-size axis
  (`app/layout.tsx`), so serif text draws at opsz 16 and runs about 4% wider
  than the prototype's auto optical sizing. That's app-wide.

### 03:42 · P4 review fixes
Still dark behind `ONBOARDING_V3`. No SQL ran.
- **Onboarding never archives a goal or habit the account already had.**
  Removing a prefilled goal or deselecting a prefilled habit (including via
  "Skip for now") used to archive the real row, with no confirm and no way
  back. Now only rows this run created are archived; an account row taken
  off the list stays active. Archiving a replayer's rows from onboarding
  needs the owner's sign-off first.
- **Goal order survives a reload.** Reusing a row this run made is limited
  to slots that keep created_at in list order, so "remove the first, add a
  new one" no longer swaps the goals and their colors after a reload.
- **Short phones with the keyboard up** (`app/onboarding/v3/keyboard-fit.tsx`):
  Screen 2's example chips fade out while they'd cover the field, and the
  content moves up when the lifted CTA would. Screen 3's chips end above
  the lifted CTA and scroll the open "Your own" into view. Unchanged on the
  852 frame with the prototype's keyboard.
- Return that confirms an IME conversion no longer adds or continues
  (WebKit's keyCode 229). Focus no longer drops to the page after removing a
  goal or closing "Your own" from a keyboard. ✕ and "Add" get 44px targets;
  the goals list keeps its list semantics in WebKit.
- The nudge line is anchored by its top (R:103), so a wrapped line grows
  toward the CTA instead of into the chips. Popping chips no longer clip or
  flash a sideways scrollbar.

### 03:21 · Onboarding v3 P4: Screens 2 and 3 (goals, habits)
Still dark behind `ONBOARDING_V3`. No SQL ran.
- **Screen 2** (`app/onboarding/v3/goal-screen.tsx`): up to three goals in
  R:95's colors, the field that rides under the list, the next-goal marker,
  example chips that ride up with the keyboard and type themselves in
  (instant under reduced motion). Return adds; Return on empty continues.
- **Screen 3** (`habits-screen.tsx`): the five presets and "+ Your own", the
  nudge line (hidden with `NUDGES` off), "Skip for now" until a pick.
- **Writes are a diff** (`lib/onboarding-v3-goals-habits.ts`), made on
  Continue through the existing goal and habit actions: create what's new,
  rename or recolor a goal this run made, archive what was removed. Back and
  Continue again writes nothing. With the flag on, `/` and `/onboarding`
  read the active goals and habits and the screens start from them, so a
  replay or a mid-wizard reload never duplicates. An account goal is never renamed, and one past the first
  three is never archived. A failed write toasts and stays.
- Dev preview fixtures `goals`, `habits` and `habit-custom`.

### 02:59 · P3 visual check against the prototype
Still dark behind `ONBOARDING_V3`. No SQL ran. Screen 1 (empty, filled,
taken, replay, reduced motion) and Screen 2's top row were shot at 393×852
and diffed against the prototype. Every box lands within 0.5px of it.
- The progress bar sat at y=78.5. It's at 79 now (R:36), in the wizard and
  its skeleton both (`PROGRESS_TRACK` in `frame.ts`).
- The photo-landed ring is 1.5px, the prototype's 3px scaled to the 84px
  avatar as the badge already was. It was 2px.
- Not changed, and for the owner to decide: the app loads Newsreader without
  its `opsz` axis (`app/layout.tsx`). The prototype loads it with the axis,
  so its 28px serif is about 2.6% narrower. That affects every Newsreader
  heading in the app, not only onboarding.

### 02:46 · P3 review fixes
Still dark behind `ONBOARDING_V3`. No SQL ran.
- **The shared avatar shows on Screen 1 in production.** It measured its
  slots in a layout effect of its own, and on the first commit the parent's
  and a later sibling's refs are still null (StrictMode's dev re-run hid
  this). The shell now places it (`useSharedAvatarPlacement`).
  `KeyboardInsetVar` writes to its own parent the same way.
- `app/onboarding/v3/layout.ts` is now `frame.ts`. Under `app/`, that name is
  a Next Layout, and `next build` would have failed its type check. The dev
  preview's shell is now `onboarding-v3-client.tsx`.
- **Photo:** one upload at a time. A failure goes back to the last confirmed
  photo, and only a real pick plays the landing animation. Still uploads on
  pick, as plan §6 says. That clashes with P3's "writes happen on Continue",
  so the owner needs to decide which one governs.
- **Screen 1:** the handle row fades in once there's a name or a handle. A
  failed check is asked again when the field is focused (a new `retry`
  action). Edits are ignored while Continue saves. Autofocus timing matches
  prod in dev.
- **Focus and targets:** a screen change that strands focus puts it on the
  incoming screen. Continue stays focusable while busy (`aria-disabled`).
  Back, ✕ and the alternative chips get 44px hit areas.
- **Polish:** a hidden CTA doesn't slide under reduced motion. The
  `/onboarding` skeleton keeps room for the replay ✕.

### 02:26 · Onboarding v3 shell and Screen 1 (plan P3, dark)
Behind `ONBOARDING_V3` (off in prod), so `/` and `/onboarding` still render
v2 exactly as before. No SQL ran.
- **`OnboardingClientV3`** keeps all six screens mounted (inactive ones
  `inert` and aria-hidden) and navigates with P2's `wizardReducer`. It has
  one top row (Back hidden on Screen 1, a progress bar filling to (i+1)/6),
  one avatar that travels from Screen 1's 84px slot to the top row's 28px
  one, and one CTA that rides above the keyboard. A leaf writes
  `--kb-inset`, so the shell never re-renders for the keyboard. Screens 2–6
  are placeholders until P4–P7.
- **Screen 1, without UW (D11):** name, photo, and a handle suggested from
  the name and checked live (650ms after a suggestion, 520ms while typing).
  Stale answers are dropped by sequence number. A taken handle shakes and
  offers 3 free alternatives. The name and handle are written on Continue,
  and only if they changed; on an error the screen toasts and stays put. The
  photo uploads when it's picked and reverts on failure.
- **Replay** starts from the saved handle with auto-suggest off. It gets a
  quiet ✕ that goes to `/` and writes nothing (D6).
- `useAvatarUpload()` is extracted from `AvatarPicker`. Every upload is
  downscaled to 1600px, then cropped to a 512px square (D14). Settings' crop
  dialog works as before, and a rejected upload now toasts instead of
  throwing.
- New: `components/v2/pill-toast.tsx` (the navy success toast, for P6 and
  P8), a v3 loading skeleton on `/onboarding`, and one v3-only
  reduced-motion rule in `globals.css`.
- **Dev-only preview:**
  `/dev/onboarding-v3?screen=1..6&fixture=empty|filled|taken|replay`
  renders the wizard on fake services, with no sign-in and no database. It
  404s in production builds.

### 02:04 · P2 review fixes
Still dark: nothing imports these. No SQL ran.
- **Handles fold to ASCII the same way everywhere.** One `foldToAscii` (NFKD,
  accents stripped, then ø/ł/æ/œ/ß/đ/ð/þ/ı by hand) feeds both the suggestions
  and `sanitizeUsernameInput`, so "Søren" gives `soren` and typing "José"
  gives `jose`, as its suggestion does. `keepValid` now reuses
  `cleanUsernameBatch` instead of a copy of it.
- **Caps never split an emoji.** The name, habit and goal caps take whole
  graphemes (`Intl.Segmenter`), still counting code points so the server caps
  hold. A flag or skin-toned emoji at the limit is dropped whole.
- **`keyboardInset` reads a pinch-zoomed page as no keyboard.** iOS Safari
  ignores `maximum-scale=1`, and zoom shrinks the visual viewport just as a
  keyboard does.
- `useKeyboardInset` returns a number rather than setting `--kb-inset` (a
  deviation from plan §6), so its comment now says to read it only in a leaf.
- `MOTION.initialsIn` is pinned frame for frame to `globals.css`'s `pop-in`
  by a test. The reduced-motion test now checks something real.

### 01:52 · Onboarding v3 pure logic and motion (plan P2, dark)
Nothing imports these yet, so no user sees a change. No SQL ran.
- **`lib/onboarding-v3.ts`:**
  - `usernameCandidates` and `usernameAlternatives` follow the README's lists,
    but every handle goes through `checkUsername` (D8). That drops
    `first.last`, `name_` and `{u}_`, reserved words and digit-only handles.
    `firstAvailable` picks the free ones from a `checkUsernames` result.
  - Input formatting: `formatNameInput` and `sanitizeUsernameInput` (no dots).
    `precheckUsername` uses checkUsername's own messages.
  - Copy for screens 2–6: goal colors 7/2/5, placeholder and hint,
    `habitNudgeText`, the intro's captions and sample donut, `inviteText` and
    `readyNote`. `inviteText` is message only; the App Store link is added by
    `invite-share`, per D9. `readyNote` says "once they accept" while every
    request is pending (D13).
  - `wizardReducer`: going back to Screen 1 after No resets the UW choice;
    entering Screen 4 resets the beat; limits are 3 goals, 3 majors and 6
    interests.
- **`lib/motion.ts`:** the E/KB/Spring easings, the item stagger
  (140 + 55i ms), pops, the check pop, the shake, FLIP and the rest as WAAPI
  keyframes. Each effect has a separate reduced-motion spec that changes
  opacity only, or is null where the README drops the effect.
- **`lib/keyboard.ts`** and `useKeyboardInset()` (`lib/hooks.ts`) read the
  keyboard's height from `visualViewport`. This is unproven on a device until
  the P0 spike.
- `MAX_UW_MAJORS` and `MAX_UW_INTERESTS` are now in `lib/uw.ts`, where P9a
  expects them.

### 01:31 · P1b review fixes
- **`getFriendsWeekRows()` is friends only now**, as the plan specifies: one
  unranked row per accepted friend, never the caller. The leaderboard ranks
  the whole circle (caller included) from a shared private read.
- **`searchUsers` orders before capping** (`orderSearchMatches`): exact
  handle, then handle prefix, then the rest, so the 5-row cap can't drop the
  person whose full handle was typed. A non-string query returns no results
  rather than throwing.
- **Correction to 01:19:** `revalidatePath("/", "layout")` states intent but
  doesn't change behaviour. In Next 16.2.6, any `revalidatePath` in an action
  re-renders the current route from the root, so `revalidatePath("/")`
  already mounted the nav. The comments now say so.
- **Week mismatch is known:** `/goals` and the Dashboard (`/`, `/me`) still
  use the server's UTC week, so near a week boundary they can differ from the
  leaderboard. Check the leaderboard against Progress → This week.
- `phase4.sql` (not run): `admin_onboarding_stats` adds `reached_v3` and
  `median_seconds_v3` per step. The admin v3 funnel charts those, so v2
  sign-ups no longer pad it. Before the file runs, the PGlite harness needs
  v3 fixtures and a mutant for the `v3_users` guard.

### 01:19 · Live server fixes ahead of onboarding v3 (plan P1b)
These change live behaviour for every user. No SQL ran, and no v3 UI exists yet.
- **Generic errors** (`app/actions/friends.ts`, `app/actions/profile.ts`): no
  action there returns `error.message` any more. Each failure has fixed text,
  like "Couldn't accept request." or "Couldn't save your profile.", so a
  constraint, column or RPC exception never reaches a toast. `setUsername`
  still maps 23505 to "That username is taken."
- **`sendFriendRequest` returns `{ ok, requestId }`** (`.select("id")` on the
  insert; RLS already shows the requester their own pending rows). This is
  additive, so callers that read only `ok` are unchanged. v3 uses it for undo.
- **`searchUsers`** strips a leading "@" (`normalizeSearchQuery`), checks the
  2-character minimum after stripping, and returns at most 5 rows
  (`SEARCH_RESULTS_MAX`). It is still a prefix search: SQL-2 has not run, and
  that was accepted. The Friends tab's search therefore shows 5 results now.
- **`completeOnboarding` revalidates the layout** through
  `revalidateOnboardingSurfaces()`, because the root layout mounts the
  BottomNav. A new account is stamped current before the re-render, so What's
  New still never greets one. The layout comment now says so.
- **The friends leaderboard uses the viewer's week.** The new `cache()`'d
  `getFriendsWeekRows()` returns unranked rows (the caller plus every friend,
  zero-hour friends included) measured over `leaderboardWeekWindow(tz)` →
  `weekWindow`. `getFriendsLeaderboard` is `rankLeaderboard(rows)`. Before
  this, the leaderboard used the server's UTC week, which rolled over at 5pm
  Sunday in Los Angeles. A missing or invalid zone falls back to UTC. The
  `/goals` page still uses the server's week and was left alone, so compare
  leaderboard hours against Progress, not `/goals`.
- **Telemetry**: `onboarding_step_viewed`/`_completed` accept
  `flow: "v2" | "v3"`, and v2 now sends `"v2"`. In `phase4.sql` (not yet run),
  `admin_onboarding_stats` counts a v3 first run as reaching a step only from
  a view event; v2 keeps its ordinal and finished inference. A view with no
  flow counts as v2, and so does a v2 user replaying in v3. The admin
  Onboarding tab adds a v3-order funnel behind `ONBOARDING_V3`, so nothing
  changes until the flip.
- Tests cover the LA and Tokyo week boundaries, the 169-hour DST week, the UTC
  fallback, unranked rows and rank parity, the "@" strip, and the `flow`
  allowlist.

### 00:59 · Onboarding v3 groundwork, dark (plan P1a)
Server and lib pieces for the onboarding v3 + Friends tab redesign
(`.claude/plans/onboarding-v3.md`). Nothing calls any of it yet, so no user can
see or trigger a change. No SQL.
- **Flags** (`lib/flags.ts`): `ONBOARDING_V3` (implies REDESIGN) and
  `FRIENDS_V3` (implies SOCIAL_ENABLED). Neither needs SQL, and nothing reads
  them yet.
- **`checkUsernames(candidates)`** (`app/actions/profile.ts`): signed-in only,
  runs the `checkUsername` rules over at most 12 candidates, returns
  `{ ok, taken, available }`, and counts the caller's own handle as free. It
  reads through a new `cache()`'d `listTakenUsernames` (`lib/db/profiles.ts`),
  where a failed read is an error, never "all available". Pure
  `cleanUsernameBatch` and `takenHandles` live in `lib/social/username.ts`. The
  check is not block-aware, so it returns yes/no only, never who holds a
  handle. `setUsername`'s 23505 catch is still the final word.
- **`ensureSchoolworkCategory()`** (`app/actions/categories.ts`): returns the
  caller's Schoolwork id, matched trimmed and case-insensitively
  (`findCategoryByName`). It inserts `SCHOOLWORK` (`#6F4E93`,
  `lib/default-categories.ts`) only when none exists, never recolors, treats a
  23505 race as found, and revalidates only when it inserted.
- `revalidateOnboardingSurfaces()` (layout), for `completeOnboarding` in P1b;
  `V3_STEPS` and `DEFAULT_GOAL_QUOTA_HOURS = 5` in `lib/onboarding.ts`.
- Tests for `V3_STEPS ⊆ STEPS`, the Schoolwork match, `cleanUsernameBatch` and
  `takenHandles`.

## 2026-10-08

### 23:30 · Patch 1.03 notes: Live Activity, a survey, Instagram
The "What's new" pop-up gets its second release, and three things it couldn't do
before.
- **New note `1.03`** (`lib/patch-notes.ts`): the Live Activity on the Lock
  Screen, a 30-second feedback survey, and the @progra.world Instagram, signed
  "Sincerely, Ish from Progra". Everyone stamped `1.1` sees it once on `/`.
- **Inline links in items**, written `[label](https://…)` and split by
  `noteSegments`. https only; anything else stays plain text, and a PATCH_NOTES
  test fails on a half-written link so raw markdown can't ship. Links are plain
  `<a target="_blank">`, which Capacitor hands to iOS for any non-progra.world
  host, so they open in Safari or Instagram instead of navigating the webview.
- **Optional `outro`** paragraphs under the bullets; `\n` is a line break.
- **The rainbow logo replaces the sparkle icon** (`public/progra-logo.png`,
  144px for 3x screens, `unoptimized` because next/image only serves 1x/2x of a
  fixed-width image). The web/PWA icons are still the old navy ones.
- **All copy is ink** (the intro was caption grey), and the dialog now caps at
  the safe viewport and scrolls. A three-item note with a sign-off is about as
  tall as an iPhone SE, and an unscrollable dialog that tall would push "Got it"
  off screen with no backdrop left to tap.
- The survey link drops the `/u/4/` account index from the URL as pasted, which
  would have sent other people to the wrong Google account.
- `npm run build` fails locally on the design-sync `node_modules/progra`
  self-link (Turbopack: "symlink … infinite loop"). Built clean with the link
  moved aside, then restored. Vercel never has the link.

### 15:40 · Design system synced to Claude Design
Uploaded to the "Progra" design-system project
(`claude.ai/design/p/034ff31e-6522-4a93-a725-705d999802c9`) with
`/design-sync`. The project now has 42 components, 221 files. The four retired
components were removed, and the new sync anchor is written.
- Re-staged the converter (the staged copy dated from August), then ran the
  driver: build → diff → validate → capture. All 42 previews are graded good
  on the absolute rubric.
- Fixes found during grading: AvatarInitials now shows the real size scale;
  ChipRail no longer stretches; RecapFeedCard's week no longer starts on a
  Sunday (fixture timezone); dropped a ToggleSwitch cell that was identical to
  Off; BottomSheet copy is neutral.
- **Removed a real-looking email address from the August Label preview**
  (`…@quantluxdigital.io` → `maya.chen@example.com`). It had been live in the
  project since August.
- **Pinned `guidelinesGlob` to `docs/SCREENS.md`.** The default pattern was
  about to upload the App Store review docs, including the demo-account file.

### 13:10 · Design-system export rebuilt for the live redesign
The claude.ai/design project ("Progra Design System") was last synced on
2026-08-04, eleven days before the editorial rebuild. Its components,
conventions and flags all described an app nobody runs any more. Everything
below is local; uploading it still takes a `/design-sync` run.
- **42 components (was 20).** Added the redesign's building blocks from
  `components/v2/`: PrimaryButton, SectionHeader, MenuRow, ChipRail,
  ToggleSwitch, BackButton/BackLink, BottomSheet, Donut, CategoryDonut,
  GoalQuotaRows, WeekSummary, HabitWeekGrid, FriendsLeaderboard, SessionCard,
  RecapFeedCard, the nudges and WhatsNewModal. Also added AvatarInitials,
  PrograMark, ClockedInStrip, InviteShare and SessionPlanPicker. Each has an
  authored preview with realistic data.
- **Retired WeekStrip, Tabs, Separator and WeekBreakdown.** The live app no
  longer uses them.
- **Server actions and `next/navigation` are stubbed** through a design-sync
  tsconfig (`.design-sync/tsconfig.json` → `.design-sync/stubs/`). This is
  what lets SessionCard, BottomNav and the nudges bundle. Each stub is typed
  against the real action. The bundle metafile was verified to contain no
  `app/actions`, `lib/db` or `lib/supabase` paths. App code is unchanged.
- **The bundle runs production flags.** The process shim now sets
  `REDESIGN` and `SOCIAL_ENABLED`. Without them BottomNav rendered the
  retired Home/Search/Goals/Habits tabs.
- **Rewrote `conventions.md`, the README header the design agent reads first.**
  It now covers the no-cards/no-headline/flat rules, the token tables, the
  11-color palette with fill and ink values, type sizes, screen and row
  recipes, the app's structure, voice, and a full Progress-screen example.
  Every class it quotes was checked against the compiled CSS.
- The PageSkeleton preview had been broken since August (its props changed).
  It is now rewritten.
- Verified with a full local build and validate into a scratch dir: 42/42
  previews render, `.d.ts` files parse, ESLint is clean, and previews
  type-check against the real component types.

### 09:58 · Internal analytics — deployed
Commit `00d5cb7` (the five analytics phases + PostHog removal) and `c0a3184`
(login/onboarding and history handoff packages, no code) pushed to `main`.
`NEXT_PUBLIC_ANALYTICS=1` is set on Vercel, so the pipeline is live from this
build: `app_events` fills from the next app open. `phase1.sql` STEP 1–3 were
applied to prod earlier today (adversarial block 33/33). `phase4.sql` has not
been run yet, so `/admin/analytics` shows "Not available" until it is.

## 2026-10-07

### 00:40 · Internal analytics, phase 5 — the dashboard
`/admin/analytics` is rebuilt on the pipeline: three tabs, one GET filter row,
every number from the phase-4 RPCs, nothing from anywhere else.

**Shape.** Admin-only as before (`requireAdmin()`, 404 for anyone else; each RPC
re-checks `is_admin()`), reachable only from the admin-only Admin hub. Tabs are
`?tab=` and the filters are a plain GET form — date-range presets and a custom
range, segment, signup cohort, include-internal — so a view is a URL, the
server re-renders every chart against one slice, and the page carries no
client state beyond the roster's chip row. One `Promise.all` per tab.
Phone-first: `max-w-md`, wide tables scroll inside themselves, charts are
`aspect-auto` with set heights.

**Overview** — six pulse tiles each with the delta against the same number one
week earlier (active, ghosts, activated-by-day-7 rate, hours this week, median
friends doers · ghosts, counted users); the stacked state bar with the ghost
callout underneath; the seven-stage activation funnel; retention by signup week
split by friends at day 7, blank cells never 0%.

**Usage & social** — clock-ins vs habit checks per active user over the range;
usage mix; session-quality tiles (sessions per doer, median session, %
auto-ended, logged vs target); goals by category with a **Categorize goals**
button (`backfillGoalCategories`, private goals never sent); friend buckets
with % active; interactions; the nudge funnel against the recipient's own
baseline; social pull; and the Notifications section — per-type table (sent /
tap / influenced / converted / baseline / lift), lift by hour, fatigue,
response by user state, permission and toggle breakdowns. Lift and social
pull show "collecting data" until the logs are 14 days old.

**Onboarding, ghosts & roster** — drop-off by screen with median seconds on
each, stuck by screen, a per-sign-in-method table, the stuck list, possible
duplicates (flag only), ghost open frequency, what ghosts do when they open,
ghosts vs doers, and the full roster with All / Active / Ghosts / Lapsed /
Stuck chips and a sort. Every roster card, stuck user and duplicate opens
`/admin/analytics/user/[id]`: that person's internal timeline, newest first,
kinds and ids only.

**Charts.** recharts through shadcn's `components/ui/chart.tsx` — the one
approved dependency. Built to the dataviz method: bars ≤ 16px with a 4px
rounded data-end, 2px lines, a solid hairline grid, text in text tokens, a
legend whenever two series share a plot, a tooltip on every mark. Colours
are the app's own palette, VALIDATED as a categorical set with the method's
checker: Green → Dark blue → Orange → Dark purple passes every gate in that
order (green beside orange failed the protan simulation; blue beside purple
failed the normal-vision floor — both avoided), plus the theme neutral for
"nothing yet". Light blue (chroma) and Light green (contrast) are not used.

**Retired.** The 2026-09-14 roster page (`user-card.tsx`, `cohort-table.tsx`,
`lib/admin-analytics.ts` + its 25 tests, the two old readers). phase4.sql STEP
3 drops `admin_list_users`, `admin_activity_days` and
`analytics_excluded_users` once this is deployed. `docs/SCREENS.md` S58 / S58a.

Gate: `tsc` · `eslint` · vitest · `npm run build` · signed-out smoke.

### 23:59 · Internal analytics, phase 4 — the data layer
Every number the dashboard will show is computed on read by SQL behind
`is_admin()`, from one place.

**One facts function.** `analytics_user_facts(filters…, p_now)` returns one row
per user with everything: state and ghost, friends now and at day 7, logged
days in the first week and activation, hours this week and the week before
(clipped), clock-ins, habit checks, opens, the eight interaction counts,
notifications received and opened, usage flags, week-4 activity. Every
`admin_*` RPC reads from it, so each definition exists exactly once — and
"the prior 7-day value" on the pulse cards is literally the same function
evaluated at `p_now − 7 days` over the users who existed then. `p_now`
defaults to `now()` and exists so the harness can pin the clock.

**The definitions, in SQL and TypeScript.** `lib/telemetry/metrics.ts` is the
reference: `userState`, `isGhost`, `friendsInFirstWeek`,
`loggedDaysInFirstWeek`, `isActivated`, `workedMs`, `clippedWorkedMs` — 20
tests, boundaries pinned (a log exactly 7 days old is lapsed; day 7 is outside
the first week; a running session caps at 10h, an ended one reads back as
stored; an auto-ended one is 0 however it overlaps). `analytics_worked_ms` is
the SQL twin, and the proportional-clipping rule is stated once: pauses are not
timestamped, so a session straddling the window keeps the same share of its
worked time as of its wall-clock span. "Logged" dates a session by
`started_at` and a habit tick by `created_at` — the day the person acted, not
the day a backfilled tick is about.

**Seven RPCs** (`.claude/plans/analytics/phase4.sql`, read-only, hand-run after
phase 1): `admin_user_roster`; `admin_overview` (pulse now vs prior, states,
ghosts, activation rate, median friends doers vs ghosts, the seven-stage
funnel, retention by signup week × friends-at-day-7 with blank-never-0% cells);
`admin_usage_social` (usage mix, session quality, per-day series, goals by
category with a "private" bucket, friend buckets, interactions, the nudge
funnel against the recipient's own 28-day log rate, and social pull: sessions
within 3h of a friend's against chance coverage, opens within 24h of a
like/comment/nudge against the quiet users' daily open rate);
`admin_notification_stats` (per type sent / tapped / influenced / converted /
baseline / lift, by hour, by notifications-per-day, by user state, the
permission and toggle breakdowns — "sent" for a local notification means
presumed fired, and clock_in_reminder converts on a MANUAL clock-out within 30
minutes, the plan's D4); `admin_onboarding_stats` (reached / stuck / median
seconds per step, by sign-in method; the stuck list; same display name across
providers, flagged only); `admin_ghost_behavior`; `admin_user_timeline`. Lift
and social pull report `collecting_data` until the logs are 14 days old.

**Readers** in `lib/db/admin-analytics.ts`, one `cache()`-wrapped reader per
RPC with primitive args, null on any error so the page can say the SQL is not
installed; the roster gets `rowToRosterUser`, the aggregates keep the RPC's
keys (`lib/admin-dashboard.ts`).

**Proven on a fixture** (`nudges-harness/analytics-phase4.mjs`): nine people
whose numbers are worked out by hand at a pinned clock — Alice active with 2.0h
(a straddling hour counted proportionally), Bob lapsed and a ghost and
activated, Carol never-logged and a ghost, Dave stuck at an inferred step,
Erin with a running session and a worthless auto-ended one, Ivan with three
early friends but one logged day (so NOT activated), a duplicate "Sam Lee"
across Google and Apple — 38 checks across all seven RPCs plus the prior week,
the adversarial block (9/9), and six planted mutants all caught (ghost without
the open window, activation on friends alone, auto-ended counted, internal
friends counted, a cancelled local notification counted as sent, a 0%
retention cell for an unelapsed week). The harness mock moved to
`analytics-mock.mjs`, shared with the phase-1 suite.

Also: `recharts` via `npx shadcn add chart` for phase 5 (approved 2026-10-07).
The install also rewrote `components/ui/card.tsx` with a broken `cn` import
and new spacing variables; that file was reverted — the chart is the only
addition.

### 23:45 · Internal analytics, phase 3 — notifications, attributed
Every notification the app can produce now has a `notification_log` row with
an id the tap can come back to, and the device's permission state finally
lives somewhere a dashboard can read.

**Remote (like, comment, reply, nudge, recap).** Each sender mints the row id
BEFORE the send and puts it in the APNs payload as `nid` beside `ntype`
(top-level custom keys, which surface under `notification.data` on a tap like
`url` does). After APNs answers it writes the row — `sent` when at least one
device accepted it, `failed` otherwise — keyed by the push_log dedupe key, so
the two tables line up one to one. One row per push, not per device. Written
by the admin client the senders already hold (exception kinds 2 and 3), never
blocking the push, and a missing table is logged, not thrown.

**Local (clock reminders, habit reminders).** A device can only say "I
scheduled this" or "I cancelled it before it fired", so that is what is
reported — and nothing is ever labelled delivered. `createReminderSync` now
asks iOS what the family still has pending (by the `local:<id>:<ms>` key it
puts in `extra`, since the schedule date iOS returns is rounded to the second),
diffs that against the new list with the pure `diffReminderSchedule()`, and
emits `notification_cancelled` for what disappears and `notification_scheduled`
for what is new — after the plugin call succeeded, so a throw reports nothing.
A reminder that already fired is simply absent from pending and is never
"cancelled"; "presumed fired" (scheduled, never cancelled, instant in the
past) is derived server-side. This is what makes the clock family's
pause-cancels-everything / resume-reschedules churn honest instead of
inflating "sent". Rows cancelled at sign-out may be dropped by the ingest
(no user) and read as presumed fired later — one accepted edge.

**Taps.** The router records `notification_tapped` before routing — `nid` for
a push, `key` for a local one — and tells the client, so the `app_opened`
that follows carries `source: "notification_tap"`. The ingest RPC opens exactly
that row for exactly that user, and upserts if the tap outran its schedule
event. Influenced opens, conversions, baselines and lift are Phase 4's SQL.

**Permission and toggles.** On every signed-in open the lifecycle leaf reads
the iOS permission (a pure read; it never prompts) and the two on-device
reminder prefs and mirrors them to `profiles.notification_permission` /
`reminder_prefs` via `sync_device_state`, throttled ten minutes client-side
and again in the RPC, which also writes whenever something changed. The
clock-reminder pref is per session, so the leaf now takes the active session
id (through a ref — a session starting must not re-attach native listeners).

Nothing user-facing changed: no new prompt, no new buzz, no native build.

Gate: `tsc` · `eslint` · vitest (+`reminder-diff.test.ts`) · build.

### 23:20 · Internal analytics, phase 2 — what is tracked
The pipeline now carries the product. Everything below is client-side
`track()` next to the existing call, fires only on the user's own completed
action (never from autoClockOut or a plan completing by itself), and carries
ids and closed labels only.

**Screens.** `landing_viewed` (device id only — there is no user yet; linked at
sign-in), `feed_viewed`, `clock_in_screen_opened` (the form, not the
active-session strip — keyed on the session id so clocking in does not
re-fire). A `<TrackView/>` leaf lets a SERVER page record a view without
becoming a client component. `sign_in_started {method}` on all three buttons.

**Onboarding.** One effect keyed on the step NAME: entering a screen records
`onboarding_step_viewed` and writes `profiles.onboarding_step` through
`setOnboardingStep` (the per-user "where did they stop" the dashboard reads;
Back re-reports, the Done splash never does). `go()` records
`onboarding_step_completed` for the screen being left, but only when moving
forward.

**Core actions.** `session_clocked_in {session_ref, goal_id, category_id,
timed}` and `session_clocked_out {session_ref, worked_minutes, timed,
breaks_taken}` — the latter REPLACES `session_completed`, which only existed
for PostHog; `session_cancelled` on the finish screen's delete; `habit_checked
{habit_id, backfilled}` on all four surfaces (Progress, /habits, the weekly
grid, the manager), only when checking ON; `like_given {session_ref}` on a
reaction that is now on (either button); `comment_given {session_ref, depth}`
for posts and replies, replacing `comment_reply_posted`; `nudge_sent` gains
`nudge_id`; `friend_request_sent {target_id}` and `friend_added
{friendship_id, from}` on the Friends tab, a profile and the UW onboarding
step; `goal_created` / `goal_updated {goal_id}` in all three goal editors.
Metrics still come from the real tables — these add timing and context.

**Profile views.** `<RecordProfileView/>` on anyone else's profile →
`record_profile_view`, which refuses a self-view and collapses the same pair
inside 30 minutes. Internal only, never shown.

**Goal categories, by Haiku 4.5.** `lib/anthropic/categorize-goal.ts` is the
deleted calendar categorizer's shape — structured JSON output pinned to the
eight labels, one short call, `maxRetries: 0`, 15 s timeout, the
`DISABLE_AI_CATEGORIZATION` kill switch kept — for ONE goal title.
`labelGoalAfterWrite` runs inside `after()` from `createGoal` and from
`updateGoal` when the title changed or the goal just became visible, under the
CALLER'S OWN RLS client (no service role). **Private goals are never sent:**
the helper skips them, going private clears the label, and the admin backfill
RPC never returns their titles — the same rule `admin_list_users()` already
applies to the admin's own eyes. `backfillGoalCategories` (admin action, the
dashboard's button) labels what is still null. `/privacy` now says goal titles
are processed too. Columns and RPCs are already in `phase1.sql` (1.3, 1.15,
1.16); the adversarial block gained T17a–d (admin-only, CHECK, private goals
never labelled) — 33/33, all mutants still caught.

Gate: `tsc` · `eslint` on every touched file · vitest · build.

### 22:45 · Internal analytics, phase 1 — the pipeline is ours, and PostHog is gone
Every product event now lands in `app_events` in Progra's own Supabase, written
by a route handler, read only by the admin dashboard. There is no third-party
analytics SDK any more.

**`track()` did not change.** `lib/analytics.ts` keeps its path and signature
and the two dozen call sites are untouched; the body now delegates to
`lib/telemetry/client.ts`, which validates, queues (localStorage, so the queue
survives a kill), batches (every 15 s, at 20 events, and on the way to the
background with a `keepalive` fetch) and POSTs to `/api/analytics/events`.
Failures are swallowed after three tries. With `NEXT_PUBLIC_ANALYTICS` off it
makes zero network calls and the route answers 204 and drops the batch, so this
deploys safely ahead of the SQL — the flag means "phase1.sql has run", like
`JOHN` and `UW`.

**No free text can be tracked, by construction.** `lib/telemetry/events.ts` is a
closed table: every event name and, per event, every property with its type —
uuid, int, bool, HH:MM, a local-notification key, or a closed enum. There is no
string type. A goal title, a task name or a comment body cannot pass
`validateEvent()` even by accident, and the test says so as a property over the
whole table. A bug report's `route` is normalised to a template
(`/profile/[username]`) before it becomes a property.

**Identity comes from the cookie, never the body — and the route must not
refresh it.** `lib/telemetry/ingest.ts` decodes the `@supabase/ssr` cookie
(chunked, `base64-`) itself and `ingest-server.ts` verifies the access token
locally with `auth.getClaims(token)`, the one call that neither reads nor
refreshes a session. That is why `api/analytics` is excluded from `proxy.ts`: a
background flush is fire-and-forget, the suspended webview may never see the
response, and a refresh there would rotate the refresh token without the device
storing it. An expired token just makes that batch anonymous;
`link_device_events` claims it on the next signed-in open — called on EVERY open
(one idempotent indexed UPDATE), not once. A guessed device id can only claim
ownerless rows; the shared-device case (A signs out, browses, B signs in)
mis-attributes A's landing events to B, which is accepted. This is service-role
exception kind **(4)** in `lib/supabase/admin.ts` and AGENTS.md.

**Bounded for strangers.** Signed-out batches keep only `landing_viewed` and
`sign_in_started`; the route rejects a request whose `Origin` /
`Sec-Fetch-Site` is not same-origin; the RPC budgets 1000 events per device per
hour and 5000 anonymous events per hour across all devices (an instance-local
limiter in the route is just the cheap first line). A client `event_id` with a
unique `(device_id, event_id)` makes a re-sent batch a complete no-op — side
effects included — and batches stay under 25 events / 16 KB, the `keepalive`
quota that would otherwise throw.

**One leaf for opens.** `components/analytics-lifecycle.tsx` replaces both
`PostHogInit` and `LastSeenPing`, ungated inside `Shell` so the beta-full wall
and the signed-out landing count. On native it listens to the App plugin's
`pause` / `resume` (didEnterBackground / willEnterForeground), NOT
`appStateChange`, which also fires for Control Center and the notification
shade; on the web, `visibilitychange`. `app_opened` carries cold/warm and
whether a notification tap preceded it; `app_backgrounded` carries seconds in
the foreground. A resume with no background before it is not an open. With the
flag off it still calls `touchLastSeen()` exactly as before; with it on the
ingest RPC bumps `profiles.last_seen_at` from every open, so the roster's
"Opened" column never regresses.

**All the DDL for phases 1–3 lands now** (`.claude/plans/analytics/phase1.sql`,
hand-run): `app_events`, `app_open_days` (opens per LOCAL day — the rollup that
outlives the 180-day raw retention), `profile_views`, `notification_log`;
`profiles.is_internal` + `excluded_reason` (guard trigger copied from the
`seat_no` idiom, so not user-writable; `admin_set_internal()` flips it),
`onboarding_step` as a STEP NAME with its CHECK, the device's notification
permission and reminder prefs; `goals.category_label`;
`friendships.accepted_at` with a BEFORE INSERT OR UPDATE trigger, because
`created_at` is when a request was SENT. Writer RPCs: `ingest_app_events`
(service role only; merges `mutual_friend_count`, `friends_active_24h`,
`segment`, `days_since_signup` once per batch — the client never computes
them), `link_device_events`, `prune_app_events` (called lazily by the route at
most hourly — the one scheduled job in this repo stays the one),
`record_profile_view` (no self-views, 30-min pair dedupe),
`set_onboarding_step`, `sync_device_state`. `admin_list_users()` is re-pointed
at `is_internal` so the old page and the new one cannot disagree. Backfills:
the old exclusion rows plus `ishaanroybiswas`, `zack`, `jillybean` as founders
(data, not query logic); `accepted_at = created_at` for existing friendships,
flagged approximate; an inferred `onboarding_step` for everyone still in the
wizard.

Tested first in `nudges-harness/analytics.mjs`: STEP 1V, the 29-check
adversarial block (which raises its own summary and rolls itself back), the
budgets, local-day bucketing for Tokyo and a garbage timezone, `last_seen_at`
parity, prune, the three backfills, idempotent re-run — and **10 planted
mutants, all caught**, including "ingest left callable by `authenticated`".

**PostHog removed entirely**: `components/posthog-init.tsx`, the `/ingest`
rewrites and `skipTrailingSlashRedirect` (nothing else used it), `posthog-js`,
the self-driving report, and the privacy-label / review-notes rows. What
changes: PostHog's pageview history stops accruing (nothing read it); the App
Store label's Usage Data → Product Interaction answer STAYS (collected, linked,
not for tracking, purpose Analytics) with PostHog dropped from "Third parties";
`NEXT_PUBLIC_POSTHOG_KEY` can come off Vercel.

Gate: `tsc` clean · `eslint` clean on every changed file · **543/543 vitest in
39 files** (+48) · `npm run build` · signed-out route smoke. New tests:
`lib/telemetry/events.test.ts` (allowlist, no-free-text property),
`queue.test.ts` (the three triggers, caps, retries, storage round trip),
`ingest.test.ts` (batch shape, per-event judgement, origin, cookie decoding,
limiter).

Yours by hand: run `phase1.sql` STEP 0 and paste it back, then STEP 1 → 1V →
2 → 3; set `NEXT_PUBLIC_ANALYTICS=1` on Vercel; remove `NEXT_PUBLIC_POSTHOG_KEY`.

### 21:50 · The card's chip is just the name now
No "Goal · " prefix and no "Category · " either — the chip reads `Thesis`,
`Writing`, `Uncategorized`. The card is deliberately plainer than the finish
screen and the live timer, which both still prefix a goal off
`attribution.isGoal`.

That made `chipLabel` byte-identical to `attribution`, so it is gone rather
than kept as a second name for one value — along with the `isGoal` threading it
needed through `liveActivitySnapshot`, the sync leaf and the layout.
`liveActivitySnapshot` takes a plain attribution string again. `chipInk` stays:
the chip still needs ink lifted past its own 28% fill.

Safe to remove rather than deprecate: no shipped binary reads `chipLabel`. The
card that uses it has never been released, and the one in the field renders the
previous editorial layout.

### 20:20 · Why the elapsed clock keeps drifting left, and the actual fix
The clock sitting too far from the card's trailing edge has now been "fixed"
three times — an optical inset (`.padding(.trailing, -6)`, reverted), and the
frame width tuned 124 → 116. Both aimed at the wrong thing.

**The mechanism.** `Text(timerInterval:)` reserves layout width for the WIDEST
string its range can produce, not the value it draws. Over a 10-hour range that
is `"9:59:59"` — 165.41pt at 48pt — while a young session draws `"5:23"`, which
is 57.68pt. More than 100pt of the box is empty, and the glyphs are not
trailing-aligned inside it by default.

**Why the obvious fix never worked.** `.frame(width:alignment:.trailing)` has
nothing to align: the Text's own box already fills the frame, so the slack is
*inside* the Text, out of the frame's reach. Only `.multilineTextAlignment`
gets at it — and no version of this card has ever set it, across all four
attempts. The handoff's own reference implementation did.

**Why it kept coming back.** The render harness cannot see it. `ImageRenderer`
draws a timer Text as a plain static string at its natural width and never
applies the reservation, so a clock that drifts badly left on a phone
photographs as perfectly flush. Proven by rendering a timer Text and a plain
`Text("5:23")` side by side in the same frame: identical output. AGENTS.md now
says so beside the harness, because a green render was the evidence that kept
closing this.

Ruled out on the way: right side bearing, which is 0.55–3.55pt and *varies per
digit* — which is also why the -6pt inset was wrong, being roughly twice the
largest of them and overshooting for most.

The fix is `.multilineTextAlignment(.trailing)`, set inside `ElapsedText` so
the card and both Dynamic Island regions get it rather than two of three. The
frame also moves 166 → 169, the UNTRACKED width of the widest string: it is not
certain the system applies `.tracking` when computing the reservation, and a
frame narrower than the reservation squeezes the digits, which is worse than a
few points of slack now that the glyphs hug the edge.

**An adaptive width is not available here**, and the reason is specific to this
surface: a Live Activity re-renders only when the app pushes, so a width chosen
at render time would still be in force after the clock crossed an hour and
gained a digit — overflowing rather than merely sitting left. A widget could
schedule a timeline entry for that instant; a Live Activity cannot.

Needs a device to confirm. Nothing off-device can.

### 19:45 · The Live Activity card, rebuilt to the widget handoff
`design_handoff_progra_widget` is now the Lock Screen card: a goal chip, the
session name, the elapsed clock at 48pt in the goal's colour, and Pause /
Clock out.

**It was built as a home screen widget first, and that was the wrong surface.**
A `.systemMedium` widget cannot hide itself — iOS has no API to retract a placed
widget — so it needs a design for the ~22 hours a day nobody is clocked in, and
the handoff explicitly leaves that state undrawn. A Live Activity appears on
clock-in and disappears on clock-out, which is the lifecycle the design already
assumes. The widget target, its App Group, its plugin and its whole TypeScript
stack were removed; what survived is the part that was really missing all along
— the fonts.

**The fonts are embedded at last.** The 2026-10-06 entry called this out as a
separate, bigger change, and the old card's own comment said a widget "can't
load a Google font". Static cuts from the Google Fonts variable originals (SIL
OFL, licence bundled): Hanken Grotesk at `wght=600`, Newsreader at `opsz=48,
wght=500`. The handoff asks for a "36 pt or 60 pt static instance", but upstream
declares `opsz` nominals at 6/16/72 only, so neither exists to take; 48 is the
clock's render size and so the optically correct cut — and it is what the mock
shows, since browsers resolve `opsz` from `font-size`. PostScript names were
read back out of the files through CoreText rather than assumed:
`HankenGrotesk-SemiBold` and `Newsreader48pt-Medium`. The Newsreader cut is
subset to the eleven glyphs a timer can emit — 3.7 KB.

**Always navy now.** The adaptive white/dark card is gone, because the handoff
specifies one ground in both appearances. `accentInk` — the palette colour
darkened for type on white — consequently has no reader left on this surface.
It stays in the payload anyway: removing a field strands an activity an older
binary started.

**The chip follows the app, not the mock.** `Goal · Thesis` for a goal, a bare
`Writing` for a category, which is what `finish-client.tsx:222` and
`live-timer-client.tsx:614` already render off `attribution.isGoal`. The handoff
only specifies the goal case, so a literal reading would have shown
`Goal · Writing` on every category-tracked session. `liveActivitySnapshot` now
takes the resolved attribution whole rather than just its text.

**Measured, not estimated.** The handoff reference's `timeWidth` TODO guessed
150pt; CoreText puts `"0:00:00"` at 48pt with −0.48 tracking at **165.41pt**, so
the frame is 166. That only holds because the counting-up range now stops one
second short of the cap — ending *at* it lets the range produce `"10:00:00"`,
which reserves 193.63pt, and `Text(timerInterval:)` sizes for the widest string
its range can produce, not the one it draws. The Island's two clock widths were
re-measured for the same seven-character range (90→77, 52→43).

The clock also gives back 11pt of its reserved descent. A 48pt line of Newsreader
reserves 12.72pt below the baseline; digits and the colon reach just 1.20pt.
Left intact it sets the top block's height and pushes a two-line card to
162.16pt, past the ~160pt a Lock Screen Live Activity should ask for. The card
is pinned to `minHeight: 160` so the button row sits where the mock's
`space-between` puts it rather than crowding the name at the bare 8pt minimum.

Both states now render through ONE formatter via `pauseTime`, where the frozen
case used to be a hand-rolled string — necessary once the clock has a pinned
width, since a hand-formatted string can differ in metrics from the system's.
`prograFormatWorked` went with it.

**What the Lock Screen loses:** the sub-line, so the break countdown and a timed
session's "ENDS 17:30" no longer appear there — the handoff's layout has no slot
for them. Both survive in the Dynamic Island's expanded region, which keeps its
measured layout and is otherwise untouched (the handoff designs no Island).
Nothing else went: `staleLabel` was already in the payload and already rendered
nowhere.

**And the card can be rendered headlessly again** — this time the real one.
`scripts/render-widget/main.swift` compiles `PrograCardView.swift` itself, which
is why the layout now lives in a file importing SwiftUI alone: ActivityKit is
iOS-only, so a card that imported it could only be photographed by hand-copying
it, and the copy would drift until the renders started lying. It earned itself
immediately — both `Link` buttons rendered as a flat yellow fill with a
missing-glyph symbol and no label, a missing `.buttonStyle(.plain)` that the
card this replaces has had all along and that `swiftc -typecheck` cannot see.

## 2026-10-06

### 06:10 · One voice on the Live Activity card, and a way to SEE it
The card's title was New York — Apple's serif, reached via `design: .serif` —
while the goal name beside it was the system sans. Two typefaces, and neither was
the wordmark's.

**"Progra" is the sans.** `components/dashboard.tsx:99` is
`text-3xl font-semibold tracking-tight` with **no** `font-serif`, so it falls
through to `body { @apply font-sans }` — Hanken Grotesk. The title and the
Dynamic Island's label now use the system sans at the same weight and tracking
(`tracking-tight` is -0.025em ≈ -0.5pt at this size), so the title and the goal
name read as one voice.

Not literally Hanken: the fonts come from Google Fonts via `next/font`, there is
no file in the repo, and a widget extension needs one embedded and registered
through `UIAppFonts`. Embedding it is a separate, bigger change — a binary asset
plus its OFL licence plus another Xcode target step.

**And the card can now be rendered headlessly.** `ImageRenderer` on macOS
compiles the card's layout and writes a PNG; a red hairline marks the trailing
padding so alignment is visible rather than inferred. It immediately showed what
three device round-trips had not: the `clockOpticalInset` added last pass pushed
the clock PAST the padding the buttons respect, which is what read as broken.
Removed — at a frame width matching the timer's real reservation the digits land
flush on that edge on their own, for a short "52:18" as well as a long
"1:24:07".

It also corrected an earlier guess of mine: `Text(timerInterval:)` *does*
right-align inside a trailing-aligned frame. Given slack it centres instead,
which is what the old 124pt produced — so the width has to stay near the
measured reservation, and that is now written down beside the constant.

### 05:05 · Measure the Live Activity clock instead of estimating it
The card's clock sat slightly inset. The reserved width was guessed from a
0.6em-per-digit figure; CoreText was asked instead, with the exact font the card
uses (26pt SF Pro Rounded semibold, monospaced-numbers feature):

```
"10:00:00"  115.35pt     "59:59"  74.45pt
"1:24:07"    98.58pt     "5:23"   57.68pt
```

So `clockWidth` was ~9pt over at 124, and the sub-line was paying for it — now
116, the widest string the 10-hour range can produce plus a hair. Both Dynamic
Island clocks were over the same way and are now measured too: expanded 96 → 90
(89.44 at 20pt), compact 58 → 52 (49.95 at 11pt).

Plus `clockOpticalInset`, which is the one value here that is a judgement rather
than a measurement, and is commented as such: 16pt of card padding is right for
10pt small caps, but against 26pt digits the same gap reads as the clock being
inset, so it is pulled 6pt past it to sit ~10pt from the card's edge. That single
constant is the whole lever — nothing else depends on it.

The measuring script is throwaway (a scratchpad `swiftc` run), but the technique
is not: the card's metrics are checkable, and a guessed em-ratio had already cost
two round trips to a device.

### 04:40 · Live Activity layout, rebuilt — and a way to type-check the Swift
Third attempt at the card's layout, and the first with the Swift actually
verified rather than reasoned about.

**There IS a way to type-check it.** `/Applications/Xcode.app` carries the iOS
SDK; `xcode-select -p` just points at CommandLineTools, which has none — so a
bare `xcrun` says "SDK iphoneos cannot be located" and it looks impossible.
Exporting `DEVELOPER_DIR` fixes it, changes no global state, and gives a clean
`swiftc -typecheck` against the real SDK. Documented in `AGENTS.md`. Two of the
three layout attempts would have been caught here.

**The measured cause.** `Text(timerInterval:)` sizes itself for the WIDEST string
its range can produce, not the value it draws — and the range runs to the 10-hour
cap, so it always reserved for `10:00:00` (~124pt) while drawing `1:24:07`
(~108pt) or `52:18` (~70pt), without right-aligning inside. Up to 54pt of dead
space, worst early in a session, and it stole that width from the title at the
same moment. With no `frame` and no `layoutPriority`, the only escape valve was
`.minimumScaleFactor(0.7)` — so the squeeze resolved by shrinking the digits
instead of pinning them, and glyph size moved between states.

**The fix.** The title gets its own row at the card's full ~305pt (~31
characters); the sub-line shares row two with the clock, pinned at
`.frame(width: 124, alignment: .trailing)`. Explicitly NOT `.fixedSize()`, which
is what broke the first attempt — it lets a timerInterval Text demand its
unbounded ideal width and overflow the card. This is the convention the web app
already uses for a changing numeric readout (`w-[50px] shrink-0 text-right
tabular-nums` on the friends leaderboard, `min-w-[78px]` on the history stepper),
both sized for the longest realistic string rather than the current one.

Splitting the rows also settles a Dynamic Type mismatch: the title scales
(`.title3`) while the clock is pinned at 26pt, so sharing a row made the contest
strictly worse at accessibility sizes. Apart, the title simply truncates later.

**`stateLabel` is now null while running.** The sub-line's budget is ~25 small-caps
characters and `GOAL · WRITING · TRACKING` is exactly 25 — the word was what
tipped it into an ellipsis, and a ticking clock already says it. Decided in
TypeScript because the payload owns copy; `SubLine` resolves its trailing segment
as a value before rendering, so the `·` is conditional and there is no dangling
`MATH ·`.

**Two bugs found on the way.** `timerRangeEnd` fell back to `Date.distantFuture`
when `capEndMs` decoded nil — a reachable path, since every `ContentState` field
is Optional by the compatibility contract — which made the timer reserve width
for an astronomically large counter. Clamped to `anchor + 10h`. And the button
labels had no `.lineLimit`, so a long payload label would wrap and grow the
card's height.

### 03:35 · Live Activity — buttons, the session's colour, and a dark card
The card now carries **Pause / Resume / End break** and **Clock out**, names what
the session counts towards, paints itself in the session's own colour, and adapts
to the system appearance.

**The buttons are `Link`s, not `Button(intent:)`.** They deep-link to
`/clock/live?la=<action>`, and the new `?la=` handler runs the EXISTING
`handleStop` / `handleEndBreak` / pause handlers. That matters more than it
sounds: the Lock Screen path is byte-identical to the on-screen one — same
toasts, same `session_completed` event, same `endLiveActivity()` teardown, and
`revalidateSessionSurfaces()` fires, so **the reminder schedule is rebuilt**. A
silent PostgREST write would have skipped all of it. The action is dispatched
explicitly rather than through `togglePause()`, because a scheduled break can
start between the tap and the app finishing its launch — which would turn a
"Pause" tap into a resume. Acting with the app closed stays deferred: it needs a
`LiveActivityIntent` that can read the Supabase cookies out of
`WKHTTPCookieStore` on a background launch, which is unverified.

**Colour is THREE hexes, and the numbers are why.** `entityOnDark()` joins
`entityColor` and `entityInk` in `lib/colors.ts`. Against the dark card's
`#142c49` ground the raw fills put maroon at **1.91:1**, dark blue at 2.12 and
purple at 2.14 — under the 3:1 that even a NON-TEXT marker needs, so the 3pt bar
would be invisible rather than merely dim. And `entityInk` is worse than
unhelpful there: it darkens a colour for white grounds, moving it toward the
background. Mixing 45% toward white keeps the hue and clears 4.5:1 for every
palette entry, so one value serves both the marker and the digits.
`lib/colors.test.ts` pins that over all 11 colours rather than trusting the
arithmetic, and encodes the two failure modes as tests of their own.

So: on white, fill for the marker and `accentInk` for the digits; on navy,
`accentOnDark` for both. The Dynamic Island takes `accentOnDark` unconditionally
— it is black in either appearance, so there is no light variant to pick.

**The card adapts off one dynamic `UIColor`** rather than four
`@Environment(\.colorScheme)` branches, so ground, type, hairline and both
buttons flip from a single source. Clock out inverts on navy (white pill, navy
type) since navy on navy disappears, and the ghost/solid pairing survives so the
destructive action keeps its weight. Paused drops the colour in both themes, but
the neutral moves UP in lightness on navy and down on white.

**Attribution and colour are resolved only while a session runs.** Both
`listCategories` and `listActiveGoals` are `cache()`-wrapped, so this is free on
the routes that already read them — but gating on `activeSession` means `/feed`
and `/me` pay nothing when nobody is clocked in.

Still dark behind `LIVE_ACTIVITY`. New Xcode target `PrograWidgetExtension` at
iOS 17.0; the app target stays at 15.0.

## 2026-10-05

### 14:55 · Live Activity, phase 1 — the whole TypeScript half, dark
Groundwork for a Lock Screen / Dynamic Island card for a running clock-in
session. Everything here ships **dark behind `LIVE_ACTIVITY`**, which means "the
native binary is out" — `capacitor.config.ts` points the shell at
`https://progra.world`, so the TS half can deploy to everyone while the plugin
that consumes it is still in App Store review.

**`lib/live-activity.ts` needs no `now`.** A running session's worked time
advances at exactly 1x, so iOS renders a self-updating clock from one anchor,
`startedAt + pausedMs` (= `plannedEndMs(timing, 0)`), with zero refreshes; while
paused the value is a constant. Every other field is a function of stored
columns too, so `liveActivitySnapshot()` takes no `now` parameter at all — a
deliberate asymmetry with `clockReminders(…, now, …)`. Two things fall out:
"one update per state transition, not a tick" becomes a property of the
signature rather than a discipline, and the fingerprint can cover *every* field
with no now-driven resync loop — which matters because ActivityKit throttles
update bursts. 35 tests, including the one that pins it: identical inputs an
hour later must produce byte-identical output.

**`sessionLiveState()` is now shared.** `live-timer-client.tsx` derived its
three states inline. The card decides its own button from the same function,
and the two can be on screen at once — so a second copy would eventually let
one offer something `pauseSession` refuses (it hard-rejects during a break).

**The one-leaf pattern has exactly two blind spots, and they matter more here.**
`clockOut` and the edit-that-ends both call
`revalidateSessionSurfacesExceptLive()`, which skips the layout on purpose — so
`SyncLiveActivity` never sees them. For reminders the cost is a stale nav
ticker; here it would be a Lock Screen card claiming a running session, with
live buttons, after clock-out. Both call `endLiveActivity()` explicitly, as does
`notification-lifecycle.tsx` for sign-out and account deletion, which a
`user`-gated leaf can never observe.

**Deep links did not work at all.** Nothing in the app listened for
`appUrlOpen`, and Capacitor navigates nothing on a custom-scheme open — it fires
that event and stops. So a deep link only ever foregrounded the app on whatever
it was showing, and a cold launch landed on Home. `components/deep-link-router.tsx`
handles both the warm event and the cold `getLaunchUrl()`, with the same
same-origin allowlist the notification tap router uses and a module-scope guard
so a client-side remount can't re-navigate. That was a prerequisite, not a
nicety: phase 1 needs it to open the timer from the card, and phase 2 needs it
for the fallback when a button can't authenticate silently.

**Also corrected `AGENTS.md`.** Its "Local notification patterns" section
claimed reminders never reschedule on pause/resume and cited
`.claude/plans/clock-in-notifications.md`. That plan file has never existed in
git history, and the code states the opposite outright.

## 2026-10-03

### 21:45 · Turn a private past session public, from the session itself
`/session/[id]`'s Private chip was read-only, so a session that ended up private
had no way out. Clocking out through the live timer saves the row
**draft-private** (`clockOut({ draft: true })`), and `/clock/finish`'s Post is the
publication moment — so a dismissed finish screen stranded the session on `/me`
tagged "· private". The only privacy control in the app lives in `SessionDialog`,
mounted from exactly one place (`/clock`'s day strip); once a session scrolled out
of that strip, nothing could publish it.

Now the owner gets a two-segment **Private | Shared** rail there instead of the
label (`app/session/[id]/visibility-toggle.tsx`) — the lit segment is navy, the
other grey, optimistic, and tapping the lit one is a no-op rather than a
round-trip. Track and chip metrics are the history scope toggle's to the pixel;
like that one it keeps its own chip rather than importing `period-chips.tsx`,
whose constants are scoped to the Today/Week/History switcher they document. The
rail carries its own `bg-track`, so it sits beside the kudos pill instead of
inside it.

**No SQL, no RLS change, no new action.** `sessions.is_private` is already the
whole of visibility — comments, reactions and the photo storage policy all read it
through `can_see_session` / `can_see_session_photo`, so flipping one boolean
propagates everywhere. `sessions_update_own` already permits the owner to write
it, and `updateSession({ isPrivate })` already existed, owner-scoped and
revalidating. The one read-path addition is `SessionDetail.autoEnded`, off the
`auto_ended_at` already in `SESSION_COLUMNS`.

**Gated to own + ended + not auto-ended**, both deliberately. A choice on an
*active* session is silently undone minutes later, because the clock-out path
rewrites `is_private` on the way past and `/clock/finish` then seeds its toggle
from `autoEnded` rather than from the DB. An *auto-ended* one is worth zero worked
time everywhere (`lib/session.ts:56`), so sharing it would post a "0m" session
under a title claiming real work — the same reason `/clock/finish` disables its own
privacy row for those. Both keep the read-only chip.

No confirm dialog: the flag is reversible by the same tap and publishing is
**silent** — pushes fire only from reactions/comments, and the feed is a 7-day
window ordered by `ended_at`, so an old session neither notifies anyone nor jumps
to the top of anything. A session that already carries a photo publishes the photo
too (`can_see_session_photo` requires `NOT is_private`), which the success toast
names in the finish screen's own words.

## 2026-10-02

### 18:20 · "Clock in or habits?" — the unit is an engagement day, not an event
Second growth question. `.claude/plans/clock-vs-habits.sql`: Q0 pre-flight
(which carries a finding of its own), Q1 adoption, Q2 the head-to-head, Q3 per
user. 58 checks in `nudges-harness/clock-vs-habits.mjs`.

**Counting rows would have given the wrong answer twice over.** A clock-in is
one timed block; a habit tick is one tap, and a user with six habits emits six
rows per visit — Q3's `ticks_per_habit_day` makes that factor visible. Worse,
`habit_completions.completed_on` is not when the person engaged: the manager
backfills up to 8 weeks, so one sitting can write thirty rows dated across a
month. `created_at` is the engagement moment, and it exists with full history
(found undocumented on 2026-09-25). So the unit is the **engagement day** — a
distinct local day on which the user acted on that surface, dated by
`sessions.started_at` / `habit_completions.created_at`, never by the day the row
is about. Q0.3 measures the backfill rate directly, i.e. how wrong the naive
`group by completed_on` version would have been.

**Two populations, because the fair denominator is contested.** Over everyone,
habits lose partly because many users never made one — which is a real answer to
"what do people use". Over habit owners only, the surface was actually available
— which answers "given both, which do they reach for". They will disagree; Q2
prints both rather than picking.

Q1 keeps **made a habit** apart from **ticked a habit**: habits created and
never used is a different failure from never creating any, and
`habits_made_never_used` names it. `has_live_habit` respects `archived_at`.

`habit_misses` is in the union for correctness, but `NEXT_PUBLIC_JOHN` is off so
it should be ~0 rows; Q0.2 prints its count so that is visible rather than
assumed. Noted in passing: `admin_list_users()`'s `last_active_on` uses
max(`completed_on`), so a backfiller reads as staler there than they are —
pre-existing, not touched here.

Fixture pins the backfiller (tapped today, dated 30 days back → engagement day
is today), the miss-only user (no completion row, still a real day), the
archived habit, the 1.5-rows-per-visit case, a NULL timezone, and the
waitlisted / excluded / never-onboarded holdouts.

### 17:05 · "Do users with more friends stay?" — the query, and why it needs two forms
First of a series of growth questions run by hand against prod.
`.claude/plans/friends-retention.sql`: Q0 pre-flight (friendships' real DDL —
the schema is not in the repo), Q1 friends-now x retention-now, Q2 the
leading-indicator version, Q3 per user.

**Q1 alone cannot answer the question.** Friends held *now* against retention
*now* is circular — staying on Progra is how you accumulate friends, so the
arrow runs both ways, and friend count also rises with tenure. Q2 fixes the
ordering: friends requested inside the user's first 7 days (predictor, fixed
early) against activity strictly after day 7 (outcome, measured later). Still
correlational — people who make friends in week 1 were keener to begin with —
so it reads as "predicts", never "causes". Only a split onboarding gets causal.

**Peer friends, not all friends.** Friend counts exclude
`analytics_excluded_users`, because "friends with the founder" is not the tie
being measured, and counting it would give almost everyone >= 1. Q1 reports
`avg_excluded_friends` so the size of that choice is visible rather than buried.

Definitions are reused, not reinvented: `counted` is
`lib/admin-analytics.ts`'s `isCounted()` (onboarded + holds a seat + not
demo/owner) and `last_active_on` is `admin_list_users()`', including the
auto-ended-session nuance, so these reconcile with `/admin/analytics` instead
of quietly disagreeing.

Tested first, per the house rule, in `nudges-harness/friends-retention.mjs` —
a PGlite mock of prod on a 12-person fixture whose answers are worked out by
hand, 40 checks. It pins the waitlisted / excluded / never-onboarded holdouts,
the habit-tick-only path, the NULL-timezone `coalesce(..,'UTC')` fallback, the
2-day churn-eligibility floor, and the runaway auto-ended session that ends
today but must still read as 26 days gone. The fixture was deliberately
re-tuned after the first green run: both Q2 cohorts had landed on identical
numbers, so a cohort-swap bug would have passed.

**Not yet run against prod** — the Supabase MCP server is returning 401 ("JWT
could not be decoded"), so the blocks are for the SQL editor.

## 2026-10-01

### 20:43 · Fix Skip (and Done) leaving you on the wizard
Regression from the gate change an hour earlier, and mine: I had `finish()` and
`skipAll()` call **both** `router.push("/")` and `router.refresh()`, reasoning
that one covers each of the two places the wizard can be mounted. They race.
With the wizard at `/`, the push re-applies the route's cached RSC payload —
still the wizard, since `staleTimes: { dynamic: 30 }` holds it for 30s — over
the refresh that had just fetched the finished one. Skip looked like it did
nothing.

One navigation now, chosen by where the wizard actually is: at `/` there is
nowhere to go, so `router.refresh()` is the whole job (`completeOnboarding`
has already revalidated the route); from `/onboarding`, the Replay path, it
still pushes.

### 20:18 · The onboarding error flash, fixed — the gate renders instead of redirecting
**Closes the `buglist.md` entry from 2026-09-13** ("flash of 'page doesn't load'
on first app open", open and uninvestigated for three weeks).

The prod console gave it up: **Minified React error #310** — "Rendered more
hooks than during the previous render" — thrown from Next's own router chunk
with `useMemo` in the frame. Not our hook code: ESLint's `rules-of-hooks` is
clean across `app/`, `components/` and `lib/`, and a brace-aware scan (verified
against deliberately-broken code first) finds zero hook calls inside any `if`,
loop, `try` or `.map()` in any client component.

It is a known Next.js bug — vercel/next.js#78396, closed as a duplicate of
 #63121 — that fires when three things meet: a `redirect()` from a Server
Component, a Suspense boundary (any `loading.tsx` is one), and a server read
during render. This app had all three on one path. The decisive test: loading
`/onboarding` **directly** was always clean; only signing in fresh — which goes
`/` → `redirect()` → `/onboarding` — threw.

`app/page.tsx` now **renders** `<OnboardingClientV2/>` in place of
`redirect("/onboarding")`. Removing any one of the three ingredients fixes it,
and the redirect is the one that was never needed. `/onboarding` stays a real
route for Settings → Replay, which is a soft navigation and was never affected.

Two things fall out of it:

- **The cold open gets materially faster.** The redirect made the browser fetch
  a second document and ran the root layout's ~13 queries **twice**, throwing
  the first set away — `cache()` is per-request and cannot span a 307.
- `finish()` and `skipAll()` now call `router.refresh()` alongside
  `router.push("/")`. The wizard renders at `/` on the common path, so pushing
  to the URL you are already on must not be the only thing between a new user
  and their first screen; the failure mode would be being stranded on the Done
  splash.

`BottomNav` is hidden until `onboarded_at` is set. It used to hide itself by
checking for the `/onboarding` pathname, which no longer exists on this path.

### 16:05 · Error boundaries, and a crash log that survives the crash
Chasing the cold-open error flash (`buglist.md`, open since 2026-09-13) turned
up why it went three weeks without a cause: **the app had no error boundary at
all.** Every throw fell through to Next's built-in `DefaultGlobalError` — "This
page couldn't load", two unlabelled buttons, no stack, no digest. Worse, Next
clears that boundary the moment the router's pathname changes, and the document
navigation clears the browser console at the same time. The error was real,
reproducible, and unreadable: by the time you looked, both the screen and the
log were gone.

- `app/error.tsx` — covers every segment below the root layout. Says something
  in the product's voice, offers `reset()`, and shows whether the throw was
  server-side or client-side. A `digest` is set only for server errors, so its
  absence is itself the diagnosis.
- `app/global-error.tsx` — the root layout itself, which `error.tsx` sits inside
  and cannot catch. Renders its own `<html>`/`<body>` with inline styles,
  because the layout that would have supplied the fonts and tokens is the thing
  that failed. Matters here specifically: the root layout mounts ~12 client
  leaves, several of which only run on a cold open.
- `lib/error-log.ts` — `recordError()` writes the last 5 crashes to
  localStorage; `readErrors()` reads them back from the console long after the
  fact. Every access is wrapped, because a blocked-storage browser must never
  turn a crash report into a second crash. This is the piece that turns a
  one-second flash into something readable.

Read them with:

```js
JSON.parse(localStorage.getItem("progra:client-errors"))
```

Not a fix for the flash — the cause is still unknown. This is the instrument
that will name it on the next reproduction.

### 16:02 · /onboarding gets its own loading state
Onboarding was the only main route with no `loading.tsx`, so it inherited the
root one: `PrograLoader`, a wordless 72px mark whose hands sweep on a
**6-second** rotation, inside `pb-24` of padding reserved for a bottom nav that
`bottom-nav.tsx` has already hidden on this route. Over a one-second hold the
hands move 60° — it reads as a static logo floating above empty space, not as a
spinner.

`PageSkeleton` gains an `onboarding` variant that mirrors the welcome step
instead: the dot row, the 58px mark, the two-line headline, the tagline, the two
fields and the avatar. Same shimmer language as every other route.

Scope, honestly: this covers **soft** navigation only — Settings → Replay
onboarding. The sign-in path is a server `redirect()` from `app/page.tsx`, which
makes the browser fetch a second document, and there is no React boundary to
fall back to there. It also does **not** fix the cold-open error flash
(`buglist.md`, logged 2026-09-13): that is a client-side throw which beats the
loader rather than replacing it.

### 15:45 · Goals match on meaning, and the goal opt-out actually opts out
**SQL APPLIED TO PROD (`.claude/plans/uw-cohort.sql` STEP 4)** — STEP 4V all 12
rows ok = true, and a live check on real rows returned `shared_goals = 1` with
`goal_titles = {"CSE 143 problem sets"}` against a caller whose own goal is
"Study for CSE 143": matched on meaning, count equal to the titles shown.

Two changes, one product and one privacy, both in one function.

**Goals now match on shared words, not on an identical string.** Finding
someone working on the same thing is the point of the cohort, and exact title
equality almost never fired — "Study for CSE 143" and "CSE 143 problem sets" are
the same goal and matched on nothing. `uw_goal_tokens()` reduces a title to its
subject the way the club matcher does, with a stop list aimed at how people
write goals: the verbs (`study`, `learn`, `work`, `practice` — the most common
words in the goal table and the least informative), the units (`hr`, `week`,
`daily`) and bare numbers, which are how a goal's *size* is written. "Read 10
books" and "Study 10 hours" must not match on `10`. A course number goes with
the numbers, so "CSE 143" reduces to `cse` and finds "CSE 142" — which two
students a quarter apart would want. `read` is deliberately not a stop word.

**The returned titles are now the ones that matched, and the count is exactly
their number.** This came out of the security review. Before, a row showed a
peer's 3 *oldest* goals while `shared_goals` counted *all* matches — so the
count could confirm a title that was never shown, and for a peer with
`uw_share_goals = false` the count was returned even though every title was
withheld. A caller could create a goal named as a guess, read the count, and
confirm another student's exact goal title without ever being shown it — a
guessing-game oracle over the data the switch exists to withhold.

Now `shared_goals` IS `array_length(goal_titles)`, so the number can never
describe anything the caller wasn't also shown, and `uw_share_goals = false`
removes that student's goals from matching entirely — no titles, no count, no
contribution to score, never surfaced on the strength of a goal. STEP 4V asserts
the invariant; the harness asserts it per row and a mutant breaks it on purpose.
The row now reads "Both on: MCAT" — the goals you share, which is the actual
hook, where the old line was the peer's three newest goals regardless.

Worth recording plainly: the old behaviour was **pinned by my own test** named
"uw_share_goals = false withholds titles but still scores". I reasoned about the
titles and never followed the count to where it gets printed on screen. The test
wasn't evidence the behaviour was right, it was evidence I'd locked in my own
mistake.

Also found by the review and fixed: each later SQL step does a
`create or replace` of `uw_peers`, so four mutants had gone silently toothless —
their patterns lived in text a later step overwrote, and they were reading as
MISSED-but-green. Retargeted, plus a sloppily-typed major and two new goals in
the fixture so the stop list, the number rule and `uw_norm`'s whitespace folding
are each observable. 11 mutants, all caught, exit 0. Suite 441.

### 14:16 · UW clubs are free text, matched on meaning — no list shown
**SQL APPLIED TO PROD (`.claude/plans/uw-cohort.sql` STEP 3)** — STEP 3V all 12
rows ok = true, and a live check confirmed "Husky Robotics" matching "UW
Robotics Club" (`shared_clubs = 1`) on real rows.

The clubs field **offers nothing**. UW has on the order of a thousand student
orgs; a field that suggests thirty of them is mostly wrong and quietly teaches a
student that the one they're actually in doesn't count. They type it, press
Enter (or comma, or the Add button — Enter is invisible on a phone keyboard),
and it becomes a removable chip. Up to 5, stored exactly as they wrote it.

Matching then has to do the work, because the database now holds "UW Robotics
Club", "Husky Robotics" and "robotics team" for one room:

- `uw_club_tokens()` reduces a name to its significant words — lowercase,
  hyphens/apostrophes/dots **joined** (so "pre-med" is one word and can't share
  "pre" with "pre-law"), one-letter words dropped, and a stop list removed: the
  school, the mascot, and the furniture (`club`, `society`, `team`, `student`,
  `of`, `the`…). What survives is the thing itself: `robotics`.
- `uw_clubs_match()` counts any shared significant word, treating one word as
  shared with another when either is a prefix of the other from four characters
  up — which absorbs plurals and truncations ("robotic"/"robotics",
  "ultimate"/"ultimate frisbee").
- A name whose every word is furniture ("UW Student Club") reduces to nothing
  and matches nobody. Correct, not a gap — it is not evidence two people know
  each other. Same for sharing only the mascot: "Husky Sailing" and "Husky
  Marching Band" are not the same club.
- `clubTokens()` / `clubsMatch()` in `lib/uw.ts` mirror both functions, with the
  stop list and the prefix rule unit-tested.

**No `pg_trgm`, deliberately.** Neither it nor `fuzzystrmatch` is available in
PGlite, so a similarity threshold could not be proven by the harness before
running against ~50 real users. Token overlap is testable, so token overlap
ships; the cost is typo tolerance ("Dubstech"/"Dubtech" won't match).

`UW_CLUBS` and `isUwClub` are gone. `cleanClubs` no longer rewrites anyone's
spelling — it trims, collapses inner whitespace, caps each name at `CLUB_MAX`
(60), dedupes case-insensitively and caps the count.

Harness: fixtures for two names for one org, a pre-med/pre-law near miss, a
mascot-only overlap and a furniture-only name, plus two new mutants (revert to
byte equality; drop the mascot from the stop list). Mutations now apply to STEP
1 **and** STEP 3 — STEP 3 redefines `uw_peers` wholesale, so a mutation planted
only in STEP 1 was being overwritten and every mutant read as MISSED. 8 mutants,
all caught, exit 0. Suite 431.

### 13:57 · UW cohort, phases 3–6 — the onboarding funnel and the way in from Settings
**SQL APPLIED TO PROD (`.claude/plans/uw-cohort.sql`) — STEP 1V all 15 rows
ok = true, STEP 2 adversarial all zeros.** Still dark: `NEXT_PUBLIC_UW` is
unset, so the welcome tick, the UW step and the Settings block don't render and
`fetchUwPeers` returns `[]`.

A UW student now ticks "I'm a UW student" on the onboarding welcome step, picks
a major and clubs one step before the end, and finishes by adding real peers who
share their major, clubs or goals.

- **The step machine** grows its second conditional step. `activeSteps(native,
  uw)` filters `STEPS`; `uw` sits after `post` and before `friends`, so the goal
  exists before anything is matched on it. The question is asked on `welcome`
  for a structural reason, not a copy one: the list may only change length while
  the user is still on index 0, or the "Step N of M" eyebrow and the progress
  dots renumber underneath them. 9 steps native / 8 web for a UW student, 8 / 7
  otherwise — asserted in `lib/onboarding.test.ts` (suite now 419).
- **`components/uw-fields.tsx`** — major, clubs and the goal-sharing switch, one
  implementation shared by onboarding and Settings, because two pickers whose
  values must match exactly to score a match is how a cohort quietly stops
  matching. The major is a typeahead over `UW_MAJORS`, which covers both the
  list and the free-text tail in one control — and avoids the 40-row native
  wheel the timezone picker was rewritten to get away from.
- **The final step is no longer a rehearsal** for UW students. It lists peers
  with the reason in words ("Same major · 2 clubs in common", never a score),
  Add sends a real `sendFriendRequest`, and the invite share sheet sits
  underneath. With no matches it says "You're early at UW" rather than padding
  the list with strangers. Non-UW students keep the practice nudge unchanged.
- **Settings → Edit profile** gets the same block, which is the whole reason it
  exists: `completeOnboarding` is write-once and Replay deliberately doesn't
  clear `onboarded_at`, so without this every user who onboarded before today —
  all ~50 — could never join the cohort.
- `lib/db/uw.ts` reads the `uw_peers` RPC (empty on any error, so a flag-on /
  SQL-not-run state degrades quietly); `app/actions/uw.ts` owns the only write,
  and `fetchUwPeers` is a read-shaped action for `searchUsers`' reason — the
  input is picked mid-flow, so no page render knows the answer.

Known gap, deliberate: Settings is a way *into* the cohort, but onboarding is
the only place you *see* it. A UW section on `/friends` is the next pass.

### 13:42 · UW cohort, phases 1–2 — matching vocabulary and the migration
**SQL APPLIED TO PROD (`.claude/plans/uw-cohort.sql` STEP 1) — STEP 1V all 15
rows ok = true, STEP 2 adversarial all zeros.**
Nothing is reachable yet: `NEXT_PUBLIC_UW` is unset, and while it is off no
reader names a new column and nothing calls the new RPC, so this is safe to
deploy ahead of the SQL. The one dangerous ordering is flag-on *before* the SQL.

Groundwork for launching at UW: a student will be able to say they're a UW
student during onboarding and be shown other UW students who share their major,
their clubs, or what they're working on.

- `lib/uw.ts` — the matching vocabulary: ~40 UW majors (plus an "Other" free-text
  escape hatch), 30 clubs, `cleanMajor`/`cleanClubs` validation, the
  `normalizeMatchText` fold, and `matchReason` ("Same major · 2 clubs in
  common"). 21 tests; suite is 416.
- `lib/flags.ts` — `UW`, which means *the SQL has run*, in the `JOHN` mould.
- `.claude/plans/uw-cohort.sql` — four defaulted columns on `profiles`
  (`is_uw`, `uw_major`, `uw_clubs`, `uw_share_goals`), two bounds CHECKs, a
  partial index, and two functions: `uw_norm` (the SQL mirror of the TS fold,
  callable by nobody but the owner) and `uw_peers`, a DEFINER RPC that returns
  scored suggestions. No existing policy is touched — `profiles` stays
  owner-only and `public_profiles` stays six columns, which is what keeps the UW
  fields invisible to strangers. The cohort gate is inside the RPC: a caller who
  isn't `is_uw` gets zero rows.
- `.claude/plans/nudges-harness/uw.mjs` — 44 assertions and 6 planted mutants
  against a PGlite mock, all passing. It caught two bugs before they could reach
  ~50 real users: a CHECK constraint may not contain a subquery, and
  `= any ((select <array>))` parses as `text = text[]`.

Known and deliberate: a UW student can read other UW students' active,
non-private goal titles (max 3 each), where today those are friends-only.
`uw_share_goals` is the opt-out, private goals are never returned, and the cap
is enforced in SQL.

## 2026-09-30

### 19:16 · Categories section says what categories are for
One caption line under the **Categories** header on /clock: "Things you want
tracked with no quota" — the distinction from goals, which do have one.

### 17:37 · Make a suggestion — Settings → Help, landing in /admin
**Requires SQL (run by hand: `.claude/plans/suggestions.sql`) — RUN AND
CONFIRMED, STEP 1V all green.** The app degrades to "Suggestions unavailable —
the admin RPCs aren't installed" until it is run, so deploy order doesn't matter;
with the SQL in and the code not yet pushed, prod has an empty table and two
RPCs nothing calls.

Settings → Help now has a second row under Report a bug. It opens a sheet, the
text lands in a new `suggestions` table, and `/admin` grows a **Suggestions**
panel with the suggester's handle, display name and email beside what they wrote.
Accept / Decline / Reopen, same triage shape as the bug queue.

**Its own table, not a `kind` column on `bug_reports`.** A bug needs reproduction
context — route, platform, user agent, viewport, build sha — and a suggestion
needs none of it, so sharing the table would mean five permanently-null columns
and a `kind` filter on every read. The verbs differ too: a bug is resolved or
dismissed, an idea is accepted or declined.

**Security is `bug_reports`' shape, copied deliberately.** INSERT-only RLS
(`suggester_id = auth.uid()`, no select policy at all), `revoke select, update,
delete` from `authenticated` on top so the default Supabase grant can't combine
with a future stray policy, and admin reads through `admin_list_suggestions()` —
`SECURITY DEFINER` because it joins `auth.users` for the email. No service-role
key anywhere near it.

**STEP 1V caught something the behavioural test didn't.** Supabase's default
privileges hand `anon` an INSERT grant on every new table. RLS already stopped it
(the policy is `to authenticated`), so every "anon cannot insert" assertion
passed while the grant sat there anyway — `revoke all ... from anon` now removes
it and 1V fails if it comes back. Caught by mocking prod in PGlite
(`.claude/plans/nudges-harness/suggestions.mjs`, 32 assertions) before running
anything against ~50 live users.

**The sheet has no disclosure line, and that's the point.** The bug sheet names
the screen and the device details it captures silently; a suggestion captures
nothing but the idea, so there is nothing to disclose — it says only that your
name is attached, which is the honest version of "includes the user".

The Admin row badge in Settings now counts open suggestions alongside open bug
reports and reports, via a shared `countOpen()` that degrades to 0 — a missing
RPC means no badge, not a crash.

Analytics gets `suggestion_submitted` with `length` only. The body stays in the
database behind an admin RPC; it has no business in PostHog.

`requireSeat()` applies, so waitlisted users can't file — and they can't reach
Settings either (the wall replaces the app shell), so there is no dead entry
point.

New: `lib/suggestions.ts`, `app/actions/suggestions.ts`,
`components/v2/suggest-sheet.tsx`, `app/admin/admin-suggestions.tsx`,
`.claude/plans/suggestions.sql`. The sheet is `next/dynamic` lazy, per the rule.

**Not written: a patch note.** Releases ship in bulk and get one note between
them; this is one feature in an uncommitted tree, so `PATCH_NOTES` gets its entry
when the batch goes out.

Verified: SQL green in PGlite (32/32), `tsc` clean, `eslint` clean on the nine
touched files, `vitest` 395/395, `npm run build` clean, signed-out `/settings`
and `/admin` both still redirect to login.

### 17:25 · The last interview surface — /admin consents panel removed

Settings → Admin still led to an "Interview consents" panel, so from inside the
app there was still an interview feature to see. The user-facing ask went
2026-09-15 and the Settings toggle 2026-09-19 (stored consents cleared in the
same change); this removes the admin end.

- **Deleted `app/admin/admin-interviews.tsx`** and unwired it from
  `app/admin/page.tsx` — the import, `RawConsentRow`, the
  `admin_list_interview_consents` leg of the `Promise.all`, the `consents` /
  `consentsInstalled` mapping and the `<AdminInterviews/>` render. /admin is now
  three panels: Bug reports, Beta capacity, Moderation.
- **Deleted `setInterviewConsent`** (`app/actions/profile.ts`) — callerless since
  2026-09-19 and kept only so the panel had something that could refill it. The
  comment left in its place records the opt-IN polarity trap and the rule that
  any future ask ships with a withdrawal surface, because the privacy policy has
  to point somewhere.
- **Dropped `interview_consent_set`** from the `lib/analytics.ts` event union and
  the two column keys from the `Profile` type. Nothing read them.

**No SQL.** `profiles.interview_consent`, `interview_consent_at` and
`admin_list_interview_consents()` stay in the database, now with no reader or
writer at all — the RPC can only return zero rows, since the consents were
cleared and nothing can set one. Dropping them is a production migration on ~50
live users that buys nothing.

**App Privacy label changed, and that one matters.** `docs/app-privacy-label.md`
declared **Other Purposes** on Email Address *for* the interview outreach. With
no way left to collect a consent or send such a mail, that answer now overstates
what the app does, so Email Address is App Functionality only. The privacy
policy's "Research and product interviews" section already said there is nothing
to opt in to; it and the label now agree.

Verified: `tsc` clean, `eslint` clean on the five touched files.

## 2026-09-25

### 23:08 · John instrumentation — the app half (SP4–SP7), export written (SP9)

The write paths, the UI and the export for the two-user test. Still dark:
`NEXT_PUBLIC_JOHN` is off, so no reader selects a new column.

**Sessions.** An optional intention above Clock in — deliberately outside
`canClockIn`, because a required field at clock-in suppresses clocking in, and
the session count is one of the things John is meant to read. At clock-out, one
debrief card (not three blocks — the finish sheet is already dense) carrying the
intention echoed back, an outcome, focus 1–5 and a phone-distraction tap.
**Focus and phone gate Post; the typed fields don't** — a tap after the work is
done can't discourage the work. The chevron, Delete and auto-ended sessions stay
unblocked, and dismissing now SAVES a filled-in debrief instead of discarding it.

`pause_count` increments on the update `pauseSession` already performs, off the
select it already makes — zero extra round-trips — and sits after the
already-paused guard so a double-tap can't inflate it. `startBreak` deliberately
doesn't increment: a scheduled break is the plan running, not a person deciding
to stop, and telling those apart is the entire point of the counter.

**Goals.** An optional deadline and definition of done, in the edit sheet only.
`GOAL_COLUMNS` was extracted on the way past — the select list was duplicated
verbatim across five readers. The new columns are appended in `listActiveGoals`
ONLY; `listActiveGoalsForUser` reads a friend's goals and a friend's deadline is
not theirs to see. Threaded through both mount points (Progress and /me),
because otherwise opening the sheet from the wrong one would show blank fields
and **wipe an existing deadline on save**.

**Habits.** A "Yesterday" card listing habits that were neither ticked nor
explained, with four reason taps and a "Did it actually" escape. Yesterday, not
today: asking at 3pm why you missed something you plan to do at 9pm produces
noise. No backlog queue — a chore in a one-week test gets ignored, which is
worse data than an honest gap. `toggleHabitCompletion` clears any miss row,
keeping done XOR missed true.

**Export.** Four read-only queries, written now and validated against seeded
rows rather than merely syntax-checked. Friend overlap is DERIVED at export
time, not stamped at clock-out: a friend's private sessions are invisible to the
client's RLS view, so an app-side computation would record "nobody" exactly
where that's false. The harness proves it — two friends overlapping 30 minutes
both read 30, while a non-friend whose session fully overlaps contributes zero.

Every cohort round-trip is lazy: it fires only when a John field was actually
sent, and no non-cohort client can produce one. Clock-in, the notes-only save
and habit toggles are unchanged for the other ~50 users.

### 22:53 · John instrumentation — schema, adversarial tests, flag and pure TS (SP0–SP3)

Groundwork for **John**, a future AI backend that reads Progra data and returns
weekly insights. This is instrumentation only — no AI, no insights, no backend.
The inputs it will need have to exist first, and for a one-week test they must be
visible to **exactly two users** (`ishaanroybiswas`, `zack`) while the other ~50
beta users see zero change.

**Two orthogonal gates, because one wouldn't do.** Every flag in `lib/flags.ts`
is a `NEXT_PUBLIC_*` env var inlined at build time — global, not per-user. So
`JOHN` answers "have the columns been created?" and `profiles.john_enabled`
answers "is this person in the test?". The cohort is widened, narrowed or ended
with one `UPDATE` in the SQL editor; no redeploy. `isJohnUser()` is
`JOHN && john_enabled === true` — strict, so an absent key fails CLOSED.

`john_enabled` is guarded by `guard_profiles_john_enabled`, a **copy** of the
existing `seat_no` guard: keyed off `current_user`, plain `plpgsql`, no
`security definer`. The draft used `auth.uid()` + `security definer` and was
wrong on both counts — the SP0 pre-flight query existed precisely to catch that,
and did.

**Three things the spec assumed already existed.** Pause count doesn't —
`paused_ms` is banked duration and `breaks_taken` counts only scheduled breaks,
so `sessions.pause_count` is new and has no history. A habit "miss" isn't a
record at all — it's the absence of a completion row — hence a new
`habit_misses` table. But habit completion **time** turned out to exist after
all: `habit_completions.created_at` was already there, undocumented, with full
history, so that column was deleted from the plan.

**The gate is not in RLS, deliberately.** `sessions_update_own` has no
`WITH CHECK`, so an owner can PATCH any column on their own row through
PostgREST. Adding one would mean rewriting a policy all 52 users write through
on every clock-in — the blast radius of getting that wrong is the whole product,
versus one junk integer in a column nothing but a `user_id`-filtered export
reads. So the cohort check lives in the action layer, and the DB carries CHECK
constraints on every new column instead.

**`habit_misses` RLS is narrower than `habit_completions`.** That table has a
`friend_read` policy; this one doesn't. A reason for missing is a confession,
not a stat.

Schema proved locally before it touched prod:
`.claude/plans/nudges-harness/john.mjs` applies STEP 1 to a PGlite mock and runs
STEP 2 — **38/38, with all 11 planted mutants caught**. It found three real bugs
in the SQL first: `call` on what are functions not procedures; a truncate test
that wasn't valid SQL and would have gone green for the wrong reason; and a
cascade test that deleted a habit with no rows attached. Prod run: 38/38.

Nothing is user-visible. `NEXT_PUBLIC_JOHN` stays off until SP8.


### 10:38 · Profile stats are lifetime totals now — Hours, Sessions, Friends

Both profile surfaces led with **This week**, which the page already shows in full
right below it (segmented bar + quota rows), and filled the third slot with
something incidental — Goals on `/profile/[username]`, Habits done on `/me`. The
identity block wasn't saying anything the rest of the page didn't.

Now both read **Hours · Sessions · Friends**, the same three in the same order: it's
the same profile, so it should read the same.

**Hours needs no SQL.** `sumProfileTrackedMs` selects four narrow timing columns and
sums through `sessionWorkedMs` — the one definition of worked time (banked pauses
excluded, auto-ended sessions worth zero). A `sum()` in Postgres would have been a
second implementation of that rule and would have drifted from the leaderboard,
recaps and rollups, which is the trap `week_leaderboard` already documents. No render
cap either: it's a total, and capping it would recreate the bug
`countProfileSessions` exists to fix.

**Friends needs an RPC, and that's not optional.** `friendships` RLS only exposes rows
the caller is part of — `listFriends` relies on exactly that, selecting with no user
filter — so counting someone *else's* friends from the client returns at most 1: the
row between the two of you. `friend_count()` is a `security definer`, granted to
`authenticated` only, in `.claude/plans/profile-stats.sql`.

**Safe to deploy before the SQL runs**, unlike the nudge SQL: `countFriendsForUser`
returns null on any error and each page falls back to the stat it showed before, so
the number is never broken on screen — it just appears once the function exists.

Both totals are RLS-scoped, so a friend sees the total of what *they* may see, which
is legitimately smaller than the owner's own. That was already true of the Sessions
count, so it's consistent rather than new.

### 10:25 · History month scope shows per-habit rates under the calendar

The month view rendered the habit calendar *instead of* the per-habit rows —
`{monthName ? <HabitCalendar/> : rows}` — so the one scope with the richest habit
data was the only one that couldn't tell you which habit was carrying it.

Now it renders both: the calendar answers "which days", the rows under it answer
"which habit". That's additive rather than a restatement, because a calendar cell's
fill is a ratio across **every** habit alive that day, so an evenly patchy month can
hide one habit at 20% and another at 95%.

No data change — `computeHabitCompletion` already returned `perHabit` unconditionally
(`lib/history-stats.ts`); month scope simply never rendered it. Each rate is days
checked ÷ days that habit existed inside the window, clipped to today, so a habit
created mid-month isn't punished for the days before it existed and a running month
reads "so far". Sorted best-first, matching the year view.

## 2026-09-24

### 10:10 · Positive nudge — cheer a friend who finished (requires SQL)

Nudges only ever fired when a friend was **behind**. `nudge_targets` returned `ok`
solely when something was unfinished, so the moment actually worth reacting to — they
did the thing — was a dimmed chip reading *"Sam is all caught up today."* The app's one
social prod was silent at the finish line.

**Praise is the same chip, with the targets flipped by state.** Finished all your habits
today, hit a weekly quota, or landed in the 75% band, and a friend gets rows to cheer
instead of prod. Both halves can appear at once.

**No new column.** A nudge and a cheer differ only in which preset was chosen, so
`preset_key` carries the tone and `target_kind` stays `('goal','habits')`.
`is_praise_preset()` in SQL is the single authority; `toneOfPreset()` mirrors it, and
`nudges.test.ts` keeps the deliberate second copy of the key list pinned to the CHECK.

**The rules are deliberately NOT identical.** Separate 6h cooldowns per half, so
cheering never spends the prod. `in_session` suppresses prods only — it exists so you
don't poke someone mid-session, which has nothing to do with congratulating them.
Everything else is shared: friendship, blocking, `nudges_enabled`, the 09:00 floor.

**A regression the suite caught before prod.** Splitting the cooldown meant a re-sent
prod fell back to a bare `unavailable` instead of the explained *"you already nudged
them — 4h left"*. The cooldown is the one refusal this design always explains (it's the
sender's own history, safe to reveal), so both halves now report their own
`*_cooldown_until` and `send_nudge` answers with it.

**And a hole in the tests themselves.** Rewriting the cooldown query moved the text one
of the 14 mutants targeted, so `--mutants` silently mutated STEP 7's dead copy and
reported a pass. It's re-pointed at the live function, plus four new mutants for the
praise paths. Suite is **62/62 with all 19 mutants caught** (was 54/54 / 14).

- **Requires SQL:** `nudges.sql` STEP 8 — the CHECK swap, `is_praise_preset()`, and
  `create or replace` of all three functions. STEP 2 was extended in place.
  **Run it before deploying**, same as the 09:00 floor change: old SQL plus new app
  means the sheet offers praise the database refuses.
- Privacy is unchanged and was verified, not assumed: praise reads only visible rows,
  private sessions never push a goal into a band, and a private goal at quota is
  byte-identical to one that doesn't exist (T55/T56).
- Push copy is still system-generated — the preset never reaches a lock screen — and
  praise deep-links to `/`, never `/clock`, which would invite clocking in.
- Coalescing is scoped per tone, or a cheer folds into a "nudged you to lock in" banner.
- Settings copy fixed: it still said nudges arrive "in the afternoon", stale since the
  floor moved to 09:00 on 2026-09-15.

## 2026-09-23

### 18:10 · Attach a photo when adding a past session

A session's photo could only be taken **while the session ran**, or on the finish
screen before Post. `session-photo-step.tsx` says so outright ("a session's one photo
is taken while it runs") and its file input carries `capture="environment"` — which
sends iOS straight to the rear camera and **hides the Photo Library option entirely**.
Right for a photo of what's in front of you; useless for a gym session you logged
afterwards with the photo already in your camera roll.

**The interesting part was the privacy guard.** `uploadSessionPhoto` refuses any
session that is ended AND public, because `can_see_session_photo` is *owner OR admin OR
(accepted friend AND not private AND ended)* — so attaching a photo after posting would
make it friend-visible with no privacy step. A past session from `createSession` is
ended and public by default, so a photo could never attach to one, even by calling the
action directly. The guard is right and stays.

So the create path now borrows the finish flow's shape: **create private → attach →
publish.** `createSession` returns the new `sessionId` (the `{ ok: true, sessionId }`
shape `clockIn` already uses), the photo uploads against the still-private row, and the
session is flipped public only if that's what was asked for. **Failure is safe by
construction**: a failed upload leaves the session saved and *private*, never published
minus the photo it was supposed to carry.

- New `components/photo-field.tsx` — an inline picker that hands back a `File` without
  uploading, since there's no session id at pick time. **No `capture` attribute**; that
  one omission is what gives the full iOS sheet (Photo Library / Take Photo / Choose
  File), same as `avatar-picker.tsx`. Runs picks through `downscaleImage`, which also
  normalises an iPhone HEIC to JPEG and keeps it under the server's 8 MB cap. It owns
  the preview URL in its handlers rather than an effect — setState in an effect body is
  a lint error here — and the parent owns the `File`.
- Not a Dialog, deliberately: it renders inside the open form. Two Base UI dialogs
  stack backdrops and fight over the focus trap.
- **`next.config.ts` untouched, and that was checked, not assumed.** Sharp's ~18MB of
  natives are traced only onto the five routes that mount a picker; this form lives on
  `/clock`, already on the list. (The Progress → Sessions sheet is on `/`, which isn't —
  a reason it stayed out of scope, along with having no privacy toggle to flip.)
- `SessionPhotoStep` is untouched, so the live clock flow stays camera-first.
- No new tests: the change is client orchestration plus an action's return shape, with
  no new pure function to cover. 369 existing tests still pass.

## 2026-09-20

### 10:15 · "Your week is ready" — the recap push (requires SQL, ships inert)

The weekly recap has had its unlock ritual since July: `isRecapReady` gates it to
Sunday 6pm in the user's own timezone, and `recap-nudge.tsx` shows a banner on
Progress once it opens. **But that banner only ever reached someone who had
already opened the app** — the retention ritual depended on remembering it
existed. This is the off-app half: an APNs push at Sunday 6pm local, deep-linking
to `/recap/[weekStart]`, which stamps `markRecapOpened` on mount so the tap also
clears the in-app banner.

**This is the first scheduled job in the repo**, and that was the real decision.
Everything else time-based here is lazy — `<EnsureSessionCap/>` and friends fire
on the next page load — and that substitute cannot work when the entire point is
reaching someone who is *not* opening the app. It runs on Supabase **`pg_cron` +
`pg_net`**, not Vercel Cron: the Hobby plan allows 2 jobs at daily granularity,
and "Sunday 6pm local" is a ~27-hour smear across UTC offsets. `vercel.json` is
untouched.

**Hourly, matching a whole evening rather than an instant.** Local 18:00 lands at
~27 distinct UTC instants and the :30/:45 zones (India, Nepal, Chatham) never
align to the hour at all, so `recap_push_candidates()` matches *Sunday, hour >=
18* local and `push_log`'s primary key makes the repeat runs no-ops. That doubles
as a catch-up window if a run fails, bounded by local midnight.

**A bug the PGlite harness caught before prod.** The first draft guarded the
timezone conversion with `exists (select 1 from pg_timezone_names …)` in the same
`WHERE`. Postgres does not promise to evaluate that guard *before* the `at time
zone`, and it didn't — one profile with a junk tz string raised and took down the
**entire result set**, meaning nobody would have got a recap push that week. Now
`local_now_or_null(tz, at)` swallows the error and returns null, so a bad row
excludes only itself. The nudge RPCs get away with a plpgsql exception block
because they're per-recipient; this one is a set, so the blast radius was
everyone.

- **New:** `lib/push/recap-push.ts` (pure compose + `recapDedupeKey` /
  `recapCollapseId`, 7 tests), `lib/push/send-recap-push.ts` (third orchestrator,
  same opt-out → `push_log` claim → tokens → send → prune shape as the other
  two), `app/api/cron/recap-ready/route.ts` (first file under `app/api/`;
  `runtime = "nodejs"` is load-bearing — `apns.ts` uses `node:http2`), and
  `.claude/plans/recap-push.sql` + `nudges-harness/recap.mjs`.
- **Copy is generic on purpose.** No emptiness check (product call: a standing
  Sunday ritual reminder, not a report), so the body can't quote hours — a user
  who tracked nothing would read "You logged 0h".
- **No new profiles column.** Opting out is the existing `social_pushes_enabled`.
  Consequently the Settings row's gate widened to `SOCIAL_PUSH || RECAP_PUSH` —
  otherwise the row could vanish while recap pushes still sent, with no way out —
  and its label/description now name whichever senders are live.
- `proxy.ts` excludes `api/cron` (no cookies to refresh, and `updateSession`
  would build a Supabase client on every scheduled invocation).
- **Ships inert** behind `NEXT_PUBLIC_RECAP_PUSH`, so the schedule can be created
  and watched in `net._http_response` before anyone is buzzed. Flag off, the
  route returns `{due:0,…,flag:"off"}` with a 200.

## 2026-09-19

### 15:44 · Remove the research-interview consent from Settings

Onboarding stopped asking on 2026-09-15, which left the Settings toggle as the
only surface. It's gone now — but **it was the withdrawal path, not the ask**,
and three things depended on that.

`app/privacy/page.tsx` promised it in writing: *"You can withdraw at any time
from Settings."* The component's own comment said why it existed: *"Consent that
can't be taken back isn't consent, so this row exists even though the ask happens
in onboarding."* And `/admin` exports consented users as CSV. Deleting the row on
its own would have left everyone who had already opted in permanently consented,
still in that export, with no way out, while the published policy pointed at a
toggle that no longer existed.

So it's a clean break rather than a deletion:

- **The section is gone** from Settings, along with `InterviewConsentRow`, the
  `interviewConsent` prop and its read in `app/settings/page.tsx`.
- **The stored consents get cleared** —
  `.claude/plans/interview-consent-clear.sql`, which lists who is consented
  first (once it runs there's no record of who said yes), then clears both the
  flag and the stamp. `interview_consent_at` must never outlive the consent it
  records, which is `setInterviewConsent`'s own rule.
- **The privacy policy was rewritten**, not just trimmed. The Research paragraph
  now says the opt-in no longer exists and prior consent has been cleared; the
  data-collected bullet about interview opt-in is gone; and a stale cross-
  reference under "How Google user data is used" — *"The one exception is
  described under Research and product interviews below"* — was removed, since
  there is no longer an exception.

Kept deliberately: `profiles.interview_consent`/`_at`, `setInterviewConsent`
(now with no caller, and a comment saying so) and the /admin panel, which simply
shows its empty state from here. Restarting interviews is then a UI change rather
than a migration — with the standing note that a withdrawal surface has to come
back at the same time, because the policy needs somewhere to point.

Band order re-traced after removing the section, the way it should have been the
first time: Account, Notifications, Sharing, Invite, Admin and Help each still
have exactly one band in front of them.

**The app ships the reworded policy immediately; the SQL has not run yet.** Until
it does, the policy's claim that prior consent was cleared is ahead of the data —
worth running promptly rather than at leisure.

## 2026-09-18

### 17:17 · Fix the stuck pinch-zoom (the cause was the zoom-disable itself)

You could pinch in and then never pinch back out — stuck until a force-quit. The
open buglist entry guessed "the viewport meta / Capacitor webview config allowing
user scaling." That was backwards: **the setting meant to prevent zoom is what
caused the stuck zoom.**

`capacitor.config.ts` never set `ios.zoomEnabled`, so Capacitor's default stood
(`CAPInstanceDescriptor.m:40`, `_zoomingEnabled = NO`). *Because* zooming was
"disabled", `CAPBridgeViewController.swift:322-324` installed Capacitor as the
scroll view's delegate — and that delegate's entire zoom handling is
`WebViewDelegationHandler.swift:337-340`:

    scrollViewWillBeginZooming { scrollView.pinchGestureRecognizer?.isEnabled = false }

`scrollViewWillBeginZooming` fires **after** zooming has begun, so a scale > 1 is
already applied; disabling an in-flight recognizer cancels it and freezes
`zoomScale` there. `pinchGestureRecognizer` appears exactly **once** in all of
Capacitor iOS, so nothing ever re-enables it — dead for the webview's lifetime.
"Sometimes" is just how much scale accumulated before the callback fired.

**A trigger the repro never mentions:** `UIScrollView` fires the same callback for
*programmatic* zoom, including iOS auto-zooming a sub-16px input on focus. The app
has 14 of those, so a small field may have been killing the recognizer before
anyone pinched at all — which fits "sometimes" better than pinch alone does.

Fixed in two layers. `app/layout.tsx`'s viewport gains
`maximumScale: 1, userScalable: false`: with no pinch possible the broken handler
never runs, **and this reaches every installed app on an ordinary deploy**, because
the iOS shell is a thin webview over progra.world — no App Store round trip. It
also suppresses the focus-zoom above, so the 14 small inputs stop mattering in the
app without the visible type change that fixing them would have cost.

Then `ios.zoomEnabled: true` for the next binary. **Not a request for zoom** — the
viewport prevents it anyway. It stops Capacitor stealing the scroll view delegate,
so any zoom that slips through stays *recoverable* rather than stuck; turning an
unrecoverable failure into a recoverable one is the whole point. Nothing else is
lost: `scrollViewWillBeginZooming` is the only `UIScrollViewDelegate` method
Capacitor implements. It also stops reassigning `WKWebView.scrollView.delegate`,
which Apple documents you shouldn't do. `npx cap sync ios` picked the key up;
`ios/App/App/capacitor.config.json` is gitignored (`ios/.gitignore:12`) and
regenerated at build time from the tracked `capacitor.config.ts`, so there's
nothing to commit there.

**Accepted cost: no user zoom inside the native app.** That's what the buglist
entry asked for, but it's an accessibility loss and is recorded as a deliberate
trade rather than a side effect. iOS Safari ignores `user-scalable=no`, so
progra.world in a browser tab stays zoomable. Whether a standalone Home Screen PWA
also ignores it is **unverified** — reports differ by iOS version and it needs a
device check.

Rendered tag went from `width=device-width, initial-scale=1, viewport-fit=cover`
to `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no,
viewport-fit=cover`, confirmed by curl against a local build.

**An install already stuck is not un-stuck by the deploy** — that recognizer is
dead in the running process. Force-quit and reopen once.

### 15:34 · "Share with friends" gets its own Settings section

It sat under **Sharing**, directly beneath the privacy paragraph and the replay
button, so it read as part of that block rather than as its own thing. The cause
is a word collision: that section's "Sharing" means PRIVACY — what friends can
see of your goals, habits and sessions — while this row means handing someone the
app. Two senses of one word in a single run of hairline rows read as one setting.

Now its own band + **Invite** label. The nudges row moved up to sit directly under
Sharing, where it belongs: it controls whether friends can nudge you, which is
visibility, not invitation. Band order re-traced afterwards — every section is
still preceded by exactly one band, in both the Notifications-renders and
Notifications-null branches.

### 01:14 · Patch 1.1 is live

`PATCH_NOTES` gains its first entry, so the "What's new" modal goes from inert to
showing. Every existing account sees it once on their next `/` load and never
again after dismissing.

Deploy 1 did its job first: a real signup on prod completed onboarding cleanly,
which is the only path that writes `patch_notes_seen_version`, and nothing
appeared for anyone while the array was empty.

Copy is the owner's, with "Everytime" corrected to "Every time". The intro ends
on "This patch includes:" so it runs straight into the bullets, and the title
carries the greeting the intro no longer does.

One known consequence of the two-deploy split: accounts created between the two
deploys were never stamped (`LATEST_PATCH_VERSION` was null, so
`stampPatchNotesCurrent` returned early), so they see 1.1 even though its
features were already live when they joined. One stale note for a handful of
accounts at most.

### 01:08 · Patch notes: patch 1.1 written, shipping in two deploys

The column SQL ran clean (STEP 2 verified, `stamped = 0`), and `PATCH_NOTES` now
carries its first entry — a welcome note explaining what the window is, then the
five user-visible changes from this batch.

Two shape changes the copy forced, both worth having:

- **`version` is now a patch number (`major.minor`), not a date.** The note says
  "This is patch 1.1" in its own text, so a date key would be a second thing to
  keep in sync with the copy. The ordering guardrail became a **numeric**
  comparison rather than a string sort — `"1.10"` sorts before `"1.9"`
  lexicographically, so the old assertion would have started lying at the tenth
  patch of a major version, and done it silently.
- **`intro?: string`** — optional prose above the bullets, rendered in the
  dialog's description slot so it's announced with the title. Body-sized rather
  than caption: three sentences of 13px caption type is a wall. Entries with
  nothing to preface omit the field; a test rejects an empty string, since
  omitting is how you say "none".

Typos in the source copy were corrected ("Every time", "palette"); the voice is
otherwise untouched.

**Shipping in two deploys, as planned.** `PATCH_NOTES` goes out EMPTY first, so
the layout gate, the stamp action and onboarding are all exercised against prod
with nobody seeing anything; 1.1's entry lands in the follow-up. Worth the extra
cycle because the fail-closed path is gone: until the SQL ran, a broken gate read
`undefined` and showed nothing, but every profile now reads `null`, so the empty
array is the only thing between a logic bug and ~57 people getting a modal.

One edge the split introduces: anyone who signs up *between* the two deploys is
never stamped (`LATEST_PATCH_VERSION` is null, so `stampPatchNotesCurrent`
returns early), and will see 1.1 even though its features were already live when
they joined. The window is minutes and the cost is one stale note, so it isn't
worth engineering around.

### 01:05 · "Share with friends" in Settings

A one-line row in Settings → Sharing that opens the native share sheet with the
standard invite (message + App Store link), falling back to the clipboard where
there's no `navigator.share`.

No new sharing code: it calls the same `shareInvite()` from `lib/invite-share.ts`
that the empty feed, `/refer` and the onboarding footer CTA call, and mirrors
`InviteShare`'s toast handling — `shared`/`dismissed`
silent, `copied` confirms, `failed` errors. So the link Settings hands out can't
drift from the one every other surface sends, and it stays the countryless App
Store URL (with the known trade-off that App Store installs carry no referrer,
so no auto-friending).

The message is its own constant, `ACCOUNTABILITY_INVITE_TEXT` — first person and
asking for something ("I'm getting 1% better every day on Progra, and I need you
to hold me accountable! Join me at"), where `DEFAULT_INVITE_TEXT` describes the
app to a stranger. It ends mid-sentence on purpose: `inviteBody()` puts the link
on the next line, so the two read as one message. A unit test pins that seam.

### 00:50 · In-app patch notes ("What's new"), plumbing only

A repeatable release-note modal. Write an entry in `lib/patch-notes.ts`, deploy,
and every existing user sees it **once** on their next `/` load. Nothing is live
yet: this ships `PATCH_NOTES = []`, which shows nobody anything and stamps
nobody — a safety valve made of data, with a shorter blast radius than a flag
(and a `NEXT_PUBLIC_` flag would need the same redeploy the array does, so it
would buy no agility).

Built on `PlanCompleteModal`, the app's only other unprompted once-only modal:
the server decides it should exist, it opens at mount, and **every** close path
stamps. Its comment is the rule the whole design turns on — "a dismiss path that
didn't write would reopen this on every single page load".

**The counter-intuitive part is the `undefined` case.** `patch_notes_seen_version`
is typed optional, because PostgREST omits a key whose column doesn't exist yet.
It would be natural to read that as "never seen" and show the note — but in that
same world the dismiss write fails too (PGRST204), so the modal would be
**undismissable for every user until a deploy**. So `undefined` fails CLOSED and
shows nothing; `null` (column present, never stamped) is what shows the note. The
check is `=== undefined`, never `== null`, which collapses the two states that
have to differ. Opposite polarity to `seat_no`, which fails open — the reasoning
is recorded at all three sites.

Three gates in the layout beyond `user`, all free (the profile is already in the
`Promise.all`):
- **`onboarded_at != null`** — not cosmetic. `completeOnboarding` revalidates the
  *page*, not the layout, and onboarding then `router.push("/")`s, so the layout
  payload built during the wizard can survive that navigation. Suppressing by
  pathname alone could leak a stale note to a brand-new account; a server-side
  gate bakes the decision into the payload and fails closed.
- **`!planComplete`** — that modal outranks this one, and two Base UI dialogs
  would stack backdrops and fight over the focus trap. Yielding is free:
  suppression never stamps, so the note waits for the next load.
- **`patchNote`** — null when there's nothing to announce.

New accounts are stamped current at onboarding so a live note isn't their welcome
message — as a **separate, error-swallowed statement**, never folded into the
`onboarded_at` UPDATE: a missing column makes PostgREST reject the whole
statement, which would take onboarding down for every new user. It sits *inside*
the first-completion branch, so a replay can't rob an existing user of a note
they haven't seen.

`markPatchNotesSeen` **does** call a revalidate helper, unlike the sibling
`markNotificationsSeen`. That one skips revalidation because nothing
server-rendered reads it — the bell owns its dot from a client poll. Here the only
reader is a server component, so a stale layout payload still says "show it". The
helper carries that reasoning so nobody "fixes" it back.

Route handling is an **allowlist** (`pathname !== "/"` → null), not a list of
screens to dodge: a denylist would have to be right about `/clock/live`,
`/clock/finish`'s unsaved wizard, the recap story and every route added later.
Deferral comes free — open `/clock/live` and nothing shows; go to `/` and it does.

Twelve tests. Six pin the selector (including `undefined` → nothing *with notes
present*, the case that matters); six are authoring guardrails on the live array.
The highest-value one asserts **newest-first ordering** — index 0 is the only
entry ever shown, so an entry appended to the bottom would ship and reach nobody.
Confirmed it isn't vacuous against an empty array: with a deliberately
out-of-order list the suite fails on exactly that test, and passes once corrected.

`.claude/plans/patch-notes.sql` adds the column (nullable, `length <= 64` CHECK
because it's client-writable under the owner policy), with the adversarial-JWT
test AGENTS.md requires. **Not run yet** — and the code is written so either
order is safe.

*(Housekeeping: the two entries below stamped 01:15 and 01:05 were my guesses and
were ahead of the clock; corrected to 00:46 and 00:44. They now sit out of
newest-first order relative to the 00:23 entry above them — left in place rather
than reshuffling a file being edited concurrently.)*

### 00:23 · Goals and habits are editable from You

The You tab's "Goal quotas" and "Habits" headers are now tappable and open the
same `ManageGoals` / `ManageHabits` sheets Progress opens — rename, requota,
recolor, add, delete, and page back up to `HABIT_HISTORY_WEEKS` weeks to
backfill a missed day. Previously You rendered both sections read-only, so the
only way to edit from there was to leave for Progress. This matters more now
that Settings no longer links `/goals` and `/habits` (see below): You is a
second entry point to the editors, not just a mirror of them.

Both headers moved from hand-rolled `<span>` rows onto the shared
`SectionHeader`, whose own comment ("one component so Progress, You and the
friend profile can't drift apart") had quietly stopped being true here. The
goals section also stops hiding itself when empty and shows Progress's
tappable "No goals yet — tap to add one." instead — otherwise a user with no
goals had no way to add one from You.

Two client islands, `app/me/goals-section.tsx` and `app/me/habits-section.tsx`,
hold the open/close state; the page stays a server component and keeps all its
reads. Both editors are `next/dynamic` lazy, verified out of the `/me` initial
payload. No changes to the editors themselves — they carry no route
assumptions, and `revalidateGoalSurfaces()` already listed `/me` while
`revalidateHabitSurfaces()` revalidates the root layout.

One read widened: `listCompletionsForUserInRange` now spans the editor's
`HABIT_HISTORY_WEEKS` backfill window instead of just this week, since the
editor pages back through it. It's still a single round-trip — the week grid
ignores out-of-week dates (same as on Progress), and the "Habits done" stat and
the section count slice this week back out so both numbers are unchanged.

### 00:46 · Fix the double band left where "Your data" was

Removing the section left its opening `<Band />` behind. `Band` is a visible
6px `bg-track` strip with a hairline, and every section that follows brings its
own — `NotificationsSection` emits one as its first element, and `Sharing` has
one before it — so the orphan stacked directly against the next one. That is the
gap: a dead ~12px double stripe, in every branch. On the website and on any
device where notification permission is `null`/`unavailable`,
`NotificationsSection` returns null, so it was Account → band → band → Sharing
with nothing in between.

Deleted the orphan. Every section is now preceded by exactly one band in both
branches: Account (`Band mt-5`), Notifications (its own), Sharing, Admin (its
own, inside the `isAdmin` fragment), Research, Help. Account's content is still
terminated by a band either way.

### 00:44 · Settings loses the "Your data" section

The four rows — Goals, Categories & rules, Habits, Past sessions — are gone from
`/settings`. Goals and Habits are managed from their section headers on
Progress, sessions from there and on `/clock`.

**Three of those four routes are now orphaned.** Settings held the only link to
`/goals`, `/categories` and `/habits`; `/sessions` keeps one from
`clock-client.tsx:962`. All four still build and still work by URL — nothing was
deleted — they are simply unreachable by tapping. `docs/SCREENS.md` R08-R12 are
marked accordingly so this doesn't read as a bug later.

What that costs, measured rather than assumed:

- **Goal privacy is now unsettable.** `goals-client.tsx:152` is the only
  `updateGoal(id, { isPrivate })` call in the app; `ManageGoals` passes just
  `{ title, weeklyQuotaHours, color }`. Settings' own Sharing copy, two sections
  further down, still says "Mark any item private to keep it off your profile
  and the feed" — true for habits (`ManageHabits` has an inline eye toggle) and
  sessions (`SessionDialog`), no longer true for goals. **This one wants
  fixing**: the toggle needs porting into `ManageGoals`.
- **Goal `description` is unreachable** — `/goals` was the only editor with the
  field. Existing descriptions are untouched and still render.
- **Category keyword rules are uneditable.** `/clock`'s category tools do
  name/color/delete but never read or write `rules.titleContains`. Low impact:
  they only auto-file imported calendar events, `CALENDAR_CONNECT` is dark and
  sync was removed from History on 2026-09-17, so they affect only users who
  connected before. Existing rules keep applying — `lib/categorize.ts` still
  reads them; `updateCategory` omits rather than clears the column, so editing a
  category on `/clock` can't destroy them.
- **`/habits` and `/sessions` lose nothing.** `ManageHabits` is a strict superset
  of `/habits` (adds color-on-create and an editable previous-week grid), and
  `/sessions` was always read-only — no edit, no delete.

### 00:35 · STEP 5 ran: 221 category rows off the grey

Applied to prod. Verified after:

    category  | color   | rows
    class     | #395AA0 |   57
    meetings  | #E07042 |   55
    meetings  | #4A6FA5 |    1
    personal  | #A084B3 |   55
    study     | #2E8B50 |   54
    study     | #58a3b4 |    1

221 rows moved (57 + 55 + 55 + 54), exactly the dry-run count. Not one row is
left on a Tailwind hex, so Class / Study / Meetings / Personal now render as
Dark blue / Green / Orange / Purple instead of four identical greys. The two
re-picks were skipped by the guard, as designed — `#4A6FA5` and `#58a3b4` are
retired app hues that `normalizeFill` maps forward to Dark blue and Light blue,
so those two users keep the colors they chose.

`.claude/plans/category-base-colors.sql` is marked DONE and is not to be re-run
(a second run matches nothing, since no row carries a system-default hex any
more). It keeps the guard's shape for reference.

**Correction to that file:** its `begin;` / `commit;` framing doesn't work in the
Supabase SQL editor, where each run is its own transaction — a `commit` in a
separate run has nothing to commit, and pasting the whole block commits before
you can read the `returning` rows. What was actually run: a dry-run SELECT
counting the rows the WHERE clause matches, read first, then the
`update ... returning` as one self-committing statement. The file now says so.

New signups are still stamped with the old hexes by `handle_new_user`; that is
handled in app code by `seedDefaultCategories` correcting the color at
onboarding, not by this SQL.

### 00:25 · Class / Study / Meetings / Personal were all rendering grey

STEP 0's distribution came back decisive:

    category  | color   | rows | pct
    class     | #a855f7 |   57 | 100.0
    meetings  | #3b82f6 |   55 |  98.2
    meetings  | #4A6FA5 |    1 |   1.8
    personal  | #10b981 |   55 | 100.0
    study     | #f59e0b |   54 |  98.2
    study     | #58a3b4 |    1 |   1.8

One hex per category at 98-100% — a system default nobody chose, so a mass
update is fair game. But the hexes themselves are the real finding: all four are
**Tailwind defaults** (purple-500, amber-500, blue-500, emerald-500), which are
off-palette *and* absent from `LEGACY_FILLS`. Verified against the actual code
rather than by eye: `normalizeFill()` returns `null` for every one, so
`entityColor()` falls through to `#9fa6b0`.

**So on all ~57 accounts these four categories are currently the SAME GREY** —
on the Progress donut, in the feed, on session cards — and `CategoryMarker`
draws nothing at all for them. Setting base colors turns out to be a bug fix,
not a preference. The 2% outliers (`#4A6FA5`, `#58a3b4`) are people who
re-picked in the color editor; both are retired app hues that `normalizeFill`
maps forward correctly, and both must survive.

`.claude/plans/category-base-colors.sql` STEP 5 now carries the measured hexes
instead of placeholders and is ready to run: ~221 rows (57 + 55 + 55 + 54, minus
the two re-picks). Its guard keys on the system-default hex per name, so the
re-picks are skipped by construction.

New signups needed fixing too — `handle_new_user` keeps stamping Tailwind hexes,
so without this every new account would arrive grey again. Rather than edit a
trigger whose body isn't in the repo (an architectural preference recorded in
ARCHITECTURE.md), `seedDefaultCategories` gained a second half: it now INSERTs a
default the account lacks *and* UPDATEs one that exists but still carries its
known system-default hex, gated on an exact match via the new
`SEEDED_SYSTEM_FILLS`. Same guard as the SQL, same protection for anyone who
picked their own. This is also what makes yesterday's seed stop being inert.

The harness now seeds the mock with the real per-category hexes plus two
re-pickers, and asserts STEP 5 hits the defaults on both users while leaving the
picks and the near-miss `Classroom` alone. Four new unit tests pin the map:
every default covered, all four off-palette (if one ever became a palette fill
the row would already be fine and rewriting it would be meddling), none equal to
the color it corrects to, and no two sharing a hex.

### 00:20 · The four categories are seeded by handle_new_user, not the app

Running STEP 1 of `.claude/plans/category-base-colors.sql` against prod came
back with the same shape four times:

    category  | total | uncolored | other_color | already_right
    class     |    57 |         0 |          57 |             0
    meetings  |    56 |         0 |          56 |             0
    personal  |    55 |         0 |          55 |             0
    study     |    55 |         0 |          55 |             0

Two findings, both of which undercut yesterday's assumptions.

**`rows_uncolored = 0`, so STEP 2 is dead.** It only paints rows with no color;
there are none. It stays in the file as the shape of a safe backfill, marked
as a no-op against today's data.

**Essentially every account has all four, so something seeds them.** Nothing in
this repo does — `createCategory` has exactly two call sites, both explicit user
actions — which leaves the Supabase-side `handle_new_user`, whose body isn't in
the repo. That trigger fires at signup, long before `completeOnboarding`, so
**the seed added yesterday inserts nothing**: it skips names that already exist,
and all four always will. `lib/default-categories.ts` and `seedDefaultCategories`
now say so at the top rather than claiming the category list starts empty. The
code stays as a safety net for an account that somehow arrives without them;
it is not the live path, and those hexes currently reach nobody.

Added **STEP 0** (read-only): the color distribution per category name. It
answers the only question that decides whether a mass update is acceptable — one
dominant color per name means those 57 rows carry a system default nobody chose
and can be overwritten; a long tail means people have been re-picking in the
color editor and must not be touched. Added **STEP 5** (forced, everyone) for
the first case only. Its `where` clause keys on the system-default hex rather
than on the name alone, so a row whose color differs is read as a deliberate
pick and left alone — that guard is the entire safety of the step.

The harness (`.claude/plans/nudges-harness/category-colors.mjs`) now covers
STEP 5 against a mock shaped like prod: every row on the system default plus two
users who re-picked. It caught two real defects before either reached Supabase —
its step extractor matched a prose line in the file header instead of the
section banner (now anchored on the banner's em dash), and STEP 5's own prose
block was single-commented, so un-commenting the step turned English into SQL.
Both fixed; all four steps pass.

## 2026-09-17

### 23:59 · Four starter categories with base colors

New accounts now finish onboarding with **Class** (dark blue `#395AA0`),
**Study** (green `#2E8B50`), **Meetings** (orange `#E07042`) and **Personal**
(purple `#A084B3`). Before this the category list started empty, so the first
clock-in had nothing to file time under — and `/clock`'s add path calls
`createCategory(name)` with no color at all, which is why hand-made categories
came out on the neutral grey.

The four colors are spaced roughly evenly around the wheel because these are the
categories that sit next to each other as **adjacent donut arcs** more than any
other set in the app; two near-neighbours would read as one slice on the
Progress hero and as identical 8px dots on a session card.

`lib/default-categories.ts` holds the list, with a dev-only assertion that every
color is a current `PALETTE` fill — a palette edit that stranded one would make
that category read back as `null` through `normalizeFill()` and render grey.
`lib/default-categories.test.ts` pins the same invariant plus distinctness.

Seeding happens in `completeOnboarding` and is **first-completion only**: the
profile stamp already carries a write-once `.is(onboarded_at, null)` filter, and
it now `.select()`s the stamped row so a replay (which matches nothing) doesn't
re-seed or resurrect categories someone deleted. It is additive and never
destructive — it reads existing names first and inserts only the ones missing,
matched case-insensitively, so a category created during onboarding keeps its
own casing, color and keyword rules. Its errors are swallowed on purpose:
onboarding completing is the load-bearing part, and a failed seed just leaves
the user where they were before this existed.

**Existing users are not touched by any of the above.** `.claude/plans/
category-base-colors.sql` is the other half, for the ~50 live accounts: STEP 1
reports what would change, STEP 2 colors only rows that have **no** color today
(everyone, cannot overwrite a chosen color), STEP 3 force-sets all four for a
single pasted user id. There is deliberately no "force, everyone" variant —
category color is a choice made in a picker, it is stored nowhere else, and
there is no undo. Proven before it goes near prod:
`.claude/plans/nudges-harness/category-colors.mjs` runs the file against a
PGlite mock seeded with mixed casing, padded names, an already-correct row, a
deliberately-different color and a near-miss name (`Classroom`) — asserting
STEP 1 mutates nothing, STEP 2 leaves chosen colors alone, and STEP 3 touches
one user only. All pass.

### 23:58 · History keeps the Today/Week/History rail instead of a back link

`/history` opened with "← Back to progress", which made it read as a sub-page of
Progress even though you enter it by tapping the third chip of Progress's period
switcher. It now renders that **same three-chip rail** with History lit and
Today/Week as links back (`/` and `/?tab=week`), on both the week and the
month/year scopes — so leaving is the same gesture as entering, and the rail
stays put across the route boundary instead of being swapped for different
chrome.

The chip classes moved out of `progress-client` into
`components/v2/period-chips.tsx` (`CHIP`, `CHIP_ON`, `CHIP_OFF`, `ChipRail`) so
the two surfaces can't drift. They still render different elements — Progress's
Today/Week are `<button>`s over client state, History's are all `<Link>`s — which
is precisely why the look has to be shared deliberately rather than by
copy-paste.

`/history`'s top padding changed from `pt-8 sm:pt-12` to Progress's `pt-7`:
without it the rail dropped 4px on phones and 20px on desktop when you crossed
over, which is exactly the jump this change exists to remove. The left-hand slot
of the row carries a `History` section-label, where Progress carries the period
label.

### 23:52 · 11-color entity palette

Categories, goals, habits and avatars now draw from one canonical eleven-color
set — maroon, red, orange, gold, light green, green, light blue, dark blue,
purple, dark purple, pink — replacing the nine warm hues from the editorial
rebuild. Palette-only: no layout, component or copy changes.

`lib/palette.ts` is the single source of truth: `PALETTE[]`, indexed 0-10, with
two values per color. `fill` is for dots, bars, donut arcs, borders, selected
fills and avatar chips; `ink` is the darker twin used *only* where the color is
itself text on white — a checked habit label, the duration chip on a session
card and in session detail, initials avatars, the onboarding goal preview. The
old `lib/category-colors.ts` and the duplicate `PALETTE` array that `lib/colors.ts`
kept "in sync" by hand are both gone; `entityColor`/`entityInk`/`goalColorOf`/
`userColor` all read from the one constant now.

**No migration ran against prod.** Entity colors are stored as hex, not an
index, so instead of touching three live tables the `rowTo*` mappers in
`lib/db/{goals,habits,categories}.ts` normalize on read: `normalizeFill()` maps
the retired nine hues *and* the 12-swatch set before them onto their nearest
replacement, and the next save persists the new value. Brick → maroon, burnt
orange → orange, mustard → gold, olive → light green, forest → green, deep teal
→ light blue, blue → dark blue, indigo → dark purple, plum → pink; red and
purple are new options nothing maps onto. Deleting the map is all it takes to
roll back.

`ColorSwatches` — the one picker behind goal setup, the category editor, the
habit editor and onboarding — now shows all eleven in palette order, maroon
first, each with a 1.5px border in its own color when selected and `#e6e9ed`
when not. Glyphs inside a filled chip stay white.

In CSS, `--palette-0..10` and `--palette-N-ink` mirror the constant, `--chart-*`
pulls from them, and the old `--cat-*` names survive as aliases so the
onboarding illustrations, bottom-nav and week-pulse follow along. Brand navy,
hairlines and the neutral greys are untouched. `--destructive` still reads
`#9c5148` — it happens to equal the retired brick, but it's a semantic delete
color, not an entity hue, so it was left alone.

### 23:40 · Invites hand out the App Store listing, not the website

Every invite surface — the onboarding `friends` step CTA, the empty-feed
`InviteShare` and `/refer` — now shares
`https://apps.apple.com/app/progra/id6798377328` instead of
`progra.world/i/{username}`. Closes the 2026-09-13 bug in `buglist.md`, which
left "App Store listing or universal link?" as an open question: the answer is
the listing.

The URL is deliberately **countryless**. `/us/app/...` pins the US storefront
and shows a recipient registered elsewhere a "not available in your country"
wall; Apple 301s the countryless form to the visitor's own store, and the page
it lands on serves the same `og:` tags either way, so link previews are
unchanged. The `progra` slug stays so the URL self-describes in plain-text
targets with no preview card.

**The knowing cost: referral attribution for new installs.** `/i/{username}` is
the entire referral mechanism — signed-in visitors hit `claim_invite`, signed-out
ones carry the handle through OAuth as `?ref=` into `/auth/callback`. An App
Store URL carries no handle, so invites no longer auto-friend the pair and
`profiles.referred_by` stops filling from shares. This was chosen over keeping
the web link, in exchange for the shortest path to an install. Universal links
(open the installed app, fall back to the store, keep attribution) remain the
real fix and would need an associated-domains entitlement, an AASA file, a new
binary and App Review.

`/i/{username}` is untouched behaviourally — links already sent keep working and
keep attributing. It gains a secondary "Get Progra on the App Store" button
below the sign-in buttons (sign-in stays first: it is the only path that
attributes), and the unknown-handle card gains the same as a text link.
`AddToHomeHint` comes off that page: it renders for exactly one audience — iOS
Safari, not installed — which is precisely who the native app serves better, and
showing both put two conflicting install instructions on one screen. It stays on
`/` and `/login`, which are existing-user surfaces.

Three copy strings were made false by the attribution loss and changed with it:
`/refer`'s "Anyone who joins from your link becomes a friend automatically", the
empty-feed line, and onboarding's failure toast (which pointed at a copy-link on
`/friends` that has never existed). `/i/{username}`'s own "you'll be friends
automatically" is **correct** and stayed — that path still works.

Mechanically: new `lib/app-store.ts` holds the constant, separate from
`lib/invite-share.ts` because the Server Component at `app/i/[username]` needs it
and invite-share reaches for `navigator`. `inviteBody`/`copyInvite`/`shareInvite`
lose their `username` parameter and `SITE_HOST`/`inviteLink()` are deleted — the
handle appears nowhere in what they produce, and a call site that wants it in the
text has `InviteShare`'s existing `message` prop. `InviteShare` loses its
`username` prop, which in turn removes a `getProfile()` from the feed's
`Promise.all` and the username redirect from `/refer`. `inviteBody` is now pure
and window-free, so `lib/invite-share.test.ts` pins it.

### 15:05 · History stops at 2026
2026 is Progra's first year (initial commit May 2026), so every earlier period
is guaranteed empty. All three scopes now floor there: the back chevron greys
out on 2026, on January 2026 and on the week containing 1 Jan, and an
out-of-range param (`?y=2019`, `?m=2025-11`, `?w=2025-06-10`) is clamped to the
floor rather than rendering an empty period with no explanation. The week floor
is the Monday of the week containing 1 Jan — not 1 Jan itself — so no day of the
first year is unreachable.

### 15:00 · History is a reading surface; AI auto-categorize deleted
The auto-categorize button, the "Sync Google Calendar" button and the Connect
entry point are gone from `/history`, along with the `?calendar=` return toast.
What remains of the calendar lives in Settings: connection status and
Disconnect. With sync gone from History there is no manual sync anywhere in the
live app (there is no automatic sync either) — deliberate, with
`CALENDAR_CONNECT` already dark.

Auto-categorize is deleted outright, not just unmounted — `/history` was its
only live entry point. Gone: `components/categorize-period-button.tsx`,
`components/categorization-review-dialog.tsx`,
`components/categorize-events-button.tsx` (already orphaned),
`app/actions/categorize-events.ts`, and `lib/anthropic/` — which held the app's
**only** Anthropic API call. `Rollup` loses `uncategorizedEventCount` and
`aiCategorizedEventCount`; `HomeActions` (pre-REDESIGN home) loses its
auto-categorize card; the legacy onboarding's `tour-history` step is removed
entirely, since it existed only to teach Sync and Auto-categorize.

**`lib/db/calendar-events.ts` is deliberately untouched.** Rows in
`event_categorizations` with `source = 'ai'` still exist for connected users and
still drive where those hours land. Its provenance split is
`if (source === "ai") … else manual` — an `else` catch-all, so deleting the `ai`
branch would silently **promote** every legacy AI guess to a manual override,
which outranks the user's own keyword rules. Reading them stays as-is (manual >
rule > ai); only the ability to create new ones is gone. Purging or migrating
those rows is a separate, deliberate decision.

### 14:30 · History rebuilt from the design handoff
`/history`'s month and year scopes are rebuilt to the `handoff-history/`
design: a Year/Month pill toggle with a period stepper, a big Newsreader title
over the period's hours and session count, then three sections — Time, Goal
completion, Habit completion. The handoff asked for a third Progress sub-tab,
but that sub-tab was deliberately removed earlier in favour of this route, so
the design landed here rather than re-splitting the surface in two.

Progress does get the third chip back — as a **link**, not a tab. `/history`
had exactly one live entry point (the Week tab's "Sessions" header, which lands
on the week scope), so the rebuilt Year/Month screen was two taps deep behind a
screen that doesn't look like it. The chip sits in the Today/Week switcher,
pixel-identical to the two buttons beside it, and navigates; `Tab` stays
`"today" | "week"`. Two stale rows in `docs/SCREENS.md` are corrected with it:
Settings → "Your data" never linked to History, and `components/dashboard.tsx`
still does but is the pre-REDESIGN home, so it's unreachable in the live config.

**Time** renders `categoryRows` as one list, goals first. The mock drew goals
and categories as two separate 100% breakdowns; a session here belongs to
exactly one of the two axes, so the shares sum to a single 100% instead. Bars
scale to the largest row, not to the total.

**Goal completion** is new aggregation (`lib/history-stats.ts`): sessions
bucketed into Mon–Sun weeks and scored against each goal's quota. Scoring is
**partial** — a week earns `min(1, hours / quota)` and a goal's rate is the mean
of its eligible weeks. An all-or-nothing first pass made 10h of a 20h quota
worth exactly as much as not showing up, which read as broken. The per-week cap
is what keeps the mean honest: without it a single 40h week would cancel four
empty ones and a mostly-idle month would score 100%.

The row prints counted hours against quota × weeks ("20/40h") beside the
percentage, and those hours are capped the same way the rate is — otherwise
40h-then-nothing would read "40/40h · 50%" and contradict itself. The section
note is "averaging N% of quota", not "N% of quotas met": nothing is being met,
it's a mean. Sessions
bucket by their attribution **end**, matching `lib/aggregate.ts`, so these
numbers reconcile with `/recap` — the handoff specced start-based bucketing,
which would have disagreed for any session crossing midnight. Quotas have no
history, so a goal is only measured from the week it was created rather than
being marked down for months it didn't exist for.

**Habit completion** is per-habit rates in Year scope and a per-day navy
calendar in Month scope. Habits carry no schedule in this schema, so the
handoff's "checks ÷ scheduled days" isn't computable; the rate is checks ÷ the
days the habit actually existed in the window, capped at today.

**Both completion sections count active items only.** "Delete" in the goal and
habit UIs doesn't delete — it sets `status = 'archived'` / stamps `archived_at`.
So a first pass that followed the handoff's "archived items still appear in past
ranges" scored goals and habits the user thought they'd deleted, and dragged the
headline rates down with them. Archived items are now excluded from Goal
completion and Habit completion outright — including the calendar's per-day
totals and its "of N" caption. They still appear in **Time**, which is about
where the hours went, not about who's hitting quota: those hours are real and
dropping them would break the breakdown's 100%.

The `?view=week` scope is deliberately unchanged — it's the deep link the
Progress Sessions header opens and the way into `/recap`, and it renders the
shared `WeekSummary` that Progress itself uses.

Also: `listAllGoals` / `listAllHabits` (archived-inclusive reads, so a past
window still shows a goal or habit since archived), `isoDateInTimeZone` in
`lib/dates.ts`, and `goal:<id>` rollup rows now resolve archived goals to a
real title and hue instead of a bare "Goal" — which also moves their hours out
of `untrackedMs` and into `totalFocusedMs` for past windows.

No new dependency, no API route: scope stays in the URL and the page
re-renders server-side, the same way the route already worked.

## 2026-09-15

### 15:19 · Login and onboarding redesigned
The sign-in screen and the first-run wizard are rebuilt from the design
handoff, in the app's own components — the HTML references never ship.

**Login.** A brand mark with drifting clock hands, "Progra" typing itself in
behind a caret, one line on what the app is, a week of breathing bars, then the
terms row and the buttons, each rising in turn. The buttons dim until the terms
box is ticked, and a tap on a dimmed one shakes the terms row instead of doing
nothing — no SDK, action or redirect runs before agreement (Guideline 1.2 is
now enforced inside each button, with `aria-disabled` rather than `disabled`).
Apple stays native-only. The same buttons and gate serve `/` and
`/i/[username]`; only `/login` gets the new page and entrance.

**Onboarding.** Eight steps (seven on the web, which has no notifications):
who you are → how Progra works (your week next to a friend's) → first goal
(live preview ring) → habits → a practice clock-in → notifications → a practice
post → hold your friends accountable (a practice nudge on Maya's profile, then
the share sheet) → Ready, Set, GO! Every headline types in, and retypes when
you come back to a step. The goal's title, colour and hours flow through the
clock chip, the timer, the post summary, the invite message and the summary.
Copy is the design's, verbatim. The 1463-line client is now a ~450-line shell
that owns all state plus one small component per step.

Two long-standing wrinkles went with it: going Back and saving again no longer
creates a duplicate goal or duplicate habits (`createGoal`/`createHabit` now
return the new `id`; the shell updates or skips what it already made), and the
practice timer no longer keeps running — and advancing whatever step you're on
— after you leave it. Dropped from onboarding, on purpose: the research-
interview opt-in (Settings still has it), the habit-reminder time picker, and
the practice-step toasts. Reduced motion stills every decorative animation on
both screens and shows headlines in full.

Verified against the design files screen by screen in headless Chrome at
420px, including the interactive states (terms shake, typed retype on Back,
clock fast-forward and auto-advance, custom habit tile, posted, nudge sent,
Done splash) and reduced motion.

### 14:13 · Nudge chip in the clock's navy
When a friend can be nudged, the chip on their profile is now filled navy
(`bg-brand`, the clock button's colour) instead of an outline. Locked and
cooldown chips stay dimmed outlines, so "you can nudge" stands apart.

### 14:08 · Nudge preset: "Slow progress is better than no progress"
Replaces "I'm gonna mog you". Copy only: the database stores the preset key, so
there's no SQL and past nudges with that key show the new wording.

### 09:13 · Replies to comments, dark behind COMMENT_REPLIES (SQL applied)
Anyone who can see a post can now reply to a comment on it. Tap **Reply** on a
comment and a reply box opens right under that thread, so you never lose sight of
what you're answering. The bottom box stays for new top-level comments. Threads
go one level deep, like Instagram: a reply to a reply files under the same
thread with "@name" in front of it. A thread with four or more replies collapses
to its first two.

The person replied to gets "X replied to you" as a push and in the panel, and
tapping either lands on the reply, expanding its thread if it's collapsed. The
post owner still gets the ordinary "commented on…" for every comment, unless
they're the one replied to, in which case they get one notification.
Deleting a top-level comment deletes its replies, so it asks first when there
are any.

The database decides the thread shape. The client only says which comment it's
answering; a trigger works out the thread and who's being replied to from that
row. It refuses a reply across a block (with the person replied to or whoever
started the thread) or onto a post you can't see, and every refusal looks the
same as an ordinary permission error. Reply pushes re-check that the person
can still see the post, since the reply text is in the push. Also: both
comment inputs are 16px now, which stops iOS zooming in on focus.

**SQL already applied:** `comment-replies.sql` STEP 1 (three columns + the
thread-guard trigger). 28/28 adversarial tests passed in prod, 29/29 locally,
10/10 planted bugs caught. **To switch on:** set `NEXT_PUBLIC_COMMENT_REPLIES=1`
and redeploy. With it off, comments read and render exactly as before.

### 08:20 · Nudges open at 9am, not 2pm (needs SQL)
A friend can now be nudged from 09:00 their local time instead of 14:00. The
locked chip says "You can nudge Sam from 9am their time — in 2h." **Needs
hand-run SQL:** re-run `nudges.sql` STEP 7 (edited in place; it only replaces
the functions, so re-running is safe), then STEP 2 (52/52 in prod). Run the SQL
before deploying: against the old SQL, the new app would say "9am" while the
chip stayed locked until 2pm.

### 08:18 · New nudge preset copy
The five presets now read "Lock in", "Still got time today!", "Your friends are
counting on you", "You can do this!" and "I'm gonna mog you". Copy-only: the
database stores the preset key, not the text, so there's no SQL and past nudges
in the panel show the new wording too.

### 08:07 · Nudge chip shows why you can't nudge (needs SQL)
Every friend now gets a Nudge chip. When they can't be nudged right now the chip
is dimmed with a lock, and tapping it says why: turned off nudges, before 2pm
their time (with how long until it opens), in a session, all caught up today, no
goals or habits to nudge, or a vague "can't be nudged right now" for accounts
that aren't set up. The cooldown chip ("Nudged · 4h") is tappable the same way,
and a refused send toasts the same reason.

This reverses v1's rule that every refusal rendered nothing. The reasons are
computed from what a friend can already see, and **private sessions are now
ignored**. v1 hid the chip during a private session so it looked like any other
hidden state. With reasons showing, that disguise no longer works, so a friend in
a private session reads exactly as if they weren't clocked in, and a nudge can
land mid-session. Private goals and habits still can't be inferred: the
"caught up" vs "nothing to nudge" split counts visible rows only, and a bad goal
id on send is still the one generic refusal.

**Needs hand-run SQL:** `nudges.sql` STEP 7 replaces `nudge_targets`,
`get_nudge_state` and `send_nudge` (same signatures). Either deploy order is safe.
Old app code reads the new `locked` state as hidden, and the new code just never
receives it until the SQL runs. Adversarial suite updated: 53/53 locally
(51 in prod, where the two account-delete cases are skipped), 13/13 planted bugs
caught.

## 2026-09-14

### 15:49 · Nudges switched on in production
`NEXT_PUBLIC_NUDGES=1` set in Vercel and redeployed. Because the iOS shell loads
progra.world, the feature reached App Store installs on next open with no App Review.
First real nudge sent between two beta accounts. The first attempt showed no button —
correctly: the recipient was clocked in, and a recipient mid-session reads as hidden. A
gate-by-gate diagnostic query now lives with the hand-run SQL for the next "why is there
no button?".

### 20:10 · Admin analytics, and Settings → Admin
PostHog was answering the wrong question. The roster this needed — who each
person is, their goals, when they last showed up — joins product data that
lives only in Supabase to behaviour that lived only in PostHog. Moving one
timestamp into Postgres is cheaper, and exposes less, than copying the product
model (private goal titles included) into a third party. PostHog stays
installed and collecting; it keeps the pageview history that can't be
backfilled.

**`/admin/analytics`** — retention (active 7d / 30d, never came back), 30-day
daily actives, a cohort table, and a card per person with **Opened** and **Did
something** side by side. Gated on `is_admin()` alone, not `SOCIAL_ENABLED`:
none of it is social. Settings' "Moderation → Report queue" is now "Admin →
Admin", and `/admin` links to it from the top. Analytics is its own route so
triaging a bug never pays for computing everyone's retention.

**Cohorts are there because of the growth rate.** 5 → 50 users in six weeks
means most users are recent, recent users are the most active, and a rolling
"% active this week" is flattered by growth alone. Cut by onboarding week is the
only view that separates growing from retaining. Cells show `n/m` beside the %,
and a window that hasn't finished is blank, never 0% — the classic cohort-chart
bug, and the first thing the tests pin.

**Definitions live in SQL and TypeScript on purpose.** SQL resolves every date
to the user's own local day (`profiles.timezone`) and returns their
`local_today`; `lib/admin-analytics.ts` then does whole-day arithmetic on
`YYYY-MM-DD` strings only. That's what keeps DST out of the math, keeps
`Date.now()` out of the server component (the RPC's `generated_at` is the page's
clock), and makes the part most likely to be subtly wrong unit-testable — 25
tests. Demo and owner accounts sit in `analytics_excluded_users` (RLS on, no
policies, same trick as `beta_config`): in the roster, tagged, but in no
denominator. Waitlisted users are out too — they never had access, so can't
have churned.

**Private goal titles are nulled inside the SQL**, so they never leave the
database, not even to the admin; the card shows "+N private". This replaces
yesterday's "Everyone's goals" panel, which showed them badged —
`admin-goals.tsx` is gone and `admin_list_all_goals` is due to be dropped.

**"Last opened" is a client leaf, not `after()`.** `after()` only fires when the
server renders the layout, and resuming the iOS app from the background doesn't
reload the page — the most common way people open Progra would never register.
`<LastSeenPing/>` pings on mount and on `visibilitychange → visible`, throttled
to 10 minutes in the client and again in `touch_last_seen()`'s WHERE.
`touchLastSeen` is a deliberate exception to the mutation rule: it calls no
revalidate helper, because nothing a user sees reads the column and
revalidating on every app open would refetch the whole tree. The data starts
empty on the day it ships; there is no backfill.

`requireAdmin()` (`lib/auth/require-admin.ts`) is called per page, never from a
layout — Next 16's auth guide notes layouts don't re-render on navigation. It's
UX; the `is_admin()` check inside every definer RPC is the boundary. A
signed-out `GET /admin/analytics` returns a 200 streamed shell carrying
`NEXT_REDIRECT → /login` with none of the page's content, same as `/admin`.

Charts are hand-drawn SVG on theme tokens — no new dependency. **Needs the SQL
run by hand** (additive: one column, one table, three functions); until then
the page says the RPCs aren't installed.

## 2026-09-14

### 15:20 · Nudges — friend-to-friend accountability (dark behind NUDGES)
A friend opens your profile, sees you haven't touched a goal or finished habits
today, and nudges you: two taps, one of five preset messages, a push, and a row
in the notifications panel. Built subplan by subplan from a written spec; the
database half was in prod and adversarially tested before a line of UI existed.

**The spec was wrong about the codebase in five places, and the plan says so.**
Blocking already existed (`block_user`/`are_blocked`, with UI), so the free-text
roadmap's blocker is already met. The push tap router already follows a payload
`url` and `/clock` already accepts `?goal=`, so the deep link the spec worked
to avoid costs nothing and needs no App Review round trip. A separate
`nudges_seen_at` was pointless when nudges render in the panel whose open
already stamps `notifications_seen_at`. The spec's CHECK
(`(kind='goal') = (goal_id is not null)`) contradicts its own `ON DELETE SET
NULL` — a nudged goal could never be deleted. And revalidating the root layout
on send would have cost every sender a full tree refetch while reaching the
recipient no sooner than BottomNav's existing 90-second poll.

**One SQL function decides eligibility, and both callers share it.**
`nudge_targets(sender, recipient)` is the only place that knows what "behind
today" means; `get_nudge_state` (the button) and `send_nudge` (the write) both
call it, so the button and the send cannot drift apart. It resolves the day in
the RECIPIENT's timezone — a sender in another timezone computing "today" from
their own clock was the likeliest subtle bug in the whole feature — and mirrors
`lib/session.ts` exactly: auto-ended sessions are worth zero, a session's whole
worked time lands on the instant it ends, running sessions clamp at 10h.

**It must not become a way to watch a friend's day.** Every rejection that
touches visibility returns one identical `unavailable` — a private goal, a
nonexistent goal, an archived goal, someone else's goal and a goal they already
worked on are byte-identical to the sender. `hidden` carries no reason at all,
and the button renders nothing rather than greying out, because a disabled
button is itself a signal. A private active session reads as `hidden`, never
`in_session`. Only the cooldown, which is the sender's own history, is ever
explained.

**Two subtleties that bite.** An abandoned over-cap timer (no cron closes it —
only the owner's own client does) must count as neither "mid-session" nor worked
time, or the drifting user this feature exists for becomes permanently
un-nudgeable. And the advisory lock is per-RECIPIENT, not per-pair: a per-pair
lock lets two senders both win the 60-minute push window and buzz the same
person twice.

**48 adversarial tests in prod, and a mutation check on the tests themselves.**
The suite runs as one `DO` block that always ends by raising its own results, so
every fixture and test nudge rolls back regardless of how the SQL editor handles
transactions. Before handing it over it ran against a PGlite mock of prod built
from catalog queries; ten deliberately planted bugs (the spec's CHECK, a leaked
private session, a countable abandoned timer, a callable internal function, a
private-goal oracle, a missing cooldown, …) were each caught by their intended
test.

**Also fixed along the way:** an unrecognized `reports.target_type` used to fall
through and render as a *profile* report in `/admin` — which is precisely what a
nudge report would have done. AGENTS.md claimed one service-role exception while
the social push sender had been a second one for a month; it now lists both
kinds, and the nudge sender is documented as the third.

Push bodies are system-generated — the preset appears only in-app, a stricter
rule than the comment push, which does carry user text. Coalescing inside 60
minutes replaces the banner via `apns-collapse-id` with no sound rather than
buzzing twice. **Needs the hand-run SQL** (`.claude/plans/nudges.sql`), and stays
invisible until `NEXT_PUBLIC_NUDGES` is set.

## 2026-09-13

### 15:36 · Everyone's goals, on the admin page
Wanting to see every user's goals without friending them has two readings, and
they are not the same change: an admin-only view, or making goals public to all
signed-in users. This is the first. The `goals` SELECT policy is untouched, so
what the beta users see is byte-identical before and after.

The gate lives in the database. `admin_list_all_goals()` is `SECURITY DEFINER`,
which is the only reason it can read across `owner OR are_friends AND NOT
is_private` at all — and that makes its internal `is_admin()` check the access
control, not a convenience. `app/admin/page.tsx` already 404s non-admins, so
this is the same two-layer shape the other `admin_*` RPCs use.

It returns private goals too. That's deliberate for a moderation surface, but
the panel badges them rather than letting them pass as ordinary rows — seeing
something a user explicitly marked owner-only should look different from seeing
something they didn't.

`AdminGoals` is a server component, unlike its four siblings; those are
`"use client"` only because they own buttons, and this one is read-only.
Grouping by person happens in TypeScript so the RPC stays a plain projection —
the Map's insertion order carries the RPC's `username, created_at` ordering
through without a second sort. Degrades to an explicit "not installed" note on
RPC error, the same discipline as the capacity and bug panels: a missing
migration must not take the moderation queue down with it.

## 2026-09-09

### 18:02 · A password door, for App Review only
Apple's Guideline 2.1(a) rejection asked for credentials a reviewer can type
into App Store Connect. Every existing way in borrows an identity from Google or
Apple, so there was nothing to hand over — "no demo account is possible" was
true, and was exactly what got rejected.

`signInWithPassword` is a server action for the reason native-auth.ts already
documents: the server client writes the session as a real Set-Cookie header,
which WebKit commits immediately, while the browser client writes via
document.cookie, which WKWebView flushes lazily and can drop. Supabase's own
error is not echoed back — it distinguishes "no such user" from "wrong
password", and repeating that turns the form into an oracle for which addresses
hold accounts.

No sign-up, no password reset, no email confirmation. Each is a flow with its
own mail and edge cases, and none is needed for one account provisioned by hand
in the dashboard.

Visible on every sign-in surface rather than native-only or hidden behind a
gesture. The shell has no address bar, so a hidden door cannot be reached by
URL, and a reviewer who does not find it files another rejection — one quiet
underlined line is the cheaper side of that trade. It renders after both OAuth
buttons so Guideline 4.8's equal-prominence comparison stays between Apple and
Google, and it is disabled until the terms checkbox is ticked, because 1.2
governs this door too.

Known tradeoff, accepted: enabling Supabase's Email provider also opens its
public sign-up endpoint, and the anon key is public by design. Supabase's
"disable signups" switch would close it but would block Google and Apple
sign-ups with it. Anyone arriving that way still lands behind the 250-seat cap
and RLS, so they see an empty app and nobody else's data.

### 17:38 · Guideline 4: stop asking Apple users for a name Apple already sent
The rejection was caused by a decision that was written down and reasoned about
at the time. `native-auth.ts` said: "Apple sends the user's name and email ONLY
on the very first authorization... That costs us nothing: no code in this app
reads provider metadata (profiles get their display name and handle from
onboarding, where the user types them)." It cost exactly one review cycle. The
plugin returns `profile.givenName`/`familyName`, the button dropped them,
nothing seeded `profiles.display_name`, and so onboarding's welcome step
rendered an empty "Your name" field to someone who had just handed Apple their
name.

The button now forwards the name and the action seeds the column, guarded by
`.is("display_name", null)`. That guard is the whole safety argument: Apple
sends nothing on later sign-ins, so it is normally a no-op, but it also means a
user who renames themselves can never have that overwritten. The write is
swallowed on failure for the same reason invite attribution is — a missing
display name is cosmetic, a failed sign-in is not.

Email needed no equivalent: it rides the id_token as a claim, `getCurrentUser`
reads it off `getClaims()`, and nothing ever asks the user for it — Hide My
Email relay addresses included.

The join went into `lib/auth/apple-name.ts` with tests rather than staying
inline, because every interesting case is unreachable from a signed-in device:
Apple only sends names on a first authorization, so exercising them by hand
means revoking the app under Settings → Sign-In & Security between each attempt.
Both halves are independently nullable, which the tests pin down.

**Verifying this on device requires revoking first** — Settings → [name] →
Sign-In & Security → Sign in with Apple → Progra → Stop Using Apple ID, and
deleting the matching Progra account. Otherwise Apple returns nulls and a
working fix looks broken.

## 2026-09-06

### 11:47 · Guideline 1.2: the terms were right, the presentation wasn't
Apple rejected the submission for not requiring users to agree to terms before
registering or logging in. The terms themselves were never the problem —
`/terms` § Acceptable use has said "There is no tolerance for it" about
harassing, hateful, sexually explicit and violent content since it was written.
What was missing was the *agreement*: `/terms` was a footer link on the landing
page and absent entirely from `/login`, so nothing was ever presented as
something to accept.

The gate went into `sign-in-buttons.tsx` because that component already exists
to decide Guideline 4.8 in one place, and `/`, `/login` and both
`/i/[username]` branches render it — so all four inherit the checkbox without
each remembering to. It became a Client Component in the process; every caller
passes plain strings, so the boundary costs nothing.

An explicit tick rather than a passive "by continuing you agree" line. The
passive form satisfies some reviewers, but only the affirmative one answers
"require that users agree", and a second rejection costs another review cycle.
The zero-tolerance sentence is repeated in the checkbox label itself so a
reviewer sees the required language without opening the linked page.

The consent text is a `<div>`, not a `<label>`, and the checkbox is named via
`aria-labelledby`. Clicking a link inside a label activates the label's control
as well as following the href, so wrapping it would have meant that reading the
terms silently ticked the box agreeing to them.

**No new binary is needed.** `server.url` points at progra.world, so deploying
the web layer changes the behaviour of the build already sitting in review.

## 2026-08-26

### 23:22 · Items 2–7 answered, and split by where they get pasted
`docs/app-review-notes-paste.txt` is the literal paste for App Review
Information → Notes: plain text, no tables, items 2–7, measured at 3,998
characters against the field's ~4000 cap. It got there by moving the Guideline
4.2 / 1.2 / 5.1.1 argument *out* — that belongs in the Resolution Center reply,
which has no meaningful limit and is where a case is argued. Notes is the durable
reference Apple asked to inherit on future submissions; the reply is the case for
this one. `docs/app-review-notes.md` now holds both, plus the reply verbatim.

Item 2 stopped being a template: `TARGETED_DEVICE_FAMILY = 1` and
`IPHONEOS_DEPLOYMENT_TARGET = 15.0` make Progra iPhone-only at a minimum of iOS
15.0, so no iPad testing is owed. The device model and OS version are the only
two placeholders left, and they are left blank deliberately — Apple checks that
list against the build's own compatibility data, so it is not a field to fill in
plausibly.

### 21:52 · Export compliance is answered in the binary, not in the web form
`ITSAppUsesNonExemptEncryption = false` in `ios/App/App/Info.plist`. Without it
every upload lands in App Store Connect as "Missing Compliance" and blocks
TestFlight until someone clicks through the encryption questionnaire — which is
exactly the wrong moment to discover it, since a build stuck there cannot be
handed to an internal tester.

`false` is the accurate answer, not the convenient one: the only cryptography in
the app is `crypto.randomUUID()` and the SHA-256 nonce digest in
`lib/auth/nonce.ts`, and hashing is not encryption — Apple's exemption covers
authentication use explicitly. Everything else is TLS supplied by the OS.

Does not affect the build already in review; that one still needs the question
answered by hand in ASC.

## 2026-08-24

### 21:50 · Answers for Apple's "Information Needed" request
App Review came back asking for the standard seven: a device recording, the test
matrix, what the app is, how to get in, the external services, regional
differences, and regulated-industry documentation. Nothing about the binary — it
is answered in Resolution Center, not with a new build. `docs/app-review-notes.md`
holds paste-ready text for the App Review Information → Notes field (permanent,
so future submissions inherit it) plus a nine-beat shot list for the recording,
ordered so account deletion comes last because it destroys the account it was
recorded on.

The load-bearing part is the pre-flight list at the top. Two things would sink
the review regardless of how good the notes are: a reviewer whose signup lands on
the 250-seat waitlist wall instead of the app, and the checked-in
`aps-environment: development`, which makes every push the reviewer might look
for silently fail. Both are checkboxes now rather than assumptions.

## 2026-08-20

### 20:15 · Pre-submission UI pass: six changes across the app
Six small things, committed separately so any one can be reverted after device
testing without taking the others with it.

**Add a session is start-and-end, not start-and-duration.** You remember "I
worked two till four", not "two hours starting at two". Duration is derived and
shown live. The stepper enforced the 5-minute floor and 10-hour cap by clamping;
free-typed times can violate both, so `save()` checks them explicitly. An end at
or before the start reads as "past midnight" — the only interpretation that
isn't nonsense, and a shape the stepper could already produce. Fixed a latent
bug while in there: `openEdit` seeded duration from `workedMs`, which excludes
paused time, so re-saving a paused session quietly trimmed it.

**Week → Sessions opens that week.** It linked to a bare `/history`, which
defaults to month, so asking for this week's sessions landed you in a different
period. `/history` already parsed `?view=week&w=`; `weekStart` was already on
the component in the right format.

**Dark mode is gone.** Mostly dead already — no `ThemeProvider` was ever mounted
— but a real sun/moon toggle survived in the `/clock` header, applying `.dark` to
that subtree and persisting in localStorage. Removed, along with 62 lines of
unreachable `.dark` tokens, the dark `themeColor` (which advertised `#14181f` to
iOS for a palette the app never renders), and the unused `next-themes`
dependency. The `dark` custom-variant stays — nine vendored shadcn components
still carry `dark:` utilities and that line is what compiles them — as does
`color-scheme: light`, which matters *more* now that there's no dark palette to
fall back on.

**A gear replaces the profile chip row.** Up to three chips plus a report flag
sat beside someone's name, which is what forced it to truncate. One 32px gear
leaves the name the line. The sheet reads Add/Remove as friend · Block · Report;
a pending request says "Cancel friend request" and an incoming one splits into
Accept and Decline, because calling either a friendship would misdescribe the
tap. Block now confirms — in a menu it sits one tap from "Remove as friend" and
it navigates you away. `ReportButton` gained optional controlled
`open`/`onOpenChange` so the sheet can close before the dialog opens rather than
the two fighting over focus.

**The profile session count was wrong, not just capped.** Both the Sessions stat
and the Recent-sessions header counted the array from `listProfileSessions`,
which is limited — so past the limit a profile reported exactly that number
forever. `countProfileSessions` does it in the database with `head`+`exact` under
the same RLS, so a friend is counted exactly what they may see. Render cap raised
50 → 200; signing is one batched `createSignedUrls` call regardless of count, so
the cost is payload, not round trips. Both `/profile/[username]` and `/me`.

**The landing page is the name, the line, and the way in.** Two feature bullets
removed; tagline gains "world's". Note for when Google's OAuth verification
clears: the calendar bullet existed partly so Google's reviewers could see the
scope described publicly. `/privacy` still does; the landing no longer will.

### 19:10 · Two hard submission blockers: a transparent app icon and no Support URL
Both would have stopped the submission, and neither was on any earlier list
because both live outside the app's own code.

**The app icon carried an alpha channel.** `hasAlpha: yes` on the 1024×1024
`AppIcon.png`. App Store validation rejects that at upload — the large icon may
not be transparent or contain an alpha channel. Every pixel was already fully
opaque (min alpha 255), so `sharp().flatten()` removed the channel without
changing a single visible pixel; the flatten background is irrelevant for that
reason. Note the icon is a hand-made gradient asset, NOT output of
`scripts/generate-icons.mjs` — that script only produces the flat-navy web/PWA
icons, so regenerating won't reintroduce this.

**There was no Support URL.** App Store Connect requires one and it is
mandatory. The only contact anywhere was a `mailto:` inside `/privacy` and
`/terms`, and the landing page has no contact information at all — so a reviewer
following a Support URL pointed at `progra.world` would land on a sign-in screen
with no way to reach anyone. `/support` is public, carries the email, the
in-app bug-report route, the 24-hour moderation commitment, how to delete an
account, and what notifications the app sends. Linked from the landing footer
and both legal pages.

### 18:30 · Google Calendar connect goes dark for the first submission
`calendar.events.readonly` is a **sensitive** Google scope, and the OAuth app
hasn't cleared verification (`NEXT_PUBLIC_SHOW_UNVERIFIED_WARNING` is still 1).
Two consequences, one cosmetic and one arithmetic:

- Every consent screen shows "Google hasn't verified this app", where the way
  forward is labelled *"Go to progra.world (unsafe)"*. That is a security
  warning on a feature advertised on the signed-out landing page, shown to an
  App Review reviewer who has no obligation to read our explanation first.
- Google caps an unverified app at **100 users** who have granted a sensitive
  scope. The beta sells 250 seats. The two numbers disagree the moment it fills.

New `CALENDAR_CONNECT` flag, dark by default. It gates the ability to
**connect**, not the feature: anyone already connected keeps their synced
events, the sync button, and Disconnect. Revocation is promised in the privacy
policy and must never depend on a flag.

Gated in four places, because hiding a button is not the same as closing a door:
Settings (the row itself disappears rather than reading "Not connected" with no
way to act on it), History, the landing-page bullet, and `/auth/google-calendar`
— which now redirects before it even checks auth, since it starts a real consent
flow.

The landing bullet is gated rather than deleted: it exists partly for Google's
own OAuth reviewers, so it should return with the feature.

Flip `NEXT_PUBLIC_CALENDAR_CONNECT=1` and `NEXT_PUBLIC_SHOW_UNVERIFIED_WARNING=0`
together when verification clears.

### 17:55 · Pre-submission regression pass: notifications outliving their account, and a wall you could walk around
First pass looking at the features together rather than one at a time. Three
real defects, all at the seams.

**Local notifications survived sign-out and account deletion.** `SyncClockReminders`
and `SyncHabitReminders` are mounted `{user && …}`, so signing out *unmounts*
them — and unmounting cancels nothing. `cancelClockReminders` existed and was
never called from anywhere; the habit family exported no cancel at all.
Reminders are wall-clock scheduled on the device, so a deleted account went on
firing "Still going?" hourly and habit nudges for up to a week.
`components/notification-lifecycle.tsx` is mounted **ungated** inside `Shell` —
a leaf gated on `user` can never observe `user` becoming null, which is the only
event it exists for. Covers sign-out, deletion, and the shared-device
user-switch in one place instead of three call sites remembering. Matters for
review specifically: a reviewer *will* delete the test account.

**Route handlers bypass the beta-full wall.** Pages are genuinely covered — the
wall replaces the layout's children and a walled user never receives an app
shell to navigate from. But route handlers don't render the layout at all, so
`/auth/google-calendar` let a seat-less user reach Google's consent screen by
typing the URL. Now `requireSeat()`-gated. The other three handlers are correct:
`/auth/callback` is how you *become* walled, and `/auth/signout` is the wall's
only button.

**Nothing stopped the two notification id ranges colliding.** Clock owns
9001/9002 + 9101–9109, habits 9201–9207 — disjoint today, but
`MAX_HOURLY_REMINDERS` is computed from `SESSION_CAP_MS`, so raising the session
cap grows the clock range toward the habit base. The failure would be silent and
destructive, since each family cancels by clearing its whole range.
`lib/notification-ids.test.ts` asserts non-overlap and headroom.

**Submission requirements.** `/terms` gains a Reporting and moderation section
committing to act on reports **within 24 hours**, and the acceptable-use rule now
names objectionable content explicitly — the two written pieces Guideline 1.2
requires and the only ones that were missing. `Info.plist`'s
`UIRequiredDeviceCapabilities` was `armv7` (32-bit ARM, dropped at iOS 11) from
the Capacitor template; now `arm64`.

Verified: `tsc` clean, `eslint` **10 problems — the documented baseline, unchanged**,
199 tests, build clean, signed-out routes 200.

### 13:20 · Interview consent, and a privacy policy that permits the outreach
**Requires SQL (run by hand, before deploy).**

Exploration reframed this one. "Email capture" turned out to have no email to
capture — Google and Apple OAuth already put it in the JWT, `getCurrentUser()`
returns it, and `admin_list_waitlist` / `admin_list_bug_reports` already surface
other users' addresses. The only missing thing was **permission to use it**,
which is one nullable boolean. So this is not a new data category, it is a new
*purpose* for one already collected — a far smaller change, including on the
privacy label.

**`profiles.interview_consent` is an opt-IN, and its polarity is the opposite of
`social_pushes_enabled` sitting three lines above it in the same type.** That one
is an opt-out documenting "null = on". Here null and false both mean NOT
consented and every read is `?? false`. Getting it backwards emails people who
never agreed, so it is stated in the column comment, the type comment, and the
RPC (`where interview_consent is true`, which null does not match).
`interview_consent_at` is cleared on withdrawal, so the stamp can never describe
a consent that no longer exists.

The ask lives on onboarding's **existing final screen** rather than an eleventh
step — no change to `STEPS`, `activeSteps`, the progress dots or the "Step N of
M" numbering, which is the entire reason for putting it there. It renders as its
own `rise` step below the goal/habit summary so it reads as a closing question
rather than competing with the celebration. Off by default, always: a pre-ticked
box is not consent.

`finish()` writes it **before** `completeOnboarding()` and **only when true**,
swallowing any failure — losing a consent flag is an annoyance, being stuck on
the last screen of onboarding is a dead end (the `claim_invite` reasoning from
the auth callback). Because null already means not consented, `skipAll()` needed
no special case at all: someone who skips never saw the checkbox and therefore
never consented, which falls straight out of the default.

Settings gains a **Research** section so consent can be withdrawn — consent that
can't be taken back isn't consent. Same optimistic-then-revert shape as
`SocialPushRow`.

`/admin` gains a fourth panel with CSV export. Every field is quoted and internal
quotes doubled: a display name containing a comma would otherwise shift every
column after it, silently, and you'd find out when the mail merge was already
wrong. The panel sits third rather than last because `AdminReports` owns the
page's bottom padding, and anything after it inherits a `pb-28` gap.

**The privacy policy edit was not optional.** §2 said Google user data is used
"only to provide user-facing features inside Progra" and enumerated three;
emailing someone for an interview is not one, so the first outreach email would
have made that sentence false — the specific failure App Review 5.1.2 and the
Google API Services User Data Policy both turn on. A new "Research and product
interviews" section is now the stated exception, §2 points at it, "What we
collect" discloses the flag, and the effective date is bumped in **both**
`privacy` and `terms` (terms promises it will be, so leaving one stale breaks the
other's promise).

Verified `public_profiles` is column-explicit (`id, username, display_name, bio,
onboarded_at, avatar_path`) — the consent flag is not friend-readable.

Also new: `docs/app-privacy-label.md`, the full App Store Connect declaration
drafted now rather than at submission, because the label must match what is
collected and the consent copy must match the label. It records every category,
every "not collected" answer and why, the third-party table, and the fact that
every "used for tracking" answer is No.

No change to `deleteAccount`: the columns live on `profiles`, which already
cascades from `auth.users`, so deleting an account withdraws consent by
construction — which the consent copy now says.

### 12:40 · Users can report bugs, and the reports land in /admin
**Requires SQL (run by hand, before deploy).**

The only support affordance in the product was a `mailto:` buried in `/privacy`
and `/terms`, neither of which is linked from Settings. Settings → Help → Report
a bug now opens a sheet; the reports queue in `/admin` above Moderation and Beta
capacity, open ones first.

**The design turns on one thing:** `usePathname()` at submit time always returns
`/settings`, because people walk to Settings *after* hitting the bug. Capturing
the current route would stamp every report with the one screen that isn't the
problem — worse than capturing nothing, because it looks authoritative. So
`lib/last-route.ts` holds a two-slot route history in module variables, written
during render by a `<RouteMemory />` leaf (module variables, not state, so there
is nothing to re-render and nothing for `set-state-in-effect` to flag; Strict
Mode's double render is absorbed by the same-path guard that stops a re-render
shifting history). `getReportRoute()` substitutes the previous route only on
`/settings`, so a future contextual entry point gets the current screen for free.

`commit_sha` is stamped server-side from `VERCEL_GIT_COMMIT_SHA` rather than
shipping an app-version constant: exact build identification, no config change,
nothing to hand-bump and forget, and unspoofable. Null outside Vercel.

Client-supplied context (route, platform, user agent, viewport) is length-capped
but otherwise stored as given — it is diagnostic, not authorization, so it needs
to be bounded rather than trustworthy. An unrecognised platform is dropped
rather than passed through, since the column CHECK would reject the whole insert.

The description is truncated at 1000 rather than rejected, matching
`reportContent`'s treatment of `note` — losing the tail of an over-long report
beats losing the report. That cap earns the app's **first character counter**;
every other capped field just sets `maxLength`, which is fine at 300 and
invisible at 1000.

RLS is INSERT-only, like `reports`: `with check (reporter_id = auth.uid())`, no
select policy, and `revoke select, update, delete` on top so the default
Supabase grant can't combine with a future stray policy. Admin reads through
`admin_list_bug_reports()`, definer because it joins `auth.users` for the
reporter's email — a reporter often has no username worth showing.
`admin_resolve_bug_report` allows reopening, because "fixed" turns out to be
wrong often enough to need an undo.

FK cascades on account deletion. That keeps deletion a single clean cascade — an
App Store requirement not worth complicating — and a report is the user's own
content.

The panel distinguishes "nothing reported" from "RPCs aren't installed", and the
admin page degrades to `[]` on error, so deploying ahead of the SQL can't take
the moderation queue down.

`requireSeat()` applies, so waitlisted users can't file. They also can't reach
Settings — the wall replaces the app shell — so there is no dead entry point.

New: `lib/bug-reports.ts`, `lib/last-route.ts` (+6 tests),
`app/actions/bug-reports.ts`, `components/route-memory.tsx`,
`components/v2/report-bug-sheet.tsx`, `app/admin/admin-bug-reports.tsx`.
`settings-client.tsx` gains its first `next/dynamic` import, per the lazy-dialog
rule. The Report queue badge now counts open bugs alongside open reports.

### 11:37 · Admin panel for the beta cap: waitlist queue + seat controls
**Requires SQL (run by hand, before deploy).**

Admitting people previously meant hand-written SQL. `/admin` now carries a Beta
capacity section above the moderation queue: seated-of-cap and waiting counts,
an editable seat cap, and one card per waitlisted person with a Grant a seat
button.

Email is the headline field on each card, not the handle — a waitlisted user
never reaches onboarding, so `display_name` and `username` are almost always
null. `admin_list_waitlist()` is `SECURITY DEFINER` precisely to join
`auth.users` for it.

`admin_grant_seat()` **refuses** when there is no room rather than quietly
growing the beta; raising the cap is a separate, explicit decision, and the
panel says so when it's full. `admin_set_seat_cap()` never evicts — the cap
gates new claims only, so members numbered above a lowered cap keep their seats.

Both read RPCs degrade to null/empty on error and the panel renders an explicit
"RPCs aren't installed" line rather than an empty list, so deploying this ahead
of its SQL cannot take the moderation queue down with it — and an empty panel
can never be misread as "nobody is waiting".

New: `app/admin/admin-waitlist.tsx`; `grantBetaSeat` / `setBetaSeatCap` in
`app/actions/admin.ts`. RPCs: `admin_beta_overview`, `admin_list_waitlist`,
`admin_grant_seat`, `admin_set_seat_cap` — each re-checking `is_admin()`
internally, matching the report-queue pattern.

### 11:35 · 250-user beta cap: race-safe seat counter + waitlist wall
**Requires SQL (run by hand, before deploy) — already applied.**

Signup was completely open: any Google/Apple account reached `/onboarding` and
became a member. The cap is now 250, enforced at the only moment that can't be
raced — the instant `auth.users` gains a row.

`profiles.seat_no` (int, partial-unique, nullable) is the single source of
truth: non-null = member, null = waitlisted. Putting it on `profiles` rather
than a join table means it rides along in the `getProfile()` the root layout
already fetches (zero extra queries on the member path), and a deleted account
frees its seat through the FK cascade that was already there.

Race-safety is two independent layers. `claim_beta_seat()` takes
`pg_advisory_xact_lock` around the "lowest free seat" lookup, so the read and
the write consuming it are one atomic step; the partial unique index makes a
double-booked seat a `23505` even if the lock were somehow bypassed. The
allocator (`next_free_seat`, split out so it is testable with zero writes)
returns the *lowest* free number, so the cap means "250 concurrent members",
not "250 signups ever".

The signup hook is an **additive** `zz_claim_beta_seat` trigger on `auth.users`,
not an edit to `handle_new_user` — replacing a function whose header we can't
see risks silently changing its security posture, and same-table triggers fire
alphabetically so the `zz_` prefix guarantees it runs after the profiles row
exists. Its body swallows every exception: a claim failure must never break
sign-up, and `claim_beta_seat_self()` heals it on first load.

There is no cron in this repo, so **admission is lazy**: raising
`beta_config.seat_cap` admits waitlisted users on their next page load, the same
shape as `EnsureSessionCap`. The cap lives in a DB row precisely so a full beta
is fixable in seconds without a redeploy.

The wall renders **in place of** the layout's children rather than redirecting
to a `/full` route — the layout can't read the pathname, so a redirect would
loop on that route. Swapping children also means a waitlisted user never
receives an app shell to soft-navigate from. Known limitation: `/privacy` and
`/terms` are unreachable while signed in and seat-less; reaching them means
signing out, and the button is on the wall.

`isWaitlisted()` tests strict `=== null` on purpose. `undefined` means the
column isn't deployed yet (PostgREST omits absent keys), which must read as
*member* — otherwise an app deployed ahead of the SQL locks all 250 users out of
their own accounts. Missing column fails open.

Page loads aren't the whole surface: a valid JWT can POST a server action
without ever requesting a page. `requireSeat()` guards the 18 content-creating
mutations (`clockIn`, `createSession`, `createGoal`, `createHabit`, `addComment`,
`toggleReaction`, `postRecap`, `sendFriendRequest`, `completeOnboarding`, …) —
weighted toward the outward-facing writes, where a waitlisted account could
otherwise surface in someone else's feed. Downstream actions that only mutate
existing rows are covered transitively: those rows can't exist unless a guarded
action created them first.

`seat_no` is not user-writable. A column-level `revoke` can't express that (a
role holding table-level `UPDATE` isn't constrained by it), so a
`guard_profiles_seat_no` BEFORE UPDATE trigger rejects the column when
`current_user` is `authenticated`/`anon`. Deliberately not `SECURITY DEFINER` —
it needs `current_user` to reflect the real caller, which is `postgres` inside
the definer claim functions. Without it the cap would be theatre: a waitlisted
user could seat themselves with one PATCH.

New: `lib/auth/seat.ts` (pure, unit-tested), `lib/auth/require-seat.ts`
(server-only), `components/beta-full.tsx`. `app/layout.tsx` gains the gate and a
shared `Shell` so the app tree and the wall can't drift on fonts or layout.

DB objects: `beta_config`, `beta_waitlist` (both RLS-on with **no** policies —
invisible to every client, the `push_log` trick), `profiles.seat_no` +
`profiles_seat_no_key`, and `next_free_seat` / `claim_beta_seat` /
`claim_beta_seat_self` / `beta_waitlist_position` / `claim_seat_on_signup` /
`guard_profiles_seat_no`.

Verified: 14-assertion grant/policy sweep; reuse, idempotence and exhaustion
tests in SQL; adversarial JWT test (anon and `authenticated` get `42501` on both
tables and on `claim_beta_seat(uuid)`; the seat_no guard fires); wall confirmed
live by pinning the cap below a freed seat, and lazy promotion confirmed by
raising it back. `tsc` clean, `eslint` clean, 190 tests pass, `npm run build`
succeeds, signed-out `/`, `/login`, `/privacy`, `/terms` all 200.

## 2026-08-19

### · One navy button: `PrimaryButton`, and the sheets converted to it
The app's most-repeated element existed in **nine hand-rolled copies**: five radii
(13/14/15/18/2xl), five heights (44/46/50/52/`py-4`), two shadow recipes, two
active scales and three disabled opacities. None of that was chosen; it
accumulated over the weeks the screens were built.

`components/v2/primary-button.tsx` takes whichever variant was already the
majority — `rounded-[15px]` (8 sites), `active:scale-[.98]` (beats `.97` 8-to-4),
`disabled:opacity-50` — in two sizes, because two contexts genuinely differ:
`sheet` (h-12, `text-sm`) and `screen` (h-[52px], `text-base`, the navy glow).
Width defaults to full; a button in a row beside Delete passes `className="flex-1"`.

Converted in this commit — the eight sheet CTAs, where the change is a 2px height
shift at most: `manage-goals` (add + save), `manage-sessions` (add + save),
`manage-habits` (add + save, which also **drops its shadcn `Button` import** — its
two sibling sheets hand-rolled the same geometry, so it was the odd one out), and
Settings' two sheets, whose `SHEET_CTA` class constant is now gone.

Screen-level CTAs (Clock in, onboarding's Continue, the live timer, the finish
screen) are deliberately NOT in this commit: those have real geometry differences
— `rounded-2xl`, `h-[50px]`, a `py-4` button with no height at all — so converting
them is a visible change that deserves its own test.

### · Register `--secondary-ink`, and stop hand-spelling tokens that have utilities
`--secondary-ink` is defined in both the light and dark blocks but was never
added to the `@theme inline` map, so no `text-secondary-ink` utility existed and
**27 call sites wrote `text-[var(--secondary-ink)]` by hand**. Registering it
fixed that, and the same audit turned up five more spellings whose utilities
already existed and were being used elsewhere in the very same files:

| Was | Now | Count |
|---|---|---|
| `text-[var(--secondary-ink)]` | `text-secondary-ink` | 27 |
| `placeholder:text-[var(--disabled)]` | `placeholder:text-disabled` | 16 |
| `border-[var(--hairline)]` | `border-hairline` | 9 |
| `text-[var(--success)]` | `text-success` | 6 |
| `bg-[var(--inset-2)]` | `bg-inset-2` | 3 |
| `ring-[var(--screen)]` | `ring-screen` | 2 |

63 replacements across 17 files, and **zero visual change** — verified at the
compiled-CSS level rather than by eye: `.text-secondary-ink{color:var(--secondary-ink)}`,
`.border-hairline{border-color:var(--hairline)}`,
`.placeholder\:text-disabled::placeholder{color:var(--disabled)}` and the rest
emit byte-identical declarations to the arbitrary values they replace.

Why it matters beyond tidiness: an arbitrary value is invisible to a search for
the utility, so "which screens use the hairline?" gave the wrong answer, and the
next person copying a line copies the long form.

### · The auto-end nudge speaks the app's language now
`components/v2/auto-end-nudge.tsx` was the last file in `components/v2/` still
drawn entirely in shadcn tokens — `border-border`, `bg-card`, `bg-muted`,
`text-muted-foreground` — and it sits on the Progress tab, sometimes stacked
directly against `recap-nudge.tsx`, its structural twin in the new language. Two
banners, same shape, two design systems.

Converted to `border-hairline` / `bg-track` / `text-caption`, and to the app's
canonical `border-[1.5px]` instead of a 1px border. What did **not** change is
the muted treatment: the file's comment explains it's a correction to deal with,
not a reward to celebrate, so it stays quiet next to RecapNudge's navy fill —
muted in Progra's own greys rather than in shadcn's.

Both nudges keep their `size-5` chevrons, which are larger than the
`size-[13px]` row chevrons elsewhere: they're banners, and the two need to match
each other more than they need to match a list row.

Still open in this file (behaviour, not polish, so not in this commit): it's one
of three surfaces — with `recap-nudge` and `plan-complete-modal` — whose action
result is discarded, so a failed `markAutoEndReviewed` is silent.

### · The finish screen has a way out
`/clock/finish` is `fixed inset-0 z-50`, so it covers the bottom nav, and it had
no header, no back control and no minimize — the only two exits were **Post** and
**Delete session**. Someone who'd just worked two hours and didn't want to share
it had to delete the work to leave the screen.

Leaving is a legitimate outcome and always was: `page.tsx` documents it —
"abandoning the screen leaves the session saved but private". There was simply no
way to do the abandoning. A chevron-down dismiss now sits top-left (the gesture
the live timer's minimize already uses, in the app's standard
`size-8 rounded-[11px] border-[1.5px]` icon-button geometry), routes to Progress,
and toasts what happened: saved privately, and postable later by editing the
session — which the edit-session dialog on /clock can do, so the copy is honest.

It deliberately does NOT call `markAutoEndReviewed`: an auto-ended session that
was dismissed rather than reviewed should keep its nudge on the Progress tab.

### · Fix 4: the bottom nav sits on the home indicator, not above it
A consequence of fix 3, not a new bug: with `contentInset: 'never'`,
`env(safe-area-inset-bottom)` started reporting its real ~34pt for the first
time, and the nav's `pb-[env(safe-area-inset-bottom)]` lifted the whole bar off
the bottom of the phone, so the tabs read as floating.

The bar now pads by `max(env(safe-area-inset-bottom) - 12px, 0px)`: still clear
of the home indicator, 12px lower than iOS's full inset. The `max(…, 0px)` keeps
it a no-op on the web and on devices with no inset, where the subtraction would
otherwise go negative.

Ships through Vercel — no Xcode build for this one. 12px is a knob; say the word
and it moves.

### · Fix 3: the page was inset twice — `contentInset` back to Capacitor's default
With fix 2 the over-scroll area went from black to white, which said the colour
was solved and the *space itself* was the remaining bug: you could scroll up into
a blank strip above the header instead of the screen starting at the top.

That strip is not a rubber-band. `CAPBridgeViewController.swift:301` sets
`scrollView.bounces = false`, so the document cannot bounce — the space was real
scrollable area, added by `contentInset: 'automatic'`, which makes UIKit apply
the safe areas to the web view's scroll view as a **content inset**. The CSS
already insets the app for the same safe areas
(`body { padding-top: env(safe-area-inset-top) }`, globals.css), so every screen
was inset twice and the extra height was scrollable.

`contentInset` is now `'never'` — Capacitor's documented default, which the repo
had overridden. The insetting goes back to the CSS, which is what
`viewport-fit=cover` and the black-translucent status bar were written for, and
it also revives every `env(safe-area-inset-*)` rule in the app: under
`'automatic'` those values report 0, so the bottom nav's
`pb-[env(safe-area-inset-bottom)]` and the sheet/overlay insets were quietly
doing nothing.

Needs an Xcode build, like fix 2.

### · Fix 2: the black space was the webview's own background — **needs an Xcode build**
Fix 1 (the web half) didn't clear it, which points at the native side, as the
audit predicted. `CAPBridgeViewController.swift:308-314`:

```swift
if let backgroundColor = configuration.backgroundColor {
    aWebView.backgroundColor = backgroundColor
    aWebView.scrollView.backgroundColor = backgroundColor
} else {
    aWebView.backgroundColor = UIColor.systemBackground
    aWebView.scrollView.backgroundColor = UIColor.systemBackground
}
```

`capacitor.config.ts` set no `backgroundColor`, so both the webview and — the
part that matters — **its scroll view** took `UIColor.systemBackground`. With no
`UIUserInterfaceStyle` in `Info.plist` the app follows the system appearance, so
on a phone in dark mode that resolves to black. The scroll view's background is
precisely what is exposed while rubber-banding past the end of a list, which is
why the black appeared on over-scroll specifically and why no amount of CSS
fixed it: the page never paints that region.

`ios.backgroundColor: '#ffffff'` (a supported key since Capacitor 1.1.0). One
line, no layout change.

**This one does not ship through Vercel.** `capacitor.config.ts` is compiled into
the native project by `npx cap copy ios` (already run — the generated
`ios/App/App/capacitor.config.json` is gitignored), so it takes effect on the
next Xcode build, and reaches beta users on the next TestFlight/App Store build.

Deliberately NOT changed in this commit: `contentInset` stays `'automatic'`. It
is a deviation from Capacitor's `never` default and it zeroes the `env(safe-area-inset-*)`
values the CSS relies on — but the layout currently works *because* the native
inset is doing that job, so flipping it is its own change with its own test, not
a rider on a colour fix.

### · Fix 1/N: black space when over-scrolling in the iOS app (web half)
The webview shows black at the ends of a scroll. Root cause is a configuration
contradiction between the two halves of the app, found by auditing both:

- `capacitor.config.ts` sets `contentInset: 'automatic'` (Capacitor's default is
  `never`), so UIKit insets the WKWebView scroll view by the safe areas and the
  exposed strips are painted by the **scroll view**, not the page.
- No `ios.backgroundColor` is set, so `CAPBridgeViewController` falls back to
  `UIColor.systemBackground` for the webview AND its scroll view, and
  `Info.plist` has no `UIUserInterfaceStyle` — so on a dark-mode phone that
  colour is **black**. That's what makes the strip black rather than white.
- The web layer is written for the opposite shell (`viewport-fit=cover`,
  `black-translucent`, `env(safe-area-inset-*)` padding on `body`), and under
  `.automatic` those `env()` values report 0 — so several bare-`env()` rules are
  currently dead.
- The document can't bounce (`scrollView.bounces = false` natively), so the
  rubber-banding is coming from **inner** scrollers, of which there are eight,
  none of which set `overscroll-behavior` (zero hits repo-wide).

**This commit is the web half**, which ships through Vercel with no Xcode build:

- `html` now paints its own canvas (`background-color: var(--screen)`) instead of
  relying on background propagation from `body`, and declares
  `color-scheme: light` — Progra has no dark mode, and without the declaration
  WebKit renders form controls, `<select>` popovers and scrollbars in the
  system's dark appearance inside the webview.
- `overscroll-contain` on all eight inner scrollers (bottom sheet, finish
  overlay, recap story, the settings timezone list, the onboarding step body,
  the notifications panel, the category donut list, the categorization review),
  so a flick past the end stops there instead of chaining to the document.
- Toasts are pinned `theme="light"`. Nothing mounts a `ThemeProvider`, so
  `useTheme()` fell through to `"system"` and sonner resolved it from
  `prefers-color-scheme` — every toast rendered dark on a dark-mode phone.

The native half (`contentInset: 'never'`, `ios.backgroundColor`,
`UIUserInterfaceStyle`) is deliberately NOT in this commit: it needs
`npx cap sync ios` plus an Xcode build, so it only reaches beta users on the next
TestFlight build. Test this one first — if the black is gone, the native change
is belt and braces.

### · The post screen, rebuilt — and no emoji palette
`/session/[id]` is what opens when you tap a post: from the feed, from a session
row on You or a friend's profile, from the notifications sheet, or from a
like/comment push. It was the last screen reachable in two taps that still
looked pre-revamp — the recolor pass had given it the new text tokens, but the
title and duration still sat in a shadcn card, with no eyebrow, no serif, and a
row of emoji reaction buttons under the photo.

Now it's the feed card opened up, in the same vocabulary: author row with the
relative time, the "clocked into ◈ {target} for 2h 12m" sub-line, the title in
serif at 26px (the card uses 17), the description unclamped, the photo whole,
and the duration pill in the session's own colour. **The emoji palette is
gone**; the post carries one like — the same kudos heart the feed leaves — and
a private post shows the Private chip instead, since nobody else can see it to
like it. Comments keep their thread and composer, rebuilt as hairline rows
under a track band.

**The back arrow now goes back.** It was a `<Link href="/feed">`, which sent
anyone arriving from a profile, the You tab or a push notification to a screen
they hadn't come from. It's `BackButton` (`router.back()`), like the friend
profile.

**Split in two:** `page.tsx` keeps the gate and the three loads, and hands plain
props to `session-view.tsx`. That's what let the four states — with photo,
without, no comments, own private post — be rendered from fixtures and
screenshotted before deploying.

`getSessionForViewer` now returns `title` + `attribution` + `isPrivate` instead
of a `label`/`isGoal` pair, and resolves attribution through the SHARED
`resolveFeedAttribution` rather than its own "goal title else task name" rule.
That local rule had no category branch at all, so a category-tracked session
showed nothing about what it was filed under — and the shared resolver is a
privacy boundary (a private goal yields null rather than falling through to a
category), which is exactly the kind of rule that shouldn't have had a second
implementation.

`components/reaction-bar.tsx` stays in the repo — the legacy `feed.tsx` still
mounts it on the flag-off path — and reaction data is untouched, since kudos IS
a `LIKE_EMOJI` reaction. The comment composer and delete control were restyled
in place.

### · Settings rebuilt in the editorial language
The last screen the 2026-08-15 redesign never touched — deferred at the time,
and increasingly odd about it, since Settings opens from the You tab's header
and You is the most editorial screen in the app. It was stacked shadcn cards,
a bold 26px title, icon rows and two centre-screen dialogs.

Now it's the same shell as `/me`: `pt-7`/`pb-28`, a `max-w-md` column with the
padding applied per section so hairlines run full-bleed, a `BackButton` beside a
`section-label`, an identity block with the serif name (tap it to edit), and
`bg-track` bands between groups. Rows are label · value · chevron with no icons,
which is what You and Friends do — one local `Row` covers the link, button and
inert-value shapes the old `SettingsRow`/`LinkRow` pair covered between them.

**Both dialogs are bottom sheets now** (`components/v2/bottom-sheet.tsx`, the
manage-goals field idiom). Edit profile keeps AvatarPicker, name, username, bio
and `saveIdentity`'s username-first ordering. The time zone `<select>` — 400
options on a native wheel — became a search field over hairline rows with the
current zone pinned first and checked. Pinned rather than scrolled-to: the sheet
is still sliding up when a mount effect fires, so measuring the list to scroll it
lands nowhere (tried scrollIntoView, then scrollTop in a rAF; ordering is both
simpler and correct).

`HoldToDelete` and `ReplayOnboardingButton` picked up the same shapes as the
sheet CTAs — the hold gesture and its `HOLD_MS` are untouched.

**Behaviour is unchanged, deliberately.** Same actions, same flag gates, the
same three notification-permission branches and analytics; `NotificationsSection`,
`HabitReminderRow` and `SocialPushRow` kept their logic line for line and only
changed wrappers. The email now has its own "Signed in as" row instead of
appearing only when a handle was missing.

Verified against a feature checklist and screenshotted at phone width (main
screen + both sheets). Two things a web screenshot can't show and which need a
device pass: the Notifications section renders nothing off-native, and the
calendar connect round-trip (`?calendar=connected`).

The four screens Settings links to — Goals, Categories, Habits, Past sessions —
are still the old card layouts, so Settings is now newer than its own
destinations. They're the next chunk.

### · Onboarding: a How-Progra-works screen, and copy that says what to do
The wizard explained the mechanics nowhere and asked for a goal immediately, so
"goal" had to be guessed from context — and goals vs categories, the one
distinction the whole clock rests on, was never mentioned at all.

**New second step, `how`** (before `goal`, because the next screen asks for
one): time goes into a **goal** — a weekly hour target — or a **category** —
the same clock with nothing to hit — and **habits** sit beside both as one-tap
daily check-offs with no timer. Ten steps in the shell now, nine on the web;
everything still derives from `activeSteps()`, so the dots and the "step N of M"
eyebrow follow on their own. Welcome's CTA is "Get started" rather than "Set
your first goal", which now belongs to the screen after next.

**Goal step** is explicit about intention over outcome: not "Run a marathon"
but "Run 5 hours a week" — the failure mode being a goal you can't clock into.

**Practice clock-in** says where this lives in the real app (the Clock tab) and
walks the three moves — name it, pick the goal, start; clock out and Progra
keeps the time — before the mock asks anyone to do it.

**The Sunday step is now about the friends**, not the artefact: they see your
hours all week, you see theirs, and the recap is where that lands. It keeps the
leaderboard mock, since that IS the friends. Its CTA reads "Continue" instead of
"Invite friends" (the invite screen follows it and makes its own ask).

**Sharing an invite now carries the link.** `navigator.share` was given the
message as `text` and the link as `url`, and share targets pick between those
fields — the ones people actually invite through take the text and drop the
url, which sent an invite nobody could accept. Both buttons now send one block,
message + link, so copy and share can't disagree.

Em dashes are single hyphens in the practice-post and friends steps, per the
house voice here.

Also refreshed the flow description in `ARCHITECTURE.md`, `docs/SCREENS.md`
(S12) and `app/onboarding/page.tsx` — all three still described a six-step
welcome→about→goal→categories→habits→invite wizard that hasn't existed for a
while.

### · Fix: onboarding died on screen 1 — sharp's native library never shipped
Pressing "Set your first goal" returned Next's server-error page (digest
`1800497011`). The Vercel log for that digest:

```
POST /onboarding
Failed to load external module sharp-20c6a5da84e2135f:
Could not load the "sharp" module using the linux-x64 runtime
ERR_DLOPEN_FAILED: libvips-cpp.so.8.18.3: cannot open shared object file
```

**Cause 1 — the deployed function had sharp's addon but not its library.** The
file tracer follows JS requires, so `@img/sharp-linux-x64/…/*.node` made the
bundle, but the addon then `dlopen`s `libvips-cpp.so.8.18.3` from a sibling
package — a path no JS ever names — and that 17MB file was left out. Provable
locally: `.next/server/app/onboarding/page.js.nft.json` listed
`@img/sharp-libvips-*/{index.js,package.json,versions.json}` and no binary.
Never an install problem (the lockfile has `@img/sharp-linux-x64` 0.35.3 and
`@img/sharp-libvips-linux-x64` 1.3.2), and a *dlopen* failure is itself proof
the addon loaded. Note Next's own nested sharp copy traces its dylib fine — the
gap is specific to the app's top-level dependency.

**Cause 2 — one bad import took the whole route down.** Next bundles every
server action for a route into ONE module (`server-reference-manifest.json`:
`setUsername`, `setProfileIdentity`, `createGoal`, `completeOnboarding` and
`uploadAvatar` all share moduleId 35424 on `app/onboarding/page`). A top-level
`import sharp` in `app/actions/avatar.ts` therefore threw while that module was
being evaluated — before any action body ran. Reproduced by moving the dylib
out of node_modules: `setUsername` 500, `clockIn` on /clock 500,
`setProfileTimezone` on /settings 500, `toggleReaction` on /feed 200 (no image
action in its module). So onboarding was unfinishable including **Skip**, and
clock-in was broken on the same terms.

**Fix 1: `outputFileTracingIncludes`** in `next.config.ts` force-includes
`node_modules/@img/**` for the five routes that mount AvatarPicker or
SessionPhotoStep (`/onboarding`, `/settings`, `/clock`, `/clock/live`,
`/clock/finish`). Scoped rather than global because it's ~18MB per function;
verified after a build that those five traces now carry the binary and /feed
still doesn't. **A new route that takes photo uploads must be added to that
list** — the symptom is the graceful message below, not a broken route.

**Fix 2: `lib/images/sharp.ts`,** a `loadSharp()` that imports sharp *inside a
function* and returns `{error}` instead of throwing. This is the part that
matters beyond today: with it, an unloadable image library costs one upload
("Photo uploads are temporarily unavailable" — deliberately not the actions'
"Couldn't process that image.", which means a bad *file*) instead of every
action on the route. Both `uploadAvatar` and `uploadSessionPhoto` now load it
per call; their existing try/catch around the re-encode is untouched.

Not a regression — sharp 0.35.3 has been in the lockfile since the social-v2
commit, so every sharp-linked action has been failing in production the whole
time. Onboarding is simply where a new beta user meets it head-on.

6 new tests (186 total), including a guard that reads both action files and
fails if a module-scope `from "sharp"` import ever comes back.

### · Loading skeletons rebuilt in the editorial language
The last screen still drawing shadcn cards onto the redesigned tabs. The nine
`loading.tsx` files that don't use `PrograLoader` (the root route, `/history`,
`/i/{username}` and `/recap/{weekStart}` do) all went through one
`PageSkeleton` that rendered a 3xl title over a stack of grey boxes — so Clock, Feed, Friends and You each flashed a card layout and then
re-laid out into flat hairline-split rows. The first paint contradicted the
screen it was announcing.

`PageSkeleton` now takes a **variant** and mirrors the real screen: same
`pt-7`/`pb-28` frame, same `max-w-md` column, same 20px gutter, same row
heights, so the swap reads as content filling in rather than a second screen.
Five shapes — `feed` (SessionCard's avatar/sub-line/serif title/photo/pill
footer), `friends` (search field + UserRow list), `profile` (identity, three
stats, the track-band splits), `clock` (the clock-in form, then the inset quiet
zone with the week bar and day strip), and `rows`, the generic
divider-split list the remaining screens use.

**Known chrome is drawn, not shimmered.** The search field and the clock-in
inputs render as empty outlines (`Frame`) because they're there before the data
is; only unknown content pulses. The clock CTA's placeholder is a navy tint —
it's the one coloured element on that screen, so the eye lands where the button
will be. The screen title stays real text, which is Next's own guidance for
`loading.js`: prerender the meaningful part rather than blurring everything.

Shimmer fill is `bg-track` — the grey the progress tracks already use, so a
loading screen introduces no colour the design doesn't have — with
`motion-reduce:animate-none`, and `role="status"` + an `sr-only` "Loading {X}…"
on the container.

The `subtitle` and `showDayStrip` props are gone (no caller used the latter);
`rows` replaces `blocks`. Titles now match their destination exactly
("Clock in", "Session history"), so the header doesn't change text on swap.

Note the five list screens this precedes — Goals, Habits, Categories, Sessions,
Recap — have **not** been redesigned yet, so their skeleton is now ahead of the
screen rather than behind it. Deliberate: the mismatch points at the work
that's left instead of preserving the look being removed.

## 2026-08-18

### · Like/comment pushes — the first notifications Progra SENDS — **requires SQL (run by hand, before deploy)**
```sql
alter table public.profiles add column social_pushes_enabled boolean;

create table public.push_log (
  key text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  sent_at timestamptz not null default now()
);
alter table public.push_log enable row level security;
revoke all on table public.push_log from anon, authenticated;
```
`push_log` gets NO policies on purpose — RLS-enabled-with-none makes it
invisible to every client; only the service role touches it. After running,
verify `public_profiles` doesn't expose the new column (it's column-explicit
today): `select pg_get_viewdef('public.public_profiles', true);`

**What it does.** A friend likes or comments on your session → your iPhone
says so ("Maya P. — liked your session \"Math revision\"", "commented on …: …").
Behind `NEXT_PUBLIC_SOCIAL_PUSH`; delivery additionally needs `APNS_TEAM_ID`,
`APNS_KEY_ID`, `APNS_PRIVATE_KEY_B64` (base64 of the .p8 — hosting env UIs
mangle PEM newlines) in the server env, plus optional `APNS_HOST` to point a
dev-signed build at the sandbox host.

**The sender is hand-rolled, zero deps.** APNs requires HTTP/2 (Node's fetch
is HTTP/1.1-only) and an ES256 provider JWT — both are a handful of lines on
node:http2 and node:crypto (`dsaEncoding: "ieee-p1363"`, the raw r||s form;
Apple rejects DER). The JWT mint is pure and signature-verified in tests with
a throwaway P-256 keypair. Sends carry `apns-expiration` +1 day and a 10s
socket timeout so a hung connection can't pin the serverless invocation.

**Fire-and-forget by construction.** The actions call `after()` (next/server →
Vercel waitUntil) — the like/comment response is already sent before the push
work starts, and the orchestrator never throws. It resolves the recipient
itself (the action adds zero pre-response work) via the service-role client:
the recipient's tokens and opt-out are owner-only rows, and the recipient is
precisely not the caller. The authorization proof is that the like/comment
write already succeeded under RLS — checked before any admin read, the
uploadSessionPhoto discipline. This is the SECOND sanctioned service-role use;
lib/supabase/admin.ts's comment now lists both.

**Dedupe = the push_log primary key, claimed before sending.** Likes:
`like:{actor}:{session}` — heart off/on (or 👍 then 🔥) never re-pings, and
since toggle-off deletes the reaction row, the log is the only memory.
Comments: `comment:{commentId}` — a genuine second comment IS news and pushes.
The claim is an ignoreDuplicates upsert, so concurrent toggles race on the
key, not on read-then-write. At-most-once: a failed send burns its slot.

**Dead tokens self-clean.** 410 Unregistered — or the 400/BadDeviceToken a
sandbox token earns at the production host — deletes that device_tokens row;
a live device re-registers on next open. Beta runs App Store builds, so the
production host is the default. Note for dev: an Xcode-signed build's token
will be deleted on its first prod-host push and reappear on next app open —
tokens "disappearing" in dev is this, working.

**Settings → Notifications** gains an account-level "Likes & comments" toggle
(null = on, so all existing rows default on) — account-level because the
server sends these, and servers know accounts, not phones. Tap routing: the
push payload carries `url`, and NotificationTapRouter follows it only if it's
a same-origin path; anything else lands on Home.

Also the first real delivery doubles as the first proof that push
registration ever stored a token — `select * from device_tokens` before
testing; an empty table means the registration path needs on-device debugging
first.

10 new tests (180 total).

### · Daily habit reminder — "You haven't checked off Reading, Meditation today"
The second notification family, behind `NEXT_PUBLIC_HABIT_REMINDERS`. A local
notification at a user-chosen time (default 18:00) on days with unchecked
habits, naming them ("Reading, Meditation and 2 more"), singular/plural aware.

**The scheduling idea.** A local notification must be scheduled before the
moment it describes, but "did they check their habits?" is only knowable while
the app runs. So every sync writes a week: TODAY fires only if something is
unchecked right now (checking the last habit re-syncs and cancels it); days
1–6 are scheduled unconditionally, because a new day starts all-unchecked —
which is also the retention property: someone who stops opening the app keeps
being nudged for seven days, not one. Ids 9201–9207, beside the clock's
9001/9002/9101–9110.

**One engine, two families.** The cancel-then-schedule mechanics moved from
`lib/clock-notifications.ts` into `createReminderSync` (lib/notification-sync.ts),
because the invariants are exactly what must not drift between copies. Two of
them tightened in the move: the fingerprint now covers title+body, not just
`id@at` — checking one of three habits changes only today's body, which the old
fingerprint would have skipped as "unchanged" — and it starts as `null`, not
`""`, so the FIRST sync after a relaunch always cancels (an empty list also
fingerprints to `""`; with notifications deliberately outliving launches, a
session that ended while the app was killed would otherwise keep its stale
nudges — a latent clock bug this fixes too).

**Tap routing** moved to its own leaf (`NotificationTapRouter`), discriminating
by reserved id: habit taps open the dashboard checklist, clock taps (and
anything unrecognised) still open /clock/live. Inside SyncClockReminders it
would have routed habit taps to the live timer — and died entirely with
CLOCK_REMINDERS off.

**The pref is per-device** (`progra.habit-reminder` in localStorage), like the
clock's, but standing rather than session-scoped: `{off?, time?}`, absent keys
meaning the default — ON at 18:00. That default is the product decision: beta
users who granted permission before this feature existed start getting it with
no trip to Settings, and Settings → Notifications (a toggle plus a time input,
shown once granted) is the way out. Onboarding asks on the habit step itself —
an inline "Remind me at [18:00]" row, shell + granted only — rather than a new
step, because the steps array changing length mid-flow is what the `native`
gate exists to avoid. The notify step's promise list gained the daily reminder
line, above a still-true "Nothing else".

**"Unchecked today" is computed server-side** in the profile timezone and rides
into the root layout leaf as flat "\n"-joined strings; fire instants are built
from device-local Date parts (DST-safe, month rollover via the Date
constructor). A `statusDate` guard covers the seam: if the server's list
describes some other day than the device's today — a stale payload straddling
midnight — day 0 falls back to all-active, the truth a new day starts with.
`revalidateHabitSurfaces()` now revalidates the layout (a strict superset of
its old page list), because page-type revalidation never re-renders the root
layout — so every toggle/create/archive/rename path re-syncs the device through
the one leaf, wired or not.

22 new tests (170 total). Enable with `NEXT_PUBLIC_HABIT_REMINDERS=1` in
production.

## 2026-08-16

### · Notifications: ask once, ask well — and let people turn them off
Clock reminders started working earlier today. This is the work that makes them
reachable.

**The bug underneath.** iOS grants notification permission ONCE, EVER, shared
between local notifications and push, and `denied` is terminal. The app was
spending that one-shot dialog from code the user never triggered:
`canScheduleReminders()` called `requestPermissions()` itself whenever the state
was `prompt`, and it ran from the root-layout sync leaf (any app open with an
active session) and from the live timer's mount effect. Anyone who declined that
context-free prompt had permanently lost the reminders — with no screen anywhere
in the app that explained it or offered a way back.

Now the read and the ask are separate. `checkNotificationPermission()` is pure
and gates scheduling; `requestNotificationPermission()` prompts and has exactly
three legal callers, all real gestures: the onboarding step, the Settings row,
and the live-timer band. No lint rule can enforce that — the mechanism is a
comment at the definition and a grep at review time.

**Where it asks now.** A new onboarding step straight after the practice
clock-in, which is what makes the point — they have just watched a session run
away on fast-forward. It lists what arrives (an hourly nudge, a timed-session
alert) and what doesn't (nothing else), advances on any answer, and is skippable;
skipping leaves the dialog unspent for later. Three states, because a replayed
onboarding or an already-answered device must not hit a button that silently
does nothing: `prompt` asks, `granted` confirms, `denied` routes to iOS Settings.

**Settings → Notifications** is the same three states as a row, and the only
place `denied` can be recovered from. Opening iOS Settings navigates the webview
to `app-settings:` — NOT `App.openUrl()`, which does not exist in
`@capacitor/app` v8.

**Reminders every 1h** — a switch on the live timer for the session you don't
want nudged through. Per-device localStorage, matching the mute control beside
it, since notifications are scheduled on the device. The stored value is *the
session id reminders are off for*, not a boolean, which makes the reset free: a
new session has a new id, and the default is back to on with no expiry logic and
no clock-out hook to forget. Open-ended sessions only — a timed session's
"Time's up" alert is the reason you set a duration.

**The 10-hour cap now says something.** Hourly nudges stop an hour short, so a
session that auto-ended did it in silence while up to ten hours vanished from the
weekly total. New reminder on its own id, for timed sessions too — `EnsurePlanComplete`
only finishes those while a client is open, so one left running overnight reaches
the cap exactly like an open-ended one.

Also: `push-registration.tsx` no longer prompts, and no longer uses the
`await import()` that never settles on device — which is the leading explanation
for why push registration has never once succeeded. It registers only when
permission is already granted.

11 new tests (148 total). `NEXT_PUBLIC_CLOCK_REMINDERS` must be `1`, not `fast`,
in production.

### · Clock reminders actually fire — read the plugin off the Capacitor global
Hourly nudges on an open-ended session and the "Time's up" alert on a timed one
were written on 2026-08-08 and had never once worked. `syncClockReminders`
computed the right 9 reminders on every run and then parked before writing any
of them, so `getPending()` stayed at 0 with no error anywhere.

The stall was `await import("@capacitor/local-notifications")` inside
`plugin()` — on device that promise never settles. A static import didn't fix
it either: it still timed out, which is impossible for a synchronous body in an
async wrapper, so the built artifact is doing something we never explained.
**Root cause remains unknown.**

What's proven is the other path. From the Safari inspector on the device,
`window.Capacitor.Plugins.LocalNotifications` reports `display=granted`, accepts
a schedule and delivers the banner. Capacitor registers plugins on that global
at bridge startup, so there's no module resolution and no chunk fetch that can
be left pending. `plugin()` now reads it there, and is **synchronous** — the
promise-returning signature is precisely what let the stall hide as a pending
await across three rounds of debugging. Exported as `notificationsPlugin` so the
tap listener in `sync-clock-reminders.tsx`, which had the identical import and
would have failed the same way, shares it rather than growing its own.

**Do not import a Capacitor plugin in this app.** Use a sync accessor off the
global, returning null when `isNativePlatform()` is false so web and SSR are
unaffected. `push-registration.tsx` still dynamically imports
`@capacitor/push-notifications`, and that is now a live candidate explanation
for why push registration has never once succeeded.

Also removed the temporary on-screen diagnostic (visible to beta users on the
live timer since 2026-08-08) and the `[push]` console logging. The fingerprint
guard stays — it's load-bearing, not an optimisation: the sync cancels its whole
id range before scheduling, so without it each re-render destroyed the previous
run's notifications before they could fire.

Reserved ids are `9001` (duration end) and `9102–9110` (hours 1–9).
`HOURLY_ID_BASE` is 9101 and hours start at 1, so 9101 itself is never used;
schedule and cancel both derive from `hourlyReminderId()`, so they agree.

## 2026-08-15

### · Goals get a real color — **requires SQL (run by hand, before deploy)**
```sql
alter table public.goals add column color text;
```
Nullable, no default, no RLS change — the existing row policies already cover
it. Every goal created before this stays `null`.

Goal color was derived from the goal id (`goalColor`), which was stable and
consistent but not *yours*. Now it's a stored pick from the same nine-swatch
palette categories and habits use, editable in the goals sheet and chosen
during onboarding. `goalColorOf()` resolves stored-or-derived in one place, so
a `null` color still renders the same hue everywhere it used to — nothing
looks different until someone picks.

Server-side the value is validated against `isCategoryColor` on both create and
update, so a freehand hex is rejected rather than stored, and `null` clears the
pick back to the derived hue.

Plumbing: `hydrateGoalTitles` became `hydrateGoals` (it now returns
`{title, color}`), which is what carries the color into feed attribution — so a
goal-tracked session's duration pill is finally the goal's color instead of
grey — plus the leaderboard breakdown, session detail, profile sessions and
notification activity. `RecapGoalRow`, `GoalRow` and `LeaderboardGoal` each
carry it too.

**If the SQL hasn't run, every goal read fails and goals disappear app-wide** —
the select names a column that isn't there. Run it first.

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
