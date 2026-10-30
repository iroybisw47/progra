# Handoff: Progra onboarding v4 (sign-in + 8-step wizard)

## Overview
A revised first-run flow for Progra (iOS-first, 393×852 reference device). It replaces the current **v3** onboarding (`app/onboarding/onboarding-client-v3.tsx`, behind `ONBOARDING_V3`) with a merged flow:

| # | Screen | Source |
|---|---|---|
| 00 | Sign in: "live feed" landing | **new** (replaces `app/login/page.tsx` layout) |
| 01 | Welcome to Progra | v3, unchanged |
| 02 | Your goal | v3, **new example chips + goal color picker** |
| 03 | Add daily habits | v1/v2 habits step (`onboarding-client-v2.tsx`), replaces v3 habits |
| 04 | How Progra works (4 steps) | **new** (replaces v3 "What Progra is" intro) |
| 05 | Practice clock-in | v1/v2 practice clock-in |
| 06 | Practice post | v1/v2 practice post |
| 06 / 06b | UW question sheet → UW page | v3, unchanged, **moved** here |
| 07 | Find your friends | v3, unchanged (now leads to 08) |
| 08 | Notifications (last step) | **new design** (replaces v3 notify + v3 "Ready?") |

## About the design files
The files in this bundle are **design references built in HTML**: interactive prototypes that show the intended look and behavior. They are **not production code to copy**. Recreate them in the Progra codebase (Next.js + React + Tailwind, `components/v2/*`, `lib/motion.ts`) using its existing components and patterns. Most screens already exist in the repo; the work is mostly re-ordering, porting the v2 practice steps into the v3 shell, and building three new screens (sign-in, How Progra works, notifications) plus the goal color sheet.

To view: open `Onboarding v4 Screens.dc.html` (every screen side by side) or `Onboarding v4.dc.html` (one clickable flow, starting at sign-in) in a browser served from this folder. Keep `support.js`, `_ds/`, `public/` and `ios-frame.jsx` next to the HTML files. In `Onboarding v4.dc.html` the props `start` (login, welcome, goal, habits, how, clock, post, uw-sheet, uw-page, friends, notify), `beat` (1–4 for How) and `variant` (empty / filled / uw / posted) jump to any state.

## Fidelity
**High-fidelity.** Colors, type, spacing, copy and motion are final and use the Progra design-system tokens. Recreate pixel-accurately. All sample people, posts and timers are illustrative data.

---

## Global shell (all wizard screens 01–08)
Unchanged from v3 (`v3/wizard-chrome.tsx`, `v3/onboarding-cta.tsx`, `v3/frame.ts`, `lib/motion.ts`) except where noted.

- Frame 393×852, safe-area top 54 / bottom 34. Column `max-w-[430px]`, `pt-safe`.
- **Top row**: `mt-[10px] h-8 gap-3 px-5`. Back button 32×32, radius 11, 1.5px `--hairline` border, `--caption` chevron-left 15px (stroke 2); hidden on Welcome (opacity 0, scale .6; 260ms/460ms ease-out `cubic-bezier(0.22,1,0.36,1)`). Progress track h3 `--track`, fill `--brand` `scaleX(progress)`, `transition: transform 760ms cubic-bezier(0.22,1,0.36,1)`. Avatar 28 (`AvatarInitials`, 11px initials).
- **Progress**: 8 steps (`of = 8`), `progress = step/8` where step = screen index + 1. **New:** on How Progra works the bar creeps per step: `(3 + (howStep+1)/4) / 8`.
- **CTA**: absolute `inset-x-5 bottom-[42px] h-[52px]`. Primary = `PrimaryButton size="screen"`. Secondary variant = `h-[52px] rounded-[15px] border-[1.5px] border-control-border bg-card text-body text-base font-semibold`. 180ms linear crossfade between the two.
- **New: skip link under the CTA**: absolutely centered at `bottom: 14px`, `text-[12px] font-medium text-caption hover:text-brand`. Used on Habits ("Skip for now"), How steps 1–3 ("Skip") and Notifications ("Not now").
- **Item motion** (`itemStyle` in `lib/motion.ts`): active = opacity 1, none (opacity 420ms / transform 560ms `cubic-bezier(0.22,1,0.36,1)`, delay `140 + 55·i` ms); past = opacity 0, `translateY(-14px)`; ahead = opacity 0, `translateY(18px)` (160ms / 220ms ease-in).
- **Finish**: on the last action, items exit (past), the top row fades (240ms linear), then the whole wizard fades to white (opacity 0 over 320ms linear) before routing into the app (Clock tab).

## Screens

### 00 Sign in: live feed (new)
Replaces the layout of `app/login/page.tsx`. Keep the existing auth handlers (`apple-sign-in-button.tsx`, `google-sign-in-button.tsx`, `email-sign-in-form.tsx`).

Layout (full screen, flex column, white):
1. **Feed panel**: height **380px** (shrinks to **252px** while the email form is open, `transition: height 420ms cubic-bezier(0.22,1,0.36,1)`), full-bleed, `background: --inset (#f6f7f8)`, `overflow: hidden`, `mask-image: linear-gradient(to bottom, transparent 0, #000 26%, #000 74%, transparent 100%)`. It sits under the status bar.
   - Inner column `padding: 0 18px`, `animation: feed-drift 48s linear infinite` where `@keyframes feed-drift { from { transform: translateY(-50%) } to { transform: translateY(0) } }`. The 6 posts are rendered **twice** for a seamless loop, so posts drift downward with new ones arriving from the top.
   - Post card: `mb-2.5 flex flex-col gap-2 rounded-[16px] bg-card px-[15px] py-[13px]`.
     - Header row (gap 10): `AvatarInitials` 30px (11px initials); name `text-[12.5px] font-semibold text-body leading-[1.25]` truncate; subline `text-[11.5px] text-caption`: "clocked into" + 7×7 r2 square in goal color + goal (`font-medium text-body`, truncate); right `text-[11px] text-faint` time.
     - Title: Newsreader 16px 500, tracking -0.01em, `--ink`.
     - Pill row: duration pill (`rounded-full px-2.5 py-[3px] text-[11px] font-semibold tabular-nums`, background = goal fill at 14% via `color-mix(in srgb, <fill> 14%, transparent)`, text = palette **ink** twin, leading 6×6 r2 square), spacer, kudos pill (`border border-hairline rounded-full px-[9px] py-[3px] text-[11px] font-semibold text-brand`, filled heart 12px + count).
   - Data (name / username · goal · palette idx · duration · title · kudos · time):
     Priya Raman / priya.r · Ace organic chem · 9 · 2h 05m · "Library, top floor" · 4 · 12m
     Marcus Lee / marcuslee · Launch my side project · 2 · 1h 30m · "Shipped the onboarding" · 6 · 38m
     Sofia Alvarez / sofia.alv · Train for a half marathon · 5 · 45m · "Tempo run, 8k" · 3 · 1h
     Daniel Kim / dkim · Finish my thesis · 7 · 3h 10m · "Chapter 3 draft done" · 9 · 2h
     Nina Kowalski / ninak · Learn Spanish · 3 · 35m · "Podcast and flashcards" · 2 · 3h
     Leo Martins / leo.m · Get stronger · 6 · 1h 05m · "Push day" · 5 · 4h
2. **Lower block**: `flex-1 flex flex-col px-6 pb-[34px]`, left-aligned.
   - Brand row (gap 10): app icon `public/progra-logo.png` 30×30 radius 8 + "Progra" Newsreader 21px 500, tracking -0.02em, `--ink`. Animation `rise .45s cubic-bezier(0.22,1,0.36,1) .10s both`.
   - H1 `mt-[18px]`: **"The social network built around self improvement"**, Newsreader 36px/1.06, 500, tracking -0.025em, `--ink`, `text-wrap: balance`. Rise, delay .18s.
   - Body `mt-2.5`: **"Put in real hours towards your goals with your friends"**, 15px/1.55 `--secondary-ink`. Rise, delay .26s.
   - Flexible spacer (min 16px).
   - Sign-in stack (gap 10, rise, delay .38s):
     - **Continue with Apple**: h52, radius 15, `#000` background, white 16px/600, Apple glyph 16px, gap 8. While signing in: label "Signing in…", opacity .45.
     - **Continue with Google**: h52, radius 15, `--brand` background, white 16px/600, shadow `0 10px 22px -10px rgba(28,58,94,.55)`. While redirecting: "Redirecting…", opacity .45.
     - **Sign in with email**: text button 13px/500 `--caption`, hover `--brand`. Tapping expands (rise .35s) an inline form: Email + Password inputs (h46, radius 13, 1.5px `--control-border`, px 14, 15px; focus border `--brand`) and a "Sign in" submit (h46, radius 13, `--brand`, white 15px/600; "Signing in…" while pending).
     - Terms line `mt-1 text-center text-[11px] leading-[1.55] text-caption`: "By continuing, you agree to the **Terms of Service** and **Privacy Policy**. Progra has no tolerance for objectionable content or abusive users." Links are `--body`, underlined, offset 2px.
   - Press feedback on buttons: `active:scale-[.98]`.
- **Change vs today:** there is **no "I agree" checkbox**. Agreement is implied by continuing. ⚠️ Confirm this satisfies App Store review for a user-generated-content app before shipping.
- Exit: lower content goes to opacity 0 + `translateY(-14px)` (220ms / 300ms ease-in), then Welcome mounts.
- `Sign in options.dc.html` also contains rejected alternatives (Editorial, The clock, centered text). Use them for reference only.

### 01 Welcome (v3, unchanged UI)
`v3/welcome-screen.tsx` as-is. **Behavior change:** Continue now goes straight to 02. It no longer opens the UW sheet.

### 02 Your goal (v3 + changes)
`v3/goal-screen.tsx`, `v3/goal-hours.tsx`.
- **Example chips** (bottom row, unchanged styling `h-[34px] rounded-full border-[1.5px] px-3.5 text-[13px] font-semibold`): **Reading, Studying, Exercising, Recharging**. These replace the current six examples.
- **Goal color button** replaces the 3×20 color bar at the start of each goal row (row height stays 92px; title row h40, gap 10):
  - `h-7 rounded-[9px] border-[1.5px] border-control-border bg-card pl-2 pr-[7px] gap-[5px]`, containing a 12×12 radius-3 swatch in the goal's fill + chevron-down 11px (stroke 2.6, `--caption`). Hover border `--brand`; `active:scale-[.94]`. aria-label `Change color for “{title}”`.
- **Goal color sheet**, opened by the button. Use the app's `BottomSheet` (the prototype hand-builds the same look):
  - Backdrop `--backdrop` rgba(18,23,29,.34), 240ms fade. Panel: top radius 26, white, shadow `0 -12px 32px -18px rgba(18,23,29,.35)`, bottom padding 34, handle 38×4 `#e6e9ed` (pt 10, pb 12). Slide `translateY(calc(100% + 24px)) → none`, 440ms in / 320ms out, `cubic-bezier(0.32,0.72,0,1)`.
  - Body `px-5 pb-6`: eyebrow "Goal color" (`section-label`); row `mt-[9px] gap-2.5`: 3×22 r2 bar in the current color + goal title Newsreader 21px 500 tracking -0.015em `--ink` (truncate); `ColorSwatches` (`components/color-swatches.tsx`, value = fill hex) `mt-[18px]`; caption `mt-3 text-[12px] leading-[1.45] text-caption`: "It marks this goal everywhere — your sessions, your week and your friends’ feed."
  - Picking a swatch sets the color, then closes after 240ms. Tapping the selected swatch, or the backdrop, closes without changing anything.
- **Color defaults**: each new goal takes the first palette index not already used, in this order: `[7, 2, 5, 9, 3, 6, 10, 0, 1, 4, 8]`. Removing a goal keeps the others' colors. The draft field's 3×26 marker previews the next default color.
- Persist `color` with each goal. **Goal 1's color is reused** on How Progra works, the practice screens and the notification previews.

### 03 Add daily habits (from v1/v2)
Port the habits step from `onboarding-client-v2.tsx` into the v3 shell. It replaces `v3/habits-screen.tsx`.
- Scroll area: absolute, top 0, bottom 108; `px-6`; inner `max-w-[420px] flex-col gap-[18px] pt-[18px] pb-6`.
- Eyebrow `section-label` "Step 2 of 6" (see open items) · H1 Newsreader 30px/1.12 500 tracking -0.02em `--ink` **"Add daily habits."** · body 14px/1.6 `--secondary-ink`: "Small daily habits compound. They keep you moving on the days you can't put in hours, and your friends see your streak right next to your goals."
- "Pick a few" eyebrow + `grid grid-cols-2 gap-2` of tiles: `rounded-[12px] border-[1.5px] bg-white px-2.5 py-[9px] gap-[7px] text-[12.5px] font-semibold text-body`. Border `--control-border` when off and the habit color when on. Checkbox 18×18 radius 6, 1.5px border (`#d5d9df` off / color on), filled with the color when on, plus a white check 12px (stroke 3.2) that animates with `check-pop .25s`.
  - Presets → color: Journaling → palette 9, Meditation → 6, Stretching → 5, Drinking water → 7. Custom habits use `[7,2,5,3,9,6,10][k % 7]`.
  - Select: pop (scale .9 → 1.08 → 1, 340ms ease-out). Deselect: scale .94 → 1, 220ms. Press `active:scale-[.96]`.
- Add your own: `flex items-end gap-2`. Underline input (15px/500 `--ink`, 2px `--hairline` bottom border, pb 8, focus `--brand`, placeholder "Or add your own…") + "+ Add" button (h34, radius 11, 1.5px `--hairline`, px 12, 12px/600 `--brand`). Enter also adds. Case-insensitive duplicates are ignored. The new tile is appended to the grid, selected, and pops in.
- CTA "Save habit" / "Save habits" (more than one picked); disabled until something is picked or typed. Skip link "Skip for now". Both go to 04.

### 04 How Progra works (new, 4 steps on one screen)
Replaces `v3/intro-screen.tsx`. Its segment, beat-layering and tap-zone mechanics are a good base to reuse.
- Container `flex h-full flex-col px-6 pt-[18px] pb-[116px]`.
- H1 **"How Progra works"**, Newsreader 34px/1.08 500 tracking -0.02em `--ink`.
- Segments `mt-4 flex h-[3px] gap-1`: 4 tracks (`bg-track rounded-full`). Fill `bg-ink`, `scaleX(0|1)`, `transition: transform 700ms cubic-bezier(0.22,1,0.36,1)`. Every segment up to and including the current step is full, so the current one animates filling when you arrive.
- Caption box `mt-[22px] h-[84px]`: one absolutely layered caption per step, cross-moving with item motion (active / past / ahead). Title Newsreader 26px/1.15 500 tracking -0.015em `--ink`; body `mt-1.5 text-[14px] leading-[1.5] text-secondary-ink`.
  1. **Clock in**: "Start a session toward ■ {goal 1}." The goal is `font-semibold text-body`, preceded by an 8×8 r2 square in goal 1's color.
  2. **Clock out**: "Stop when you’re done. The time counts toward your week."
  3. **Post**: "Add a photo and a line. It lands in your friends’ feed."
  4. **Friends react**: "They like and comment — and you cheer on theirs."
- Visual panel `mt-3.5 flex-1 max-h-[400px] rounded-[22px] bg-inset overflow-hidden`. Layers are absolute, `inset-0 flex flex-col justify-center px-3.5 py-4`.
  1. White card (radius 16, padding 28/16/26, centered column, gap 14): eyebrow "Clocked in" with a 7px dot in goal color (`pulse-dot 1.6s ease-in-out infinite`); live timer Newsreader 52px/0.9 500 tracking -0.03em tabular `--ink` counting up from **0:00:00** (h:mm:ss, 1s ticks, restarts each time you enter step 1); goal row 13px/600 `--body` with 8px square.
  2. White card (radius 16, padding 18/16): eyebrow "Clocked out"; `mt-3` baseline row: "1h 20m" Newsreader 40px/0.95 500 tracking -0.03em + "on ■ {goal}" 13px `--caption` (goal `font-semibold text-body`); 1px `--hairline` rule `mt-4`; `mt-3` row: eyebrow "This week" + right "+1H 20M" (10px/600, tracking .06em, `--done`, fades in at 60% of the grow); `GoalQuotaRows` `mt-2.5` for goal 1 (quota = goal 1's hours/week). Actual time animates 0 → 80 min over 900ms (ease-out cubic) after a 450ms delay.
  3. Eyebrow row h22 "Your friends' feed" with a 7px `--done` dot; feed card `mt-2 rounded-[16px] bg-card px-4 py-3.5 gap-2.5`. Header: avatar 34 (12px initials, the user's own), name 13px/600, "clocked into ■ {goal} for 1h 20m" 12px `--caption` (values `font-medium text-body`), "just now" 12px `--faint`. Title Newsreader 17px "Locking in at the library". Photo placeholder h112, radius 14, `--track`, image icon + "Your photo" (12px/600 `--caption`). Duration pill "1h 20m" (goal wash).
  4. The same post without the photo. Reaction row: duration pill · spacer · heart pill (border hairline; turns `--brand` and fills 500ms after arrival) · comment pill "1" (fades in at 1350ms). Kudos row `mt-3.5`: 3 avatars 30px with a 2px `--inset` ring, overlapping 20px apart, popping in (opacity 200ms linear + `scale(.5)→1` 420ms `cubic-bezier(0.34,1.56,0.64,1)`) at 650 / 800 / 950ms; "Zack, Priya and Leo gave you kudos" 12px `--secondary-ink` fades in at 1100ms. Comment card `mt-2.5 rounded-[16px] bg-card px-3.5 py-3 gap-2.5`: avatar 30 Marcus Lee; "Marcus Lee" 12.5px/600; "same spot tomorrow?" 13px `--body`; "2m" 11px `--faint`. It rises in at 1350ms.
- Navigation: CTA **"Next"** on steps 1–3 and **"Try it"** on step 4 (→ 05). Skip link "Skip" on steps 1–3 (→ 05). Tapping the right two-thirds of the panel goes forward and the left third goes back; a horizontal swipe over 36px also works. **Enter / Space / →** advance and **←** goes back (ignored while typing in a field). Top Back steps back within the screen before leaving it. Returning from 05 lands on step 4.

### 05 Practice clock-in (from v1/v2)
- Eyebrow "Step 3 of 6 · Practice" · H1 **"Try clocking in."** · body "Name the session, pick your goal, and go! This one's 25 minutes, but we will fast forward it."
- Card `rounded-[16px] border-[1.5px] border-control-border p-4 flex-col gap-3.5`.
  - Idle: eyebrow "Name this session"; underline input 19px/500 tracking -0.01em, placeholder "What are you working on?", **prefilled "Practice"**. Chip row (gap 8): goal chip (flex-1, h38, radius 12, 1.5px border; 8px square in goal color + goal 12.5px/600 + chevron 12px `#c3c8ce`) and duration chip (h38, radius 12; clock icon 13px `#8b929c` + "25m"). Button h50, radius 14, `--brand`, white 15px/600, glow shadow: **"Clock in for 25m"**.
  - Running (elements rise in at 0 / .08 / .16s): timer Newsreader 52px/.95 tracking -0.03em tabular (`m:ss`); row with an 8px pulsing dot in goal color + session name 13px/600 + "25m target" 12px `--faint`; progress bar h8 `--track` with goal-color fill; note 12px/500 `--caption` centered, "It’s running. Sit back — we’ll fast-forward this one." which switches to "Fast-forwarding — you get the idea." after 1.5s.
  - Timing: real time for 1.5s, then ease-out cubic to 25:00 over 1.8s. When it reaches 25:00, wait 500ms and auto-advance to 06.
- Bottom CTA is disabled: "Clock in above to continue" / "Clocking in…".
- Nothing is saved.

### 06 Practice post (from v1/v2)
- Eyebrow "Step 4 of 6 · Practice" · H1 **"Show your work."** · body "Clock out, snap what you did, and post it to your friends. **This one's practice, so don't worry - nothing gets posted.**" (the bold part is 600 `--body`).
- Card (same border card, gap 12): header (initials circle 34 on `rgba(28,58,94,.1)`, `--brand` 12px/600; session name 13px/600 (defaults to "Practice", or the typed name); "25m · {goal}" 11px `--faint`; 9px square in goal color). Photo: dashed button h76, radius 12, `1.5px dashed #d5d9df`, `#fafbfc`, image icon + "Add a photo" 12.5px/600 `--caption`. When attached, it becomes a thumbnail (the prototype shows a grey stand-in labelled "desk-photo.jpg attached"; use the real photo picker and a preview). Caption input: underline, 14px, placeholder "Say something about it…". **"Post to feed"** button h46, radius 13, `--brand`, white 14px/600. After posting: check 16px `--done` + "That's the whole flow. Nothing was posted." (13px/600 `--done`; see open items).
- CTA "Post above to continue" (disabled) → "Continue", which opens the UW sheet (or goes to 07 when UW is off).

### 06 / 06b UW question + UW page (v3, unchanged UI, moved)
`v3/uw-sheet.tsx`, `v3/uw-screen.tsx`. Same visuals and behavior, but the sheet now rises over the **posted practice session** (06) instead of after Welcome. No → 07 after the 780ms hold. Yes → the UW page morph → Continue / Skip for now → 07. Back from 07 returns to the UW page if the answer was Yes.

### 07 Find your friends (v3, unchanged UI)
`v3/find-friends-screen.tsx`. CTA "Skip for now" / "Continue · {n} added" now goes to **08** instead of ending onboarding.

### 08 Notifications (new, last step)
Replaces `v3/notify-screen.tsx`. Keep its gating: show only while iOS notification permission is undetermined. The v3 "Ready?" screen (`v3/ready-screen.tsx`) is removed from the flow.
- Scroll area like 03. Eyebrow **"Last step"** · H1 `mt-3` **"Allow notifications?"** Newsreader 32px/1.1 500 tracking -0.02em `--ink`.
- Panel `mt-[22px] rounded-[22px] bg-inset px-3.5 pt-4 pb-5 flex-col`:
  - Label `px-1 text-[12px] font-semibold leading-[1.3] text-secondary-ink`: **"When your friends like your posts"**, then a banner `mt-2`.
  - Label `mt-[18px]`: **"To remind you to clock in"**, then a banner `mt-2` with a stacked card peeking behind it (absolute, left/right 12, bottom -7, h24, radius 16, 1px `--hairline`, white, opacity .7).
  - Banner: `rounded-[18px] border border-hairline bg-card pl-3.5 pr-3.5 pt-3 pb-[13px] flex gap-[11px]`. App icon 34px radius 8; title 13px/600 `--body` truncate, with the time right-aligned at 11px `--faint`; body 12.5px/1.4 `--secondary-ink` with a 7×7 goal-color square and the goal name (500 `--body`).
    1. "Priya liked your post" · now · "1h 20m on ■ {goal 1}"
    2. "Time to clock in" · 5:30 PM · "Still time for ■ {goal 1} today."
  - Banner entrance: from opacity 0, `translateY(-12px) scale(.97)` → none; opacity 260ms linear, transform 560ms `cubic-bezier(0.34,1.56,0.64,1)`; delays **420ms** and **640ms** after the screen activates.
- Footer `mt-4 flex items-center justify-center gap-1.5 text-[12.5px] text-caption`: bell icon 14px + **"You can always turn them off."**
- CTA **"Turn on notifications"** → request OS permission → finish onboarding (whatever the answer). Skip link **"Not now"** → finish.

## State
- `screen` 0–7 (welcome, goal, habits, how, clock, post, friends, notify), plus overlays: `uwSheet`, `uwPage`, `colorFor` (goal index or null).
- Welcome: `name`, `username` (existing validation/errors), avatar.
- Goals: `[{ title, hoursPerWeek (1–40, default 5), color (palette index) }]`, max 3.
- Habits: selected names (presets + custom).
- How: `howStep` 0–3, local timer seconds, and the "This week" grow value (0–1).
- Practice (not persisted): clock phase (`idle | running | done`), elapsed ms, session name (default "Practice"), photo, caption, posted flag.
- UW (existing): answer, majors (max 3), interests (max 6).
- Friends (existing): search text, added usernames.
- Notifications: permission request in flight.
- Persist at the end: profile, goals (with color), habits, UW fields, friend requests. Same endpoints as v3.

## Design tokens (Progra DS, `app/globals.css`)
- Text: `--ink #12171d`, `--body #1b2129`, `--secondary-ink #5d6672`, `--caption #8b929c`, `--faint #9fa6b0`, `--disabled #c3c8ce`.
- Surfaces: `--screen/--card #ffffff`, `--inset #f6f7f8`, `--track #f1f3f5`, `--hairline #eceef1`, `--divider #f4f5f7`, `--control-border #e6e9ed`.
- Brand: `--brand #1c3a5e`, glow `rgba(28,58,94,.55)`, `--done #266b4d`, `--destructive #9c5148`, backdrop `rgba(18,23,29,.34)`.
- Palette (fill / ink), indices 0–10: #8E3A44/#6E2530, #DE5148/#BE362D, #E07042/#C24E14, #D6A728/#8F6C0A, #7CBE6D/#356B2F, #2E8B50/#175E33, #77B7C6/#22758C, #395AA0/#33518F, #A084B3/#7A57A0, #6F4E93/#533672, #D06DA1/#BA4485. Wash = fill at 14%.
- Type: Newsreader (serif: headlines, titles, timers, stat numbers), Hanken Grotesk (everything else). Eyebrow = `section-label` (10px/600, uppercase, 0.14em, `--faint`).
- Radii: pills full; inputs/buttons 10–15; cards 16–18; panels 22; sheets 26 (top); color markers 2–3.
- Motion: ease-out `cubic-bezier(0.22,1,0.36,1)`; sheet `cubic-bezier(0.32,0.72,0,1)`; spring `cubic-bezier(0.34,1.56,0.64,1)`; existing keyframes `rise`, `pop-in`, `check-pop`, `pulse-dot`, `caret-blink`; new `feed-drift` (above).

## Assets
- `public/progra-logo.png`: rainbow app icon (already in the repo). Used on sign-in, Welcome and the notification banners.
- Icons are lucide-react (chevron-left, chevron-down, x, check, plus, minus, image, heart, message-circle, bell, users, share, search, clock). The Apple glyph is the one in `app/login/apple-sign-in-button.tsx`.
- Avatars use `AvatarInitials` (hash of `u:{username}` → palette, 16% wash).

## Files in this bundle
- `Onboarding v4.dc.html`: the full clickable prototype (sign-in → 08); all logic and copy live here.
- `Onboarding v4 Screens.dc.html`: board with every screen and key state.
- `Sign in options.dc.html`: sign-in explorations (1b live feed, left-aligned, is the chosen one).
- `support.js`, `ios-frame.jsx`, `_ds/…` (Progra DS bundle), `public/progra-logo.png`: needed to open the HTML.

## Open items for design
1. The v1 eyebrows "Step 2 of 6", "Step 3 of 6 · Practice" and "Step 4 of 6 · Practice" don't match the 8-step progress bar. Suggest dropping the numbering and keeping "Practice".
2. On the practice post, "That's the whole flow. Nothing was posted." is no longer true, since UW, friends and notifications follow. Suggested: "Nice — nothing was posted."
3. The UW page still opens with "Your school / Are you a UW student?" right after the user answered Yes.
4. Sign-in drops the explicit terms checkbox (see 00).
