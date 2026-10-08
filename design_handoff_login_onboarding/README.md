# Handoff: Progra Login + Onboarding Redesign

## Overview
Redesign of Progra's auth + onboarding: a new login screen and a simplified 8-step onboarding flow (welcome → how it works → first goal → habits → practice clock-in → notifications → practice post → nudge/share). Less text than the current flow, one action per step, and the multiplayer/accountability angle front and center. Two headline treatments exist: standard (headlines rise in) and "typed" (headlines type in letter-by-letter like a text message).

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior, not production code to copy directly. The task is to **recreate these designs in the existing Progra codebase** (`iroybisw47/progra`, Next.js App Router + Tailwind + shadcn, existing `app/login/` and `app/onboarding/` routes) using its established patterns: replace the current `onboarding-client-v2.tsx` step content, keep the existing server actions/auth wiring (`signInWithApple`, Google OAuth redirect, username availability check, `completeOnboarding`, analytics `track()` calls).

## Fidelity
**High-fidelity.** Colors, type, spacing, radii, and copy are final. Recreate pixel-perfectly, mapping to existing Tailwind tokens where they match (the palette below already exists in `lib/category-colors.ts`).

## Design Tokens
Fonts (Google Fonts): **Hanken Grotesk** 400–700 (UI), **Newsreader** 400–600 optical serif (display headlines, big numerals).
- Ink: `#12171d` (display), `#1b2129` (body strong), `#5d6672` (body), `#8b929c` / `#9fa6b0` (muted), `#c3c8ce` (disabled strokes)
- Brand navy: `#1c3a5e` (primary buttons, accents, caret; hover `#142c49`)
- Strokes: `#e6e9ed` cards, `#eceef1` buttons/inputs, `#f4f5f7` hairlines; track fill `#f1f3f5`; canvas `#ffffff`
- Category palette (goals/habits/swatches): Brick `#9C5148`, Burnt orange `#B0703C`, Mustard `#A98A38`, Olive `#7D8850`, Forest `#4E7A5F`, Deep teal `#46808A`, Blue `#4A6FA5` (default), Indigo `#6B639C`, Plum `#91607F`
- Semantic: success `#266b4d`, warning/bad-example `#9c5148`, highlight sweep `rgba(169,138,56,.28)` (mustard @ 28%)
- Radii: 999px pills, 14–16px primary buttons/cards, 11–13px small buttons/inputs, 12px tiles
- Primary button shadow: `0 10px 22px -10px rgba(28,58,94,.55)`; brand mark shadow `0 14px 30px -12px rgba(28,58,94,.55)`
- Eyebrow style: 10px / 600 / uppercase / letter-spacing .14em / `#9fa6b0`
- Underline inputs: no box, `border-bottom: 2px solid #eceef1`, focus → `#1c3a5e`; 19px / 500 text

## Animations (shared vocabulary)
- `rise`: translateY(14px)+fade → none, .45s cubic-bezier(.22,1,.36,1); staggered delays .1/.22–.25/.34–.4/.46/.58s per element down the page
- `pop-in`: scale .5 → 1.06 → 1, .55s cubic-bezier(.34,1.56,.64,1) — brand mark
- `sweep`: 360° rotation, linear infinite — brand-mark clock hands (minute hand 9s, hour hand 96s, offset 120°)
- `bar-pulse`: scaleY(.3→1→.3) from bottom, ~5.4–6.4s ease-in-out infinite, staggered delays — 7-bar week strip, one bar per palette color (blue, teal, forest, mustard, indigo, burnt orange, plum)
- `pulse-dot`: opacity 1→.3→1, 1.6s infinite — "live" dots
- `wheel-fill`: progress-ring dashoffset 238.76 → 90.7, 1.1s cubic-bezier(.22,1,.36,1) .3s delay
- `check-pop`: scale .4 → 1.15 → 1 + fade, .25–.3s — checkmarks, sent bubble
- `hl-sweep`: background-size 0%→100% (no-repeat linear-gradient), .7s, ~.9–1.2s delay — marker highlight on emphasized copy
- `caret-blink`: opacity step 1s — typing caret
- **Typed variant only**: headlines type in char-by-char (login 55ms/char after 300ms; onboarding 32ms/char after 280ms) with a 2.5px navy caret, blinking while typing, hidden after. Layout is height-stable: an invisible ghost of the full headline reserves space; the typed text overlays it (`white-space: pre-line`).

## Screens / Views

### 1. Login (`Login.dc.html`, typed: `Login Typed.dc.html`)
Centered column, max-width 384px, white canvas.
- **Brand mark**: 58px rounded-square (28% radius) navy tile, white clock — ring r22 stroke 4.5, two hands animating via `sweep` (see above), `pop-in` entrance
- **Title** "Progra": Newsreader 500, 40px, -0.02em, `#12171d`
- **Tagline**: "Log self improvement sessions, track your habits, and share your progress with friends." 15px/1.6 `#5d6672`
- **Week strip**: 7 pulsing bars, 30px tall, gap 6, radius 3 (`bar-pulse`)
- **Terms row**: 16px checkbox (4px radius, 1.5px `#c3c8ce` stroke; checked = navy fill + white check), 12px/1.6 `#8b929c` copy: "I agree to the Terms of Service and Privacy Policy. Progra has no tolerance for objectionable content or abusive users." Links: `#1b2129` underlined.
- **Buttons** (46px, radius 14, 15px/600): Apple = black w/ Apple glyph "Sign in with Apple"; Google = navy w/ shadow "Continue with Google". Until terms checked: 45% opacity, `not-allowed` cursor, click shakes the terms row (`nudge-x` .4s). Loading labels: "Signing in…" / "Redirecting…" (~1.6s), then proceed to onboarding.
- **Email door**: quiet 12px underlined "Sign in with email" → swaps to email+password inputs (44px, 1.5px `#e6e9ed` border, radius 13) + white "Sign in" button.

### 2. Onboarding (`Onboarding.dc.html`, typed: `Onboarding Typed.dc.html`)
Shell: 64px header — 32px back button (11px radius, `#eceef1` stroke; hidden on step 0), centered progress dots (5px, active = 18px navy pill, past = `#b7c4d3`, future = `#e6e9ed`), "Skip" (12px `#8b929c`) top-right ends onboarding. Content column max-width 420px, 24px side padding. Footer: 52px navy CTA (radius 15, 16px/600, shadow; 40% opacity when gated) + optional quiet skip link. Step template: eyebrow ("Step N of 7", "· Practice" on clock/post) → Newsreader 30px/1.12 headline → 14px/1.6 `#5d6672` body → content card(s), each `rise`-staggered.

**Step 0 · Welcome** — Brand mark + "Welcome to Progra." (40px) + "Hours toward your goals, with friends watching." Underline inputs: Your name (optional), @username (checkmark pops in when ≥3 chars of [a-z0-9_]); 56px initials avatar (navy 10% bg) + "Add photo". CTA "Get started" gated on valid username.

**Step 1 · How** — "Most productivity apps are singleplayer, but Progra is multiplayer." + "On Progra, you track hours put towards your goals, and your habits, but your friends are able to see your progress to hold you accountable." Card "This week": 2-col grid comparing **You** (4.2h, Newsreader 24px; bar 70% blue `#4A6FA5`; "of 6h goal · on track"; Habits: Journaling ✓ indigo, Stretching unchecked) vs **Maya** (7.5h; bar 94% plum `#91607F`; "of 8h goal · almost ✓" in green; Habits: Meditation ✓ teal, Drinking water ✓ blue). Habit rows: 14px checkbox tiles (5px radius) + 10.5px labels; columns split by `#f4f5f7` hairline.

**Step 2 · Goal** — "Set your first goal." Body: "**BUT, make sure it's something you can put hours in.**" (bold, mustard `hl-sweep` highlight ~.9s in) "Instead of saying "get a 4.0 in math" (terracotta `#9c5148`), say **"study math 6hr a week"**." Underline input (placeholder "e.g. Study math"); 9 color swatches (38px, radius 11, flex row; selected = white check + 2px white / 4px color double ring); hours stepper (38px −/+ buttons, Newsreader 30px "5h", range 1–40); **live preview card**: 84px SVG progress ring (r38, stroke 8, `wheel-fill` to ~62%, stroke = chosen color) + "On your Progress tab" + goal title + "5h / week" in goal color. Color/hours/title update live. CTA "Save goal" gated on title.

**Step 3 · Habits** — "Add daily habits." + "Small daily habits compound. They keep you moving on the days you can't put in hours, and your friends see your streak right next to your goals." 2×2 preset tiles (Journaling indigo, Meditation teal, Stretching forest, Drinking water blue; 12px radius, checked = colored border + colored 18px checkbox w/ `check-pop`) + underline "Or add your own…" with "+ Add" button (Enter works). CTA "Save habit(s)"; skippable.

**Step 4 · Clock-in (practice)** — "Try clocking in." + "Name the session, pick your goal, and go! This one's 25 minutes, but we will fast forward it." Card: underline input "Name this session" (19px, emphasized) → chips row: goal chip (color square + title + chevron) + "25m" duration chip → 50px navy "Clock in for 25m". Running state: Newsreader 52px timer, live dot in goal color + session name + "25m target", progress bar in goal color, caption "It's running. Sit back — we'll fast-forward this one." → "Fast-forwarding — you get the idea." Real time ~1.5s then eases to 25:00 over ~1.8s, auto-advances. Footer CTA disabled ("Clock in above to continue"). No note field.

**Step 5 · Notifications** — "Don't lose track of time." + "We'll nudge you each hour you're still clocked in." Card of 3 green-check lines: hourly nudge while clocked in; alert at session target; "Nothing else — no streaks, no marketing". CTA "Enable notifications" (triggers OS prompt on iOS); skippable.

**Step 6 · Post (practice)** — "Show your work." + "Clock out, snap what you did, post it. **This one's practice — nothing gets posted.**" Card: avatar + "Your first session" + "25m · {goal}" + goal color square; 76px dashed "Add a photo" drop area (→ filled gradient tile "desk-photo.jpg attached"); underline caption input "Say something about it…"; 46px navy "Post to feed" → green check-pop line "That's the whole flow. Nothing was posted." CTA gated until posted.

**Step 7 · Nudge + Share** — "Hold your friends accountable." + "Your friends hold you accountable, and you hold them accountable. When a friend is falling behind, send them a nudge. Try it below." Card "Practice on a profile", structured like the app's profile header: 44px avatar MP (plum 14% bg) + "Maya" 14.5px/600 + "@maya" — then, right-aligned, the **Nudge pill button** (32px, radius 999, navy, 12.5px/600) **to the left of the settings gear button** (32px circle, 1.5px `#eceef1` stroke, gear icon `#8b929c`) — matching the real profile screen placement. Below: "Thesis writing · 2.5h of 8h this week" + "BEHIND PACE" tag (9.5px/700 terracotta) + 31% plum bar. Tap Nudge → "Pick a message" list of 5 preset buttons (left-aligned, 13px/600, hover navy border): **"Lock in" / "Still got time today!" / "Your friends are counting on you" / "You can do this!" / "Slow progress is better than no progress"**. Pick one → right-aligned navy chat bubble (radius 16/16/4/16) with the message + green "Nudge sent to Maya"; Nudge button dims to "Nudged" (50% opacity). Footer CTA: **"Share with friends"** → native share sheet (`navigator.share`, clipboard fallback) with "I'm putting {hours} hours into "{goal}" this week on Progra, plus {habits} every day. Join me and hold me accountable." + `https://progra.world/i/{username}` → CTA becomes **"Start my week"**. Quiet skip: "Start my week without sharing".

**Done splash** — "Ready. / Set. / GO!" (Newsreader 52px, staggered rise, "GO!" navy), pulsing week strip, summary line "Your week starts now: {hours}h on "{goal}", plus {habits} every day. Your friends will see how it goes."

## Interactions & Behavior
- Back preserves all entered state; Skip (header) ends onboarding; per-step gating as listed above
- Data flows through the whole flow: goal title/color/hours drive the wheel preview, clock-in chip/timer/progress colors, post summary, invite message, and done summary
- All button presses: `transform: scale(.96–.98)` active states, .12–.15s
- Typed variant: retype runs on every step entry (including back), timers cleaned up on unmount

## State Management
`step` index (0–7), `done`; profile `{name, username}`; goal `{title, color, hours}`; `habits[]` (name+color, presets + custom); clock `{sessionName, running, simMs, fast}`; post `{photo, caption, posted}`; nudge `{open, sentMessage}`; `shared`; typed variant adds `{typedText, typing}`. Persist per existing app patterns (server actions on step commit); practice clock-in/post/nudge write nothing.

## Assets
No binary assets. Brand mark, gear, checks, chevrons, Apple glyph are inline SVG (gear/check/camera/chevron = lucide paths, already in the codebase). Fonts via Google Fonts (already `next/font`-loadable).

## Files
- `Login.dc.html` / `Login Typed.dc.html` — login (standard / typed headlines)
- `Onboarding.dc.html` / `Onboarding Typed.dc.html` — 8-step flow (standard / typed)
- `Full Flow.dc.html` / `Full Flow Typed.dc.html` — login → onboarding chained
Repo targets: `app/login/*`, `app/onboarding/onboarding-client-v2.tsx`, `components/color-swatches.tsx`, `lib/category-colors.ts`, `components/v2/invite-share.tsx`.
