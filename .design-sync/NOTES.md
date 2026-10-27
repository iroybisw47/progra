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
- **Server edges are stubbed through `cfg.tsconfig`, not by excluding
  components** (2026-10-08). `cfg.tsconfig` points at
  `.design-sync/tsconfig.json`, whose `paths` send `@/app/actions/<mod>` to
  `.design-sync/stubs/actions/<mod>.ts` and `next/navigation` to
  `stubs/next-navigation.ts`, ahead of the catch-all `@/*` rule. The builder's
  tsconfig-paths plugin takes the FIRST matching rule in key order and falls
  through to the next on a miss — so an action module with no stub file
  silently resolves to the REAL action and drags `lib/supabase/server` into
  the bundle. Each stub is typed against the real action with an
  `import type * as real` (erased by esbuild), which is how two return-shape
  mismatches (`reacted` on the kudos toggles) were caught. Check after any
  entry change: no `app/actions`, `lib/db` or `lib/supabase` path in the
  bundle metafile's inputs.
  - Consequence: the old `node_modules/server-only` no-op package is no longer
    needed — nothing reaches `lib/db` values any more (type-only imports are
    erased). Don't recreate it.
  - The tsconfig's comments must not contain a slash-star pair: the plugin
    strips block comments with a regex before `JSON.parse`.
  - Still excluded (`null`): anything that reads on the server or is a whole
    screen — ProgressClient, FeedV2, Manage*, CommentThreads, etc.
- **process shim**: `next/link` / `next/navigation` internals read
  `process.env.__NEXT_*` at module scope; `.design-sync/process-shim.ts` (the
  entry's first import) defines `globalThis.process` so the bundle evaluates
  in the browser. Without it `window.Progra` comes up empty and every card
  errors `process is not defined`.
  It also sets the PRODUCTION flags (`NEXT_PUBLIC_REDESIGN=1`,
  `NEXT_PUBLIC_SOCIAL_ENABLED=1`). Without them `lib/flags` reads false and
  BottomNav renders the retired Home/Search/Goals/Habits tabs — which is what
  the August sync shipped. Keep it in step with the flags prod runs; leave
  `NEXT_PUBLIC_ANALYTICS` unset so `track()` stays a no-op.
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
- **Excluded components** — see the `null` entries in `cfg.componentSrcMap`.
  **Retired 2026-10-08:** WeekStrip, Tabs, Separator (nothing in the app
  imports them) and WeekBreakdown (only the pre-REDESIGN screens do). Keeping
  dead components in the DS invites mockups built from patterns the app no
  longer has.
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
  from `components/*.tsx` sources. Type-check previews against the real types
  before building, with a throwaway tsconfig that maps `progra` →
  `.design-sync/entry.ts` and `@/app/actions/*` → the stubs (the app's own
  `tsc` never sees `.design-sync/` — dot-directories fall outside its glob).
  The PageSkeleton preview sat broken from August to October because nothing
  checked it. ESLint DOES lint `.design-sync/`: read `Date.now()` at module
  scope in previews, never during render (react-hooks/purity).
- Use current palette hexes (`lib/palette.ts`) in fixtures, and pass goal
  `color`s — GoalQuotaRows falls back to an id-derived hue without one.
- `CategoryMarker` with `color=null` renders nothing by design.

- Fixture dates: build day-anchored timestamps at **noon UTC**
  (`Date.UTC(y, m, d, 12)`). UTC midnight renders as the previous day in
  every US timezone — the RecapFeedCard preview read "Week of Sep 27" (a
  Sunday; weeks start Monday) until this was fixed.
- Fixture data is uploaded and browsed by people: fictional names and
  `example.com` addresses only. The August Label preview shipped a
  real-looking address (`…@quantluxdigital.io`); replaced 2026-10-08.
- Visually inert states don't get a cell. ToggleSwitch's `disabled` blocks
  taps but doesn't dim, so a Disabled cell photographed identically to Off.
- WeekPulse is captured at its first frame (the staggered `bar-pulse`
  delays haven't started), so its bars read as full-height squares. That IS
  the app's first paint at the app's real width (200px, done-splash) —
  graded good, not a bug.
- FriendsLeaderboard's "resets in …" reads the live clock (`useNowMinute`);
  it changes pixels between runs but grades follow sources, so it never
  invalidates.

- **`cfg.guidelinesGlob` is pinned to `docs/SCREENS.md`.** The default
  (`docs/*.md`, …) swept in the App Store review docs added to `docs/` after
  the August sync — including `app-review-demo-account.md` — and they would
  have shipped into the design project. Anything new in `docs/` stays local
  unless it is added to the glob on purpose.

## Known render warns

- `[RENDER_THIN]` on **Dialog, AlertDialog, Toaster, BottomSheet,
  WhatsNewModal** (`maxHeight: 0`) —
  their content renders in portals outside the measured root; the screenshots
  (9–21KB) show full dialogs/toasts and all cells are graded good. Legitimate,
  expected on every sync.

## Re-sync risks

- **`conventions.md` is ~13.7k chars** — well past the skill's 2–4k
  guidance but deliberately so (it carries the token tables, palette and a
  full screen example the design agent needs). The README is ~16k, inside the
  ~32k inline window; if the component count grows a lot, watch the build's
  size warning and trim the header's tables first.
- Fetch the real `_ds_sync.json` from the project before trusting a diff.
  On 2026-10-08 verification first ran against the local August copy (no
  DesignSync auth yet); the real anchor turned out identical, but that is luck,
  not a guarantee.
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
- The `node_modules/progra` symlink (junction on Windows) and `.ds-sync/`
  staging are machine state — recreate both on a fresh clone before running
  the driver.
- The compiled Tailwind CSS goes stale whenever `app/globals.css` or app
  class usage changes — `cfg.buildCmd` must run before the converter on every
  re-sync (the driver does this when configured).
- Google Fonts remote import means previews/designs need network to show
  brand fonts; offline renders fall back silently.
- `.design-sync/fonts.css` duplicates the font weights declared in
  `app/layout.tsx` (Hanken 300–700, Newsreader 400–600 + italic) — update it
  if the app's font config changes.
- New components added under `components/` do NOT auto-appear: add them to
  `.design-sync/entry.ts` AND `cfg.componentSrcMap`, author a preview, and if
  the component calls a server action, add a stub file for that module.
- Groups in the DS pane follow source folders: `components/v2/*` → **v2**,
  everything else → **general**. `conventions.md` tells the design agent to
  prefer **v2**; moving a component between folders changes its group.
