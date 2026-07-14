# Changelog

A running log of changes, grouped by date (newest first). Section headings are
prefixed with the commit time (local, `HH:MM`) the work landed — a proxy for
when it was done, not a start/stop work timer.

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
