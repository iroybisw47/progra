# Streaks: morning report (2026-10-20, overnight run)

Branch **`feat/streaks`**, off `main` at `914fa28` (today's notify-last onboarding change, committed first as agreed). **Nothing is pushed or merged.** Everything is dark behind `NEXT_PUBLIC_STREAKS`, and with the flag off the app renders as it does on `main`.

Plan: `.claude/plans/streaks.md` + `streaks-P1..P6.md`. SQL: `.claude/plans/streaks.sql`. Harness: `.claude/plans/nudges-harness/streaks.mjs`. (`.claude/` is gitignored, so those stay local.)

## Status by phase

| Phase | Status | Commit |
|---|---|---|
| P1 Rules core (`lib/streaks.ts`, config, flag, 31 shared fixtures) | ✅ done, 66 tests | `44d3fdd` |
| P2 SQL + PGlite harness | ✅ written and proven on the mock · ❌ **not applied to prod** (see Blocked) | `17cd40d` (fixture only; the SQL is gitignored) |
| P3 Your badge, sheet, announcement card, settle leaf, `/dev/streaks` | ✅ done | `0765d43` |
| P4 A friend's streak on their profile | ✅ done | `aa88be9` |
| P5 Hourly cron, 7pm reminder, freeze note | ✅ code done · ❌ needs SQL STEP 3 + STEP 4 + `CRON_SECRET` | `23af943` |
| P6 Release prep: onboarding copy, SCREENS.md, this file | ✅ done · launch date, copy, patch note and device check are yours | tip of `feat/streaks` |

**Gate, run after every phase:**
- tsc is clean.
- eslint on changed files is clean, apart from the accepted `Date.now()` debt.
- vitest passes **1469 of 1469**.
- `npm run build` passes, with the design-sync link moved aside and restored.
- Signed out, `/me`, `/feed` and `/profile/x` redirect to `/login`.
- `/api/cron/streaks` returns 401 with no bearer or a wrong one.
- `/dev/streaks` renders not-found in a prod build.

**Harness:** ALL PASS, 129 checks, including the 17-case adversarial JWT block (STEP 2), **all 21 mutants caught**.

## Blocked: needs you

1. **The SQL isn't in prod.** The Supabase MCP server here is **read-only**: STEP 1 was refused with "cannot execute CREATE TABLE in a read-only transaction", so nothing changed. I didn't try to switch it to write mode. Run it in the SQL editor, one block at a time, from `.claude/plans/streaks.sql`:
   1. STEP 0, the pre-flight. I ran it read-only and all 6 rows were ok.
   2. STEP 1, which leaves `enabled = false`, so nothing shows.
   3. STEP 1V. Every row should be ok.
   4. STEP 2, the adversarial block. It raises its own summary, which should end in **17/17 passed**, and rolls everything back.
   5. STEP 3 and STEP 3V, for the pushes.
   6. STEP 4, the pg_cron/pg_net schedule, **only after** the route is deployed and `CRON_SECRET` is set in Vercel. You paste the secret into Vault yourself; it never goes in a file. pg_cron and pg_net are **not installed** in prod today, and the recap job was never scheduled either.
2. **The launch date.** `STREAK_LAUNCH_DATE` is `null` (pre-launch everywhere). Set it in both places, together with the copy:
   - `lib/streaks-config.ts`;
   - `update public.streak_config set enabled = true, launch_date = '<date>';`
   - If they differ, the DB wins and the server logs it once.
3. **Copy.**
   - `STREAK_ANNOUNCEMENT_COPY` in `lib/streaks-config.ts` is `[ANNOUNCEMENT COPY]`. It **never renders in a production build** while it's the placeholder, so the flag can ship first.
   - Also review my wording of the push copy (`lib/push/streak-push.ts`) and the sheet text (`components/v2/streak-sheet.tsx`).
4. **The patch note.** Add it to `lib/patch-notes.ts` at flag flip, per the batch-release rule.
5. **Device check** (iPhone): the badge and sheet on `/me` and a friend's profile, the card, and one real push.
6. **`app/onboarding/steps/habit-step.tsx:30`** says "your friends see your streak right next to your goals". That isn't true (it's next to your name, on your profile) and wasn't true before streaks either. It's marketing copy, so I left it for you.

## Decisions I made (veto any)

- **The habit rule.** A tick counts for the streak day it was *made* in, when it's for that day or the calendar day after (made between midnight and 4am). Backfills never count. `completed_on` alone can't carry a 4am cutoff, and this matches how analytics already dates ticks.
- **A running session** counts live once it has 5 minutes. Settling waits for a session still running under the cap, so a session that runs past 4am isn't settled as a miss.
- **The ledger.** `streak_days` stores every closed day once settled, and that's what makes closed days and freezes final. Reads compute any unsettled days live, so the numbers are right before settling. `freeze` is a reserved word in Postgres, so the column is `freeze_used`.
- **Where settling happens:**
  - on `/me` and `/feed` (the `EnsureStreakSettled` leaf), **not the root layout** as the plan said, so the streak RPC isn't added to every page load;
  - and hourly for everyone, by the cron.
- **The friend view.** Your freezes bridge your shared count too: a freeze reveals a miss, not private activity. A day with only private activity breaks the shared count and uses no freeze.
- **The announcement:**
  - before launch, it stays up until dismissed;
  - on or after Day One, it shows once more for anyone who dismissed it before launch;
  - after that, it stays gone.
- **Push timing:**
  - The reminder goes out 19:00–21:59 local, at hourly granularity.
  - It has a 2h APNs TTL, so it can't land after the evening.
  - The freeze note goes out 08:00–21:59 the morning after.
  - Quiet hours (22:00–07:59) are enforced in the SQL.
  - Both share the existing push switch, and Settings' label now names streaks.
- **Onboarding.** With `STREAKS && SOCIAL_PUSH` on, v2's notify card no longer promises "no streaks", and v3's `notifyReasons` lists the evening reminder. Both are flag-gated.
- **No dark-mode check.** Progra has no dark mode (`app/globals.css:191`).

## How to test

- **No database:** `npm run dev`, then `/dev/streaks?fixture=` with any of these fixtures:
  - `prelaunch`, `prelaunch-undated`, `zero`, `at-risk`, `12`, `milestone-30`;
  - `400` (a long name, to show truncation);
  - `freeze-used`, `launched-card`;
  - `friend-5`, `friend-1`, `friend-prelaunch`.
  - Add `&sheet=1` to open the sheet. Screenshots at 393×852 are in the session scratchpad.
- **Signed in, after STEP 1:** `NEXT_PUBLIC_STREAKS=1 npm run dev`, and set `streak_config` to `enabled = true` with a launch date a few days back. `.env.local` may point at prod, so that is a real change to prod's config. Do it on a branch database if you have one.
- **The SQL:** `cd .claude/plans/nudges-harness && node streaks.mjs ../streaks.sql --mutants`.

## Out of scope, as agreed

These were cut by your scope answers or deferred: pair streaks, the friend at-risk push, the feed-card badge, weekly-recap changes, a launch push announcement, any Pro gating, and native changes.
