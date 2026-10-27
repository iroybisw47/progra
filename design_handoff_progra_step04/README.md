# Handoff: Progra onboarding, step 04 "What is Progra" (practice clock-in)

## Overview
This **replaces the existing step 04** of Progra's onboarding (between **03 Your habits** and **05 Find your friends**). Instead of explaining the app, it walks the user through one practice loop of the real product:

1. **Intro**: "What is Progra?" with a live-looking preview of the Progress tab (time wheel, goal progress, habit grid).
2. **Clock in**: the real Clock page, reduced to the essentials: their goal is preselected and a 25 minute timer is set.
3. **Running**: the real live-timer screen. The 25 minutes are fast-forwarded and the timer clocks them out on its own.
4. **Post**: their first post, with an optional photo.
5. **Feed**: the post as friends will see it ("{Name} just joined Progra, and their first goal is {goal}"), then on to Find your friends.

It runs as **one onboarding step** (the progress bar sits at 4/6 the whole time). Internally it has six phases: `intro → ready → running → ended → post → posted`.

## About the design files
`prototype/Progra Onboarding.dc.html` is a **design reference built in HTML**: a working prototype that shows the intended look, copy, motion and behavior. It is not production code. Rebuild step 04 in the Progra codebase with its existing patterns, routing and data layer, and the real Progra components (`Donut`, `GoalQuotaRows`, `HabitWeekGrid`, `SectionHeader`, `AvatarInitials`, `PrimaryButton`). The prototype contains the whole onboarding; **only step 04 is in scope here**.

To view it: serve the `prototype/` folder over HTTP (`npx serve prototype` or `python3 -m http.server` inside it), open `Progra Onboarding.dc.html`, and click **04 What Progra is** in the side panel. A `file://` URL will not load the phone frame.

## Fidelity
**High-fidelity.** Final colors, type, spacing, copy and motion. Coordinates are CSS px in the **393 × 852** iPhone frame. The status bar ends at y≈54 and the home indicator is the bottom 34px.

**Inputs from earlier steps:** `name`, `username`, `photo` (optional), `goals[]` (1–3, colors palette 7 / 2 / 5 in order), `habits[]` (0+).

---

## Shared chrome (already in the onboarding; unchanged)
- Back button (20,64) 32×32 goes back to step 03 from any phase (not phase by phase).
- Progress bar (64,79) 269×3, `--brand` on `--track`, at `scaleX(4/6)`.
- Their avatar, 28px, top-right at (345,66).
- **Primary CTA** at (20,758), 353×52: `PrimaryButton size="screen"`. The **secondary** variant is outlined: 52px, radius 15, 1.5px `--control-border`, 16px/600 `--body`. Primary and secondary crossfade over 180ms linear. A **CTA ring pulse** (2px `--brand` ring, radius 15, `scale 1 → 1.06×1.5`, opacity .5 → 0, 800ms) is used once, see Ended.

## Motion tokens
- **E** `cubic-bezier(0.22, 1, 0.36, 1)` (default ease-out).
- **Item stagger** (every element below, with the index *i* given):
  - **enter:** opacity 420ms E and transform 560ms E, from `translateY(18px)` to none, with delay `140 + i × 55` ms.
  - **exit forward:** opacity 160ms ease-in, transform 220ms ease-in to `translateY(-14px)`.
- **Pop:** `scale .4/opacity 0 → 1.12–1.2 (70%) → 1`, 300–340ms.
- Transform and opacity only (the app runs in a WebView; target 60fps).
- **Reduced motion:** every item becomes an opacity crossfade (200ms linear, 60ms delay). There are no FLIPs, no wheel spin, no bar fill, no pops or rings, and the timer steps (see Running).

---

## Phase 1: Intro (`demo = 'intro'`)
A column at (20,110), width 353:

**Hero preview** (item 0). An outer panel (`--inset` #f6f7f8, radius 22, padding 12) holds a white card (radius 16, padding 14/16/12):
- **Top row** (flex, center, gap 16):
  - `Donut` with `size=112` and `stroke=12`. Segments:
    - 390 at `#395AA0` (palette 7)
    - 180 at `#E07042` (palette 2)
    - 130 at `#6F4E93` (palette 9)
  - The donut's `label` is the total, **"11h 40m"**, and its `sub` is **"This week"**.
  - Right column (flex 1, gap 9): `.section-label` "Goals this week", then `GoalQuotaRows` with one goal: `{ title: 'Study', color: '#395AA0', quotaHours: 10, actualMs: 6.5h }`.
- 1px `--hairline` rule (margin 12 / 0 / 9).
- `.section-label` "Habits", then `HabitWeekGrid` (margin-top 4) with the user's **first two habits** (fallback "Drink water", "Stretch"):
  - colors `#7CBE6D` (palette 4) and `#77B7C6` (palette 6)
  - illustrative completions: habit 1 on Mon, Tue, Wed, Fri; habit 2 on Mon, Wed, Thu, Fri
  - "today" = Friday of that week
- This is illustrative data, not the user's data (they have none yet).
- **Entry animation** starts 120ms after the phase appears:
  - **Wheel:** the donut SVG goes from `rotate(-90deg) rotate(-140deg) scale(.86)`, opacity 0, to `rotate(-90deg)`, 900ms E, 120ms delay. Keep the component's base `-90deg` in both keyframes.
  - **Goal bar:** fills `scaleX(0 → 1)` from the left, 900ms E, delay `380 + i × 120` ms.
  - **Habit checks:** each done cell pops in (340ms) with delay `620 + i × 55` ms.

**Copy** (verbatim; keep "Lets" as written):
- Heading (item 1, margin-top 24): **"What is Progra?"** Newsreader 500, 34px / 1.1, −0.02em, `--ink`.
- Lead (item 2, margin-top 12): **"Progra is a productivity app designed to be used with your friends!"** Newsreader 500, 22px / 1.3, −0.01em, `--secondary-ink`.
- Body (item 3, margin-top 14): **"You clock in hours towards goals, or anything you want to keep track of/post, and friends can see your posts on a shared feed!"** Hanken 15px / 1.55, `--secondary-ink`.
- Last line (item 5, margin-top 16): **"Lets start with an example."** Hanken 15px / 1.4, 600, `--body`.

**CTA:** primary **"Start the example"** goes to `ready`.

## Phase 2: Clock in (`demo = 'ready'`)
Mirrors the real Clock tab, with only the goal and the timer.
- **Eyebrow row** at (20,112), item 0: `.section-label` "Clock in" on the left; on the right, today's date as meta (e.g. "MON, OCT 19"; 10px / 600, 0.06em, `--caption`).
- At (20,146), width 353:
  - **Section header** (item 1): `SectionHeader label="Working on"`. Set `meta="PICK ONE"` only when the user has more than one goal.
  - **Goal rows** (item 2): one row per goal, gap 8.
    - Each row is 56px tall, radius 14, 1.5px border, white, padding 0 14, gap 11. The border is `--brand` when selected and `--control-border` otherwise (160ms).
    - Leading 3×24 color bar (radius 2) in the goal's color.
    - Title: Newsreader 500, 17px, −0.01em, `--ink`, truncated.
    - Subline: "Goal · 0h this week", 11px `--faint`.
    - Trailing 22px radio. Selected: `--brand` fill with a 12px white check. Unselected: white with a 1.5px `--control-border`.
    - **The first goal is preselected.** Tapping another row selects it (press `scale(.99)`).
  - **Timer section** (item 3, margin-top 22): `SectionHeader label="Timer"`, then a static 56px row with the same box style as the goal rows:
    - 17px timer icon in `--caption` (lucide `timer`)
    - **"25 min"** in Newsreader 500, 17px
    - subline "Clocks you out at {now + 25 min, h:mm a}", 11px `--faint`
  - Nothing else: no session-mode or break controls.
- **CTA:** primary **"Clock in"** goes to `running`.

## Phase 3: Running (`demo = 'running'`)
Mirrors the real live-timer screen.
- **Eyebrow** (item 0):
  - left: a 7px `--done` (#266b4d) dot pulsing (existing `pulse-dot` animation, 1.6s), then `.section-label` "Clocked in" in `--done`
  - right: meta "PRACTICE RUN"
- **Centered block** at y=272:
  - **Title** (10px square, radius 2, in the goal color, plus the goal title in Newsreader 500 22px −0.015em `--ink`, truncated). It **FLIPs** from the selected row's title to this spot: translate plus scale from the row title's rect, transform-origin 0 0, 640ms E.
  - **Timer** (item 1, margin-top 22): `stat-num` at 52px / 0.9, format `H:MM:SS`.
  - **Status** (item 2, margin-top 14): "Started {h:mm a} · 25 min timer", 13px / 1.45 `--caption`.
  - **Fast-forward chip** (margin-top 22): fades in at 900ms and fades out when the timer ends. It is a 28px pill with padding 0 12, `--track` background, 11.5px / 600 `--secondary-ink`, a 13px fast-forward icon and the text **"Fast-forwarding 25 minutes"**.
- **Timer progression** (drive with rAF; write the text directly to avoid re-renders):
  - First 1000ms: real time, 0:00:00 → 0:00:01.
  - Next 3400ms: eased (cubic in-out) from 1s to 1500s.
  - At 1500s (0:25:00) it auto-ends with `demoEnd = 'auto'`.
  - Reduced motion: jumps in 5-minute steps every 500ms and ends at 2.8s.
- **CTA:** secondary **"Clock out"** ends early and freezes at the current simulated time (`demoEnd = 'early'`).
- Production: this is a **practice session** and should not need a real timer. Whether its 25 minutes count toward the goal is a product decision; the prototype does not log it.

## Phase 4: Ended (`demo = 'ended'`)
Same layout as Running.
- **Eyebrow:** label "Timer done", or "Clocked out" if they ended early. The pulsing dot is covered by a 14px `--done` circle with a 9px white check (pop, 320ms).
- **Timer:** shows 0:25:00 (or the early time) and bumps `scale 1 → 1.08 → 1` (520ms).
- **Ring:** a 150px ring (2px `--done`) centered on the block at (121,272) pulses `scale .55 → 1.5`, opacity .5 → 0, 900ms.
- **CTA ring pulse** at 520ms.
- **Status:**
  - auto end: "25 minutes done. Your timer clocked you out."
  - early: "Clocked out at {m}m."
- **CTA:** primary **"Continue"** goes to `post`.

## Phase 5: Post (`demo = 'post'`)
- **Eyebrow** (item 0): "Session done" on the left, "PRACTICE RUN" on the right.
- **Heading** at (20,136), item 1, verbatim: **"This is just practice, but will be your first post, so feel free to post anything!"** Newsreader 500, 25px / 1.18, −0.015em, `--ink`.
- **Photo slot** at (20,248), 353×340, item 2. Radius 14, 1.5px **dashed** `--disabled`, `--inset` background. The whole slot is tappable and opens the native photo picker (press `scale(.99)`). Centered stack, gap 10:
  - 52px `--brand` circle with a 22px white camera icon and the navy glow (`0 10px 22px -10px rgba(28,58,94,.55)`)
  - "Add a photo", 14px / 600 `--body`
  - "Your desk, your notes, the view", 12px `--caption`
- **When a photo is picked:**
  - it fills the slot (`object-fit: cover`) and fades in from `scale(1.08)`, 460ms
  - the dashed border goes transparent
  - a "Change" pill sits at bottom-right (10px inset): 28px, padding 0 11, `rgba(255,255,255,.92)`, 11.5px / 600, 12px camera icon
- **Skip:** a **"Post without a photo"** text button centered at y=600 (44px tall, 12px / 500 `--caption`, `--brand` on hover/press, nowrap), item 3. It shows only while no photo is picked and posts without a photo.
- **CTA:** primary **"Add a photo"** opens the picker; once a photo is picked it reads **"Post"** and posts.

## Phase 6: Posted (`demo = 'posted'`)
- **Eyebrow** (item 0): a 7px `--done` dot plus `.section-label` "Your friends' feed".
- At (20,136), width 353, gap 14:
  - **Feed card** (item 1): an outer `--inset` panel (padding 14, radius 22) holding a white card (radius 16, padding 14/16, column gap 10).
    - **Header row** (gap 11, align top):
      - `AvatarInitials` at 34px (their photo or initials)
      - text 13px / 1.4 `--secondary-ink`: "**{Name}** just joined Progra, and their first goal is ■ **{goal}**". Name and goal are 600 `--body`; ■ is a 7px square in the goal color, radius 2.
      - "just now", 12px `--faint`, on the right
    - **Photo** (only if one was posted): 282px tall, radius 14, cover. It **FLIPs from the photo slot** (translate plus uniform scale from the slot's rect, 660ms E); the card fades in over 140ms underneath.
    - **Actions** (right-aligned): an outlined pill (1px `--hairline`, radius full, padding 2) with comment and heart icons (13px, `--disabled`, padding 3/8 each).
  - **Line** (item 4): "Posted. Next, add the friends who'll see it in their feed." 13px / 1.45 `--secondary-ink`.
- **CTA:** primary **"Continue"** goes to step 05 (Find your friends).
- Production: create a real first feed post (a "joined" post with the goal and optional photo). If the codebase has a feed component for this post type, use it; `SessionCard` is for sessions.

---

## CTA map
| Phase | CTA | Action |
|---|---|---|
| intro | Start the example (primary) | → ready |
| ready | Clock in (primary) | → running |
| running | Clock out (secondary) | end early → ended |
| ended | Continue (primary) | → post |
| post | Add a photo / Post (primary) | open picker / publish → posted |
| posted | Continue (primary) | → step 05 |

## State
```
demo:      'intro' | 'ready' | 'running' | 'ended' | 'post' | 'posted'   (reset to 'intro' on entering the step)
demoGoal:  index into goals (default 0)
demoAt:    timestamp when clocked in
demoEnd:   null | 'auto' | 'early'
demoSecs:  final simulated seconds (1500 on auto end)
postPhoto: local image URL | null
```

## Tokens used (all from the Progra design system)
- **Text:** `--ink` #12171d, `--body` #1b2129, `--secondary-ink` #5d6672, `--caption` #8b929c, `--faint` #9fa6b0, `--disabled` #c3c8ce
- **Surfaces and lines:** white, `--inset` #f6f7f8, `--track` #f1f3f5, `--hairline` #eceef1, `--control-border` #e6e9ed
- **Brand and state:** `--brand` #1c3a5e, `--done` #266b4d
- **Palette:**
  - goals: 7 #395AA0, 2 #E07042, 5 #2E8B50
  - wheel extra: 9 #6F4E93
  - habits: 4 #7CBE6D, 6 #77B7C6
- **Type:** Newsreader 500 for headings, goal titles and the timer (`stat-num`); Hanken Grotesk for everything else; `.section-label` for eyebrows.
- **Radii:** rows and photo 14; cards 16; panels 22; CTA 15; pills full.

## Files
- `prototype/Progra Onboarding.dc.html`: the full prototype. The step 04 markup is the block under `<!-- 04 what progra is -->`. The step 04 logic is in the script: `animHero`, `enter3`, `startDemo`, `paintTimer`, `finishDemo`, `pickPostPhoto` / `onPostFile` / `postNoPhoto` / `postIt`, `m3` (end-of-timer effects), `cta3` / `ctaSpec3`, and `vals3` (all positions, copy and per-phase visibility).
- `prototype/support.js`, `prototype/ios-frame.jsx`, `prototype/_ds/…`: needed only to run the prototype.
- **Prototype-only, do not build:** the side panel, slow motion, the fake keyboard, and unused helpers in the step 04 code (`weekMins`, `goal1Wash`, `stopBeats` naming).
