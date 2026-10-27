repo: iroybisw47/progra
branch: main

## Last sync
date: 2026-10-21T03:37:14Z

### Updated in this project
- Recreated 12 screens in one canvas and gave them a dark theme (Progra Dark Mode.dc.html)
- Dark tokens derived from app/globals.css; palette lifts computed from lib/palette.ts
- New Settings → Display → Appearance row and its System / Light / Dark sheet

## Screen map
| Screen | Repo files |
|---|---|
| 01 Progress · Today | components/v2/progress-client.tsx, components/v2/donut.tsx, components/v2/period-chips.tsx, components/v2/section-header.tsx, components/v2/goal-quota-rows.tsx, components/bottom-nav.tsx, app/layout.tsx, app/globals.css |
| 02 Progress · Week | components/v2/progress-client.tsx, components/v2/habit-week-grid.tsx, lib/db/progress.ts |
| 03 Feed | components/v2/feed-v2.tsx, components/clocked-in-strip.tsx, components/v2/session-card.tsx, components/v2/recap-feed-card.tsx, components/avatar-initials.tsx, components/kudos-button.tsx, components/v2/recap-kudos-button.tsx, components/v2/recap-comments.tsx |
| 04 Clock · pick a goal | app/clock/clock-client.tsx, components/category-picker.tsx, components/goal-picker.tsx |
| 05 Clock · running timer | app/clock/live/live-timer-client.tsx |
| 06 Friends | app/friends/friends-client.tsx, components/v2/friends-leaderboard.tsx, components/notifications-bell.tsx |
| 07 You | app/me/page.tsx, app/me/goals-section.tsx, app/me/habits-section.tsx |
| 08 Settings | app/settings/settings-client.tsx, components/v2/back-button.tsx, components/v2/toggle-switch.tsx |
| 09 Appearance sheet (new) | components/v2/bottom-sheet.tsx, app/settings/settings-client.tsx |
| 10 Edit goal sheet | components/v2/manage-goals.tsx, components/color-swatches.tsx, components/v2/primary-button.tsx |
| 11 Session detail | app/session/[id]/session-view.tsx, components/v2/comment-row.tsx, components/comment-composer.tsx |
| 12 Weekly recap | components/recap-story/slide-frame.tsx, components/recap-story/story-header.tsx, components/recap-story/hours-slide.tsx, components/recap-story/recap-story-v2.tsx |
