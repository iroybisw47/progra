---
description: Refresh ARCHITECTURE.md after a work session or feature set
---

Update `ARCHITECTURE.md` at the project root so it reflects the work just completed.

`ARCHITECTURE.md` is a **cumulative, analysis-oriented map** of the codebase — the
layers, the data flow, the invariants, and the reasoning behind them. It is not a
changelog of commits and not agent instructions (that's `AGENTS.md`). When code and
the doc disagree, the code wins and the doc gets fixed in the same session.

## Steps

1. **Determine what changed.** Run `git log --oneline` since the last Changelog entry
   and `git diff --stat` for uncommitted work. Read the actual diffs — do not infer
   architecture from commit messages alone.

2. **Re-read the sections the change touched** and fix anything now inaccurate:
   - §4 Route map — new/removed/renamed routes
   - §5 Data model — new tables, columns, RLS policies, RPCs
   - §6 Domain logic core — new or changed pure modules in `lib/`
   - §9 Conventions & invariants — any new load-bearing rule
   - §10 Open questions — resolve entries that are now answered; add new ones

3. **Add a Changelog entry** at the TOP of §11 (newest first):

   ```
   ### YYYY-MM-DD — <short topic>
   - What changed architecturally, and why.
   - Any new invariant, migration, or superseded rule. Note "No SQL." explicitly
     when the change needed none.
   ```

   Keep it terse and architectural. Prose bullets, not a file list. If this feature
   set supersedes an earlier entry's rule, say so and name the entry it supersedes.

4. **Bump `_Last updated:_`** near the top of the file to today's date.

5. **Report** which sections you changed, in one short paragraph.

## Constraints

- Never delete old Changelog entries — the history is the point. Supersede, don't erase.
- Do not restate `SPEC.md`; it is an explicitly historical origin artifact.
- SQL/DDL is run by hand by the user in the Supabase dashboard (no migration files in
  repo) — so when recording a schema change, note that the SQL was run manually and
  whether the user has confirmed it.
- This repo is Next 16; check `node_modules/next/dist/docs/` before asserting how a
  Next API behaves.
