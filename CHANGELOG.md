# Changelog

A running log of changes, grouped by date (newest first). Section headings are
prefixed with the commit time (local, `HH:MM`) the work landed — a proxy for
when it was done, not a start/stop work timer.

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
