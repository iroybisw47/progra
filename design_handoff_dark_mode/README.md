# Handoff: Progra dark mode

## Overview
Adds a dark theme to the whole app plus an **Appearance** setting (System / Light / Dark) in Settings. Every existing screen keeps its layout, type, spacing and copy exactly as built; only colors change. The one new piece of UI is a "Display" section in Settings with an Appearance row and its bottom sheet.

Repo: `iroybisw47/progra` (Next.js 16 App Router, Tailwind v4, shadcn/Base UI, Capacitor iOS shell).

## About the design files
`Progra Dark Mode.html` is a **design reference built in HTML**, not production code. It rebuilds 12 screens from the repo's own components and applies the dark theme by overriding CSS variables on a wrapper element. Implement it in the existing codebase with its existing components and Tailwind tokens; do not copy the HTML. In the app the theme is applied by putting `class="dark"` on `<html>` (§4.4).

The mockup has two Tweaks: `theme` (dark / light — light is the current UI, rebuilt for comparison) and `palette` (night / original — shows the entity palette before the dark-mode lift).

## Fidelity
**High fidelity.** Every color value below is final. Layout is the current production layout; where the mock and the repo disagree on layout, the repo wins.

---

## 1. How it works
- All surface, line and text colors already flow through CSS variables in `app/globals.css` (`:root`), and the Tailwind utilities (`text-ink`, `bg-track`, `border-hairline`, …) resolve to `var(--token)` through `@theme inline`. Dark mode is **one `.dark {}` block** that redefines those variables. Paste-ready: `dark-tokens.css` in this folder.
- `@custom-variant dark (&:is(.dark *));` is already at the top of `globals.css`, so the `dark:` utilities that shadcn components and `components/bottom-nav.tsx` already carry (`dark:border-white/10 dark:bg-[rgba(20,24,31,0.9)]`) start matching as soon as `.dark` exists.
- Put `.dark` on **`<html>`**. `--cat-*` and `--chart-*` are declared on `:root` as `var(--palette-N)`. When `.dark` is on the same element they resolve to the dark palette; on a descendant they would not.
- The ground `#14181f` is the old dark theme's color. It's still in the nav's `dark:` class, and it was the dark `themeColor` the CHANGELOG says was removed.

## 2. Tokens
Greys keep the **contrast ratio they have against white today**, measured against `#14181f` (WCAG formula, same hue/chroma, plus about +0.15 for light-on-dark). Captions and eyebrows stay exactly as soft as light mode; this was a deliberate product choice. Lines are translucent white so they hold on both the screen and the lighter sheet surface.

| Token | Light | Dark | Notes |
|---|---|---|---|
| `--screen` / `--background` | #ffffff | **#14181f** | every screen |
| `--card` / `--popover` / `--card-warm` | #ffffff | **#1b1f26** | sheets and dialogs sit one step up |
| `--inset` / `--accent` | #f6f7f8 | rgba(255,255,255,.035) | Clock "This week" panel |
| `--inset-2` | #fafbfc | rgba(255,255,255,.02) | day-strip chips |
| `--track` / `--secondary` / `--muted` / `--busy` | #f1f3f5 | rgba(255,255,255,.055) | tracks, chip rails, bands |
| `--hairline` | #eceef1 | rgba(255,255,255,.07) | section rules |
| `--divider` | #f4f5f7 | rgba(255,255,255,.045) | row dividers |
| `--control-border` / `--border` / `--input` | #e6e9ed | rgba(255,255,255,.09) | 1.5px outlines |
| `--warm-border` | #e6e9ed | rgba(255,255,255,.14) | sheet grab handle |
| `--app-bg` | #e9ebef | #0b0d11 | desktop ground |
| `--ink` | #12171d | #e9f1fa | ~15.6:1 |
| `--body` / `--foreground` | #1b2129 | #d8e0eb | ~13.4:1 |
| `--secondary-ink` / `--muted-foreground` | #5d6672 | #8c95a2 | 5.9:1 (light 5.8) |
| `--caption` | #8b929c | #646b74 | 3.3:1 (light 3.1) |
| `--faint` | #9fa6b0 | #555b64 | 2.6:1 (light 2.45) |
| `--disabled` | #c3c8ce | #3e4247 | 1.75:1 (light 1.68) |
| `--brand` / `--primary` / `--ring` | #1c3a5e | **#a5c0e1** | pale navy, 9.5:1 on ground |
| `--primary-foreground` | #ffffff | **#142c49** | text on brand fills, 7.5:1 |
| `--brand-deep` | #142c49 | #142c49 | **unchanged**: recap navy grounds |
| `--sand` | #d9e2ec | rgba(165,192,225,.14) | strong navy tint |
| `--sand-ink` | #142c49 | #bed6f5 | |
| `--tint-you` | rgba(28,58,94,.05) | rgba(165,192,225,.06) | your leaderboard row |
| `--done` / `--success` | #266b4d | #65a887 | |
| `--destructive` | #9c5148 | #cc7c72 | still muted terracotta |

**Navy chrome inverts.** A navy fill on a near-black ground gives the active-tab label and "Clocked in now" eyebrow (both `text-brand`) under 2:1. So `--brand` becomes a pale navy that works both as text and as a fill, and every brand fill already uses `text-primary-foreground`, which becomes deep navy. Result: the Clock FAB, selected chips, primary buttons, rank-1 badge and request count are pale navy with navy text. The navy glow becomes `--glow` (a faint pale halo).

**New tokens** (replace hard-coded light-only values; light value = today's hex):

| Token | Light | Dark |
|---|---|---|
| `--logo` | #1c3a5e | #1c3a5e |
| `--uncategorized` | #9fa6b0 | #5f6670 |
| `--unchecked` | #dfe3e8 | rgba(255,255,255,.11) |
| `--today-ring` | #b7c4d3 | rgba(165,192,225,.4) |
| `--dash` | #d5d9df | rgba(255,255,255,.16) |
| `--destructive-line` | #f0e3e0 | rgba(204,124,114,.28) |
| `--backdrop` | rgba(18,23,29,.34) | rgba(0,0,0,.55) |
| `--glow` | rgba(28,58,94,.55) | rgba(165,192,225,.16) |
| `--nav-glass` | rgba(255,255,255,.92) | rgba(20,24,31,.9) |

## 3. Entity palette in dark
The rule is that **a goal's hue never changes**. Fills under 3:1 against the sheet surface `#1b1f26` are raised in OKLCH lightness, with chroma and hue held, to just clear 3:1. Only three need it. Inks (a palette color used as *text*) are raised to ≥ 4.5:1 against their own 12% wash on `#1b1f26`. Wash alphas don't change: **12%** for `tint()` (habit pills, duration chip, selected rows) and **16%** for avatars. Glyphs on filled chips stay `#fff`.

| # | Name | Fill light → dark | Ink light → dark |
|---|---|---|---|
| 0 | Maroon | #8E3A44 → **#a44e57** | #6E2530 → #cd737a |
| 1 | Red | #DE5148 (same) | #BE362D → #ee6056 |
| 2 | Orange | #E07042 (same) | #C24E14 → #e27244 |
| 3 | Gold | #D6A728 (same) | #8F6C0A → #D6A728 |
| 4 | Light green | #7CBE6D (same) | #356B2F → #7CBE6D |
| 5 | Green | #2E8B50 (same) | #175E33 → #46a164 |
| 6 | Light blue | #77B7C6 (same) | #22758C → #77B7C6 |
| 7 | Dark blue | #395AA0 → **#4567ae** | #33518F → #688dd7 |
| 8 | Purple | #A084B3 (same) | #7A57A0 → #a488b7 |
| 9 | Dark purple | #6F4E93 → **#7b5aa0** | #533672 → #a07fc8 |
| 10 | Pink | #D06DA1 (same) | #BA4485 → #d471a5 |

Stored colors do not change; the database keeps the light fill hex. Only display resolves to the theme.

## 4. Code changes

### 4.1 `app/globals.css`
- Add the new tokens to `:root`, register them in `@theme inline`, and add the `.dark` block (all in `dark-tokens.css`).
- `html { color-scheme: light; }` sits in `@layer base`. The unlayered `.dark { color-scheme: dark; }` overrides it, so leave the base rule. Update the "Progra has no dark mode" comments.

### 4.2 Palette plumbing (the one non-trivial change)
Entity colors are resolved to **hex in JS** and painted inline (`style={{ backgroundColor: entityColor(c) }}`), so they won't follow the theme on their own. Make the display helpers return CSS variables:
- `lib/colors.ts`
  - `entityColor(hex)` → `var(--palette-N)`, where N is the index of `normalizeFill(hex)` in `PALETTE`. Otherwise `var(--uncategorized)`.
  - `entityInk(hex)` → `var(--palette-N-ink)`. Same for `inkFor` in `lib/palette.ts` when used for display.
  - `tint(hex, alpha)` → `color-mix(in srgb, var(--palette-N) ${alpha*100}%, transparent)`.
  - `goalColorOf`, `goalColor`, `userColor` → the `var()` form.
- **Keep hex variants** (for example `entityFillHex`) for anything that computes on the number: `mixToWhite` / `entityOnDark` / `entityChipInk`, `resolveAttributionColor` in `lib/session-attribution.ts` (the iOS Live Activity and widget payloads), and any canvas or image export. Grep for `normalizeFill`, `isPaletteFill`, `=== c.fill` and `parseHex` callers, and make sure they still get hex.
- `components/avatar-initials.tsx`: background `tint(color, 0.16)` and text `inkFor(color)` go through the var forms.
- `components/category-marker.tsx`: `normalizeFill(color) ?? color` → `entityColor(color)`.
- `components/color-swatches.tsx`: paint `var(--palette-N)` but keep emitting `c.fill` (hex) to `onChange`. The unselected border `#e6e9ed` becomes `var(--control-border)`.
- `components/v2/recap-feed-card.tsx`: `c.color ?? "var(--chart-5)"` → route `c.color` through `entityColor`.
- `components/v2/donut.tsx` already accepts `var()` strings; SVG `stroke="var(--x)"` works.

### 4.3 Hard-coded light values
| File | Now | Change to |
|---|---|---|
| `components/v2/progress-client.tsx` | unchecked habit box `border-[#dfe3e8]` | `border-unchecked` |
| `app/clock/clock-client.tsx` | today chip `border-[#b7c4d3]` | `border-today-ring` |
| `app/clock/clock-client.tsx` | selected day `text-white/70`, `text-white` | `text-primary-foreground/70`, `text-primary-foreground` |
| `app/clock/clock-client.tsx` | dashed add row `border-[#d5d9df]` | `border-dash` |
| `components/v2/manage-goals.tsx` (+ manage-habits / manage-sessions if they use the same) | Delete `border-[#f0e3e0]` | `border-destructive-line` |
| `components/v2/bottom-sheet.tsx` | backdrop `bg-[rgba(18,23,29,.34)]` | `bg-backdrop` |
| `components/clocked-in-strip.tsx` | `bg-[rgba(28,58,94,.08)]` | `bg-brand/8` |
| `components/v2/recap-feed-card.tsx` | `bg-[rgba(28,58,94,.05)]` | `bg-brand/5` |
| CTA glows (`primary-button.tsx`, `clock-client.tsx`, `invite-share.tsx`, `friends-client.tsx`, live timer) | `shadow-[…rgba(28,58,94,.55)]` | `shadow-[0_10px_22px_-10px_var(--glow)]` |
| `components/progra-mark.tsx` | rect `fill="var(--brand)"` | `fill="var(--logo)"` (the logo stays navy) |
| `app/clock/live/live-timer-client.tsx` | root `bg-card` | `bg-screen` (otherwise the timer is lighter than every other screen in dark) |
| `components/recap-story/recap-story-v2.tsx` | root and overlay `bg-white` (≈ lines 245, 330) | `bg-screen` |
| `components/recap-story/share-slide.tsx` | textarea `bg-white` | `bg-card` |
| `components/bottom-nav.tsx` | `bg-[rgba(255,255,255,0.92)] … dark:bg-[rgba(20,24,31,0.9)]` | fine as-is, or `bg-nav-glass` |

Keep as-is: `text-white` glyphs inside palette-filled chips, the closing slide's white CTA with `text-brand-deep` (it sits on navy), and `bg-brand-deep` recap grounds (`--brand-deep` doesn't change).

Then grep `bg-white`, `text-white`, `#fff`, `rgba(28,58,94` and `#[0-9a-f]{6}` in `app/` and `components/`, and classify anything left over.

### 4.4 Appearance (System / Light / Dark)
- **Preference:** `localStorage["progra.appearance"]` = `"system" | "light" | "dark"`, default `"system"`. Stored per device, like the habit reminder pref (`lib/habit-reminder-prefs.ts`); no DB column.
- **No-flash apply:** add an inline `<script>` in `<head>` of `Shell` in `app/layout.tsx` that runs before paint. It reads the pref, resolves `"system"` with `matchMedia('(prefers-color-scheme: dark)')`, toggles `dark` on `document.documentElement`, and sets `<meta name="theme-color">` to `#14181f` or `#ffffff`. Add `suppressHydrationWarning` to `<html>`.
- **Live updates:** a small client hook (`useAppearance()`) exposes `{ pref, resolved, setPref }`. It writes localStorage, re-applies the class, and while `pref === "system"` listens to the `matchMedia` `change` event.
- **`viewport.themeColor`** (`app/layout.tsx`, currently `"#ffffff"` with a comment saying there's no dark mode): use `[{ media: "(prefers-color-scheme: light)", color: "#ffffff" }, { media: "(prefers-color-scheme: dark)", color: "#14181f" }]`. The script corrects it when a manual choice disagrees with the system.
- **Toaster:** `components/ui/sonner.tsx` is pinned to light; pass `theme={resolved}`.
- **iOS shell:**
  - The status bar content has to flip to light on dark. Use the same Capacitor SystemBars path the recap's navy slides already use.
  - `capacitor.config.ts` gives the webview a light background so overscroll isn't black (see its comment near lines 25–28). With dark mode, that edge should be `#14181f` while dark. Either set the native webview/scroll-view background from the resolved theme, or knowingly accept a light overscroll edge.
  - `entityOnDark` and the widget code stay as they are.

## 5. Screens (in the mock)
Layout is unchanged everywhere except screens 08–09. What to check in dark:

1. **Progress · Today** (`components/v2/progress-client.tsx`). Chip rail on `--track`; the active chip is pale navy with navy text. Donut track `--track`. Habit pills: checked = 1.5px border in the fill, 12% wash, label in the ink; unchecked = `--hairline` border, `--unchecked` box, `--caption` label.
2. **Progress · Week.** Week bar on `--track`. `HabitWeekGrid`: done = fill with a white check; not done = `--hairline` border; future days at 35% opacity; today's letter `--brand`.
3. **Feed** (`feed-v2.tsx`). Clocked-in duration pill is `bg-brand/8` with `text-brand`. Session card duration chip is a 12% wash with ink text. Avatars are a 16% wash with ink text. Recap panel `bg-brand/5`; rank `#2` in `--brand`.
4. **Clock · pick a goal** (`clock-client.tsx`). The picker chip's open state has a `--brand` border. The selected "Goal" toggle and selected goal pill are filled (pill in the goal's fill, white text). The CTA is pale navy with navy text and `--glow`. The "This week" inset is on `--inset`.
5. **Clock · running timer** (`live-timer-client.tsx`). Ground `bg-screen` (§4.3). The ring track is `--track`, and the ring and target bar use the session's fill. Pause is outlined; Clock out is pale navy.
6. **Friends** (`friends-client.tsx`, `friends-leaderboard.tsx`). The invite button is pale navy. The Requests eyebrow and count badge are `--brand`. The rank-1 badge is pale navy; ranks 2–3 are on `--track`. Your row is `--tint-you`. Block is `--destructive`.
7. **You** (`app/me/page.tsx`). Serif name `--ink`, stats `--ink` over `--disabled` labels, bands on `--track`.
8. **Settings** (`settings-client.tsx`). **New "Display" section** right after Account, using the existing `Band` + `SectionLabel` + `Row` pieces:
   - `Row label="Appearance" value="System" | "Light" | "Dark"` with a chevron, opening the sheet.
   - Under it, an `Inset` line (`text-caption text-xs leading-relaxed`): "Matches your phone — dark right now. Set on this device only." For a manual choice, use "Set on this device only."
9. **Appearance sheet (new).** `BottomSheet` / `BottomSheetContent title="Appearance" meta="This device"`.
   - Three rows in `MenuRow` rhythm (`border-divider border-t py-3.5 text-[15px]`): **System**, **Light**, **Dark**.
   - Selected row: label `text-ink font-semibold`, plus a trailing `CheckIcon className="text-brand size-4" strokeWidth={2.4}` (the same check as `TimezonePicker`). Unselected: `text-body font-medium`.
   - The System row carries meta `text-faint text-xs`: "Dark right now" or "Light right now".
   - Footnote after a divider (`text-caption text-xs leading-relaxed`): "System follows your phone’s setting."
   - Tapping a row applies immediately and closes the sheet. There's no Save button.
10. **Bottom sheet · edit goal** (`manage-goals.tsx`). Sheet surface `--card` `#1b1f26`, backdrop `--backdrop`, handle `--warm-border`, title `--ink`. Delete button border `--destructive-line`. Swatches show the dark fills; the unselected swatch border is `--control-border`.
11. **Session detail** (`app/session/[id]/session-view.tsx`). Same treatment as the feed card at a larger size. The composer's Post button is pale navy, disabled at 40%.
12. **Weekly recap** (`components/recap-story/*`). The white slides go dark (`bg-screen`, §4.3). Pips are `--track` / `--brand`. The Loading and Closing slides stay `bg-brand-deep` navy in both themes.

**BottomNav:** frosted `rgba(20,24,31,.9)` with a `white/10` top border (already in code). The FAB is pale navy with a navy icon, ringed by `--screen`. Tracking state: `bg-cat-blue` resolves to `#4567ae` with white digits. Paused: `bg-disabled` `#3e4247`.

## 6. Verify after implementing
- shadcn `Button` outline/secondary and `Input` (their `dark:bg-input/30` and similar now match) on `#14181f`.
- `ToggleSwitch`: the white knob on the pale `--brand` track.
- Session photos are not dimmed.
- Flip Light/Dark/System on device: no flash of the wrong theme on cold launch, the status bar flips, and the overscroll edge looks right.

## Files
- `Progra Dark Mode.html`: self-contained mockup (open in a browser; Tweaks for theme and palette).
- `dark-tokens.css`: paste-ready tokens.
- Screen-to-source map: `github.md` at the project root.
