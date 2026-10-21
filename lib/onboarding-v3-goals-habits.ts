// Onboarding v3's Screens 2 and 3, the parts that can be wrong without a
// device (.claude/plans/onboarding-v3.md, P4): what the two screens start
// with, which color each goal shows, and which writes Continue makes. Pure,
// like lib/onboarding-v3.ts, which it builds on. The screens own the network.
// This owns every decision about it, which is what lets
// lib/onboarding-v3-goals-habits.test.ts pin "Back and Continue again never
// duplicates" without a browser.
//
// The writes are a DIFF, made on each Continue, between what the screen shows
// and the rows the wizard knows exist ("rows" below). Rows come from two
// places:
//   - "account": the person's active goals and habits when the wizard loaded
//     (app/page.tsx and app/onboarding/page.tsx read them). For a replayer
//     those are their real goals and habits. For a first run they're empty,
//     unless the page was reloaded after Screen 2 had already saved, which is
//     exactly the case that would otherwise create everything twice.
//   - "wizard": rows this run created.
// The screens start from the account rows (prefillWizard), so what's on
// screen is what exists, and Continue only writes the difference: create
// what's new, update a row the wizard made, archive a row the wizard made
// that is no longer on screen.
//
// Each goal on Screen 2 (a "slot") knows which row it is once it has one:
// the reducer's goalRowIds, set from the account's ids at the start, from
// the row a typed title matched (newGoalHours), and after every save
// (savedRowIds). A slot keeps that row whatever happens to the titles
// around it, so goals with the same or nearly the same title can't trade
// rows from one Continue to the next, which would write one goal's quota to
// another. Only a slot without a row is matched by title (matchGoals).
//
// An account row is NEVER archived, renamed or recolored from here. One may
// carry weeks of sessions, nothing in the app un-archives, and the Goals page
// only archives behind a confirm dialog. So removing a prefilled goal, or
// deselecting a prefilled habit, takes it off this run's list and leaves the
// row as it is. Archiving a replayer's existing rows from onboarding needs
// the owner's sign-off first (P4 review); v2 never did it either.
//
// The one write an account goal can get is its weekly quota, and only on the
// person's explicit edit (OWNER-FIX-2, decided on 2026-10-09): Screen 2's
// hours box under it starts at the quota as stored, so a replay that leaves
// the box alone writes nothing, and one that changes it updates that quota
// and nothing else, as the Goals page's own stepper would.
//
// "R:<line>" and "P:<line>" cite the design handoff, as the plan does.

import { goalFillHex } from "@/lib/colors";
import { DEFAULT_GOAL_QUOTA_HOURS } from "@/lib/onboarding";
import {
  MAX_GOALS,
  V3_HABITS,
  goalColor,
  goalHoursOrDefault,
  type WizardState,
} from "@/lib/onboarding-v3";
import { normalizeMatchText } from "@/lib/uw";

// ---- What the pages pass in -------------------------------------------------

// The slices of lib/db's Goal and Habit the wizard needs, and no more, so the
// page doesn't serialize descriptions and the rest into the client payload.
// The weekly quota is in it since OWNER-FIX-2: Screen 2's hours boxes start
// from it, and the diff compares against it.
export type AccountGoal = {
  id: string;
  title: string;
  color: string | null;
  quotaHours: number;
};
export type AccountHabit = { id: string; name: string };

export function accountGoalsFrom(
  goals: readonly { id: string; title: string; color: string | null; weeklyQuotaHours: number }[]
): AccountGoal[] {
  return goals.map(({ id, title, color, weeklyQuotaHours }) => ({
    id,
    title,
    color,
    quotaHours: goalHoursOrDefault(weeklyQuotaHours),
  }));
}

export function accountHabitsFrom(
  habits: readonly { id: string; name: string }[]
): AccountHabit[] {
  return habits.map(({ id, name }) => ({ id, name }));
}

// ---- What the screens start with --------------------------------------------

// Screens 2 and 3 as the account already has them:
//   - goals: the first MAX_GOALS active goals, oldest first (listActiveGoals'
//     order), titles exactly as stored. Any beyond the third are never shown
//     (goalRowsFrom marks them unlisted). goalHours holds each one's quota,
//     and goalRowIds its id, in the same order, so each starts on its row.
//   - habits: every active habit, selected. One that matches a preset by
//     normalizeMatchText selects that preset's chip ("drink water" lights up
//     "Drink water"); the rest become "Your own" chips, as typed ones do.
// A blank name or title is skipped. Two habits with the same name show as one
// chip, and the diff then leaves both rows alone (habitSteps).
export function prefillWizard(
  goals: readonly AccountGoal[],
  habits: readonly AccountHabit[]
): Pick<WizardState, "goals" | "goalHours" | "goalRowIds" | "habits" | "customHabits"> {
  const presetFor = new Map<string, string>(V3_HABITS.map((h) => [normalizeMatchText(h), h]));
  const seen = new Set<string>();
  const selected: string[] = [];
  const custom: string[] = [];
  for (const h of habits) {
    const name = h.name.trim();
    const key = normalizeMatchText(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const preset = presetFor.get(key);
    selected.push(preset ?? name);
    if (!preset) custom.push(name);
  }
  const listed = goals.filter((g) => g.title.trim()).slice(0, MAX_GOALS);
  return {
    goals: listed.map((g) => g.title),
    goalHours: listed.map((g) => goalHoursOrDefault(g.quotaHours)),
    goalRowIds: listed.map((g) => g.id),
    habits: selected,
    customHabits: custom,
  };
}

// ---- Goals: the rows -----------------------------------------------------------

export type GoalRow = {
  id: string;
  title: string;
  color: string | null; // as stored
  // The weekly quota as stored, which a goal's hours box is diffed against.
  quotaHours: number;
  // "account" rows are never renamed, recolored or archived: one may carry
  // weeks of sessions, and renaming it to a different goal would move that
  // history onto it. Their quota is written only when the person changes
  // the box of the goal on that row. "wizard" rows were created a moment ago
  // and are free to reuse or archive.
  origin: "account" | "wizard";
  // Whether Screen 2 started out listing it. False only for an account goal
  // past the first MAX_GOALS, which was never on screen. Typing its title
  // still puts the goal on it (newGoalHours), so that doesn't create a twin
  // of it, but a listed row is matched first.
  listed: boolean;
};

export function goalRowsFrom(goals: readonly AccountGoal[]): GoalRow[] {
  const shown = new Set(
    goals
      .filter((g) => g.title.trim())
      .slice(0, MAX_GOALS)
      .map((g) => g.id)
  );
  return goals.map((g) => ({
    id: g.id,
    title: g.title,
    color: g.color,
    quotaHours: goalHoursOrDefault(g.quotaHours),
    origin: "account",
    listed: shown.has(g.id),
  }));
}

// Which row each goal on screen (each "slot") lands on, or null for one that
// needs creating. `hours` are the slots' boxes and `rowIds` the rows they
// already know (the reducer's goalHours and goalRowIds), by position.
//
// A slot that knows its row keeps it while the row is still there, whatever
// its title: the twin of another goal's, or a loose match for some other row,
// it never trades rows with another slot. The first slot to name a row has
// it, though the reducer never lets two name the same one.
//
// The rest are matched by title, in tiers, each tier across every such slot
// before the next, so a better match always wins over a looser one:
//   1. the same title, among listed rows (a prefilled goal, or one this run
//      saved), in order
//   2. the same title ignoring case and spacing, among listed rows
//   3. either of those among unlisted rows (an account goal past the third)
//   4. a wizard row still unused, which a new title renames, so going Back,
//      removing a goal and typing another reuses the row rather than leaving
//      an archived one behind. Only one that keeps the list's order, though
//      (below).
// An account goal is a match in tiers 1-3 only for a slot whose box holds
// its quota already, so matching it writes nothing. A slot can change an
// account goal's quota only through the goal's own id, which it holds from
// the moment its box shows that quota (prefillWizard, newGoalHours). One that
// finds the goal by title alone later on (the same title typed twice, then
// the first copy removed) would otherwise overwrite a quota nobody changed,
// so with other hours it's a goal of its own.
// Two identical titles stay two goals (the reducer allows that, P:918-924):
// the second matches a second row or is created.
//
// `rows` is in created_at order: the account's as listActiveGoals returns
// them, then each one this run created, appended (afterGoalStep). The rest of
// the app, and a reload's prefill, show goals in that order, so tier 4 only
// renames a row that sits, by age, between the rows matched above and below
// its slot, and never once a slot above it needs a new row (a new row is the
// newest of all). Otherwise renaming an older row into a later slot would put
// the goals in a different order after a reload, with their colors swapped.
// Such a title is created instead, and the unused row archived.
export function matchGoals(
  rows: readonly GoalRow[],
  titles: readonly string[],
  hours: readonly number[],
  rowIds: readonly (string | null)[]
): (GoalRow | null)[] {
  return placeGoals(
    rows,
    titles,
    titles.map((_, i) => goalHoursOrDefault(hours[i])),
    rowIds
  );
}

type TitleTier = (r: GoalRow, title: string) => boolean;
const exact: TitleTier = (r, t) => r.title === t;
const loose: TitleTier = (r, t) => normalizeMatchText(r.title) === normalizeMatchText(t);
const TITLE_TIERS: readonly TitleTier[] = [
  (r, t) => r.listed && exact(r, t),
  (r, t) => r.listed && loose(r, t),
  (r, t) => !r.listed && exact(r, t),
  (r, t) => !r.listed && loose(r, t),
];

// matchGoals, where a slot's hours can be null: the goal newGoalHours is
// placing, whose box will start at whatever its row holds, so any account
// goal with its title may be its row.
function placeGoals(
  rows: readonly GoalRow[],
  titles: readonly string[],
  hours: readonly (number | null)[],
  rowIds: readonly (string | null)[]
): (GoalRow | null)[] {
  const out: (GoalRow | null)[] = titles.map(() => null);
  const used = new Set<string>();
  titles.forEach((_, i) => {
    const id = rowIds[i];
    const row = id ? rows.find((r) => r.id === id) : undefined;
    if (!row || used.has(row.id)) return;
    used.add(row.id);
    out[i] = row;
  });

  // Tiers 1-3.
  const writesNothing = (r: GoalRow, i: number) =>
    r.origin === "wizard" || hours[i] === null || r.quotaHours === hours[i];
  for (const fits of TITLE_TIERS) {
    titles.forEach((t, i) => {
      if (out[i]) return;
      const row = rows.find((r) => !used.has(r.id) && fits(r, t) && writesNothing(r, i));
      if (!row) return;
      used.add(row.id);
      out[i] = row;
    });
  }

  // Tier 4, in list order. `newest` is the age of the newest row placed in a
  // slot above; `creating` is set once a slot above needs a new row.
  const age = new Map(rows.map((r, k) => [r.id, k]));
  const ageOf = (r: GoalRow) => age.get(r.id) ?? -1;
  let newest = -1;
  let creating = false;
  titles.forEach((_, i) => {
    const at = out[i];
    if (at) {
      newest = Math.max(newest, ageOf(at));
      return;
    }
    if (creating) return;
    const below = Math.min(
      Infinity,
      ...out.slice(i + 1).flatMap((r) => (r ? [ageOf(r)] : []))
    );
    const row = rows.find(
      (r, k) => r.origin === "wizard" && !used.has(r.id) && k > newest && k < below
    );
    if (!row) {
      creating = true;
      return;
    }
    used.add(row.id);
    out[i] = row;
    newest = ageOf(row);
  });
  return out;
}

// The color of an account goal as the rest of the app draws it: its own, or
// the hue derived from its id. As hex, because it is compared with and saved
// over the stored value.
function accountColor(row: GoalRow | null): string | null {
  return row && row.origin === "account" ? goalFillHex(row) : null;
}

// The three goal colors (R:95), in order: palette 7, 2 and 5.
const GOAL_COLORS = Array.from({ length: MAX_GOALS }, (_, i) => goalColor(i).fill);

const sameColor = (a: string | null, b: string | null) =>
  (a ?? "").toLowerCase() === (b ?? "").toLowerCase();

// Colors for a list where some slots are fixed (an account goal keeps its
// own) and the rest are free. Each free slot takes the first goal color no
// other slot has, in R:95's order. For a first run, where nothing is fixed,
// that is exactly goalColor(i). A replayer whose own goal is already dark
// blue gets orange for the next one rather than a second dark blue.
function assignColors(fixed: readonly (string | null)[]): string[] {
  const used = fixed.filter((c): c is string => c !== null);
  return fixed.map((c, i) => {
    if (c) return c;
    const free = GOAL_COLORS.find((g) => !used.some((u) => sameColor(u, g))) ?? goalColor(i).fill;
    used.push(free);
    return free;
  });
}

// The colors for the slots matchGoals placed, in order, and one more for the
// next goal.
function slotColors(matched: readonly (GoalRow | null)[]): string[] {
  return assignColors([...matched.map(accountColor), null]);
}

// What Screen 2 draws: each row's color bar, and the marker beside the field
// while a next goal is being typed (R:92-93). The diff uses the same colors,
// and places each slot the same way (matchGoals), so a goal is created in
// the color it was shown in, and an account goal is drawn in its own color
// exactly when it's the row the goal will be saved on.
export function goalColors(
  rows: readonly GoalRow[],
  titles: readonly string[],
  hours: readonly number[],
  rowIds: readonly (string | null)[]
): { colors: string[]; next: string } {
  const all = slotColors(matchGoals(rows, titles, hours, rowIds));
  return { colors: all.slice(0, titles.length), next: all[titles.length] };
}

// A goal being added (OWNER-FIX-2): the hours its box starts at and the row
// it's on. When the row Continue would save it on already carries this title
// (matchGoals' tiers 1-3), that row's quota and id. So a goal removed and
// typed back, a replayer's own or one this run saved, comes back on its own
// row at its own hours, and Continue writes nothing for it, and so does a
// replayer's goal past the third, typed in. A wizard row that would only be
// renamed into the slot isn't this goal, and neither is a second copy of a
// title already listed: those start at the default, on no row yet. `goals`,
// `hours` and `rowIds` are the list as it stands (the reducer's), and
// `title` is the title as it will be listed (formatGoalTitle).
export function newGoalHours(
  rows: readonly GoalRow[],
  goals: readonly string[],
  hours: readonly number[],
  rowIds: readonly (string | null)[],
  title: string
): { hours: number; rowId: string | null } {
  const at = goals.length;
  const row = placeGoals(
    rows,
    [...goals, title],
    [...goals.map((_, i) => goalHoursOrDefault(hours[i])), null],
    [...goals.map((_, i) => rowIds[i] ?? null), null]
  )[at];
  return row && normalizeMatchText(row.title) === normalizeMatchText(title)
    ? { hours: row.quotaHours, rowId: row.id }
    : { hours: DEFAULT_GOAL_QUOTA_HOURS, rowId: null };
}

// ---- Goals: the writes ---------------------------------------------------------

// What an update changes: any of the three for a row this run made, only
// the weekly quota for an account goal (see the top of this file).
export type GoalPatch = { title?: string; color?: string; weeklyQuotaHours?: number };

// A create's `slot` is its goal's position in the list, which the id
// createGoal returns is recorded against (savedRowIds).
export type GoalStep =
  | { kind: "update"; id: string; patch: GoalPatch }
  | { kind: "create"; slot: number; title: string; color: string; hours: number }
  | { kind: "archive"; id: string };

// What Continue on Screen 2 writes, in order: updates, then new goals in list
// order, then archives of rows this run made that are no longer listed. Each
// slot is on the row matchGoals puts it on: the one it knows, or the one its
// title matches. An update is one per row, with whatever differs: the title,
// color and hours of a row this run made, or only the hours of an account
// goal whose box was changed. Because matchGoals only renames a row where it
// keeps the order, created_at (which listActiveGoals sorts by) follows the
// list if the page reloads, except for a goal removed and typed back in lower
// down: that one is back on its own row, so a reload lists it where it was
// before. An account goal
// is never renamed, recolored or archived: one removed from the list stays
// active (see the top of this file). Each new goal and each wizard row gets
// its slot's color, so a goal that moves up when the one above it is removed
// takes that slot's color, as the list draws it, and each new goal its box's
// hours (`hours`, by position, as the reducer's goalHours). Nothing at all
// when the screen matches the rows, which is every Continue after Back that
// changed nothing.
export function goalSteps(
  rows: readonly GoalRow[],
  titles: readonly string[],
  hours: readonly number[],
  rowIds: readonly (string | null)[]
): GoalStep[] {
  const matched = matchGoals(rows, titles, hours, rowIds);
  const colors = slotColors(matched);
  const updates: GoalStep[] = [];
  const creates: GoalStep[] = [];
  titles.forEach((title, slot) => {
    const row = matched[slot];
    const color = colors[slot];
    const quota = goalHoursOrDefault(hours[slot]);
    if (!row) {
      creates.push({ kind: "create", slot, title, color, hours: quota });
      return;
    }
    const patch: GoalPatch = {};
    if (row.origin === "wizard") {
      if (row.title !== title) patch.title = title;
      if (!sameColor(row.color, color)) patch.color = color;
    }
    if (row.quotaHours !== quota) patch.weeklyQuotaHours = quota;
    if (Object.keys(patch).length > 0) updates.push({ kind: "update", id: row.id, patch });
  });
  const used = new Set(matched.filter((r): r is GoalRow => r !== null).map((r) => r.id));
  const archives: GoalStep[] = rows
    .filter((r) => r.origin === "wizard" && !used.has(r.id))
    .map((r) => ({ kind: "archive", id: r.id }));
  return [...updates, ...creates, ...archives];
}

// The row each slot is on once a save of goalSteps(rows, titles, hours,
// rowIds) has run, however far it got, for the reducer's setGoalRowIds: the
// row matchGoals put it on, which is there whatever happened (a failed update
// leaves it as it was, and only rows no slot is on are archived), or, for a
// slot that needed a new row, the id createGoal returned for it (`created`,
// by slot) once that landed. Null for a create that didn't, which the next
// Continue makes again. `rows` are the rows the save started from.
export function savedRowIds(
  rows: readonly GoalRow[],
  titles: readonly string[],
  hours: readonly number[],
  rowIds: readonly (string | null)[],
  created: ReadonlyMap<number, string>
): (string | null)[] {
  return matchGoals(rows, titles, hours, rowIds).map((r, i) => r?.id ?? created.get(i) ?? null);
}

// The rows once `step` has succeeded. `createdId` is the id createGoal
// returned, required for a create. The screen applies each step as it
// succeeds, so a failure halfway leaves the rows saying exactly what exists,
// and the next Continue diffs from there.
export function afterGoalStep(
  rows: readonly GoalRow[],
  step: GoalStep,
  createdId?: string
): GoalRow[] {
  switch (step.kind) {
    case "create":
      if (!createdId) return [...rows];
      return [
        ...rows,
        {
          id: createdId,
          title: step.title,
          color: step.color,
          quotaHours: step.hours,
          origin: "wizard",
          listed: true,
        },
      ];
    case "update": {
      // Field by field: the patch speaks the action's names (weeklyQuotaHours),
      // and the row its own.
      const { title, color, weeklyQuotaHours } = step.patch;
      return rows.map((r) => {
        if (r.id !== step.id) return r;
        const next = { ...r };
        if (title !== undefined) next.title = title;
        if (color !== undefined) next.color = color;
        if (weeklyQuotaHours !== undefined) next.quotaHours = weeklyQuotaHours;
        return next;
      });
    }
    case "archive":
      return rows.filter((r) => r.id !== step.id);
  }
}

// ---- Habits ----------------------------------------------------------------------

// "account" rows are never archived, as for goals. "wizard" rows were
// created by this run.
export type HabitRow = { id: string; name: string; origin: "account" | "wizard" };

export function habitRowsFrom(habits: readonly AccountHabit[]): HabitRow[] {
  return habits.map(({ id, name }) => ({ id, name, origin: "account" }));
}

export type HabitStep = { kind: "create"; name: string } | { kind: "archive"; id: string };

// What Continue (or Skip) on Screen 3 writes: the selected chips with no row
// yet, in pick order, then archives of rows THIS RUN created whose chip is no
// longer selected (picked, Continue, Back, deselected). Matched by
// normalizeMatchText, as the chips are, so an account habit "drink water" is
// the "Drink water" chip and is left alone. There is no rename: a chip is
// either selected or not. New habits are created without a color, and
// createHabit assigns one (plan P4).
//
// An account habit is never archived, deselected or not, and whichever
// label the CTA wears: "Skip for now" can't take away a replayer's habits.
export function habitSteps(rows: readonly HabitRow[], selected: readonly string[]): HabitStep[] {
  const keep = new Set(selected.map(normalizeMatchText));
  const have = new Set(rows.map((r) => normalizeMatchText(r.name)));
  const creates: HabitStep[] = [];
  for (const name of selected) {
    const key = normalizeMatchText(name);
    if (!key || have.has(key)) continue;
    have.add(key);
    creates.push({ kind: "create", name });
  }
  const archives: HabitStep[] = rows
    .filter((r) => r.origin === "wizard" && !keep.has(normalizeMatchText(r.name)))
    .map((r) => ({ kind: "archive", id: r.id }));
  return [...creates, ...archives];
}

// The rows once `step` has succeeded, as afterGoalStep.
export function afterHabitStep(
  rows: readonly HabitRow[],
  step: HabitStep,
  createdId?: string
): HabitRow[] {
  switch (step.kind) {
    case "create":
      return createdId
        ? [...rows, { id: createdId, name: step.name, origin: "wizard" }]
        : [...rows];
    case "archive":
      return rows.filter((r) => r.id !== step.id);
  }
}

// ---- Screen 6 ----------------------------------------------------------------------

// The goal Screen 6 names, "Start your first session on {goal}", and the one
// the Clock tab opens with preselected (lib/clock-handoff.ts): the first goal
// listed on Screen 2, as the owner asked on 2026-10-09 (OWNER-FIX-1). Its
// title as listed, the color Screen 2 drew it in (which is the color it was
// saved in, so it matches the Clock's row), and its row's id.
//
// The id is the real one by Screen 6. The screen is only reachable through
// Screen 2's Continue, and that save leaves every goal on a row, with the
// reducer holding its id (goalRowIds): one this run created, or, for a
// replayer, the account goal it was prefilled from, so a replayer's is their
// first listed goal. The first goal is placed as the diff places it
// (matchGoals), by its id first. `id` is null only for a goal no save has
// put on a row yet, which the wizard can't reach; the Clock tab would then
// open with nothing preselected. Null for no goals at all, which only the
// dev preview reaches (a goal-less fixture opened on Screen 6).
export type ReadyGoal = { id: string | null; title: string; color: string };

export function readyGoal(
  rows: readonly GoalRow[],
  titles: readonly string[],
  hours: readonly number[],
  rowIds: readonly (string | null)[]
): ReadyGoal | null {
  if (titles.length === 0) return null;
  const matched = matchGoals(rows, titles, hours, rowIds);
  return { id: matched[0]?.id ?? null, title: titles[0], color: slotColors(matched)[0] };
}
