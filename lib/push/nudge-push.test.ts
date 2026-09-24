import { describe, expect, it } from "vitest";

import {
  composeNudgePush,
  nudgeCollapseId,
  nudgeDedupeKey,
  nudgeLabelSnippet,
} from "@/lib/push/nudge-push";

const UUID = "3edc1d62-dc8a-431e-8cd3-d35c9e66a934";

describe("composeNudgePush", () => {
  it("names the goal and deep-links to the clock picker", () => {
    expect(
      composeNudgePush({
        mode: "single",
        senderName: "Sam",
        targetKind: "goal",
        targetLabel: "Thesis",
        goalId: UUID,
      })
    ).toEqual({
      title: "Sam",
      body: "nudged you to lock in on Thesis.",
      url: `/clock?goal=${UUID}`,
    });
  });

  it("falls back to the plain clock screen when the goal is gone", () => {
    const push = composeNudgePush({
      mode: "single",
      senderName: "Sam",
      targetKind: "goal",
      targetLabel: "Deleted goal",
      goalId: null,
    });
    expect(push.url).toBe("/clock");
  });

  it("sends habits nudges home", () => {
    expect(
      composeNudgePush({
        mode: "single",
        senderName: "Sam",
        targetKind: "habits",
        targetLabel: "Habits",
        goalId: null,
      })
    ).toEqual({ title: "Sam", body: "nudged you to finish your habits.", url: "/" });
  });

  it("counts the others in a coalesced push", () => {
    expect(
      composeNudgePush({ mode: "coalesced", senderName: "Sam", othersCount: 1 })
    ).toEqual({ title: "Sam and 1 other", body: "nudged you to lock in.", url: "/clock" });
    expect(
      composeNudgePush({ mode: "coalesced", senderName: "Sam", othersCount: 3 }).title
    ).toBe("Sam and 3 others");
  });

  it("never carries the preset the sender picked", () => {
    const bodies = [
      composeNudgePush({
        mode: "single",
        senderName: "Sam",
        targetKind: "goal",
        targetLabel: "Thesis",
        goalId: UUID,
      }),
      composeNudgePush({ mode: "coalesced", senderName: "Sam", othersCount: 2 }),
    ];
    for (const push of bodies) {
      expect(`${push.title} ${push.body}`).not.toMatch(/🔒|👀|waiting|quiet/i);
    }
  });

  it("truncates a long goal title", () => {
    const long = "A".repeat(100);
    const push = composeNudgePush({
      mode: "single",
      senderName: "Sam",
      targetKind: "goal",
      targetLabel: long,
      goalId: UUID,
    });
    expect(push.body.length).toBeLessThan(long.length);
    expect(push.body).toContain("…");
  });

  it("leaves a short label alone", () => {
    expect(nudgeLabelSnippet("  Thesis  ")).toBe("Thesis");
  });
});

describe("composeNudgePush — praise", () => {
  it("congratulates finished habits and lands on Progress, not the clock", () => {
    expect(
      composeNudgePush({
        mode: "single",
        tone: "praise",
        senderName: "Sam",
        targetKind: "habits",
        targetLabel: "Habits",
        goalId: null,
      })
    ).toEqual({
      title: "Sam",
      body: "cheered you on for finishing your habits.",
      url: "/",
    });
  });

  it("never sends praise to /clock, even with a goal id", () => {
    // /clock opens the clock-in picker. Telling someone who just hit their
    // quota to clock in is the opposite of congratulating them.
    const push = composeNudgePush({
      mode: "single",
      tone: "praise",
      senderName: "Sam",
      targetKind: "goal",
      targetLabel: "Thesis",
      goalId: UUID,
    });
    expect(push.url).toBe("/");
    expect(push.body).toBe("cheered you on for Thesis.");
  });

  it("coalesces praise without borrowing the nudge's words", () => {
    const push = composeNudgePush({
      mode: "coalesced",
      tone: "praise",
      senderName: "Sam",
      othersCount: 2,
    });
    expect(push).toEqual({
      title: "Sam and 2 others",
      body: "cheered you on.",
      url: "/",
    });
    expect(push.body).not.toMatch(/lock in/i);
  });

  it("still carries nothing the sender chose", () => {
    // The same invariant the nudge half holds: the preset is in-app only.
    const bodies = [
      composeNudgePush({
        mode: "single",
        tone: "praise",
        senderName: "Sam",
        targetKind: "habits",
        targetLabel: "Habits",
        goalId: null,
      }),
      composeNudgePush({
        mode: "coalesced",
        tone: "praise",
        senderName: "Sam",
        othersCount: 1,
      }),
    ];
    for (const push of bodies) {
      expect(`${push.title} ${push.body}`).not.toMatch(/GOOO|goated|locked in/i);
    }
  });

  it("defaults to the nudge half when no tone is given", () => {
    // Existing callers pass no tone; they must keep prodding, not praising.
    const push = composeNudgePush({
      mode: "single",
      senderName: "Sam",
      targetKind: "habits",
      targetLabel: "Habits",
      goalId: null,
    });
    expect(push.body).toBe("nudged you to finish your habits.");
  });
});

describe("push keys", () => {
  it("dedupes per nudge and collapses per window anchor", () => {
    expect(nudgeDedupeKey(UUID)).toBe(`nudge:${UUID}`);
    expect(nudgeCollapseId(UUID)).toBe(`nudge-${UUID}`);
  });

  it("fits the 64-byte apns-collapse-id limit", () => {
    expect(Buffer.byteLength(nudgeCollapseId(UUID), "utf8")).toBeLessThanOrEqual(64);
  });
});
