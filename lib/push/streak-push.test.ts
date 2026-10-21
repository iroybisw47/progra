import { describe, expect, it } from "vitest";

import {
  composeStreakPush,
  streakCollapseId,
  streakDedupeKey,
  streakTtlSeconds,
} from "@/lib/push/streak-push";

const UUID = "3edc1d62-dc8a-431e-8cd3-d35c9e66a934";

describe("composeStreakPush", () => {
  it("the reminder names the count and opens the Clock tab", () => {
    expect(composeStreakPush({ kind: "reminder", current: 12 })).toEqual({
      title: "Today’s still open",
      body: "Your 12-day streak is waiting on today. A session or a habit keeps it going.",
      url: "/clock",
    });
  });

  it("the freeze note says the streak is safe and opens your profile", () => {
    expect(composeStreakPush({ kind: "freeze", current: 6 })).toEqual({
      title: "A freeze kept your streak going",
      body: "Yesterday was covered, so your 6-day streak is safe.",
      url: "/me",
    });
  });

  it("never guilts: no 'lose', 'break' or 'miss' in either", () => {
    for (const kind of ["reminder", "freeze"] as const) {
      const p = composeStreakPush({ kind, current: 30 });
      expect(`${p.title} ${p.body}`).not.toMatch(/lose|lost|break|broke|miss/i);
    }
  });
});

describe("keys", () => {
  it("dedupes per person, kind and day", () => {
    expect(streakDedupeKey("reminder", UUID, "2026-10-21")).toBe(`streak-reminder:${UUID}:2026-10-21`);
    expect(streakDedupeKey("freeze", UUID, "2026-10-21")).not.toBe(streakDedupeKey("reminder", UUID, "2026-10-21"));
  });

  it("collapse ids fit APNs' 64 bytes", () => {
    expect(streakCollapseId("reminder", "2026-10-21")).toBe("streak-reminder-2026-10-21");
    expect(Buffer.byteLength(streakCollapseId("reminder", "2026-10-21"))).toBeLessThanOrEqual(64);
  });

  it("a reminder can't outlive the evening", () => {
    // Sent by 21:59 local, so it expires by midnight, hours before the 4am close.
    expect(streakTtlSeconds("reminder")).toBeLessThanOrEqual(2 * 60 * 60);
    expect(streakTtlSeconds("freeze")).toBeGreaterThan(streakTtlSeconds("reminder"));
  });
});
