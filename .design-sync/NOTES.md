# design-sync notes — Progra

Repo-specific gotchas for future syncs.

- **This is an app, not a packaged DS.** No dist, no Storybook. The bundle
  entry is the hand-authored `.design-sync/entry.ts` (client-safe surface
  only), wired via `cfg.entry`. Components are enumerated in
  `cfg.componentSrcMap` (server-coupled ones pinned to `null`).
- **Self-link required**: `node_modules/progra` points at the repo root. The
  converter resolves the package and `tokensPkg` through it, and authored
  previews `import ... from "progra"` rely on it. **Recreate it on a fresh
  clone** — it is never committed.
  - macOS/Linux: `ln -sfn .. node_modules/progra` (a plain symlink; the
    original Windows `New-Item -ItemType Junction` has no equivalent here and
    isn't needed — esbuild follows the symlink fine).
  - Windows: `New-Item -ItemType Junction`.
- **`server-only` must be stubbed.** `lib/db/*` imports the `server-only`
  package, which the repo never installs directly — Next ships its own copy at
  `next/dist/compiled/server-only`, and that copy's `index.js` **throws by
  design**. Either way the bundle won't build. Fix: create a no-op package at
  `node_modules/server-only/` (`package.json` + empty `index.js`). Machine
  state — recreate on a fresh clone. It's safe because `.design-sync/entry.ts`
  only exposes the client-safe surface, so nothing server-coupled is reached.
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
- **Playwright**: installed into `.ds-sync/`, and the browser build must match
  the pinned version or capture fails.
  - macOS cache is `~/Library/Caches/ms-playwright` — **not**
    `~/.cache/ms-playwright`; checking the latter reports "no browsers" on a
    machine that has them. Current: `playwright@1.62.1` + chromium build 1234.
  - Windows cache was `%LOCALAPPDATA%\ms-playwright` (chromium 1217,
    `playwright@1.59.0`).
- **`_vendor/` filenames** are `react.js` and `react-dom.js` — not the
  `*.production.min.js` names the layout docs suggest. Build the upload list
  from the live `ds-bundle/` tree, never from remembered names.
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

- **`conventions.md` is hand-written prose and does not track the tokens.**
  It went stale exactly this way once: it described the pre-V2 palette
  ("warm, paper-like, cream surfaces, deep-teal brand `#355a52`") long after
  commit `f57e751` (V2 redesign) changed `--brand` to navy `#1c3a5e` /
  `#7fa3cc` dark and flattened surfaces to white over cool grey. Nothing in
  the pipeline catches this — validate only checks that named tokens exist,
  and every name it listed was still real. Since the header is prepended
  verbatim into the README the design agent reads, a stale palette misdirects
  the brand of every design built from it. **On each re-sync, diff its colour
  claims against `app/globals.css` `:root` before uploading.**
- The `node_modules/progra` symlink (junction on Windows), the `server-only`
  stub, and `.ds-sync/` staging are all machine state — recreate all three on
  a fresh clone before running the driver.
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
