import { describe, expect, it } from "vitest";

import {
  composeRecapPush,
  recapCollapseId,
  recapDedupeKey,
} from "@/lib/push/recap-push";

const UUID = "3edc1d62-dc8a-431e-8cd3-d35c9e66a934";
// Monday 2026-09-14 00:00 in New York, the shape weekWindow hands the sender.
const WEEK_START_MS = 1757822400000;

describe("composeRecapPush", () => {
  it("deep-links to the V2 story for that week, not the legacy card view", () => {
    expect(composeRecapPush({ weekStartISO: "2026-09-14" })).toEqual({
      title: "Your week is ready",
      body: "See how the week came together.",
      url: "/recap/2026-09-14",
    });
  });

  it("never quotes hours — the candidate query does not skip empty weeks", () => {
    const push = composeRecapPush({ weekStartISO: "2026-09-14" });
    expect(`${push.title} ${push.body}`).not.toMatch(/\d/);
  });

  it("carries nothing user-supplied", () => {
    // Two different weeks differ only in the url. If a name, goal title or
    // comment ever leaks into this family, this is what catches it.
    const a = composeRecapPush({ weekStartISO: "2026-09-14" });
    const b = composeRecapPush({ weekStartISO: "2026-09-21" });
    expect(a.title).toBe(b.title);
    expect(a.body).toBe(b.body);
  });
});

describe("push keys", () => {
  it("dedupes per user per week, and collapses per week", () => {
    expect(recapDedupeKey(UUID, WEEK_START_MS)).toBe(
      `recap:${UUID}:${WEEK_START_MS}`
    );
    expect(recapCollapseId(WEEK_START_MS)).toBe(`recap-${WEEK_START_MS}`);
  });

  it("gives the same user a fresh key next week", () => {
    const thisWeek = recapDedupeKey(UUID, WEEK_START_MS);
    const nextWeek = recapDedupeKey(UUID, WEEK_START_MS + 7 * 24 * 60 * 60_000);
    expect(thisWeek).not.toBe(nextWeek);
  });

  it("cannot collide with the nudge or social families", () => {
    expect(recapDedupeKey(UUID, WEEK_START_MS).startsWith("recap:")).toBe(true);
  });

  it("fits the 64-byte apns-collapse-id limit", () => {
    expect(
      Buffer.byteLength(recapCollapseId(WEEK_START_MS), "utf8")
    ).toBeLessThanOrEqual(64);
  });
});
