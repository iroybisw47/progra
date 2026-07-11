# design-sync notes — Progra

Repo-specific gotchas for future syncs.

- **This is an app, not a packaged DS.** No dist, no Storybook. The bundle
  entry is the hand-authored `.design-sync/entry.ts` (client-safe surface
  only), wired via `cfg.entry`. Components are enumerated in
  `cfg.componentSrcMap` (server-coupled ones pinned to `null`).
- **Self-junction required**: `node_modules/progra` is a junction to the repo
  root, created with PowerShell `New-Item -ItemType Junction`. The converter
  resolves the package and `tokensPkg` through it, and authored previews
  `import ... from "progra"` rely on it. **Recreate it on a fresh clone** —
  junctions aren't committed.
- **process shim**: `next/link` / `next/navigation` internals read
  `process.env.__NEXT_*` at module scope; `.design-sync/process-shim.ts` (the
  entry's first import) defines `globalThis.process` so the bundle evaluates
  in the browser. Without it `window.Progra` comes up empty and every card
  errors `process is not defined`.
- **CSS is compiled per-sync**: `cfg.buildCmd` runs the Tailwind v4 CLI over
  `app/globals.css` into `.design-sync/.cache/tailwind-compiled.css`
  (`cfg.cssEntry`). Consequence: **only utility classes the app itself uses
  exist in the shipped stylesheet** — preview glue must stick to classes the
  app already uses (grep `ds-bundle/_ds_bundle.css` before using one).
- **Fonts**: Hanken Grotesk + Newsreader load from Google Fonts via the remote
  `@import` in `.design-sync/fonts.css`, shipped as `tokens/fonts.css`
  (`cfg.tokensPkg: "progra"` + `cfg.tokensGlob` — tokensGlob is a STRING and
  only works when tokensPkg is set). The file also defines `--font-hanken` /
  `--font-newsreader`, which next/font injects in the app but nothing defines
  in the bundle.
- **Playwright**: cached chromium build 1217 in `%LOCALAPPDATA%\ms-playwright`
  pins `playwright@1.59.0` (installed in `.ds-sync/`).
- **Excluded components** (import server actions / Supabase): WeeklyHabits,
  RecapCard, GoalPicker, HomeActions, SessionDialog,
  CategorizationReviewDialog, CategorizeEventsButton, CategorizePeriodButton,
  EventCategoryDialog, SyncCalendarButton, EnsureProfileSync.
- **Overlay/fixed overrides**: Dialog / AlertDialog / Toaster / BottomNav have
  `cardMode: single` (+ viewports) in `cfg.overrides` — Dialog family renders
  open-state via portals, BottomNav is `position: fixed`.

## Preview-authoring facts (folded from wave 1)

- **`cfg.overrides` viewport changes require a full `package-build.mjs`
  re-stamp** before `preview-rebuild.mjs` will touch the affected components
  (`[CONFIG_STALE]`; `viewport` is a graded knob, `cardMode`/`primaryStory`
  are exempt). Subagents can't run the full build — orchestrator applies
  override changes, rebuilds, THEN dispatches waves.
- **Toaster**: sonner's `toast()` must be a bundle export (`export { toast }
  from "sonner"` in `.design-sync/entry.ts`) — importing `toast` from
  `"sonner"` inside a preview bundles a second sonner instance whose state
  the bundled Toaster never sees.
- Compiled-CSS class availability (beyond the safe list): PRESENT `max-w-md,
  h-4/5/8/10, font-mono, grid, grid-cols-2, text-base, flex-1,
  justify-between, items-start, text-foreground, w-fit, mt-1, tabular-nums,
  capitalize, leading-none`; ABSENT `space-y-*, gap-1.5, max-w-xs,
  font-serif, min-h-24, w-64, w-72, w-80`. Width glue: `w-full max-w-sm`.
- Prefer inline `<svg>` over lucide-react imports in previews (components'
  own `[&>svg]` rules size them).
- Label disabled styling: wrap in `<div data-disabled="true" className="group">`.
  `aria-invalid="true"` on Input/Textarea shows the error treatment.
  Vertical Separator needs explicit `h-4` in a plain flex row.
- **BottomNav**: `position: fixed` escapes capture — its preview wraps it in
  `style={{ transform: "translate(0)", position: "relative" }}` so the wrapper
  becomes the containing block. The component itself was hardened
  (`usePathname() ?? ""`) because a null pathname outside a Next router
  crashed the tab matchers — this fix is what makes BottomNav usable in
  Claude Design at all.
- Generated `.d.ts` are untyped (`[key: string]: unknown`) — prop shapes come
  from `components/*.tsx` sources. Data shapes: `WeekStrip.markedDates` =
  `Set<"YYYY-MM-DD">` (Mon-first weeks); `WeekBreakdown` rows =
  `CategoryBreakdownRow` (`lib/aggregate.ts`; goal rows use
  `color: "var(--primary)"`, names prefixed `"Goal: "`); `CategoryPicker`
  takes `lib/storage.ts` `Category` with hexes from `lib/category-colors.ts`
  (12 fixed; `color: null` valid). `CategoryMarker` with `color=null,
  isGoal=false` renders nothing by design.

## Known render warns

- `[RENDER_THIN]` on **Dialog, AlertDialog, Toaster** (`maxHeight: 0`) —
  their content renders in portals outside the measured root; the screenshots
  (9–21KB) show full dialogs/toasts and all cells are graded good. Legitimate,
  expected on every sync.

## Re-sync risks

- The `node_modules/progra` junction and `.ds-sync/` staging are machine
  state — recreate both on a fresh clone before running the driver.
- The compiled Tailwind CSS goes stale whenever `app/globals.css` or app
  class usage changes — `cfg.buildCmd` must run before the converter on every
  re-sync (the driver does this when configured).
- Google Fonts remote import means previews/designs need network to show
  brand fonts; offline renders fall back silently.
- `.design-sync/fonts.css` duplicates the font weights declared in
  `app/layout.tsx` (Hanken 300–700, Newsreader 400–600 + italic) — update it
  if the app's font config changes.
- New components added under `components/` do NOT auto-appear: add them to
  `.design-sync/entry.ts` AND `cfg.componentSrcMap` (client-safe only).
