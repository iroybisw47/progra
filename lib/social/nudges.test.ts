import { describe, expect, it } from "vitest";

import {
  NUDGE_PRESETS,
  NUDGE_PRESET_KEYS,
  formatCooldownLeft,
  isNudgePreset,
  isNudgeTargetKind,
  nudgeRejectionFallback,
  nudgeRejectionMessage,
  parseNudgeState,
  parseSendNudgeResult,
} from "@/lib/social/nudges";

const NOW = Date.parse("2026-09-14T18:00:00Z");

describe("presets", () => {
  // The database CHECK on nudges.preset_key holds this exact set. This literal
  // is the second copy on purpose: if someone edits one side, this fails loudly
  // instead of the insert failing in production.
  it("matches the keys the SQL CHECK constraint allows", () => {
    expect(NUDGE_PRESET_KEYS).toEqual([
      "lock_in",
      "still_time",
      "waiting",
      "one_session",
      "miss_you",
    ]);
  });

  it("says nothing about pods — the app has none", () => {
    expect(Object.values(NUDGE_PRESETS).join(" ")).not.toMatch(/pod/i);
  });

  it("guards unknown keys and kinds", () => {
    expect(isNudgePreset("lock_in")).toBe(true);
    expect(isNudgePreset("shame")).toBe(false);
    expect(isNudgePreset("toString")).toBe(false); // inherited property
    expect(isNudgeTargetKind("habits")).toBe(true);
    expect(isNudgeTargetKind("goals")).toBe(false);
  });
});

describe("parseNudgeState", () => {
  it("reads an ok state", () => {
    expect(
      parseNudgeState({
        status: "ok",
        goals: [{ goal_id: "g1", title: "Thesis", color: "#aabbcc" }],
        habits: { left: 2, total: 3 },
      })
    ).toEqual({
      status: "ok",
      goals: [{ goalId: "g1", title: "Thesis", color: "#aabbcc" }],
      habits: { left: 2, total: 3 },
    });
  });

  it("keeps goals when habits are all done", () => {
    const state = parseNudgeState({
      status: "ok",
      goals: [{ goal_id: "g1", title: "Thesis", color: null }],
      habits: null,
    });
    expect(state).toEqual({
      status: "ok",
      goals: [{ goalId: "g1", title: "Thesis", color: null }],
      habits: null,
    });
  });

  it("reads a cooldown as epoch ms", () => {
    expect(
      parseNudgeState({ status: "cooldown", cooldown_until: "2026-09-15T00:00:00+00:00" })
    ).toEqual({ status: "cooldown", cooldownUntil: Date.parse("2026-09-15T00:00:00Z") });
  });

  it("hides anything malformed rather than offering a button", () => {
    for (const bad of [
      null,
      undefined,
      "ok",
      [],
      {},
      { status: "disabled" },
      { status: "in_session" },
      { status: "cooldown" }, // no timestamp
      { status: "cooldown", cooldown_until: "not a date" },
      { status: "ok", goals: [], habits: null }, // nothing to nudge
      { status: "ok", goals: [], habits: { left: 0, total: 3 } },
    ]) {
      expect(parseNudgeState(bad)).toEqual({ status: "hidden" });
    }
  });

  it("drops junk entries inside the goals array", () => {
    const state = parseNudgeState({
      status: "ok",
      goals: [{ goal_id: "g1", title: "Keep" }, { goal_id: 7 }, null, "x"],
      habits: null,
    });
    expect(state).toEqual({
      status: "ok",
      goals: [{ goalId: "g1", title: "Keep", color: null }],
      habits: null,
    });
  });
});

describe("parseSendNudgeResult", () => {
  it("reads a success", () => {
    expect(parseSendNudgeResult({ ok: true, nudge_id: "n1", pushed: true })).toEqual({
      ok: true,
      nudgeId: "n1",
      pushed: true,
    });
  });

  it("reads a coalesced success as pushed false", () => {
    expect(
      parseSendNudgeResult({ ok: true, nudge_id: "n2", pushed: false, coalesced_with: "n1" })
    ).toEqual({ ok: true, nudgeId: "n2", pushed: false });
  });

  it("reads each rejection, and collapses unknown ones", () => {
    expect(parseSendNudgeResult({ ok: false, reason: "in_session" })).toEqual({
      ok: false,
      reason: "in_session",
      cooldownUntil: null,
    });
    expect(parseSendNudgeResult({ ok: false, reason: "private" })).toEqual({
      ok: false,
      reason: "unavailable",
      cooldownUntil: null,
    });
    expect(parseSendNudgeResult(null)).toEqual({
      ok: false,
      reason: "unavailable",
      cooldownUntil: null,
    });
  });
});

describe("cooldown copy", () => {
  it("rounds the wait", () => {
    expect(formatCooldownLeft(NOW + 30_000, NOW)).toBe("a moment");
    expect(formatCooldownLeft(NOW - 5_000, NOW)).toBe("a moment"); // already past
    expect(formatCooldownLeft(NOW + 35 * 60_000, NOW)).toBe("35m");
    expect(formatCooldownLeft(NOW + 4 * 3_600_000, NOW)).toBe("4h");
  });

  it("names the wait, and stays vague about everything else", () => {
    expect(
      nudgeRejectionMessage(
        { ok: false, reason: "cooldown", cooldownUntil: NOW + 4 * 3_600_000 },
        "Sam",
        NOW
      )
    ).toBe("You've already nudged Sam — you can again in 4h.");
    expect(
      nudgeRejectionMessage({ ok: false, reason: "in_session", cooldownUntil: null }, "Sam", NOW)
    ).toBe("Sam is in a session right now.");
    // Disabled, before 14:00, caught up and "that goal is private" all land here.
    expect(
      nudgeRejectionMessage({ ok: false, reason: "unavailable", cooldownUntil: null }, "Sam", NOW)
    ).toBe("Sam can't be nudged right now.");
  });

  it("has name-free copy for the action, which only knows ids", () => {
    const copy = (reason: "cooldown" | "in_session" | "unavailable") =>
      nudgeRejectionFallback({ ok: false, reason, cooldownUntil: null });
    expect(copy("cooldown")).toBe("You've already nudged them recently.");
    expect(copy("in_session")).toBe("They're in a session right now.");
    expect(copy("unavailable")).toBe("They can't be nudged right now.");
  });
});
