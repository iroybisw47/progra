# Progra — Functional Description & User Flows

A purely functional specification of what Progra does and the flows a user moves
through. No interface, layout, or styling is prescribed — only behavior, data,
rules, and steps.

---

## 1. Product summary

Progra is a mobile web app for tracking how a person spends their time, measuring
that time against goals they set, and (optionally) doing this socially with
friends. It combines four capabilities:

1. **Time tracking** — start/stop a timer on a task to record real worked time.
2. **Goals** — define weekly targets in hours and track actual time against them.
3. **External time** — import calendar events and categorize all time (tracked +
   imported) so it can be summarized by category and by goal.
4. **Review** — see totals across a week, month, and year, plus a per-week summary.

Layered on top is an optional **social system**: a friend graph, a shared activity
surface of friends' completed and in-progress work, lightweight interactions,
optional photos attached to a work session, per-item privacy, reporting/moderation,
and account deletion.

---

## 2. Core objects

- **Account** — one per user, created on first sign-in. Holds identity, a timezone,
  and connection state to an external calendar.
- **Session** — one tracked block of work: a start time, an end time, and any paused
  duration. Optionally attributed to a **goal** or a **category**. Optionally carries
  a "before" and an "after" photo. Can be marked private.
- **Goal** — a title and a weekly hour target (quota). Can be marked private.
- **Category** — a label with an optional color and optional keyword rules used to
  auto-classify imported events. Can be marked private (via items assigned to it).
- **Habit** — a recurring daily practice, tracked as done/not-done per day. Can be
  marked private.
- **Calendar event** — an item imported from the user's external calendar, with a
  start/end time and a resolved category.
- **Friendship** — a relationship between two accounts: pending, accepted, or blocked.
- **Comment** — free text attached to a session.
- **Reaction** — one of a fixed set of emoji attached to a session.
- **Report** — a flag raised by a user against a session, comment, or profile, with a
  reason and optional note, for moderator review.

---

## 3. Flows

### 3.1 Sign up / sign in
1. User authenticates with a Google account.
2. On first sign-in, an account is created and the user enters onboarding.
3. On return sign-ins, the user goes to the main experience.

### 3.2 Onboarding (first run only)
1. Explain what the app does.
2. Prompt the user to create their first **goal**: a title and a weekly hour target.
3. Prompt a practice **time-tracking** run: start a timer, let it run, stop it — the
   resulting session appears in the user's totals.
4. Explain categories and how time is summarized.
5. Introduce the ongoing surfaces (progress review, habits).
6. Complete onboarding; the user enters the main experience. Onboarding can be
   replayed later from account settings.

### 3.3 Track time (the central loop)
1. User starts a timer on a task, choosing to attribute it to either a **goal** or a
   **category** (mutually exclusive), or neither.
2. While running, the elapsed worked time is shown live. The user can **pause** and
   **resume**; paused time is excluded from worked time.
3. Only **one active session per user** is allowed at a time.
4. User stops the timer; the session is finalized with its total worked time and
   attributed accordingly.
5. Worked time = (end − start) − paused time.

### 3.4 Manage goals
1. User creates a goal (title + weekly hour quota); can edit the quota or title later.
2. For the current week, each goal shows actual tracked time vs. its quota.
3. Time attributed to a goal during tracking accrues toward that goal's weekly total.
4. A goal can be marked private (excluded from what others can see).

### 3.5 Categories & classification
1. User creates categories (label + optional color) and optional keyword rules.
2. Tracked sessions can be attributed to a category directly.
3. Imported calendar events are auto-classified into a category by keyword rules; the
   user can override an event's category manually, or exclude an event entirely.
4. Classification precedence: manual override > keyword rule > automatic suggestion.
5. All time (tracked sessions + imported events) is summarized per category.

### 3.6 Habits
1. User defines habits (recurring daily practices).
2. Each day, the user marks a habit done or not done for that day.
3. Day boundaries are evaluated in the user's timezone.
4. Habit history/streaks are viewable per week.

### 3.7 Connect a calendar
1. User connects an external (Google) calendar via authorization.
2. The app imports events over a rolling window (roughly the past year through the
   near future) on demand.
3. Imported events are classified (§3.5) and included in all time summaries.
4. Re-syncing updates the imported set; excluded events stay hidden.

### 3.8 Review progress
1. **This week:** total time and a breakdown by category and by goal for the current
   week (in the user's timezone).
2. **History:** rollups by month and year on a category axis; each category expands to
   the individual sessions and events composing it, each removable.
3. **Weekly summary:** a per-week recap of total time, category breakdown, and
   goal-quota attainment, shareable as text.
4. A single instant (a session's end, an event's start) determines which week/month/
   year it counts in — never double-counted across periods.

### 3.9 Browse and edit past sessions
1. User views a paginated list of past sessions and imported events, newest first.
2. A past session can be edited (e.g., re-attributed between a goal and a category) or
   deleted; an imported event can be excluded.

---

## 4. Social flows (optional layer)

### 4.1 Public identity
1. User sets a unique username, a display name, and a short bio.
2. Other signed-in users can view a user's public profile by username.

### 4.2 Friends
1. User searches for others by username.
2. User sends a friend request; the recipient accepts or declines.
3. Either party can remove the friendship. Either party can **block** the other.
4. A block hides each user from the other and is invisible to the blocked party.

### 4.3 Activity surface
1. The primary social surface shows friends' **recently completed** sessions:
   who, the task/goal label, and the worked duration.
2. It also shows friends who are **currently tracking** a session (live presence):
   who, their current task/goal label, and their running duration.
3. Visibility is governed by friendship and per-item privacy: a user only sees a
   friend's non-private sessions.

### 4.4 Interactions
1. On a visible session, a user can leave **comments** (free text) and add **reactions**
   (from a fixed emoji set; toggling a reaction on/off).
2. A comment can be deleted by its author or by the session's owner.
3. Comments and reactions are only visible on sessions the viewer is allowed to see.

### 4.5 Session photos
1. When tracking, a user may optionally attach a **before** photo at start and an
   **after** photo at end. Both steps are skippable.
2. A completed session is shared on the user's profile **only if it has both a before
   and an after photo** ("complete pair"); sessions without both stay private.
3. Photos never appear on the live activity surface — only on profiles as complete
   pairs, and only to viewers allowed to see that session.
4. Photo access is restricted to the owner, permitted friends of non-private complete
   pairs, and moderators.

### 4.6 Viewing a profile
1. A user's profile shows their identity, and — for permitted viewers (self or friend)
   — their non-private goal progress for the week, habit activity, and their shared
   photo sessions.
2. Non-friends see identity only, with an option to send a friend request.

### 4.7 Privacy controls
1. Any goal, habit, or session can be marked **private**.
2. Private items are excluded from all friend-visible surfaces (activity, profile,
   interactions).
3. New items default to shareable; the user can make any item private.

---

## 5. Safety & account flows

### 5.1 Reporting
1. On another user's session, comment, or profile, a user can submit a **report**:
   choose a reason from a fixed set and optionally add a note.
2. Reports are write-only for users — a reporter cannot read reports.

### 5.2 Moderation (moderator only)
1. A moderator has a private queue of open reports, each showing the reporter, the
   reason/note, and a preview of the reported content (comment text, or a session's
   photos).
2. For each report the moderator can:
   - **Take down** a session's photos (removes them from all profiles),
   - **Delete** a reported comment,
   - **Dismiss** or mark the report resolved.
3. Resolved reports leave the open queue.

### 5.3 Account deletion
1. From account settings, a user can permanently delete their account, confirming the
   destructive action explicitly.
2. Deletion removes all of the user's data (sessions, goals, categories, habits,
   calendar data, friendships, comments, reactions, reports, photos, profile) and the
   login itself.
3. The user is signed out; a subsequent sign-in with the same identity starts a fresh
   account at onboarding. Other users' data is unaffected (the deleted user disappears
   from their friends lists).

---

## 6. Rules & constraints (functional)

- One active (unstopped) session per user at any time.
- Worked time excludes paused duration.
- Week/month/year boundaries and "today" are computed in the user's timezone;
  weeks start Monday.
- Goal quotas are weekly (hours).
- Time is summarized by category and by goal; tracked sessions and imported events are
  both counted (an event overlapping a session counts in both).
- Visibility rule for all social reads: a viewer sees an item if they own it, or they
  are accepted friends with the owner and the item is not private.
- A session appears as a shareable "story" on a profile only when it has both a before
  and after photo.
- Reporting is available only on other users' content; moderation actions are
  restricted to a moderator; account deletion affects only the requesting user.
