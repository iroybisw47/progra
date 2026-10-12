# Handoff: Progra Weekly Recap — story redesign

## Overview
A redesign of the Sunday recap story (`app/recap/[weekStart]/recap-story.tsx` in `iroybisw47/progra`, branch `main`). It is a full-screen, tap-through story with eight slides:

**Loading → Hours tracked → Where it went → Weekly goals → Habits → Friends → Your rank → Closing**

It opens on the brand, moves through effort, goals and habits, shows the social side, and ends with a push into the next week. Each slide has one job and one takeaway.

- "Where it went" and "Your rank" are carried over from today's story (restyled).
- "Your rank" is dropped from the sequence when the user has fewer than 3 active friends (Friends shows an invite prompt instead).
- Today's "Post to feed" / "Share this week" panel is intentionally **not** part of the new flow.
- An "Insight" slide was designed and then cut. Don't build it.

## About the design files
The files in this bundle are **design references built in HTML**: prototypes showing the intended look, copy and behaviour, not production code to copy. The task is to **recreate them in the Progra codebase** (Next.js + React + Tailwind, wrapped by Capacitor for iOS) using its existing components, tokens and patterns: `components/v2/*`, `app/globals.css`, `lib/palette.ts`, `lib/colors.ts`, `lib/duration.ts`, `lib/db/recap.ts`.

**Viewing:** serve this folder over HTTP (e.g. `npx serve .`) and open `Weekly Recap.dc.html`. Opening via `file://` may fail because pages fetch sibling files. The top of the page is a clickable phone prototype; below it is a board of every slide and data state (final frames).

**Reading a `.dc.html` file:** the markup between `<x-dc>` tags is the template. Inline styles carry every value. `{{ name }}` holes are filled by `renderVals()` in the `<script type="text/x-dc">` class at the bottom of the file. `<sc-if>` is a conditional and `<sc-for>` a loop. `<x-import component-from-global-scope="Progra.AvatarInitials">` mounts the real Progra component of that name, and `<dc-import name="RecapSlide">` mounts `RecapSlide.dc.html`. `var(--ink)` etc. are the app's own CSS tokens.

## Fidelity
**High fidelity.** Colors, type, spacing, copy and motion are final; recreate them exactly. All data (names, hours, habits, quote) is sample data.

---

## Global layout

- **Artboard:** 402 × 874 (iPhone 16 Pro). Everything is fluid horizontally except the habit grid's fixed 26 px cells; layouts hold at the DS's 390 px mock width.
- **Top inset:** slide content starts 99 px from the top = 59 px safe area + 28 px header row + 12 px gap. Implement as `calc(env(safe-area-inset-top) + 40px)`.
- **Bottom padding:** 44 px (34 px home indicator + 10 px).
- **Side gutter:** 24 px (Closing: 28 px). On Your rank, list rows run edge to edge with 24 px inner padding.
- **Ground:** `#ffffff` on slides 1–6; `--brand-deep` `#142c49` on Loading and Closing. Progra has no dark mode; deep navy is the existing dark surface (share card, Live Activity).
- **Story surface:** `user-select: none`, suppress the long-press context menu, `touch-action: manipulation`.
- **Fonts:** serif = `--font-newsreader` (Newsreader), sans = `--font-hanken` (Hanken Grotesk). All numbers use `font-variant-numeric: tabular-nums`.

### Header (every slide except Loading)
- Absolutely positioned at the top, z-index 20, `padding: <safe-area> 6px 0 16px`, flex row, `gap: 8px`, items centered.
- **Progress pips:** a flex:1 row with `gap: 6px`. There is one pip per slide after Loading: 7 in the full sequence, 6 when Your rank is skipped.
  - Each pip is 4 px tall with full radius. Track `--track` `#f1f3f5`; fill `--brand` `#1c3a5e`.
  - On Closing: track `rgba(255,255,255,.2)`, fill `#ffffff`.
  - Pips up to and including the current slide are 100% filled; later ones are 0%. Width transitions `.3s ease`. No timer fill, because nothing auto-advances.
- **Close button:** 44 × 28 hit area with a 20 px lucide `x` icon (stroke 2).
  - Color `--caption` `#8b929c` (Closing: `rgba(255,255,255,.65)`). `aria-label="Close recap"`.
  - Its pointer events must not reach the story's tap handler (`stopPropagation`).
- On Closing, the header fades in (opacity 0 → 1, `.35s ease`, `.55s` delay) after the navy flood.

### Slide title block (slides 1–6)
The recap story is the DS's documented exception to "no big headlines".
- Column, `gap: 6px`.
- **Title:** Newsreader 500, 36 px, line-height 1.04, letter-spacing −0.022em, `--ink` `#12171d`.
- **Subline:** Hanken 13 px, line-height 1.3, `--caption` `#8b929c`, nowrap.
- **Entrance:** `rise` .5s `cubic-bezier(.22,1,.36,1)`, delay .05s.

---

## Screens

### 00 · Loading
- Full-screen `--brand-deep`. Centered column, `gap: 24px`, `padding-bottom: 20px` (optical centering). No header.
- **Logo:** the new app icon `assets/progra-logo.png`, 112 × 112, radius 25 px, overflow hidden. Two stacked copies:
  1. **Ghost:** opacity .2, `grayscale(1)`. At 1.6s it animates to opacity 1 with no filter (.2s ease).
  2. **Fill:** full color, revealed by `mask-image: conic-gradient(#000 var(--rc-sweep), transparent 0)`. `--rc-sweep` animates 0 → 360deg over 1.5s `cubic-bezier(.65,0,.35,1)`, delay .15s. The clock face fills clockwise from 12 o'clock.
     - Animating the angle requires `@property --rc-sweep { syntax: '<angle>'; inherits: false; initial-value: 0deg; }` (WKWebView iOS 16.4+).
     - Without it the reveal just snaps mid-way; the ghost still resolves at 1.6s.
  - **Container:** `scale` .5s `cubic-bezier(.22,1,.36,1)`, then `settle` (scale 1 → 1.05 → 1) .45s ease-in-out at 1.65s.
- **Date line:** "Week of Oct 5". Hanken 500, 13 px, letter-spacing .01em, `rgba(255,255,255,.62)`, nowrap. `rise` .45s at .35s.
- **Advance:** automatically to Hours after **2050 ms**, the only auto-advance in the story. Any tap advances immediately.

**Loading → Hours transition.** Hours mounts beneath a navy "curtain", a copy of the loading screen with the full-color logo and date line. The curtain slides up `translateY(0 → -100%)` over .8s `cubic-bezier(.76,0,.24,1)`, delay .05s, with `pointer-events: none`. It only plays when arriving from Loading, not when navigating back to Hours.

### 01 · Hours tracked
- Title **"Hours tracked"**. Subline "Week of Oct 5 – 11" (en dash with spaces; across months, "Week of Sep 28 – Oct 4").
- **Center block:** flex:1, justify center, `gap: 26px`, `padding-bottom: 36px`.
- **Number row:** baseline-aligned, `gap: 10px`. `scale` .6s at .25s, `transform-origin: left bottom`.
  - **Number:** Newsreader 500, **148 px**, line-height .85, letter-spacing −0.045em, `--ink`. One decimal ("11.5").
    - Counts up from 0 over 1300 ms (ease-out cubic), 300 ms delay.
    - If the total reaches 100+, step the size down (≈112 px) so it fits.
  - **Unit:** "hrs", Newsreader 500, 40 px, letter-spacing −0.02em, `--secondary-ink` `#5d6672`. `fade` .5s at 1.25s.
- **Comparison line:** Hanken 17 px, line-height 1.4, `--body` `#1b2129`. `rise` .5s at 1.45s. Neutral either way: no red, no arrows.
  - total > weekly average → "Above your weekly average of 8.2 hrs."
  - otherwise → "Your weekly average is 8.2 hrs."

### 02 · Where it went (kept from today's story)
- Title **"Where it went"**. Subline "5 categories" ("{n} categories").
- **Donut:** 180 × 180, r = 80, stroke 20, rotated −90° so it starts at 12 o'clock. Track `--track`.
  - Segments use the category fill colors, butt caps, no gaps, drawn clockwise in order.
  - Each segment's dash animates from 0 over `share × 0.9s` (linear), starting at `0.25s + cumulativeShare × 0.9s`. The ring reads as one continuous 0.9s stroke.
  - Order: by time descending, Uncategorized (`#c3c8ce`) last.
- **Donut center:** "11h 30m" (`lib/duration` format), Hanken 600, 24 px, `--ink`. Above "TRACKED": 8 px, 600, uppercase, letter-spacing .12em, `--disabled` `#c3c8ce`, `gap: 3px`. Fades in .5s at 1.05s.
- **Category rows:** `gap: 10px`; each row is a column with `gap: 4px`.
  - **Top line:** 14 px / 20 px. A 10 px round dot in the category color, `gap: 8px`, then the name (truncate). On the right, "5.0h · 43%" at 12 px / 16 px, `--caption`.
  - **Bar:** 6 px, full radius, track `--track`, fill = category color, width = share % (min 2%).
  - **Motion:** row `rise` .45s at `.75s + i × .08s`. Bar `grow` (scaleX 0 → 1 from the left) .7s `cubic-bezier(.22,1,.36,1)` at row delay + .12s.
- Reuse `CategoryDonut`'s data shape (`{ id, name, color, ms }`) and ordering; the recap version is a custom layout so the motion can be staged.

### 03 · Weekly goals (supports any number of goals)
- Title **"Weekly goals"**. Subline "{cappedHours}h of {totalQuota}h" (e.g. "8.6h of 10h").
- **Overall %** = `Σ min(actual_i, quota_i) / Σ quota_i`. Each goal is capped at its own quota, so one over-achieved goal can't hide a shortfall.
  - Treat the week as **complete only when every goal met its quota**.
  - Otherwise clamp the displayed value to ≤ 99.
- **Ring block:** flex:1, centered column, `gap: 18px`, `padding: 4px 0 14px`.
  - **Ring:** 172 × 172, r = 78, stroke 13, round caps. Track `--track`; progress `--brand` (navy, not a palette color; nothing on this slide is red).
    - Dash animates from 0 over 1.4s `cubic-bezier(.22,1,.36,1)`, delay .3s.
    - When complete, `settle` (.5s ease-in-out) at 1.75s.
  - **Ring center:** the number in Newsreader 500, 54 px, line-height .85, letter-spacing −0.035em, `--ink`. Its "%" is 26 px, `--secondary-ink`. Count-up 1400 ms, 300 ms delay.
  - **Under the number:** "ACROSS 3 GOALS" ("across {n} goals"; "weekly goal" when n = 1). 9 px, 600, uppercase, .12em, `--disabled`. `fade` .4s at .6s.
  - **Message:** Newsreader 500, 21 px, line-height 1.22, letter-spacing −0.015em, `--ink`, centered, max-width 310 px, `text-wrap: balance`. `rise` .5s at 1.25s.
    - complete → "Goals complete. Want to raise them?"
    - 80–99% → "{pct}% done. Great job! Let’s aim for 100 next week."
    - under 80% → "You were {pct}% done with your weekly goals. Let’s try and hit them next week!"
    - single goal → use the singular: "Goal complete. Want to raise it?" / "…with your weekly goal. Let’s try and hit it next week!"
- **Finished-goal callout:** shown when at least one goal reached its quota.
  - **Panel:** radius 25.92 px, background `rgba(38,107,77,.08)` (`--done` at 8%), `padding: 14px 18px`, `margin-bottom: 18px`, `gap: 14px`. `rise` .55s at 1.5s.
  - **Badge:** 36 px circle, `--done` `#266b4d`, white lucide `check` (18 px, stroke 3). `check` pop .4s at 1.8s.
  - **Text:** Newsreader 500, 19 px, line-height 1.25, letter-spacing −0.01em, `--ink`.
  - **Copy:**
    - some goals done → "You did 100% of your {names}, good job!!", names joined "A, B and C". Example: "You did 100% of your Reading, good job!!"
    - all done → "You did 100% of all three goals, good job!!"; for other counts use the number word ("all four goals", "both goals").
- **"BY GOAL" list:** border-top 1px `--hairline` `#eceef1`, `padding-top: 14px`, `gap: 12px`. `rise` .5s at 1.65s.
  - **Eyebrow:** 10 px, 600, uppercase, letter-spacing .14em, `--faint` `#9fa6b0`.
  - **Rows:** `gap: 11px`; each row is a column with `gap: 5px`.
    - **Top line** (`gap: 8px`), in order:
      - 9 px square marker, radius 2, goal fill color.
      - Title: 14 px, 600, `--body`, truncate.
      - **Done pill** (only when actual ≥ quota): "✓ 100%". Full radius, background `rgba(38,107,77,.1)`, text `--done`, `padding: 2px 8px 2px 6px`, 10.5 px, 700, letter-spacing .02em, 11 px check (stroke 3.4), `gap: 3px`. `check` pop at `2.35s + i × .08s`.
      - flex spacer.
      - Actual "5.0h": 14 px, 600, `--ink`.
      - Quota "/ 6h": 12 px, `--caption`, nowrap.
    - **Bar:** 6 px track, fill = goal color, width = `min(100, actual/quota × 100)%` (min 2%). `grow` .8s at `1.75s + i × .08s`.
  - You can extend `GoalQuotaRows` with a done-pill option or build a recap-specific row.

### 04 · Habits (day-by-habit checklist, like Progress → Week)
- Title **"Habits"**. Subline "{n} habits this week".
- **Grid:** rows = every habit; columns = Mon → Sun. Modeled on `HabitWeekGrid` / `app/habits/habits-client.tsx`. The grid sits in a flex:1 centered column with `gap: 26px` before the best-day card.
  - **Header row** (`gap: 4px`, `padding-bottom: 8px`):
    - flex:1 spacer.
    - Seven day letters "M T W T F S S", each 26 px wide, centered. 10 px, 700, letter-spacing .06em, `--disabled`; the best day's letter is `--brand`.
    - "WEEK", 40 px wide, right-aligned, 9 px, 600, uppercase, .12em, `--disabled`.
  - **Habit row:** `padding: 7px 0`, border-top 1px `--divider` `#f4f5f7`, `gap: 4px`.
    - **Name group:** flex:1, `gap: 7px`, `padding-right: 4px`. An 8 px square marker (radius 2, habit fill), then the name at 13 px, 600, `--body`, truncate.
    - **Day cells:** 7 cells, 26 × 26, radius 8, border 1.5 px, `box-sizing: border-box`.
      - Done: background and border = habit fill, white lucide check (13 px, stroke 3.4).
      - Not done: transparent with a `--hairline` border.
    - **Week %:** 40 px wide, right-aligned. Newsreader 500, 19 px, line-height 1, letter-spacing −0.03em, `--ink`; its "%" is 11 px, `--secondary-ink`.
    - Week % = days completed ÷ 7, rounded (6/7 → 86%).
  - **Best-day column highlight:** a rounded rect behind that day's column, 30 px wide, from 8 px above the header to 6 px below the last row. Radius 10, `rgba(28,58,94,.06)`. `fade` .5s at 1.25s. (The prototype positions it absolutely; in code, give the column itself a background.)
  - **Motion:**
    - rows `rise` .45s at `.2s + i × .07s`
    - each cell `check` pop .35s at `.35s + dayIndex × .07s + row × .03s`, a diagonal wave from Monday to Sunday
    - percentages count up over 700 ms at 900 ms
- **Best-day card:** radius 25.92 px, background `rgba(28,58,94,.05)`, `padding: 16px 18px`, `gap: 14px`. `rise` .55s at 1.35s.
  - Every habit done that day: 36 px `--done` circle with a white check. Copy: "Your best day was Wednesday, when you completed every habit."
  - Otherwise: 36 px `--sand` `#d9e2ec` circle with "4/5" (Newsreader 600, 14 px, `--brand-deep`). Copy: "Your best day was Tuesday, with 4 of 5 habits done."
  - Badge `check` pop .4s at 1.65s. Text: Newsreader 500, 18 px, line-height 1.3, letter-spacing −0.01em, `--ink`.
  - Best day = the day with the most habits completed.

### 05 · Friends
- Title **"Friends"**. Subline "8 in your circle" (or "{n} active friends" under 3).
- **Center block:** flex:1, justify center, `gap: 26px`.
- **Group total:** "Your group logged **84** hours together this week." Newsreader 500, 29 px, line-height 1.18, letter-spacing −0.02em, `--ink`. The number counts up over 1100 ms at 350 ms. `rise` .55s at .2s.
- **Like rows:** one block with a bottom border of 1px `--divider`. Each row: `padding: 12px 0`, `gap: 12px`, `AvatarInitials` 40 px (initials 13 px).
  1. **You liked most:** border-top 1px `--hairline`.
     - "You liked Sam’s posts the most": 14 px, 600, line-height 1.25, `--body`.
     - Under it (`gap: 3px`): a filled lucide `heart` (13 px) and "12 likes", 12 px, 500, `--brand`.
     - `slide` (translateX 18px → 0 + fade) .5s at .95s.
  2. **Liked you most:** border-top 1px `--divider`.
     - "Jordan liked your posts the most." in the same style.
     - `slide` .5s at 1.12s.
- **Top-three callout:** shown only when rank ≤ 3 and active friends ≥ 3.
  - **Panel:** radius 25.92 px, `rgba(28,58,94,.05)`, `padding: 14px 18px`, `gap: 14px`. `rise` .5s at 1.45s.
  - **Rank:** "#2", Newsreader 500, 30 px, letter-spacing −0.03em, `--brand`. `check` pop at 1.7s.
  - **Text:** "You were in the top three this week." (14 px, 600, `--body`) over "of 8 in your circle" (11 px, `--faint`).
- **Outside top three:** no callout.
- **Fewer than 3 active friends:** replaces the callout. Your rank is removed from the sequence. Fades up with `rise` .5s at 1.45s.
  - Copy: "Leaderboards start at three active friends — invite one more and you’ll see how your weeks stack up." 13.5 px, line-height 1.45, `--secondary-ink`. Compute "one more" as `3 − n`.
  - Below it, the `InviteShare` component, `gap: 14px`. Its taps must not navigate the story.

### 06 · Your rank (kept from today's story)
- Title **"Your rank"** (24 px side padding). Subline "By clocked time".
- **Hero row:** baseline-aligned, `gap: 10px`, `padding: 18px 24px 16px`.
  - "#2": Newsreader 500, 68 px, line-height .9, letter-spacing −0.035em, `--brand`. `pop` .5s at .25s (origin left bottom).
  - "of 8 in your circle": 14 px, `--caption`. `fade` at .55s.
- **List:** full-bleed rows. Each row: `padding: 9px 24px`, border-top 1px `--divider`, `gap: 10px`. Rows `rise` .45s at `.55s + i × .07s`.
  - **Rank badge:** 22 px circle, Newsreader 600, 12 px.
    - #1: `--brand` with white text.
    - #2–3: `--track` with `--body` text.
    - others: transparent with `--faint` text.
  - **Avatar:** `AvatarInitials` 30 px (initials 11 px).
  - **Name:** 13 px, 600, `--body`, truncate. Under it a subline at 10.5 px, `--faint` ("3 goals this week" / "Tracked outside goals").
  - **Duration:** right-aligned, 56 px wide, 12.5 px, 600, `--ink` ("11h 30m"; whole hours as "18h").
  - **Your row:** background `--tint-you` `rgba(28,58,94,.05)`, label "You".
- Reuse `FriendsLeaderboard` data; this variant is denser.

### 07 · Closing
- Full-screen `--brand-deep`, revealed by a circular flood from bottom-center. `clip-path: circle(0% at 50% 100%)` → `circle(150% at 50% 100%)`, .75s `cubic-bezier(.65,0,.35,1)`.
- `padding: 99px 28px 46px` (top = safe area + 40). The center block is flex:1, justify center, `gap: 40px`, `padding-bottom: 24px`.
- **Headline (h1):** Newsreader 500, 52 px, line-height 1.02, letter-spacing −0.025em.
  - Two lines: "It’s time for a new week." / "Let’s go!"
  - **Color:** the user's top goal (most hours this week) fill, lifted toward white by 45% with `lib/colors.ts` `mixToWhite(fill, 0.45)`, the same lift `entityOnDark` uses. Orange `#E07042` → `#eeb097`. An alternative explored was `--sand` `#d9e2ec`.
  - **Motion:** words rise in one at a time (`word`: translateY 9px → 0 + fade, .55s `cubic-bezier(.22,1,.36,1)`). 75 ms stagger starting at .6s; line 2 starts after an extra 120 ms.
- **Quote:** `figure` with `gap: 12px`. `rise` .6s at 1.45s.
  - Text: Newsreader italic, 21 px, line-height 1.35, `rgba(255,255,255,.86)`: “Well begun is half done.” (placeholder).
  - Attribution: "ARISTOTLE", 10 px, 600, uppercase, .14em, `rgba(255,255,255,.5)`.
- **CTA:** "Start your next session".
  - 52 px tall, full width, radius 15 px, background `#ffffff`, text `--brand-deep` (Hanken 600, 16 px). No shadow. Press: scale .98 (.15s).
  - `rise` .6s at 1.85s.
  - The only interactive element besides the close X. Tapping it closes the recap and opens the **Clock** tab. Its taps must not navigate the story.

---

## Interactions & behaviour
- **Navigation is tap-only.** Nothing advances on a timer except Loading (2050 ms).
  - Tap the right half → next; the left half → previous.
  - On Hours, a left tap stays on Hours (no return to Loading). On Closing, a right tap does nothing.
  - **Swipe:** horizontal movement ≥ 45 px with |dx| > |dy|. Swipe left → next; right → previous.
  - **Keys (web):** ← / →; Esc closes.
  - **Close (X):** exits the recap to Progress.
  - Taps on the X, InviteShare and the CTA must stop propagation so they don't count as story taps.
  - No hold-to-pause (there's nothing to pause).
- **Replay on entry:** every navigation re-mounts the slide so its choreography replays. In React, key the slide by a navigation counter.
- **Status bar:** light content on Loading and Closing, dark elsewhere.
  - It switches to dark ≈700 ms after the Loading → Hours curtain starts.
  - It switches to light ≈380 ms into the Closing flood.
- **Count-ups:** `requestAnimationFrame`, ease-out cubic `1 − (1 − t)³`, from 0 to the target, formatted to fixed decimals each frame.
- **Reduced motion** (`prefers-reduced-motion: reduce`): every animation jumps to its end state, count-ups render final values, and the curtain is skipped.

## Motion reference
| name | definition |
|---|---|
| rise | translateY(14px) + opacity 0 → none |
| fade | opacity 0 → 1 |
| word | translateY(9px) + opacity 0 → none |
| scale | scale(.94) + opacity 0 → none |
| slide | translateX(18px) + opacity 0 → none |
| drop | translateY(−6px) + opacity 0 → none |
| pop | scale .5 → 1.06 (70%) → 1, opacity 0 → 1 |
| check | scale .4 → 1.15 (70%) → 1, opacity 0 → 1 |
| settle | scale 1 → 1.05 → 1 |
| grow | scaleX 0 → 1 (origin left) |
| ring | stroke-dasharray from `0 C` to final |
| curtain | translateY 0 → −100% |
| flood | clip-path circle 0% → 150% at 50% 100% |
| sweep | `--rc-sweep` 0 → 360deg (registered `<angle>`) |

**Easings:**
- `cubic-bezier(.22,1,.36,1)`: default for rises, scales, bars and rings.
- `cubic-bezier(.65,0,.35,1)`: logo sweep and closing flood.
- `cubic-bezier(.76,0,.24,1)`: curtain.

**Rhythm:** title .05s → hero .2–.3s → supporting copy 1.2–1.5s → tertiary 1.6–2.4s. Every slide settles by about 2.5s.

## State & data
**Story state**
- `pos`: index into the active sequence.
- `navKey`: increments on every navigation, used to re-key the slide.
- `fromIntro`: shows the curtain only when going Loading → Hours.
- The sequence is `[Loading, Hours, WhereItWent, Goals, Habits, Friends, YourRank, Closing]`, minus YourRank when active friends < 3.
- Pips = sequence length − 1.

**Data per week.** ★ marks data that isn't in `WeekRecap` today.
- `weekStart` / `weekEnd`: drive "Week of Oct 5" and "Week of Oct 5 – 11".
- `totalMs`; ★ `weeklyAverageMs`, the user's average over prior weeks (define the window, e.g. trailing 8 weeks excluding this one).
- `categories[]`: `{ id, name, color, ms }`.
- `goals[]`: `{ id, title, color, quotaHours, actualMs }`, plus the top goal by `actualMs` for the closing accent.
- ★ `habits[]`: `{ id, name, color, days: boolean[7] }` (Mon → Sun). Derive `bestDayIndex`, `bestDayCount` and `habitCount` from it.
- ★ `groupTotalMs`: you + friends this week.
- ★ `mostLikedByYou`: `{ user, count }`.
- ★ `mostLikedYou`: `{ user }`.
- `activeFriendCount`, `rank`, `circleSize`, and leaderboard rows `{ user, ms, goalCount }`.
- ★ `quote`: `{ text, attribution }`.

## Design tokens (all already in `app/globals.css` / the DS)
**Ink**
- `--ink` `#12171d`
- `--body` `#1b2129`
- `--secondary-ink` `#5d6672`
- `--caption` `#8b929c`
- `--faint` `#9fa6b0`
- `--disabled` `#c3c8ce`

**Surfaces and lines**
- `--track` `#f1f3f5`
- `--hairline` `#eceef1`
- `--divider` `#f4f5f7`
- `--control-border` `#e6e9ed`

**Brand**
- `--brand` `#1c3a5e`
- `--brand-deep` `#142c49`
- `--sand` `#d9e2ec`
- `--tint-you` `rgba(28,58,94,.05)`
- `--done` `#266b4d`
- done wash: `rgba(38,107,77,.08)` (panel) and `.1` (pill)

**Entity palette** (fills, used for data only):
- Maroon `#8E3A44`
- Red `#DE5148`
- Orange `#E07042`
- Gold `#D6A728`
- Light green `#7CBE6D`
- Green `#2E8B50`
- Light blue `#77B7C6`
- Dark blue `#395AA0`
- Purple `#A084B3`
- Dark purple `#6F4E93`
- Pink `#D06DA1`
- Uncategorized `#c3c8ce`

**Radii**
- panels 25.92 px (matches today's recap panels)
- buttons 15 px
- logo 25 px at 112 px
- habit cells 8 px
- markers 2 px
- pips, pills and avatars: full

**Shadows:** none anywhere in the story.

**Type scale**
- 148 (hours)
- 68 (rank hero)
- 54 (goal %)
- 52 (closing)
- 36 (titles)
- 29 (friends sentence)
- 24 (donut center)
- 21 (goal message, quote)
- 19 (callouts, habit %)
- 18 (best day)
- 17 (comparison line)
- 14 / 13 / 12 / 11 / 10 / 9 / 8 (rows, meta, eyebrows)

## Assets
- `assets/progra-logo.png`: the 1024 × 1024 app icon, copied from `ios/App/App/Assets.xcassets/AppIcon.appiconset/Progra_Logos_Round_3_rainbowbg-10_1024x1024.png`. Use the repo's copy.
- **Icons:** lucide `x`, `check`, `heart` (filled). The app already uses lucide-react.
- **Avatars:** `AvatarInitials` (initials on a wash of the user's color, or photo).

## Files in this bundle
- `Weekly Recap.dc.html`: entry point, with the clickable prototype and the board of all 14 frames.
- `RecapSlide.dc.html`: every slide and state.
  - Props: `slide`, `hours` (`above|lighter`), `goal` (`100|86|62`), `bestDay` (`all|partial`), `friends` (`top3|outside|few`), `accent` (`goal|sand`), `still`.
  - Internal slide ids are 0, 1, 2, 3, 4, 6, 7, 8; id 5 was the cut Insight slide.
- `Recap Story (current).dc.html`: a recreation of today's 5-panel story, for comparison.
- `screenshots/`: final frames at 2× (804 × 1748) for all 14 slides and states, named `NN-slide-state.png` (e.g. `03-goals-80-and-up.png`, `05-friends-fewer-than-3.png`). They show settled end states; the motion lives in the prototype.
- `ios-frame.jsx`, `support.js`, `_ds/`: prototype scaffolding (device frame, page runtime, compiled Progra DS bundle). Don't port these; the repo is the source of truth.

**Repo files this replaces or draws on:**
- `app/recap/[weekStart]/recap-story.tsx`
- `app/recap/[weekStart]/page.tsx`
- `lib/db/recap.ts`
- `components/v2/category-donut.tsx`
- `components/v2/goal-quota-rows.tsx`
- `components/v2/habit-week-grid.tsx`
- `components/v2/friends-leaderboard.tsx`
- `components/v2/invite-share.tsx`
- `components/avatar-initials.tsx`
- `lib/colors.ts`
- `lib/palette.ts`
- `lib/duration.ts`

## Open questions (not designed)
- Source and rotation of the weekly quote.
- Definition of the weekly average and of the group total.
- Habits:
  - the denominator for habits scheduled on specific days (prototype: ÷ 7)
  - the tie-break for best day
  - layout with more than about 7 habits
- Goals: layout with more than about 5 goals (the ring area compresses).
- Users with no goals or no habits: skip that slide (suggested).
- No likes given or received this week: hide that row (suggested).
- A quiet week (0 hours tracked).
