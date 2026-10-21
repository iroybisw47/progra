import { describe, expect, it } from "vitest";

import { goalFillHex } from "@/lib/colors";
import { DEFAULT_GOAL_QUOTA_HOURS } from "@/lib/onboarding";
import {
  V3_HABITS,
  formatGoalTitle,
  goalColor,
  initialWizardState,
  wizardReducer,
  type WizardAction,
  type WizardState,
} from "@/lib/onboarding-v3";
import {
  accountGoalsFrom,
  accountHabitsFrom,
  afterGoalStep,
  afterHabitStep,
  goalColors,
  goalRowsFrom,
  goalSteps,
  habitRowsFrom,
  habitSteps,
  matchGoals,
  newGoalHours,
  prefillWizard,
  readyGoal,
  savedRowIds,
  type AccountGoal,
  type GoalRow,
  type GoalStep,
  type HabitRow,
  type HabitStep,
} from "@/lib/onboarding-v3-goals-habits";

const BLUE = goalColor(0).fill; // palette 7
const ORANGE = goalColor(1).fill; // palette 2
const GREEN = goalColor(2).fill; // palette 5

// An account goal as accountGoalsFrom hands it over, at the 5h default unless
// the test says otherwise.
function account(g: Omit<AccountGoal, "quotaHours"> & { quotaHours?: number }): AccountGoal {
  return { quotaHours: DEFAULT_GOAL_QUOTA_HOURS, ...g };
}

// A row the hooks hold, likewise at 5h unless the test says otherwise.
function row(r: Omit<GoalRow, "quotaHours"> & { quotaHours?: number }): GoalRow {
  return { quotaHours: DEFAULT_GOAL_QUOTA_HOURS, ...r };
}

// Every box at the 5h default, which is what a list typed in and never
// adjusted holds.
const at5 = (titles: readonly string[]) => titles.map(() => DEFAULT_GOAL_QUOTA_HOURS);

// No goal on a row yet, as titles typed in and never saved are.
const unsaved = (titles: readonly string[]) => titles.map(() => null);

// Runs a Continue to completion the way the screen does (useGoalWrites):
// every step succeeds, in order, createGoal hands back the next fake id, and
// the row each goal ended up on comes back as the reducer then holds it.
function saveGoals(
  rows: GoalRow[],
  titles: string[],
  ids: () => string,
  hours: readonly number[] = at5(titles),
  rowIds: readonly (string | null)[] = unsaved(titles)
) {
  const steps = goalSteps(rows, titles, hours, rowIds);
  const created = new Map<number, string>();
  const after = steps.reduce<GoalRow[]>((acc, step) => {
    if (step.kind !== "create") return afterGoalStep(acc, step);
    const id = ids();
    created.set(step.slot, id);
    return afterGoalStep(acc, step, id);
  }, rows);
  return { steps, rows: after, rowIds: savedRowIds(rows, titles, hours, rowIds, created) };
}

function saveHabits(rows: HabitRow[], selected: string[], ids: () => string) {
  const steps = habitSteps(rows, selected);
  const after = steps.reduce<HabitRow[]>(
    (acc, step) => afterHabitStep(acc, step, step.kind === "create" ? ids() : undefined),
    rows
  );
  return { steps, rows: after };
}

function counter(prefix: string) {
  let n = 0;
  return () => `${prefix}${++n}`;
}

// What the database would hold: the rows' titles, in order.
const titlesOf = (rows: readonly GoalRow[]) => rows.map((r) => r.title);

// The rows as the page reads them back after a reload.
const reload = (rows: readonly GoalRow[]): AccountGoal[] =>
  rows.map(({ id, title, color, quotaHours }) => ({ id, title, color, quotaHours }));

function run(state: WizardState, ...actions: WizardAction[]): WizardState {
  return actions.reduce(wizardReducer, state);
}

// Screen 2 as it opens for `goals`, the account's.
function opened(goals: readonly AccountGoal[]): WizardState {
  return { ...initialWizardState(), ...prefillWizard(goals, []) };
}

// A goal typed in and added, as the shell adds it (onAdd): on the row
// newGoalHours finds for it, at that row's hours, or at 5h on none.
function typeGoal(state: WizardState, rows: readonly GoalRow[], title: string): WizardState {
  const placed = newGoalHours(
    rows,
    state.goals,
    state.goalHours,
    state.goalRowIds,
    formatGoalTitle(title)
  );
  return wizardReducer(state, { type: "addGoal", title, ...placed });
}

describe("prefillWizard", () => {
  it("starts a first run empty", () => {
    expect(prefillWizard([], [])).toEqual({
      goals: [],
      goalHours: [],
      goalRowIds: [],
      habits: [],
      customHabits: [],
    });
  });

  it("shows the first three goals, titles exactly as stored, each with its quota, on its row", () => {
    const goals: AccountGoal[] = [
      account({ id: "g1", title: "Learn  Spanish", color: null, quotaHours: 10 }),
      account({ id: "g2", title: "Get stronger", color: ORANGE }),
      account({ id: "g3", title: "Ship v2", color: null, quotaHours: 2.5 }),
      account({ id: "g4", title: "Read more", color: null, quotaHours: 3 }),
    ];
    const p = prefillWizard(goals, []);
    expect(p.goals).toEqual(["Learn  Spanish", "Get stronger", "Ship v2"]);
    expect(p.goalHours).toEqual([10, 5, 2.5]);
    expect(p.goalRowIds).toEqual(["g1", "g2", "g3"]);
  });

  it("keeps the hours and rows aligned with the goals when a blank title is skipped", () => {
    const p = prefillWizard(
      [
        account({ id: "g1", title: "  ", color: null, quotaHours: 9 }),
        account({ id: "g2", title: "Run", color: null, quotaHours: 60 }),
      ],
      []
    );
    expect(p.goals).toEqual(["Run"]);
    expect(p.goalHours).toEqual([60]);
    expect(p.goalRowIds).toEqual(["g2"]);
  });

  it("selects every habit, lighting a preset chip by name and adding the rest as their own", () => {
    const p = prefillWizard(
      [],
      [
        { id: "h1", name: "drink  water" },
        { id: "h2", name: "Floss" },
        { id: "h3", name: "Stretch" },
      ]
    );
    expect(p.habits).toEqual(["Drink water", "Floss", "Stretch"]);
    expect(p.customHabits).toEqual(["Floss"]);
  });

  it("shows duplicate and blank habits once, or not at all", () => {
    const p = prefillWizard(
      [],
      [
        { id: "h1", name: "Floss" },
        { id: "h2", name: "floss" },
        { id: "h3", name: "  " },
      ]
    );
    expect(p).toEqual({
      goals: [],
      goalHours: [],
      goalRowIds: [],
      habits: ["Floss"],
      customHabits: ["Floss"],
    });
  });

  it("is a state the reducer carries on from", () => {
    const state = {
      ...initialWizardState(),
      ...prefillWizard(
        [account({ id: "g1", title: "Run", color: null, quotaHours: 2.5 })],
        [{ id: "h1", name: "Drink water" }]
      ),
    };
    const next = run(
      state,
      { type: "toggleHabit", name: "Drink water" },
      { type: "addGoal", title: "Read" },
      { type: "removeGoal", index: 0 }
    );
    expect(next.habits).toEqual([]);
    expect(next.goals).toEqual(["Read"]);
    expect(next.goalHours).toEqual([5]);
    expect(next.goalRowIds).toEqual([null]);
  });
});

describe("account mappers", () => {
  it("keep only what the wizard needs, the quota included", () => {
    expect(
      accountGoalsFrom([
        { id: "g1", title: "A", color: null, description: "secret", weeklyQuotaHours: 5 } as never,
      ])
    ).toEqual([{ id: "g1", title: "A", color: null, quotaHours: 5 }]);
    expect(accountHabitsFrom([{ id: "h1", name: "Floss", color: "#fff" } as never])).toEqual([
      { id: "h1", name: "Floss" },
    ]);
  });

  it("keep a quota the box can't set as stored, and default one that isn't a quota", () => {
    const quotas = [2.5, 60, 0, -3, Number.NaN];
    const goals = quotas.map((weeklyQuotaHours, i) => ({
      id: `g${i}`,
      title: "A",
      color: null,
      weeklyQuotaHours,
    }));
    expect(accountGoalsFrom(goals).map((g) => g.quotaHours)).toEqual([2.5, 60, 5, 5, 5]);
  });

  it("give each row its quota, defaulting one that isn't a quota", () => {
    const rows = goalRowsFrom([
      account({ id: "g1", title: "A", color: null, quotaHours: 12 }),
      account({ id: "g2", title: "B", color: null, quotaHours: Number.NaN }),
    ]);
    expect(rows.map((r) => r.quotaHours)).toEqual([12, 5]);
  });
});

describe("goalColors", () => {
  it("gives a first run R:95's colors in order, and the next one to the marker", () => {
    const colors = (titles: string[]) => goalColors([], titles, at5(titles), unsaved(titles));
    expect(colors([])).toEqual({ colors: [], next: BLUE });
    expect(colors(["A"])).toEqual({ colors: [BLUE], next: ORANGE });
    expect(colors(["A", "B"])).toEqual({ colors: [BLUE, ORANGE], next: GREEN });
    expect(colors(["A", "B", "C"]).colors).toEqual([BLUE, ORANGE, GREEN]);
  });

  it("keeps an account goal's own color and skips it for the others", () => {
    const rows = goalRowsFrom([account({ id: "g1", title: "Mine", color: BLUE })]);
    expect(goalColors(rows, ["Mine", "New"], [5, 5], ["g1", null])).toEqual({
      colors: [BLUE, ORANGE],
      next: GREEN,
    });
    // Not first in the list, and still never doubled up.
    expect(goalColors(rows, ["New", "Mine"], [5, 5], [null, "g1"]).colors).toEqual([ORANGE, BLUE]);
  });

  it("draws an uncolored account goal in its id-derived hue, as the app does", () => {
    const rows = goalRowsFrom([account({ id: "g-legacy", title: "Old", color: null })]);
    expect(goalColors(rows, ["Old"], [5], ["g-legacy"]).colors).toEqual([
      goalFillHex({ id: "g-legacy", color: null }),
    ]);
  });

  it("moves a wizard goal's color with its position", () => {
    const first = saveGoals([], ["A", "B"], counter("w"));
    // Back, and A removed: B, still on its own row, is first.
    expect(goalColors(first.rows, ["B"], [5], first.rowIds.slice(1)).colors).toEqual([BLUE]);
  });

  it("draws a goal in its own row's color, not a loose twin's (D1)", () => {
    const rows = goalRowsFrom([
      account({ id: "g1", title: "RUN", color: GREEN }),
      account({ id: "g2", title: "Run", color: ORANGE }),
    ]);
    // "run" is on g2, though g1 is the first to match it by title.
    expect(goalColors(rows, ["run"], [5], ["g2"]).colors).toEqual([ORANGE]);
    expect(goalColors(rows, ["run"], [5], [null]).colors).toEqual([GREEN]);
  });
});

describe("matchGoals", () => {
  // In created_at order, as the hooks hold them: the account's, then this run's.
  const rows: GoalRow[] = [
    row({ id: "a", title: "Get stronger", color: null, origin: "account", listed: true }),
    row({ id: "h", title: "Read more", color: null, origin: "account", listed: false }),
    row({ id: "w", title: "Draft", color: BLUE, origin: "wizard", listed: true }),
  ];
  const ids = (m: readonly (GoalRow | null)[]) => m.map((r) => r?.id ?? null);
  const byTitle = (from: readonly GoalRow[], titles: string[]) =>
    ids(matchGoals(from, titles, at5(titles), unsaved(titles)));

  it("prefers an exact title over a loose one, and a listed row over a hidden one", () => {
    expect(byTitle(rows, ["get stronger", "Read more", "Something new"])).toEqual(["a", "h", "w"]);
  });

  it("never matches one row twice", () => {
    // The second takes the wizard row by reuse rather than the same account row.
    expect(byTitle(rows, ["Get stronger", "Get stronger"])).toEqual(["a", "w"]);
  });

  it("keeps a goal on the row it knows, whatever its title (D1)", () => {
    const twins: GoalRow[] = [
      row({ id: "w1", title: "Run", color: BLUE, origin: "wizard", listed: true }),
      row({ id: "w2", title: "run", color: ORANGE, origin: "wizard", listed: true }),
    ];
    // By title the two would swap rows. On their rows, they don't.
    expect(byTitle(twins, ["run", "Run"])).toEqual(["w2", "w1"]);
    expect(ids(matchGoals(twins, ["run", "Run"], [5, 5], ["w1", "w2"]))).toEqual(["w1", "w2"]);
    // Two copies of one title each keep their own.
    expect(ids(matchGoals(twins, ["Run", "Run"], [5, 5], ["w2", "w1"]))).toEqual(["w2", "w1"]);
    // A known row that no title would find.
    expect(ids(matchGoals(twins, ["Swim"], [5], ["w2"]))).toEqual(["w2"]);
  });

  it("matches by title a goal whose row is gone, or named by a goal above it", () => {
    expect(ids(matchGoals(rows, ["Draft"], [5], ["gone"]))).toEqual(["w"]);
    expect(ids(matchGoals(rows, ["Draft", "Draft"], [5, 5], ["w", "w"]))).toEqual(["w", null]);
  });

  it("matches an account goal by title only where its quota is the box's, so that writes nothing", () => {
    const own = goalRowsFrom([account({ id: "g1", title: "Run", color: null, quotaHours: 10 })]);
    expect(ids(matchGoals(own, ["run"], [10], [null]))).toEqual(["g1"]);
    expect(ids(matchGoals(own, ["run"], [5], [null]))).toEqual([null]);
    // On its own row, the box is that goal's to change.
    expect(ids(matchGoals(own, ["run"], [5], ["g1"]))).toEqual(["g1"]);
  });

  it("only renames a wizard row into a slot that keeps the rows' age order", () => {
    const wizard: GoalRow[] = [
      row({ id: "w1", title: "A", color: BLUE, origin: "wizard", listed: true }),
      row({ id: "w2", title: "B", color: ORANGE, origin: "wizard", listed: true }),
    ];
    // w1 is older than w2, so it can't become the goal listed after B.
    expect(byTitle(wizard, ["B", "C"])).toEqual(["w2", null]);
    // Above B it can.
    expect(byTitle(wizard, ["C", "B"])).toEqual(["w1", "w2"]);
    // And once a slot needs a new row (X: nothing is older than w1), nothing
    // below it reuses an older one, since the new row will be the newest.
    const three: GoalRow[] = [
      ...wizard,
      row({ id: "w3", title: "C", color: GREEN, origin: "wizard", listed: true }),
    ];
    expect(byTitle(three, ["X", "A", "Y"])).toEqual([null, "w1", null]);
    // A goal on its own row counts the same as one matched to it.
    expect(ids(matchGoals(wizard, ["B", "C"], [5, 5], ["w2", null]))).toEqual(["w2", null]);
  });
});

describe("newGoalHours (OWNER-FIX-2)", () => {
  it("starts a goal nothing has saved at the 5h default, on no row", () => {
    expect(newGoalHours([], [], [], [], "Run a 10k")).toEqual({
      hours: DEFAULT_GOAL_QUOTA_HOURS,
      rowId: null,
    });
    const rows = goalRowsFrom([
      account({ id: "g1", title: "Get stronger", color: null, quotaHours: 10 }),
    ]);
    expect(newGoalHours(rows, [], [], [], "Run a 10k")).toEqual({ hours: 5, rowId: null });
  });

  it("puts a replayer's own goal typed back on its row, at its quota, matched loosely too", () => {
    const rows = goalRowsFrom([
      account({ id: "g1", title: "Learn Spanish", color: null, quotaHours: 10 }),
      account({ id: "g2", title: "Ship v2", color: null, quotaHours: 2.5 }),
    ]);
    expect(newGoalHours(rows, ["Ship v2"], [2.5], ["g2"], "Learn Spanish")).toEqual({
      hours: 10,
      rowId: "g1",
    });
    expect(
      newGoalHours(rows, ["Ship v2"], [2.5], ["g2"], formatGoalTitle("  learn   SPANISH "))
    ).toEqual({ hours: 10, rowId: "g1" });
    // A quota the box can't set comes back as stored.
    expect(newGoalHours(rows, ["Learn Spanish"], [10], ["g1"], "ship v2")).toEqual({
      hours: 2.5,
      rowId: "g2",
    });
  });

  it("puts a hidden fourth goal typed in on its row, at its own quota", () => {
    const rows = goalRowsFrom([
      account({ id: "g1", title: "A", color: null }),
      account({ id: "g2", title: "B", color: null }),
      account({ id: "g3", title: "C", color: null }),
      account({ id: "g4", title: "Read more", color: null, quotaHours: 3 }),
    ]);
    expect(newGoalHours(rows, ["A", "B"], [5, 5], ["g1", "g2"], "read more")).toEqual({
      hours: 3,
      rowId: "g4",
    });
  });

  it("puts a goal this run saved back on its row at its saved hours, so typing it back writes nothing", () => {
    const { rows } = saveGoals([], ["A"], counter("w"), [10]);
    // Back, remove A, type it again.
    const back = newGoalHours(rows, [], [], [], "A");
    expect(back).toEqual({ hours: 10, rowId: "w1" });
    expect(goalSteps(rows, ["A"], [back.hours], [back.rowId])).toEqual([]);
  });

  it("doesn't take the hours or the row of a wizard row that would only be renamed into the slot", () => {
    const { rows } = saveGoals([], ["A"], counter("w"), [8]);
    // matchGoals would reuse A's row for C (a rename), but C isn't A.
    expect(matchGoals(rows, ["C"], [5], [null])[0]?.id).toBe("w1");
    expect(newGoalHours(rows, [], [], [], "C")).toEqual({ hours: 5, rowId: null });
  });

  it("starts a second copy of a listed goal at the default, on no row: the row is the first's", () => {
    const rows = goalRowsFrom([account({ id: "g1", title: "Run", color: null, quotaHours: 10 })]);
    expect(newGoalHours(rows, ["Run"], [10], ["g1"], "Run")).toEqual({ hours: 5, rowId: null });
  });

  it("leaves a row to a goal above that Continue would put on it", () => {
    const { rows } = saveGoals([], ["A"], counter("w"));
    // A first "A" on no row yet is matched to w1 first, so a second isn't.
    expect(newGoalHours(rows, ["A"], [5], [null], "A")).toEqual({ hours: 5, rowId: null });
  });
});

describe("goalSteps: a first run", () => {
  it("creates each goal in its color, with its box's hours, in list order", () => {
    const titles = ["Launch my side project", "Get stronger"];
    expect(goalSteps([], titles, [5, 8], unsaved(titles))).toEqual([
      { kind: "create", slot: 0, title: "Launch my side project", color: BLUE, hours: 5 },
      { kind: "create", slot: 1, title: "Get stronger", color: ORANGE, hours: 8 },
    ]);
  });

  it("creates a goal whose hours aren't a quota at the default", () => {
    expect(goalSteps([], ["A"], [Number.NaN], [null])).toEqual([
      { kind: "create", slot: 0, title: "A", color: BLUE, hours: 5 },
    ]);
  });

  it("writes nothing on a Continue after Back that changed nothing", () => {
    const { rows, rowIds } = saveGoals([], ["A", "B"], counter("w"), [3, 12]);
    expect(rowIds).toEqual(["w1", "w2"]);
    expect(goalSteps(rows, ["A", "B"], [3, 12], rowIds)).toEqual([]);
    // Nor by title, before the reducer has the rows.
    expect(goalSteps(rows, ["A", "B"], [3, 12], unsaved(["A", "B"]))).toEqual([]);
    expect(titlesOf(rows)).toEqual(["A", "B"]);
  });

  it("saves changed hours as one update, and nothing on the next Continue", () => {
    const ids = counter("w");
    const first = saveGoals([], ["A", "B"], ids);
    const second = saveGoals(first.rows, ["A", "B"], ids, [5, 9], first.rowIds);
    expect(second.steps).toEqual([{ kind: "update", id: "w2", patch: { weeklyQuotaHours: 9 } }]);
    expect(second.rows.map((r) => r.quotaHours)).toEqual([5, 9]);
    expect(goalSteps(second.rows, ["A", "B"], [5, 9], second.rowIds)).toEqual([]);
  });

  it("folds a recolor and new hours for one row into one update", () => {
    const ids = counter("w");
    const first = saveGoals([], ["A", "B"], ids);
    // Back, remove A, and B's hours changed.
    const second = saveGoals(first.rows, ["B"], ids, [7], first.rowIds.slice(1));
    expect(second.steps).toEqual([
      { kind: "update", id: "w2", patch: { color: BLUE, weeklyQuotaHours: 7 } },
      { kind: "archive", id: "w1" },
    ]);
    expect(second.rows).toEqual([
      { id: "w2", title: "B", color: BLUE, quotaHours: 7, origin: "wizard", listed: true },
    ]);
  });

  it("keeps the list's order after a reload when the first goal is swapped for a new one", () => {
    const ids = counter("w");
    const first = saveGoals([], ["A", "B"], ids);
    // Back, remove A, add C.
    const second = saveGoals(first.rows, ["B", "C"], ids, [5, 5], [first.rowIds[1], null]);
    expect(second.steps).toEqual([
      { kind: "update", id: "w2", patch: { color: BLUE } },
      { kind: "create", slot: 1, title: "C", color: ORANGE, hours: 5 },
      { kind: "archive", id: "w1" },
    ]);
    expect(second.rowIds).toEqual(["w2", "w3"]);
    expect(titlesOf(second.rows)).toEqual(["B", "C"]);
    // The page reloads: listActiveGoals' order is the rows' order.
    const reloaded = reload(second.rows);
    const prefill = prefillWizard(reloaded, []);
    expect(prefill.goals).toEqual(["B", "C"]);
    expect(
      goalColors(goalRowsFrom(reloaded), prefill.goals, prefill.goalHours, prefill.goalRowIds).colors
    ).toEqual([BLUE, ORANGE]);
  });

  it("archives a removed goal and recolors the one that moved up", () => {
    const ids = counter("w");
    const first = saveGoals([], ["A", "B"], ids);
    const second = saveGoals(first.rows, ["B"], ids, [5], first.rowIds.slice(1));
    expect(second.steps).toEqual([
      { kind: "update", id: "w2", patch: { color: BLUE } },
      { kind: "archive", id: "w1" },
    ]);
    expect(second.rows).toEqual([
      { id: "w2", title: "B", color: BLUE, quotaHours: 5, origin: "wizard", listed: true },
    ]);
  });

  it("archives the copy removed of two identical goals, and keeps the other on its row (D1)", () => {
    const ids = counter("w");
    const first = saveGoals([], ["Run", "Run"], ids, [5, 9]);
    expect(first.rowIds).toEqual(["w1", "w2"]);
    // Back, and the first copy removed: the 9h one is still w2.
    const second = saveGoals(first.rows, ["Run"], ids, [9], ["w2"]);
    expect(second.steps).toEqual([
      { kind: "update", id: "w2", patch: { color: BLUE } },
      { kind: "archive", id: "w1" },
    ]);
  });

  it("renames a row it made rather than archiving one and creating another, hours and all", () => {
    const ids = counter("w");
    const { rows } = saveGoals([], ["A"], ids, [8]);
    // Back, A removed, C typed: on no row yet.
    const second = saveGoals(rows, ["C"], ids);
    expect(second.steps).toEqual([
      { kind: "update", id: "w1", patch: { title: "C", weeklyQuotaHours: 5 } },
    ]);
    expect(second.rowIds).toEqual(["w1"]);
    expect(titlesOf(second.rows)).toEqual(["C"]);
    expect(second.rows[0].quotaHours).toBe(5);
  });

  it("follows a recased title with a rename", () => {
    const { rows, rowIds } = saveGoals([], ["learn spanish"], counter("w"));
    expect(goalSteps(rows, ["Learn Spanish"], [5], rowIds)).toEqual([
      { kind: "update", id: "w1", patch: { title: "Learn Spanish" } },
    ]);
  });

  it("never holds more active goals than the list, however often it goes back and forth", () => {
    const ids = counter("w");
    // Each title always has the same hours, so the rows can be checked
    // against them too. Matched by title each time, as lists typed afresh are.
    const hoursOf = (t: string) => t.charCodeAt(0) - 60;
    const lists = [
      ["A"],
      ["A", "B"],
      ["B"],
      ["B", "C", "D"],
      ["D"],
      ["D", "A"],
      [],
      ["E", "E"],
      ["E"],
    ];
    let rows: GoalRow[] = [];
    for (const titles of lists) {
      const hours = titles.map(hoursOf);
      const saved = saveGoals(rows, titles, ids, hours);
      rows = saved.rows;
      expect(titlesOf(rows).sort()).toEqual([...titles].sort());
      expect(rows.map((r) => r.quotaHours).sort()).toEqual([...hours].sort());
      // And the next identical Continue is a no-op.
      expect(goalSteps(rows, titles, hours, saved.rowIds)).toEqual([]);
    }
  });

  it("keeps two identical goals as two, as the reducer does", () => {
    expect(
      goalSteps([], ["Run", "Run"], [5, 5], [null, null]).filter((s) => s.kind === "create")
    ).toHaveLength(2);
  });

  it("saves what the reducer holds, hours included", () => {
    const state = run(
      initialWizardState(),
      { type: "addGoal", title: "Launch my side project" },
      { type: "addGoal", title: "Get stronger", hours: 3 },
      { type: "setGoalHours", index: 0, hours: 12 }
    );
    expect(goalSteps([], state.goals, state.goalHours, state.goalRowIds)).toEqual([
      { kind: "create", slot: 0, title: "Launch my side project", color: BLUE, hours: 12 },
      { kind: "create", slot: 1, title: "Get stronger", color: ORANGE, hours: 3 },
    ]);
  });
});

describe("goalSteps: a replay", () => {
  const goals: AccountGoal[] = [
    account({ id: "g1", title: "Get stronger", color: GREEN }),
    account({ id: "g2", title: "Ship v2", color: null }),
    account({ id: "g3", title: "Learn Spanish", color: BLUE }),
    account({ id: "g4", title: "Read more", color: ORANGE }),
  ];
  const rows = goalRowsFrom(goals);
  const p = prefillWizard(goals, []);

  it("writes nothing when the prefilled goals are continued untouched", () => {
    expect(goalSteps(rows, p.goals, p.goalHours, p.goalRowIds)).toEqual([]);
  });

  it("writes nothing for a quota the box couldn't set, left alone (2.5h, 60h)", () => {
    const odd: AccountGoal[] = [
      account({ id: "g1", title: "Read", color: null, quotaHours: 2.5 }),
      account({ id: "g2", title: "Thesis", color: BLUE, quotaHours: 60 }),
    ];
    const start = prefillWizard(odd, []);
    expect(start.goalHours).toEqual([2.5, 60]);
    expect(goalSteps(goalRowsFrom(odd), start.goals, start.goalHours, start.goalRowIds)).toEqual([]);
  });

  it("updates only the quota of an account goal whose box was changed", () => {
    expect(goalSteps(rows, p.goals, [8, 5, 5], p.goalRowIds)).toEqual([
      { kind: "update", id: "g1", patch: { weeklyQuotaHours: 8 } },
    ]);
    // Typed back recased, in another slot and its color not that slot's:
    // still the quota and nothing else.
    expect(goalSteps(rows, ["Ship v2", "get stronger"], [5, 20], ["g2", "g1"])).toEqual([
      { kind: "update", id: "g1", patch: { weeklyQuotaHours: 20 } },
    ]);
    // Stepped down from 60, as the box would.
    const big = goalRowsFrom([account({ id: "g9", title: "Thesis", color: null, quotaHours: 60 })]);
    expect(goalSteps(big, ["Thesis"], [40], ["g9"])).toEqual([
      { kind: "update", id: "g9", patch: { weeklyQuotaHours: 40 } },
    ]);
  });

  it("never archives a prefilled goal that was removed, nor writes the hidden fourth", () => {
    expect(rows.map((r) => r.listed)).toEqual([true, true, true, false]);
    expect(goalSteps(rows, ["Get stronger", "Learn Spanish"], [5, 5], ["g1", "g3"])).toEqual([]);
    // Every one removed and a new one typed: only the new one is written.
    expect(goalSteps(rows, ["Run a 10k"], [5], [null])).toEqual([
      { kind: "create", slot: 0, title: "Run a 10k", color: BLUE, hours: 5 },
    ]);
    // Every listed one's hours changed: the fourth, never shown, isn't touched.
    const steps = goalSteps(rows, p.goals, [9, 9, 9], p.goalRowIds);
    expect(steps.map((s) => (s.kind === "create" ? null : s.id))).toEqual(["g1", "g2", "g3"]);
  });

  it("never renames or recolors an account goal, even when a new title could take it", () => {
    const one = goalRowsFrom(goals.slice(0, 1));
    expect(goalSteps(one, ["Something else"], [5], [null])).toEqual([
      { kind: "create", slot: 0, title: "Something else", color: BLUE, hours: 5 },
    ]);
    // A goal on its row under another title still writes nothing but hours.
    expect(goalSteps(one, ["Something else"], [5], ["g1"])).toEqual([]);
    // Moved down a slot, it keeps its own color and is still not written.
    expect(goalSteps(one, ["New", "Get stronger"], [5, 5], [null, "g1"])).toEqual([
      { kind: "create", slot: 0, title: "New", color: BLUE, hours: 5 },
    ]);
  });

  it("puts an account goal typed again back on its row instead of creating a twin", () => {
    // Removed, then typed back with different casing.
    const back = typeGoal(run(opened(goals), { type: "removeGoal", index: 0 }), rows, "get stronger");
    expect(back.goalRowIds).toEqual(["g2", "g3", "g1"]);
    expect(goalSteps(rows, back.goals, back.goalHours, back.goalRowIds)).toEqual([]);
    // The hidden fourth, typed in place of a removed one.
    const fourth = typeGoal(run(opened(goals), { type: "removeGoal", index: 2 }), rows, "read more");
    expect(fourth.goalRowIds).toEqual(["g1", "g2", "g4"]);
    expect(goalSteps(rows, fourth.goals, fourth.goalHours, fourth.goalRowIds)).toEqual([]);
    // By title alone, too, since that writes nothing.
    expect(
      goalSteps(rows, ["Ship v2", "Learn Spanish", "get stronger"], [5, 5, 5], [null, null, null])
    ).toEqual([]);
  });

  it("lets a replayer add beside their goals without a duplicate after Back", () => {
    const ids = counter("w");
    const one = goalRowsFrom(goals.slice(0, 1));
    const first = saveGoals(one, ["Get stronger", "Run a 10k"], ids, [5, 5], ["g1", null]);
    expect(first.steps).toEqual([
      { kind: "create", slot: 1, title: "Run a 10k", color: BLUE, hours: 5 },
    ]);
    expect(first.rowIds).toEqual(["g1", "w1"]);
    const second = saveGoals(first.rows, ["Get stronger", "Run a 10k"], ids, [5, 5], first.rowIds);
    expect(second.steps).toEqual([]);
    expect(titlesOf(second.rows)).toEqual(["Get stronger", "Run a 10k"]);
  });

  it("treats goals saved before a reload as the account's, so a reload never duplicates", () => {
    const saved = saveGoals([], ["A", "B"], counter("w"), [10, 4]).rows;
    // The page reloads: the wizard restarts from what listActiveGoals returns.
    const reloaded = reload(saved);
    const prefill = prefillWizard(reloaded, []);
    expect(prefill.goals).toEqual(["A", "B"]);
    expect(prefill.goalHours).toEqual([10, 4]);
    expect(prefill.goalRowIds).toEqual(["w1", "w2"]);
    expect(
      goalSteps(goalRowsFrom(reloaded), prefill.goals, prefill.goalHours, prefill.goalRowIds)
    ).toEqual([]);
  });
});

// The review's D1: matched by title on every Continue, goals whose titles
// repeat or match loosely could land on a different row each time, so a Back
// and Continue that changed nothing could write one goal's quota to another
// account goal (the hidden fourth included), and Screen 6 and the colors
// could name the wrong one. Each goal now stays on the row it knows.
describe("goalSteps: each goal stays on its own row (D1)", () => {
  it("writes a goal's new hours to its own row, never a loose twin's", () => {
    const goals = [
      account({ id: "g1", title: "RUN", color: GREEN }),
      account({ id: "g2", title: "Run", color: ORANGE }),
    ];
    const rows = goalRowsFrom(goals);
    // "Run" removed and typed back as "run": it's g2 again.
    let s = typeGoal(run(opened(goals), { type: "removeGoal", index: 1 }), rows, "run");
    expect(s.goalRowIds).toEqual(["g1", "g2"]);
    // Then "RUN" removed, and "run"'s box changed.
    s = run(s, { type: "removeGoal", index: 0 }, { type: "setGoalHours", index: 0, hours: 8 });
    expect(goalSteps(rows, s.goals, s.goalHours, s.goalRowIds)).toEqual([
      { kind: "update", id: "g2", patch: { weeklyQuotaHours: 8 } },
    ]);
    // By title alone "run" lands on g1, the first loose match.
    expect(matchGoals(rows, ["run"], [5], [null])[0]?.id).toBe("g1");
    expect(readyGoal(rows, s.goals, s.goalHours, s.goalRowIds)).toEqual({
      id: "g2",
      title: "run",
      color: ORANGE,
    });
  });

  it("never writes the hidden fourth when loosely equal titles change places", () => {
    const goals = [
      account({ id: "g1", title: "Run", color: null, quotaHours: 10 }),
      account({ id: "g2", title: "B", color: null }),
      account({ id: "g3", title: "C", color: null }),
      account({ id: "g4", title: "run", color: null, quotaHours: 3 }),
    ];
    const rows = goalRowsFrom(goals);
    // "Run" removed and typed back lowercase: g1, listed, before the hidden g4.
    let s = typeGoal(run(opened(goals), { type: "removeGoal", index: 0 }), rows, "run");
    expect(s.goalRowIds).toEqual(["g2", "g3", "g1"]);
    expect(goalSteps(rows, s.goals, s.goalHours, s.goalRowIds)).toEqual([]);
    // "C" removed and "Run" typed: g1 is taken, so it's the hidden "run" at its 3h.
    s = typeGoal(run(s, { type: "removeGoal", index: 1 }), rows, "Run");
    expect(s.goalRowIds).toEqual(["g2", "g1", "g4"]);
    expect(s.goalHours).toEqual([5, 10, 3]);
    // Nobody changed any hours, so nothing is written, to the fourth or anyone.
    expect(goalSteps(rows, s.goals, s.goalHours, s.goalRowIds)).toEqual([]);
  });

  it("never writes a quota nobody changed: a second copy left on its own is a goal of its own", () => {
    const goals = [account({ id: "g1", title: "Run", color: GREEN, quotaHours: 10 })];
    const rows = goalRowsFrom(goals);
    // "Run" typed again: the row is the first copy's, so this one is 5h, on none.
    let s = typeGoal(opened(goals), rows, "Run");
    expect(s.goalHours).toEqual([10, 5]);
    expect(s.goalRowIds).toEqual(["g1", null]);
    // The first copy removed. The 5h left was never g1's box, so g1 keeps 10h.
    s = run(s, { type: "removeGoal", index: 0 });
    expect(goalSteps(rows, s.goals, s.goalHours, s.goalRowIds)).toEqual([
      { kind: "create", slot: 0, title: "Run", color: BLUE, hours: 5 },
    ]);
    // At g1's own 10h it may be g1 again, which then writes nothing.
    s = run(s, { type: "setGoalHours", index: 0, hours: 10 });
    expect(goalSteps(rows, s.goals, s.goalHours, s.goalRowIds)).toEqual([]);
  });
});

describe("savedRowIds", () => {
  it("gives every goal the row it's on, and each new one the id it was created with", () => {
    const rows = goalRowsFrom([account({ id: "g1", title: "Mine", color: BLUE })]);
    const created = new Map([
      [1, "w1"],
      [2, "w2"],
    ]);
    expect(savedRowIds(rows, ["Mine", "New", "Other"], [5, 5, 5], ["g1", null, null], created)).toEqual(
      ["g1", "w1", "w2"]
    );
  });

  it("leaves a goal whose create never landed on no row, for the next Continue to create", () => {
    const titles = ["A", "B", "C"];
    const steps = goalSteps([], titles, [5, 6, 7], unsaved(titles));
    // Only the first create succeeded.
    const rows = afterGoalStep([], steps[0], "w1");
    const ids = savedRowIds([], titles, [5, 6, 7], unsaved(titles), new Map([[0, "w1"]]));
    expect(ids).toEqual(["w1", null, null]);
    expect(goalSteps(rows, titles, [5, 6, 7], ids)).toEqual(steps.slice(1));
  });

  it("keeps a goal on the row it was matched to when its update didn't land", () => {
    const first = saveGoals([], ["A"], counter("w"));
    // Back, A removed, C typed: a rename of w1, which fails.
    const steps = goalSteps(first.rows, ["C"], [5], [null]);
    expect(steps).toEqual([{ kind: "update", id: "w1", patch: { title: "C" } }]);
    const ids = savedRowIds(first.rows, ["C"], [5], [null], new Map());
    expect(ids).toEqual(["w1"]);
    expect(goalSteps(first.rows, ["C"], [5], ids)).toEqual(steps);
  });
});

describe("afterGoalStep", () => {
  it("leaves the rows as they were for a create with no id", () => {
    const step: GoalStep = { kind: "create", slot: 0, title: "A", color: BLUE, hours: 5 };
    expect(afterGoalStep([], step)).toEqual([]);
  });

  it("stores a created goal's hours as its quota", () => {
    const step: GoalStep = { kind: "create", slot: 0, title: "A", color: BLUE, hours: 12 };
    expect(afterGoalStep([], step, "w1")).toEqual([
      { id: "w1", title: "A", color: BLUE, quotaHours: 12, origin: "wizard", listed: true },
    ]);
  });

  it("maps an update's fields onto the row, the quota by its own name", () => {
    const rows = [row({ id: "w1", title: "A", color: BLUE, origin: "wizard", listed: true })];
    expect(
      afterGoalStep(rows, { kind: "update", id: "w1", patch: { weeklyQuotaHours: 3 } })
    ).toEqual([{ ...rows[0], quotaHours: 3 }]);
    expect(
      afterGoalStep(rows, { kind: "update", id: "w1", patch: { title: "B", color: ORANGE } })
    ).toEqual([{ ...rows[0], title: "B", color: ORANGE }]);
    // Never a stray weeklyQuotaHours key on the row.
    const [after] = afterGoalStep(rows, {
      kind: "update",
      id: "w1",
      patch: { weeklyQuotaHours: 9 },
    });
    expect(Object.keys(after).sort()).toEqual(Object.keys(rows[0]).sort());
  });

  it("stops where a failure stops, so the next Continue picks up the rest", () => {
    const titles = ["A", "B", "C"];
    const steps = goalSteps([], titles, [5, 6, 7], unsaved(titles));
    // Only the first create succeeded.
    const rows = afterGoalStep([], steps[0], "w1");
    expect(goalSteps(rows, titles, [5, 6, 7], unsaved(titles))).toEqual(steps.slice(1));
  });
});

describe("habitSteps", () => {
  it("creates the selected chips in pick order, without a color", () => {
    expect(habitSteps([], ["Stretch", "Drink water"])).toEqual([
      { kind: "create", name: "Stretch" },
      { kind: "create", name: "Drink water" },
    ]);
  });

  it("archives a chip deselected after Back, and recreates nothing", () => {
    const ids = counter("h");
    const first = saveHabits([], ["Drink water", "Stretch"], ids);
    const second = saveHabits(first.rows, ["Stretch"], ids);
    expect(second.steps).toEqual([{ kind: "archive", id: "h1" }]);
    expect(second.rows).toEqual([{ id: "h2", name: "Stretch", origin: "wizard" }]);
    expect(habitSteps(second.rows, ["Stretch"])).toEqual([]);
  });

  it("writes nothing for a replayer who changes nothing, presets matched by name", () => {
    const habits = [
      { id: "h1", name: "drink water" },
      { id: "h2", name: "Floss" },
    ];
    const rows = habitRowsFrom(habits);
    expect(habitSteps(rows, prefillWizard([], habits).habits)).toEqual([]);
  });

  it("leaves an account duplicate alone while its chip stays selected", () => {
    const rows = habitRowsFrom([
      { id: "h1", name: "Floss" },
      { id: "h2", name: "floss" },
    ]);
    expect(habitSteps(rows, ["Floss"])).toEqual([]);
  });

  it("never archives an account habit, deselected or skipped", () => {
    const rows = habitRowsFrom([
      { id: "h1", name: "Meditate" },
      { id: "h2", name: "Floss" },
    ]);
    // "Skip for now": nothing selected.
    expect(habitSteps(rows, [])).toEqual([]);
    // One deselected, a new one picked: only the new one is written.
    expect(habitSteps(rows, ["Floss", "Stretch"])).toEqual([{ kind: "create", name: "Stretch" }]);
  });

  it("archives only this run's habits when skipped after Back", () => {
    const ids = counter("w");
    const habits = habitRowsFrom([{ id: "h1", name: "Meditate" }]);
    const first = saveHabits(habits, ["Meditate", "Stretch"], ids);
    expect(first.steps).toEqual([{ kind: "create", name: "Stretch" }]);
    expect(habitSteps(first.rows, [])).toEqual([{ kind: "archive", id: "w1" }]);
  });

  it("never holds more habits than the chips selected, however often it goes back and forth", () => {
    const ids = counter("h");
    let rows: HabitRow[] = [];
    const picks = [
      ["Drink water"],
      ["Drink water", "Meditate"],
      [],
      ["Meditate", "Floss"],
      ["Floss"],
      ["Floss", "Drink water", "Journal"],
    ];
    for (const selected of picks) {
      rows = saveHabits(rows, selected, ids).rows;
      expect(rows.map((r) => r.name).sort()).toEqual([...selected].sort());
      expect(habitSteps(rows, selected)).toEqual([]);
    }
  });

  it("works from the reducer's own state, custom chips included", () => {
    const state = run(
      initialWizardState(),
      { type: "toggleHabit", name: V3_HABITS[0] },
      { type: "addCustomHabit", name: "floss daily" },
      { type: "addCustomHabit", name: "drink water" }
    );
    expect(habitSteps([], state.habits)).toEqual([
      { kind: "create", name: "Drink water" },
      { kind: "create", name: "Floss daily" },
    ]);
  });
});

describe("afterHabitStep", () => {
  it("adds a created row and drops an archived one", () => {
    const create: HabitStep = { kind: "create", name: "Floss" };
    const rows = afterHabitStep([], create, "h1");
    expect(rows).toEqual([{ id: "h1", name: "Floss", origin: "wizard" }]);
    expect(afterHabitStep(rows, { kind: "archive", id: "h1" })).toEqual([]);
    expect(afterHabitStep(rows, create)).toEqual(rows);
  });
});

describe("readyGoal (Screen 6's pill and the Clock's preselect)", () => {
  it("is the first goal of a first run, on the row Screen 2 just created, in its color", () => {
    const titles = ["Launch my side project", "Get stronger"];
    const { rows, rowIds } = saveGoals([], titles, counter("w"));
    expect(readyGoal(rows, titles, at5(titles), rowIds)).toEqual({
      id: "w1",
      title: "Launch my side project",
      color: BLUE,
    });
  });

  it("follows the list after Back: the goal that moved up, with that slot's color", () => {
    const ids = counter("w");
    const first = saveGoals([], ["A", "B"], ids);
    const second = saveGoals(first.rows, ["B", "C"], ids, [5, 5], [first.rowIds[1], null]);
    expect(readyGoal(second.rows, ["B", "C"], [5, 5], second.rowIds)).toEqual({
      id: "w2",
      title: "B",
      color: BLUE,
    });
  });

  it("is a replayer's first listed goal, their own row and color", () => {
    const goals: AccountGoal[] = [
      account({ id: "g1", title: "Ship v2", color: null }),
      account({ id: "g2", title: "Get stronger", color: GREEN }),
    ];
    const rows = goalRowsFrom(goals);
    const p = prefillWizard(goals, []);
    expect(readyGoal(rows, p.goals, p.goalHours, p.goalRowIds)).toEqual({
      id: "g1",
      title: "Ship v2",
      color: goalFillHex({ id: "g1", color: null }),
    });
    // Removing it on Screen 2 makes the next one first. The account row
    // itself is left as it was (goalSteps never archives one).
    const s = run(opened(goals), { type: "removeGoal", index: 0 });
    expect(readyGoal(rows, s.goals, s.goalHours, s.goalRowIds)).toEqual({
      id: "g2",
      title: "Get stronger",
      color: GREEN,
    });
  });

  it("puts a replayer's new first goal on the row it was saved to", () => {
    const goals: AccountGoal[] = [account({ id: "g1", title: "Ship v2", color: BLUE })];
    const titles = ["Read more", "Ship v2"];
    const { rows, rowIds } = saveGoals(goalRowsFrom(goals), titles, counter("w"), [5, 5], [null, "g1"]);
    expect(readyGoal(rows, titles, [5, 5], rowIds)).toEqual({
      id: "w1",
      title: "Read more",
      color: ORANGE,
    });
  });

  it("has no id for a goal nothing has saved, and nothing for no goals", () => {
    expect(readyGoal([], ["Unsaved"], [5], [null])).toEqual({
      id: null,
      title: "Unsaved",
      color: BLUE,
    });
    expect(readyGoal([], [], [], [])).toBeNull();
  });
});

// The review's property for D1, over random runs of Screen 2: goals added (as
// the shell adds them), removed and their hours set, Continue with every
// write landing or a failure partway, and the odd reload. Titles repeat and
// match loosely, the account has quotas the box can't set and goals past the
// third. A run is a seed, so a failure here names one that replays it.
describe("Screen 2 fuzzed: every goal keeps its row (D1)", () => {
  // mulberry32.
  function seeded(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const TITLES = ["Run", "run", "  RUN ", "Read more", "read  more", "Ship v2", "Thesis", "A", "a"];
  const QUOTAS = [5, 10, 3, 2.5, 60];
  const COLORS = [null, BLUE, ORANGE, GREEN, "#7a5af8"];
  // What a box gets set to, the reducer clamping what's out of range.
  const SET_TO = [1, 3, 5, 8, 10, 40, 0, 41, 2.5, 60, -2];

  type DbGoal = { title: string; color: string | null; quota: number; active: boolean };

  it("writes nothing after a save that landed, and only an edited quota to an account goal", () => {
    let saves = 0;
    let landed = 0;
    let quotaWrites = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const rand = seeded(seed);
      const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
      const at = `seed ${seed}`;

      // The database: every goal there has been, by id, in created_at order.
      const db = new Map<string, DbGoal>();
      let made = 0;
      const insert = (title: string, color: string | null, quota: number) => {
        const id = `r${++made}`;
        db.set(id, { title, color, quota, active: true });
        return id;
      };
      for (let k = Math.floor(rand() * 6); k > 0; k--) {
        insert(pick(TITLES).trim(), pick(COLORS), pick(QUOTAS));
      }

      // The page as it loads: the account's active goals, the wizard started
      // from them. Which boxes were changed since, and what the account goals
      // looked like, are the test's own bookkeeping.
      let rows: GoalRow[] = [];
      let state = initialWizardState();
      let edited: boolean[] = [];
      let accountGoals = new Map<string, { title: string; color: string | null }>();
      const load = () => {
        const goals: AccountGoal[] = [...db]
          .filter(([, g]) => g.active)
          .map(([id, g]) => ({ id, title: g.title, color: g.color, quotaHours: g.quota }));
        rows = goalRowsFrom(goals);
        state = opened(goals);
        edited = state.goals.map(() => false);
        accountGoals = new Map(goals.map((g) => [g.id, { title: g.title, color: g.color }]));
      };
      load();

      for (let move = 0; move < 40; move++) {
        const roll = rand();
        if (roll < 0.3) {
          const next = typeGoal(state, rows, pick(TITLES));
          if (next !== state) edited.push(false);
          state = next;
        } else if (roll < 0.47) {
          const index = Math.floor(rand() * (state.goals.length + 1)) - (rand() < 0.1 ? 1 : 0);
          const next = wizardReducer(state, { type: "removeGoal", index });
          if (next !== state) edited.splice(index, 1);
          state = next;
        } else if (roll < 0.7) {
          const index = Math.floor(rand() * Math.max(1, state.goals.length));
          const next = wizardReducer(state, { type: "setGoalHours", index, hours: pick(SET_TO) });
          if (next !== state) edited[index] = true;
          state = next;
        } else if (roll < 0.96) {
          // Continue, as useGoalWrites runs it: the steps in order, the
          // first refused one ending the save.
          saves++;
          const { goals, goalHours, goalRowIds } = state;
          const matched = matchGoals(rows, goals, goalHours, goalRowIds);
          const steps = goalSteps(rows, goals, goalHours, goalRowIds);
          const refused = rand() < 0.3 ? Math.floor(rand() * (steps.length + 1)) : steps.length;
          const created = new Map<number, string>();
          let now = rows;
          steps.forEach((step, k) => {
            if (step.kind !== "create" && accountGoals.has(step.id)) {
              // An account goal: never archived, and never anything but
              // the quota, for a goal whose box was changed.
              expect(step.kind, at).toBe("update");
              if (step.kind !== "update") return;
              expect(Object.keys(step.patch), at).toEqual(["weeklyQuotaHours"]);
              expect(edited[matched.findIndex((r) => r?.id === step.id)], at).toBe(true);
              quotaWrites++;
            }
            if (k >= refused) return;
            if (step.kind === "create") {
              const id = insert(step.title, step.color, step.hours);
              created.set(step.slot, id);
              now = afterGoalStep(now, step, id);
              return;
            }
            const goal = db.get(step.id);
            expect(goal?.active, at).toBe(true);
            if (!goal) return;
            if (step.kind === "archive") {
              goal.active = false;
            } else {
              const { title, color, weeklyQuotaHours } = step.patch;
              if (title !== undefined) goal.title = title;
              if (color !== undefined) goal.color = color;
              if (weeklyQuotaHours !== undefined) {
                goal.quota = weeklyQuotaHours;
                // Saved: the box and the row agree again.
                edited[matched.findIndex((r) => r?.id === step.id)] = false;
              }
            }
            now = afterGoalStep(now, step);
          });
          const ids = savedRowIds(rows, goals, goalHours, goalRowIds, created);
          rows = now;
          state = wizardReducer(state, { type: "setGoalRowIds", ids, goals });

          for (const [id, was] of accountGoals) {
            const goal = db.get(id);
            expect(goal?.active, at).toBe(true);
            expect({ title: goal?.title, color: goal?.color }, at).toEqual(was);
          }
          if (refused === steps.length) {
            landed++;
            // Back, then Continue with nothing changed: nothing to write.
            expect(goalSteps(rows, state.goals, state.goalHours, state.goalRowIds), at).toEqual([]);
            // What's stored is what's listed: every goal on an active row
            // holding its hours (and its title, if this run made it), in the
            // color it's drawn in, and nothing else this run made still on.
            const { colors } = goalColors(rows, state.goals, state.goalHours, state.goalRowIds);
            state.goals.forEach((title, i) => {
              const id = state.goalRowIds[i];
              const goal = id ? db.get(id) : undefined;
              expect(goal?.active, at).toBe(true);
              expect(goal?.quota, at).toBe(state.goalHours[i]);
              if (id && !accountGoals.has(id)) {
                expect(goal?.title, at).toBe(title);
                expect(goal?.color?.toLowerCase(), at).toBe(colors[i].toLowerCase());
              }
            });
            for (const [id, goal] of db) {
              if (goal.active && !accountGoals.has(id)) expect(state.goalRowIds, at).toContain(id);
            }
            expect(readyGoal(rows, state.goals, state.goalHours, state.goalRowIds)?.id, at).toBe(
              state.goalRowIds[0]
            );
          }
        } else {
          load();
        }

        // Aligned, every row named once at most, and only rows that exist.
        expect(state.goalHours, at).toHaveLength(state.goals.length);
        expect(state.goalRowIds, at).toHaveLength(state.goals.length);
        expect(edited, at).toHaveLength(state.goals.length);
        const named = state.goalRowIds.filter((id): id is string => id !== null);
        expect(new Set(named).size, at).toBe(named.length);
        for (const id of named) expect(rows.some((r) => r.id === id), at).toBe(true);
      }
    }
    // The runs reach what they're for.
    expect(saves).toBeGreaterThan(1000);
    expect(landed).toBeGreaterThan(500);
    expect(quotaWrites).toBeGreaterThan(50);
  });
});
