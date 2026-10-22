import { describe, expect, it } from "vitest";

import { PRAISE_PRESET_KEYS } from "@/lib/social/nudges";
import {
  RALLY_HIDDEN,
  goalPaceMeta,
  isRallyKind,
  parseRallyState,
  rallyRefusalMessage,
  rallyRejectionFallback,
  rallyStateRefusal,
} from "@/lib/social/rally";

const NOW = Date.parse("2026-10-22T18:00:00Z");
const HABIT = { habit_id: "h1", name: "Read", color: "#77B7C6" };
const GOAL = { goal_id: "g1", title: "Thesis", color: null, worked_ms: 5_400_000, quota_ms: 18_000_000 };

describe("parseRallyState", () => {
  it("reads a cheer", () => {
    expect(
      parseRallyState({ status: "ok", cheer: { habits: [HABIT] }, nudge: null })
    ).toEqual({
      status: "ok",
      cheer: { habits: [{ habitId: "h1", name: "Read", color: "#77B7C6" }] },
      nudge: null,
    });
  });

  it("reads a nudge with all three kinds of target", () => {
    expect(
      parseRallyState({
        status: "ok",
        cheer: null,
        nudge: { habits: [HABIT], goals: [GOAL], streak: { current: 4 } },
      })
    ).toEqual({
      status: "ok",
      cheer: null,
      nudge: {
        habits: [{ habitId: "h1", name: "Read", color: "#77B7C6" }],
        goals: [{ goalId: "g1", title: "Thesis", color: null, workedMs: 5_400_000, quotaMs: 18_000_000 }],
        streak: { current: 4 },
      },
    });
  });

  it("keeps only the cheer if both modes arrive", () => {
    const state = parseRallyState({
      status: "ok",
      cheer: { habits: [HABIT] },
      nudge: { habits: [HABIT], goals: [], streak: null },
    });
    expect(state.status === "ok" && state.nudge).toBeNull();
  });

  it("drops junk entries, and hides when nothing usable is left", () => {
    expect(
      parseRallyState({
        status: "ok",
        cheer: { habits: [{ habit_id: 1, name: "x" }] },
        nudge: { habits: ["x"], goals: [{ ...GOAL, quota_ms: 0 }], streak: { current: 0 } },
      })
    ).toEqual(RALLY_HIDDEN);
  });

  it("passes cooldown and locked through, and hides anything else", () => {
    expect(
      parseRallyState({ status: "cooldown", cooldown_until: "2026-10-22T20:00:00Z" })
    ).toEqual({ status: "cooldown", cooldownUntil: Date.parse("2026-10-22T20:00:00Z") });
    expect(parseRallyState({ status: "locked", reason: "disabled" })).toEqual({
      status: "locked",
      reason: "disabled",
      opensAt: null,
    });
    expect(parseRallyState({ status: "cooldown", cooldown_until: "nope" })).toEqual(RALLY_HIDDEN);
    expect(parseRallyState({ status: "weird" })).toEqual(RALLY_HIDDEN);
    expect(parseRallyState(null)).toEqual(RALLY_HIDDEN);
  });
});

describe("refusals", () => {
  it("maps a non-ok state to its refusal", () => {
    expect(rallyStateRefusal({ status: "cooldown", cooldownUntil: NOW })).toEqual({
      reason: "cooldown",
      cooldownUntil: NOW,
      opensAt: null,
    });
    expect(rallyStateRefusal({ status: "ok", cheer: null, nudge: null })).toBeNull();
  });

  it("says why, with the wait", () => {
    const say = (reason: Parameters<typeof rallyRefusalMessage>[0]["reason"], extra = {}) =>
      rallyRefusalMessage({ reason, cooldownUntil: null, opensAt: null, ...extra }, "Sam", NOW);
    expect(say("cooldown", { cooldownUntil: NOW + 4 * 3_600_000 })).toBe(
      "You've already rallied Sam — you can again in 4h."
    );
    expect(say("too_early", { opensAt: NOW + 2 * 3_600_000 })).toBe(
      "You can rally Sam from 9am their time — in 2h."
    );
    // Neutral on purpose: true of the Settings opt-out and of a mute alike.
    expect(say("disabled")).toBe("Sam isn't taking rallies right now.");
    expect(say("in_session")).toBe("Sam is in a session right now.");
    expect(say("done_today")).toBe("Sam is all caught up today.");
    expect(say("unavailable")).toBe("Sam can't be rallied right now.");
  });

  it("has name-free copy for the action", () => {
    expect(
      rallyRejectionFallback({ reason: "disabled", cooldownUntil: null, opensAt: null })
    ).toBe("They aren't taking rallies right now.");
  });
});

describe("helpers", () => {
  it("formats a goal's pace", () => {
    expect(goalPaceMeta({ workedMs: 5_400_000, quotaMs: 18_000_000 })).toBe("1.5h of 5h this week");
    expect(goalPaceMeta({ workedMs: 0, quotaMs: 3_600_000 })).toBe("0h of 1h this week");
  });

  it("knows the kinds send_rally takes", () => {
    expect(["habit", "goal", "streak"].every(isRallyKind)).toBe(true);
    expect(isRallyKind("habits")).toBe(false);
  });

  // send_rally treats exactly these as cheers (is_praise_preset), and the
  // nudges_rally_cheer_shape constraint pins a cheer to one habit.
  it("cheers with the praise presets", () => {
    expect(PRAISE_PRESET_KEYS).toEqual(["lets_go", "locked_in", "goated"]);
  });
});
