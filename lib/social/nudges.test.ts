import { describe, expect, it } from "vitest";

import {
  NUDGE_PRESETS,
  NUDGE_PRESET_KEYS,
  formatCooldownLeft,
  isNudgePreset,
  isNudgeTargetKind,
  nudgeRefusalMessage,
  nudgeRejectionFallback,
  nudgeStateRefusal,
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

  it("reads a locked state with its reason", () => {
    expect(parseNudgeState({ status: "locked", reason: "in_session" })).toEqual({
      status: "locked",
      reason: "in_session",
      opensAt: null,
    });
    expect(
      parseNudgeState({
        status: "locked",
        reason: "too_early",
        opens_at: "2026-09-14T21:00:00+00:00",
      })
    ).toEqual({
      status: "locked",
      reason: "too_early",
      opensAt: Date.parse("2026-09-14T21:00:00Z"),
    });
  });

  it("locks with the vague reason when the reason is unknown", () => {
    for (const reason of [undefined, "private", "cooldown", 7]) {
      expect(parseNudgeState({ status: "locked", reason })).toEqual({
        status: "locked",
        reason: "unavailable",
        opensAt: null,
      });
    }
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
      opensAt: null,
    });
    expect(
      parseSendNudgeResult({
        ok: false,
        reason: "too_early",
        opens_at: "2026-09-14T21:00:00+00:00",
      })
    ).toEqual({
      ok: false,
      reason: "too_early",
      cooldownUntil: null,
      opensAt: Date.parse("2026-09-14T21:00:00Z"),
    });
    expect(parseSendNudgeResult({ ok: false, reason: "private" })).toEqual({
      ok: false,
      reason: "unavailable",
      cooldownUntil: null,
      opensAt: null,
    });
    expect(parseSendNudgeResult(null)).toEqual({
      ok: false,
      reason: "unavailable",
      cooldownUntil: null,
      opensAt: null,
    });
  });
});

describe("nudgeStateRefusal", () => {
  it("is null only for a nudgeable friend", () => {
    expect(nudgeStateRefusal({ status: "ok", goals: [], habits: { left: 1, total: 1 } })).toBe(
      null
    );
    expect(nudgeStateRefusal({ status: "hidden" })).toBe(null);
  });

  it("turns cooldown and locked into the same refusal a send returns", () => {
    expect(nudgeStateRefusal({ status: "cooldown", cooldownUntil: NOW })).toEqual({
      reason: "cooldown",
      cooldownUntil: NOW,
      opensAt: null,
    });
    expect(nudgeStateRefusal({ status: "locked", reason: "too_early", opensAt: NOW })).toEqual({
      reason: "too_early",
      cooldownUntil: null,
      opensAt: NOW,
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

  it("says why, by name", () => {
    const say = (
      reason: Parameters<typeof nudgeRefusalMessage>[0]["reason"],
      times: { cooldownUntil?: number; opensAt?: number } = {}
    ) =>
      nudgeRefusalMessage(
        { reason, cooldownUntil: times.cooldownUntil ?? null, opensAt: times.opensAt ?? null },
        "Sam",
        NOW
      );
    expect(say("cooldown", { cooldownUntil: NOW + 4 * 3_600_000 })).toBe(
      "You've already nudged Sam — you can again in 4h."
    );
    expect(say("cooldown")).toBe("You've already nudged Sam recently.");
    expect(say("too_early", { opensAt: NOW + 35 * 60_000 })).toBe(
      "You can nudge Sam from 2pm their time — in 35m."
    );
    expect(say("too_early")).toBe("You can nudge Sam from 2pm their time.");
    expect(say("disabled")).toBe("Sam has turned off nudges.");
    expect(say("in_session")).toBe("Sam is in a session right now.");
    expect(say("done_today")).toBe("Sam is all caught up today.");
    expect(say("nothing_to_nudge")).toBe("Sam doesn't have any goals or habits to nudge.");
    // Not onboarded, waitlisted, no timezone — and any bad goal id on send.
    expect(say("unavailable")).toBe("Sam can't be nudged right now.");
  });

  it("has name-free copy for the action, which only knows ids", () => {
    const copy = (reason: Parameters<typeof nudgeRejectionFallback>[0]["reason"]) =>
      nudgeRejectionFallback({ reason, cooldownUntil: null, opensAt: null });
    expect(copy("cooldown")).toBe("You've already nudged them recently.");
    expect(copy("disabled")).toBe("They've turned off nudges.");
    expect(copy("too_early")).toBe("You can nudge them from 2pm their time.");
    expect(copy("in_session")).toBe("They're in a session right now.");
    expect(copy("done_today")).toBe("They're all caught up today.");
    expect(copy("nothing_to_nudge")).toBe("They don't have any goals or habits to nudge.");
    expect(copy("unavailable")).toBe("They can't be nudged right now.");
  });
});
