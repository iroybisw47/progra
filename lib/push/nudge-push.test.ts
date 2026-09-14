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

describe("push keys", () => {
  it("dedupes per nudge and collapses per window anchor", () => {
    expect(nudgeDedupeKey(UUID)).toBe(`nudge:${UUID}`);
    expect(nudgeCollapseId(UUID)).toBe(`nudge-${UUID}`);
  });

  it("fits the 64-byte apns-collapse-id limit", () => {
    expect(Buffer.byteLength(nudgeCollapseId(UUID), "utf8")).toBeLessThanOrEqual(64);
  });
});
