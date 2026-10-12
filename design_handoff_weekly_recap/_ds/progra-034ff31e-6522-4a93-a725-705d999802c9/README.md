# Progra — conventions for building with this design system

Progra is a phone-first productivity app (clock in to goals, weekly quotas,
habits, a friends feed, a Sunday recap). The live design is an **editorial,
flat** look: white screens, hairline rules instead of cards, deep-navy brand,
a Newsreader serif for names/titles/numbers and Hanken Grotesk for everything
else, and an eleven-color palette that belongs to the user's goals,
categories, habits and friends — never to the chrome.

Mock at **390px wide** (iPhone). Every screen is a single centered column,
`max-w-md`.

## The rules that make a mockup look like Progra

1. **No cards on tabs.** Sections are separated by a full-bleed hairline, a
   grey band, or row dividers — never a bordered/rounded/shadowed box. `Card`
   exists for legacy pages and dialogs only.
2. **No big headlines on tabs.** A tab's title is the 10px uppercase eyebrow
   (`.section-label`, e.g. "FEED"). Serif is for *content*: a person's name,
   a session title, a sheet title, and stat numbers.
3. **Small, dense list text.** Rows are 11–13.5px. Color comes from 2–3px
   palette markers (squares, 3px bars), never from colored text blocks or
   tinted backgrounds behind whole rows.
4. **Flat.** The only drop shadows in the app are the navy glow under navy
   surfaces (`PrimaryButton size="screen"`, the `RecapNudge` /
   `ReferFriendButton` banners) and the bottom sheet's own shadow. No
   `shadow-sm/md/lg` anywhere.
5. **Navy is chrome, the palette is data.** Buttons, selected chips, active
   tab, focus → `--brand`. Goal/category/habit/avatar colors → the palette.
   Never paint UI chrome in a palette color, and never use navy for data.
6. **Light only.** There is no dark mode. Don't design one.
7. **Calm.** No alarm red. Destructive is muted terracotta (`--destructive`
   #9c5148) and appears only on genuine deletes/removals.

## Setup

No provider is needed. Load `styles.css`; fonts arrive from Google Fonts via
`tokens/fonts.css` (already in the `styles.css` import closure).

**Prefer components in the `v2` group** — they are the redesign's building
blocks. The `general` group holds shadcn primitives (Button, Dialog, Input…)
and older widgets still used inside forms and dialogs.

## Styling idiom

Tailwind classes, but the shipped stylesheet is compiled from the app's own
usage, so **only utilities the app already uses exist**. Every class string
quoted in this document exists. For anything else, use inline `style` with the
CSS variables below (all defined in `_ds_bundle.css`).

Note `font-mono` is mapped to Hanken Grotesk — there is no monospace face.
Numbers get `tabular-nums` (sans) or `.stat-num` (serif).

## Tokens

Text, darkest to lightest (utilities are `text-<name>`):

| token | hex | use |
|---|---|---|
| `--ink` | #12171d | serif titles, stat numbers, strongest text |
| `--body` | #1b2129 | row titles, labels, body copy |
| `--secondary-ink` | #5d6672 | descriptions, secondary values |
| `--caption` | #8b929c | metadata, captions, empty states (the most-used text color) |
| `--faint` | #9fa6b0 | eyebrows (`.section-label`), timestamps, sublines |
| `--disabled` | #c3c8ce | chevrons, inactive day letters, disabled |

Surfaces and lines:

| token | hex | use |
|---|---|---|
| `--screen` / `--background` / `--card` | #ffffff | every screen and sheet |
| `--inset` | #f6f7f8 | the rare inset panel (Clock's "This week") |
| `--track` | #f1f3f5 | progress-bar tracks, chip rails, section bands, toggle off |
| `--hairline` | #eceef1 | section rules, feed-post dividers, outlined pills |
| `--divider` | #f4f5f7 | row dividers inside a section |
| `--control-border` | #e6e9ed | outlined buttons and inputs (1.5px) |
| `--app-bg` | #e9ebef | ground *behind* the app on desktop only |

Brand and state: `--brand` #1c3a5e (navy — `bg-brand`, `text-brand`),
`--brand-deep` #142c49, `--sand` #d9e2ec (strong navy tint),
`--tint-you` rgba(28,58,94,.05) (your own row in a list), `--done`/`--success`
#266b4d (met / complete), `--destructive` #9c5148.

### The entity palette

Eleven colors, in picker order. Each has a **fill** (dots, bars, donut arcs,
filled chips, avatar washes) and an **ink** twin used *only* when the color is
the text itself. Never set body text in a fill color. Glyphs inside a filled
chip are always white.

| # | name | fill | ink |
|---|---|---|---|
| 0 | Maroon | #8E3A44 | #6E2530 |
| 1 | Red | #DE5148 | #BE362D |
| 2 | Orange | #E07042 | #C24E14 |
| 3 | Gold | #D6A728 | #8F6C0A |
| 4 | Light green | #7CBE6D | #356B2F |
| 5 | Green | #2E8B50 | #175E33 |
| 6 | Light blue | #77B7C6 | #22758C |
| 7 | Dark blue | #395AA0 | #33518F |
| 8 | Purple | #A084B3 | #7A57A0 |
| 9 | Dark purple | #6F4E93 | #533672 |
| 10 | Pink | #D06DA1 | #BA4485 |

CSS: `var(--palette-N)` / `var(--palette-N-ink)`. A **wash** (the feed's
duration pill, avatar backgrounds) is the fill at 12–16% alpha with the ink as
text, e.g. `background: #395AA01F; color: #33518F`. Uncategorized time is
grey `#c3c8ce`.

## Type

- **Eyebrow** — `section-label`: 10px, 600, uppercase, 0.14em tracking,
  `--faint`. Opens every section and is the title of every tab. Right-aligned
  meta beside it: `text-caption text-[10px] font-semibold tracking-[0.06em]`.
- **Stat numbers** — `stat-num` (Newsreader 500, tabular, `--ink`), sized per
  context: hero `stat-num text-[36px] leading-[0.9]`, running timer
  `stat-num text-[52px] leading-[0.9]`, profile stats `stat-num text-[21px]`
  over a label `text-disabled text-[9px] font-semibold uppercase tracking-[0.12em]`.
- **Serif content** — person name
  `text-ink font-serif text-[22px] font-medium tracking-[-0.015em]`;
  session title on its own page
  `text-ink font-serif text-[26px] leading-[1.15] font-medium tracking-[-0.015em]`;
  feed post title `text-ink font-serif text-[17px] font-medium tracking-[-0.01em]`;
  sheet title (BottomSheet does this itself) 21px.
- **Rows** — title `text-body text-[13px] font-semibold leading-[1.25]`,
  subline `text-faint text-[11px] leading-[1.3]`, right value
  `text-body text-[13px] font-semibold tabular-nums`.
- Durations read `2h 15m`, `45m`, or `6.5h` in quota contexts; timers `0:47:12`.

## Screen anatomy

```tsx
// A tab. Gutter on the wrapper (Progress, Clock, History)…
<div className="flex flex-1 flex-col items-center px-5 pt-7 pb-28">
  <main className="flex w-full max-w-md flex-col">…</main>
</div>
// …or on each row, so dividers run edge to edge (Feed, Friends, You,
// Settings): drop px-5 from the wrapper and give every child px-5.
```

`pb-28` clears the fixed `BottomNav` (64px, frosted white, hairline top).

Section separators, in increasing weight:

- row divider — `border-divider border-t` on each row (first row has none)
- section rule — `<div aria-hidden className="bg-hairline h-px w-full mt-4" />`
  then `<section className="flex flex-col pt-3">`
- band (group break) — `<div className="bg-track border-hairline h-1.5 border-t mt-5" />`

Row recipes:

- **Session row** — `border-divider flex items-center gap-2.5 border-t py-[7px]`
  with a leading color bar `h-5 w-[3px] rounded-[2px]` in the goal's fill.
- **Settings row** — `border-divider flex items-center gap-3 border-t px-5 py-3`,
  label `text-body text-[13.5px] font-medium`, value `text-caption text-[13px]`,
  trailing chevron `text-disabled size-[13px]`.
- **Person row** — avatar `size-9`, then the row title/subline styles, `py-[9px]`.
- **Sheet row** — use `MenuRow`.

Empty states are one inline line in a row, never an illustration:
`<p className="text-caption border-divider border-t px-5 py-3 text-[13px]">No friends yet — search above to add someone.</p>`

## Controls

- **Screen CTA** (Clock in, Continue): `PrimaryButton size="screen"` — 52px,
  radius 15px, navy glow. One per screen, usually last.
- **Sheet CTA**: `PrimaryButton` (48px, no glow).
- **Secondary**:
  `border-control-border text-body h-12 w-full rounded-[15px] border-[1.5px] text-sm font-semibold`.
- **Small row action** (Add, Accept):
  `border-control-border text-caption h-[30px] rounded-[10px] border-[1.5px] px-3 text-xs font-semibold`.
- **Text link**: `text-caption hover:text-brand text-xs font-medium` ("+ Add past session").
- **Segmented switch**: `ChipRail` + `CHIP`/`CHIP_ON`/`CHIP_OFF`.
- **Switch**: `ToggleSwitch` (44×26). **Back**: `BackButton` on overlay
  screens, `BackLink` on Settings sub-pages.
- **Choices and forms open in a `BottomSheet`**, not a centered dialog.
  Centered `Dialog`/`AlertDialog` are for confirmations only.
- Press feedback is a scale, not a color: `active:scale-[.99]` rows,
  `active:scale-[.98]` buttons.

Radii: pills/chips `rounded-full`; buttons and inputs 10–15px; color markers
`rounded-[2px]`; photos `rounded-[14px]`; sheets 26px top corners.

## Which component for what

- Section opener with count/chevron → `SectionHeader`
- Goal progress against a weekly quota → `GoalQuotaRows`
- Where the time went (donut + per-category bars) → `CategoryDonut`;
  the whole weekly block → `WeekSummary`; a bare ring → `Donut`
- Habits this week → `HabitWeekGrid`
- A finished session (feed, profile, You) → `SessionCard`
- Friends clocked in now → `ClockedInStrip`; weekly ranking → `FriendsLeaderboard`
- A posted Sunday recap → `RecapFeedCard`
- People → `AvatarInitials` (initials on a wash of their color, or a photo)
- Banners on Progress → `RecapNudge`, `AutoEndNudge`
- Clock-in options → `SessionPlanPicker`, `CategoryPicker`
- Color choice → `ColorSwatches`
- Brand → `PrograMark`, loading → `PrograLoader`, ambient motif → `WeekPulse`
- Release note → `WhatsNewModal`; loading screen → `PageSkeleton`

## The app's structure

Bottom nav, five tabs: **Progress · Feed · [Clock] · Friends · You** — Clock is
the raised navy center button and shows the live timer while a session runs.

- **Progress** — date eyebrow + Today/Week/History `ChipRail`; Today: hero
  `stat-num` total, a donut, today's sessions, habits; Week: `WeekSummary` +
  `HabitWeekGrid`.
- **Feed** — `ClockedInStrip`, then full-bleed `SessionCard` / `RecapFeedCard`
  posts separated by hairlines.
- **Clock** — goal/category choice, `SessionPlanPicker`, `PrimaryButton
  size="screen"` "Clock in"; while running, a full-screen white timer
  (`stat-num text-[52px]`). Finishing goes to a summary screen.
- **Friends** — search, invite (`InviteShare`), `FriendsLeaderboard`, people rows.
- **You** — serif name, stat strip, goals (`GoalQuotaRows`), habits, your sessions.
- **Overlay screens** (Settings, a friend's profile, session detail) open with
  `BackButton` beside an eyebrow title.
- The recap story and the finish screen are deliberate exceptions (bold numbers,
  rounded panels). Don't use them as the template for a tab.

## Voice

Short, warm, lowercase-casual, em-dashes. Real examples: "Nothing tracked yet
today — tap to clock in." · "Your feed's quiet — send a friend the app, then add
each other once they're in." · "+ Add past session" · "Your week is ready" ·
"Nobody's clocked in yet this week. Start a session and you'll be first."
Never shout, never exclamation-mark a failure.

## Idiomatic example — a Progress "Today" screen

```tsx
import { ChipRail, CHIP, CHIP_ON, CHIP_OFF, Donut, SectionHeader,
         GoalQuotaRows, PrimaryButton } from "progra"; // window.Progra.*

const H = 3600000;

<div className="flex flex-1 flex-col items-center px-5 pt-7 pb-28">
  <main className="flex w-full max-w-md flex-col">
    <div className="flex items-center justify-between gap-3">
      <span className="section-label whitespace-nowrap">Thu, Oct 8</span>
      <ChipRail>
        <button className={`${CHIP} ${CHIP_ON}`}>Today</button>
        <button className={`${CHIP} ${CHIP_OFF}`}>Week</button>
        <button className={`${CHIP} ${CHIP_OFF}`}>History</button>
      </ChipRail>
    </div>

    <div className="stat-num pt-3 text-[36px] leading-[0.9]">3h 45m</div>

    <div className="flex justify-center pt-4">
      <Donut segments={[{ color: "#395AA0", value: 110 }, { color: "#E07042", value: 35 },
                        { color: "#2E8B50", value: 80 }]} />
    </div>

    <div aria-hidden className="bg-hairline h-px w-full mt-4" />
    <section className="flex flex-col pt-3">
      <SectionHeader label="Today" meta="3 sessions" className="pb-2" />
      <div className="border-divider flex items-center gap-2.5 border-t py-[7px]">
        <span className="h-5 w-[3px] shrink-0 rounded-[2px]" style={{ backgroundColor: "#395AA0" }} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-body truncate text-[13px] leading-[1.25] font-semibold">Thesis — lit review</span>
          <span className="text-faint truncate text-[11px] leading-[1.3]">Thesis · 9:40 AM</span>
        </div>
        <span className="text-body shrink-0 text-[13px] font-semibold tabular-nums">1h 50m</span>
      </div>
    </section>

    <div aria-hidden className="bg-hairline h-px w-full mt-4" />
    <section className="flex flex-col gap-2.5 pt-3">
      <SectionHeader label="Goals this week" href="/goals" />
      <GoalQuotaRows goals={[
        { id: "g1", title: "Thesis", color: "#395AA0", quotaHours: 10, actualMs: 6.5 * H },
        { id: "g2", title: "Spanish", color: "#E07042", quotaHours: 3, actualMs: 2 * H },
      ]} />
    </section>
  </main>
</div>
```

## Where the truth lives

`styles.css` → `_ds_bundle.css` holds every token and every compiled utility —
grep it before using a class not quoted here. Each component's API is its
`components/<group>/<Name>/<Name>.d.ts`; realistic usage is in the matching
`<Name>.prompt.md` and preview.

# Progra (progra@0.1.0)

This design system is the published progra React library, bundled as a single
browser global. All 42 components are the real upstream code.

## Where things are

- `_ds_bundle.js` — the whole-DS bundle at the project root; loads every component to `window.Progra`. First line is a `/* @ds-bundle: … */` metadata header.
- `styles.css` — the single stylesheet entry: it `@import`s the tokens, fonts, and component styles (`_ds_bundle.css`). Link this one file.
- `components/<group>/<Name>/<Name>.prompt.md` (example JSX + variants), `<Name>.d.ts` (types), `<Name>.html` (variant grid).
- `tokens/*.css` — CSS custom properties, names verbatim from upstream.
- `fonts/` — `@font-face` files + `fonts.css` (when the package ships fonts).
- `guidelines/` — the design system's own usage guidance (1 doc(s), see `guidelines/index.md`). Read these before composing larger layouts.

For a specific component, `read_file("components/<group>/<Name>/<Name>.prompt.md")`.

## Loading

Add these two lines to your page once (React must be on the page first):

```html
<link rel="stylesheet" href="styles.css">
<script src="_ds_bundle.js"></script>
```

Components are then available at `window.Progra.*`. Mount into a dedicated child node (e.g. `<div id="ds-root">`), not the host page's own React root, so the two trees don't collide:

```jsx
const { AlertDialog } = window.Progra;
ReactDOM.createRoot(document.getElementById('ds-root')).render(<AlertDialog />);
```

## Tokens

2 CSS custom properties from progra. Names are
preserved verbatim from upstream. See `tokens/` for the full list.

- **typography** (2): `--font-hanken`, `--font-newsreader`

## Components

### general
- `AlertDialog`
- `AvatarInitials`
- `Badge`
- `BottomNav`
- `Button`
- `Card`
- `CategoryMarker`
- `CategoryPicker`
- `Checkbox`
- `ClockedInStrip`
- `ColorSwatches`
- `Dialog`
- `GoalProgressBar`
- `Input`
- `Label`
- `PageSkeleton`
- `PrograMark`
- `Textarea`
- `Toaster`

### v2
- `AutoEndNudge`
- `BackButton`
- `BackLink`
- `BottomSheet`
- `CategoryDonut`
- `ChipRail`
- `Donut`
- `FriendsLeaderboard`
- `GoalQuotaRows`
- `HabitWeekGrid`
- `InviteShare`
- `MenuRow`
- `PrimaryButton`
- `RecapFeedCard`
- `RecapNudge`
- `ReferFriendButton`
- `SectionHeader`
- `SessionCard`
- `SessionPlanPicker`
- `ToggleSwitch`
- `WeekPulse`
- `WeekSummary`
- `WhatsNewModal`
