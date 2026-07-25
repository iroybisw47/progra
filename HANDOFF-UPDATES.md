# Progra — Handoff: updates 2026-07-24 → 07-25

> Supplements `HANDOFF.md` (the durable project brief, last full update 2026-07-23).
> This captures what shipped in the 07-24/07-25 wave so a fresh Claude session can
> catch up fast. Full per-change detail is in `CHANGELOG.md` (newest first). When
> code and this doc disagree, the code wins — fix the doc the same session.
> All shipped to `main` (`iroybisw47/progra`), behind the usual `REDESIGN` /
> `SOCIAL_ENABLED` flags. Repo: `C:\Users\iroyb\Progra\progra`.

## ⚠️ Manual SQL run this wave (schema is NOT in the repo — user runs it by hand)
These columns/indexes now exist in Supabase and back the features below. If a fresh
DB is ever set up, re-run them:
```sql
-- Nav notification dots (Feed/Friends tabs) + likes/comments panel "seen" stamps
alter table public.profiles
  add column if not exists feed_seen_at timestamptz,
  add column if not exists friend_requests_seen_at timestamptz,
  add column if not exists notifications_seen_at timestamptz;

-- Reactions had no timestamp; needed to order likes + compute "new since seen"
alter table public.session_reactions
  add column if not exists created_at timestamptz not null default now();

-- Baseline existing users so the first Notifications open isn't a history dump
update public.profiles set notifications_seen_at = now() where notifications_seen_at is null;

-- Supporting indexes for the owner-side notification reads
create index if not exists session_reactions_session_created_idx
  on public.session_reactions (session_id, created_at desc);
create index if not exists session_comments_session_created_idx
  on public.session_comments (session_id, created_at desc);
```

## Features shipped

### Social — notifications
- **Nav notification dots** on the Feed + Friends bottom-nav tabs. Feed dot = a
  friend finished a session or joined; Friends dot = a new incoming friend request
  **OR** an unseen like/comment. Computed server-side (`lib/db/notifications.ts`
  `getNavBadges`), seeded from the layout, kept live by a ~90s poll +
  `visibilitychange` in `components/bottom-nav.tsx`. Cleared via `markFeedSeen` /
  `markFriendsSeen` (`app/actions/notifications.ts`) against the profile `*_seen_at`
  columns. Feed/friend-request halves clear on visiting the tab.
- **Likes & comments notifications** (3 phases): a bell at the top-right of the
  Friends header opens a **slide-over panel** listing who 👍-liked (collapsed per
  post, Instagram-style) or commented on **your own** sessions.
  - Read layer: `lib/db/notifications-activity.ts` — `listMyNotifications()`
    (aggregated, RLS-scoped to your sessions, 👍-only, 30-day window),
    `hasUnseenNotifications()` (cheap dot check).
  - UI: `components/notifications-bell.tsx` + new `components/ui/sheet.tsx` (a
    right-edge slide-over over the app's Base UI dialog primitive).
  - Actions: `fetchMyNotifications`, `markNotificationsSeen` (stamps
    `profiles.notifications_seen_at`; dot clears **only** on opening the panel).
  - The Friends **nav** dot ORs in `hasUnseenNotifications()`.
- **iOS fix**: the notifications Sheet is `position:fixed`, so it ignored the app's
  global `body` safe-area padding — its title + X drew under the notch. Added
  `pt/pb-[env(safe-area-inset-*)]` and offset the close button. Also made the panel
  full-width on phones (`max-w-full sm:max-w-sm`).
- **Feed card footer**: comment (speech-bubble) control moved to the **left** of
  the like heart (`components/v2/feed-v2.tsx`).

### Progress tab
- **"Sessions today" widget**: rows are chronological (earliest→latest, so the live
  session sits at the bottom), goal-tracked rows read **"Goal: {name}"**, and both
  sessions + imported events show a **start–end AM/PM range**. New `formatTime12`
  in `lib/dates.ts` (kept separate from `formatTime`, which still feeds the 24h
  `<input type="time">` in the session dialog).
- **Unified category donut** — `components/v2/category-donut.tsx` (`CategoryDonut`):
  a centered donut (period total in the middle) + each category as a row with a
  **colored bar sized to its share of the total** (hours + %). Used on **Today**,
  **This week**, and **all /history views**. Retired the old text `Legend` component
  and `WeekSummary`'s `heroDonut` prop.

### History (big revamp)
- Progress **History** sub-tab is now **3 buttons** — Past weeks / Past months /
  Past year — each opening a **focused** single-period view on `/history`.
- `/history?view=…` focused views: **no page header, no week/month/year switch** —
  just a **"Back to history"** link (returns via `/?tab=history`;
  `ProgressClient` gained an `initialTab` prop, and `app/page.tsx` reads `?tab`),
  the Previous/Next scrubber, and that period's donut.
- **Month & year** now render the same `CategoryDonut` as the week (from the
  rollup's `categoryRows` / `totalTrackedMs`), replacing the old big-number + bars
  analytical card.
- **Category drill-down restored on every view**: tap a category (under the donut)
  to expand its individual sessions/events (title · source · date · hours). Wired
  through `CategoryDonut`'s optional `items` map. Month/year reuse
  `rollup.categoryItems`; the **week** now carries `categoryItems` too — added to
  `computeWeekRecap` (`lib/db/recap.ts`) via `buildCategoryItems`. **View-only** —
  the old per-item delete/exclude flow was NOT restored.
- `app/history/loading.tsx` now shows the branded `PrograLoader` (not the stale
  "History / Where your time went" skeleton).

### Docs
- `docs/SCREENS.md` — ground-truth screen inventory (routes, states, dialogs,
  per-tab mermaid flowcharts, orphan analysis). Derived from the tree, not from the
  (stale) ARCHITECTURE.md.

## New / notably-changed files
- `components/v2/category-donut.tsx` (new) — the shared donut+bars+drill-down.
- `components/notifications-bell.tsx`, `components/ui/sheet.tsx` (new).
- `lib/db/notifications.ts`, `lib/db/notifications-activity.ts`,
  `app/actions/notifications.ts` (nav dots + likes/comments).
- `lib/db/progress.ts` (dropped the per-load month rollup; the History tab is now
  just links, so `monthLabel/monthTotalMs/monthSegs` were removed from `ProgressData`).
- `lib/db/recap.ts` (`WeekRecap` gained `sessionCount`, `importedCount`,
  `categoryItems`), `app/history/history-client.tsx`, `app/history/page.tsx`.
- `lib/dates.ts` (`formatTime12`), `components/v2/week-summary.tsx` (now delegates
  to `CategoryDonut`; `heroDonut`/`Legend` gone).

## Open threads / known state (read before touching related code)
- **Invite links / referrals (PR 1 — code landed, SQL PENDING).** New public route
  `/i/[username]` + `?ref=` through OAuth + `/auth/callback` calling `claim_invite`.
  Requires hand-run SQL not yet applied: `profiles.referred_by uuid`, an anon SELECT
  grant on `public_profiles`, and the `claim_invite` SECURITY DEFINER RPC (see
  `.claude/plans/invite-links-referrals.md`). ⚠️ **`profiles.referred_by` is
  `ON DELETE SET NULL`, a DELIBERATE exception to the "every FK to auth.users
  CASCADEs" rule** — cascade would delete invitees' profiles when a referrer deletes
  their account. Do NOT "fix" it to cascade. PR 2 (onboarding invite step, empty-feed
  reuse, suggested-friends extraction) is not started.
- **Calendar Sync + Auto-categorize live ONLY on the `/history` month/year donut
  view** (`SyncCalendarButton` / `CategorizePeriodButton` in `history-client.tsx`).
  `HomeActions` (sync+categorize cards) renders only in the legacy `Dashboard`
  (non-REDESIGN), and `CategorizeEventsButton` is orphaned. There is a **planned but
  UNSTARTED** task to give Sync a home on the Progress tab and/or fold sync +
  auto-categorize into one action — user greenlit exploring it, then paused. If you
  remove the /history calendar actions, you orphan Sync entirely.
- `/search` is orphaned under REDESIGN (only a beta-nav tab; nothing links to it).
- History category drill-down is **view-only** by design this wave (no delete).
- Conventions unchanged from `HANDOFF.md` §3/§6 (auth via `getCurrentUser`/local
  `getClaims`; mutations in `app/actions/*` with `lib/revalidate.ts`; reads in
  `lib/db/*` with `cache()`; RLS is the security authority). New reads/actions this
  wave follow them.
