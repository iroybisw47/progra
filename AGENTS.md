<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
# AGENTS.md

Instructions for any AI coding agent (Claude Code, etc.) working in this repo.
Read this before writing any code.

<!-- BEGIN:nextjs-agent-rules -->
## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure
may all differ from your training data. **Read the relevant guide in
`node_modules/next/dist/docs/` before writing any code.** Heed deprecation
notices. Known gotchas: it's `proxy.ts` not `middleware`; dynamic route
params are `Promise<{...}>` and must be `await`ed.
<!-- END:nextjs-agent-rules -->

## Read these first, in order

1. This file (`AGENTS.md`)
2. `HANDOFF.md` — working relationship, conventions, current status
3. `ARCHITECTURE.md` — system map 
4. `CHANGELOG.md` — dated change log, newest first
5. Whatever `.claude/plans/*.md` file is relevant to the task at hand

## Data flow — never mix these

- **Client → actions (writes) only.** Reads happen server-side in `page.tsx`
  via `lib/db/*`.
- **Reads only in `lib/db/*`** (`server-only`). **Writes only in
  `app/actions/*`** (`"use server"`). Never mix the two.
- `"use server"` files export **only async functions** — constants/types go
  in `lib/*`, or the build breaks.
- New read helpers must be `cache()`-wrapped. New dialogs must be
  `next/dynamic` lazy.

## Auth & security — load-bearing, do not bypass

- **Never call `supabase.auth.getUser()`** in pages/actions — use
  `getCurrentUser()` (local `getClaims()`). RLS is the security authority,
  not app-layer checks.
- **Never bypass RLS.** The app relies 100% on `auth.uid()` scoping — social
  reads must be provably DB-gated. Prove RLS/security changes with the
  adversarial JWT test before shipping to prod.
- **No service-role key in user-facing paths**, with one documented
  exception: Storage **writes** go through `lib/supabase/admin.ts` after
  explicit in-action ownership/identity verification (Storage rejects all
  user-JWT uploads as anon). Current call sites: `uploadSessionPhoto`,
  `uploadAvatar`/`removeAvatar`. Everything else is anon-key + RLS;
  privileged operations are `is_admin()`-gated `SECURITY DEFINER` RPCs —
  never a god-key shortcut.
- Every FK to `auth.users` is `ON DELETE CASCADE` **except**
  `profiles.referred_by`, which is a **deliberate** `ON DELETE SET NULL` —
  cascading would delete invitees' profiles when a referrer deletes their
  account. Do not "fix" this to cascade.

## Naming conventions (verified against code)

- **Actions:** verb-first camelCase — `addComment`, `toggleReaction`,
  `clockIn`.
- **DB reads:** `list*` (collections), `get*` (one/derived),
  `*ForUser(userId)` (cross-user).
- **Mappers:** `rowToX`. **Column constants:** `X_COLUMNS`.
- **Client files:** kebab-case filename → PascalCase export. Page shells are
  strictly `<route>-client.tsx`.
- **RPCs:** snake_case `verb_noun`. Boolean predicates read as English
  (`are_*` / `is_*` / `can_*` / `owns_*`). Admin RPCs are `admin_`-prefixed.

## Mutation pattern

- Every mutation calls its `revalidate*Surfaces()` helper
  (`lib/revalidate.ts`) — never a scattered `revalidatePath` literal, never a
  client-side `router.refresh()` on success.
- Actions **return, never throw**: `type Result = { ok: true } | { error:
  string }` (may carry a payload, e.g. `{ ok: true, sessionId }`). Clients
  surface `error` via `sonner` toasts.
- DB reads return empty/null, never throw.
- The Google integration layer throws typed `GoogleAuthError`.
- `SECURITY DEFINER` RPCs `raise exception`; the calling action catches it
  and returns a generic `{ error }` — don't leak internal exception text to
  the client.

## Timers / dates

- **Never call `useNow()` at the top of a screen** — tick inside a
  `<Ticking>` leaf component; quantize everything else with
  `useNowMinute()`.
- Timezone-sensitive date math (week windows, recap unlock times) goes
  through `lib/dates.ts` helpers (`weekWindow`, `recapReadyMs`, etc.) — these
  already handle DST edge cases correctly. Don't hand-roll `midnight + Nh`
  math; it breaks on DST transition days.

## Don't touch without a decision

- **`vercel.json`'s `sfo1` region pin and `staleTimes.dynamic`** — both are
  load-bearing perf infrastructure.
- **Reskin = recolor only.** Never change layout/spacing/widget sizes when
  doing a visual/theme pass (warm palette, Newsreader/Hanken fonts).
- **No new dependencies without asking first.**
- **Don't start a new feature phase unprompted** — phases are green-lit
  individually.
- Sentinel-enforced, not just convention: no tool-writes to
  `.claude/settings*.json` or `.sentinel.yaml`; no reads of
  `.env*`/credentials.

## Known, accepted lint debt — do not "fix" casually

`Date.now()` react-hooks/purity errors in a few server components;
`set-state-in-effect` warnings in `onboarding-client`, `manage-habits`,
`categorization-review-dialog`. These are pre-existing and known, not
regressions — leave them unless the task is specifically about them.

## Local notification patterns (on-device, no server)

Timed clock-in reminders (duration-end + hourly) use
`@capacitor/local-notifications` and are **wall-clock scheduled** —
scheduling is set once at clock-in and does NOT reschedule on pause/resume.
This is a deliberate design decision, not a bug — see
`.claude/plans/clock-in-notifications.md` if touching this again. This is a
different system from the server-driven push notifications (likes/comments,
friend activity), which go through APNs — don't conflate the two.

## Verification style before calling something done

`tsc` → `eslint` (changed files only) → `vitest` → `npm run build` →
signed-out HTTP route smoke test → after actual deploys, prod probes
(`x-vercel-id` header, TTFB).

"Deploy" means: commit all + push `main`. This repo is normally an
**uncommitted working tree** — commit/push only when explicitly asked.

## Runtime gotcha

Orphaned `next dev` processes can hold port 3000 after a stop. Kill the PID
(`Stop-Process -Id <PID> -Force` on PowerShell) before restarting.

## Docs to keep current as you work

- Log changes in `CHANGELOG.md` (dated, newest first, `HH:MM` prefixes) as
  work happens — not just at the end.
- Refresh `ARCHITECTURE.md` at the end of a feature set (there's an
  `/update-arch` skill for this).
- `docs/SCREENS.md` — ground-truth screen inventory (routes, states,
  dialogs). Derived from the actual file tree, trust this over the stale
  parts of `ARCHITECTURE.md`.

## Schema note

The DB schema is **not in the repo** — it's reconstructed from queries in
`HANDOFF.md`. Confirm actual DDL against Supabase directly before assuming a
column/table shape from docs alone.