// Made-up Rally states for the dev preview (app/dev/rally), so every look of
// the chip and the sheet can be screenshotted without the SQL or a friend.

import type { RallyState } from "@/lib/social/rally";

export const RALLY_PREVIEW_FIXTURES = [
  "cheer",
  "nudge",
  "both",
  "nudge-streak",
  "cooldown",
  "disabled",
  "too-early",
  "in-session",
  "done",
] as const;
export type RallyPreviewFixture = (typeof RALLY_PREVIEW_FIXTURES)[number];

const HOUR = 3_600_000;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

// `now` is passed in so the cooldown and the 9am wait read sensibly.
export function rallyPreview(fixture: RallyPreviewFixture, now: number): RallyState {
  switch (fixture) {
    case "cheer":
      return {
        status: "ok",
        cheer: {
          habits: [
            { habitId: id(1), name: "Gym", color: "#2E8B50" },
            { habitId: id(2), name: "Read 20 pages", color: "#77B7C6" },
          ],
          goals: [
            { goalId: id(6), title: "Learn Spanish", color: "#395AA0", workedMs: 3.5 * HOUR, quotaMs: 5 * HOUR },
          ],
        },
        nudge: null,
      };
    case "both":
      return {
        status: "ok",
        cheer: { habits: [{ habitId: id(1), name: "Gym", color: "#2E8B50" }], goals: [] },
        nudge: {
          habits: [{ habitId: id(3), name: "No phone before 9", color: "#D6A728" }],
          goals: [
            { goalId: id(5), title: "Ace organic chem", color: "#DE5148", workedMs: 1.5 * HOUR, quotaMs: 6 * HOUR },
          ],
          streak: null,
        },
      };
    case "nudge":
    case "nudge-streak":
      return {
        status: "ok",
        cheer: null,
        nudge: {
          habits: [
            { habitId: id(3), name: "No phone before 9", color: "#D6A728" },
            { habitId: id(4), name: "Stretch", color: "#A084B3" },
          ],
          goals: [
            {
              goalId: id(5),
              title: "Ace organic chem",
              color: "#DE5148",
              workedMs: 1.5 * HOUR,
              quotaMs: 6 * HOUR,
            },
          ],
          streak: fixture === "nudge-streak" ? { current: 6 } : null,
        },
      };
    case "cooldown":
      return { status: "cooldown", cooldownUntil: now + 4 * HOUR };
    case "disabled":
      return { status: "locked", reason: "disabled", opensAt: null };
    case "too-early":
      return { status: "locked", reason: "too_early", opensAt: now + 2 * HOUR };
    case "in-session":
      return { status: "locked", reason: "in_session", opensAt: null };
    case "done":
      return { status: "locked", reason: "done_today", opensAt: null };
  }
}

export function parseRallyPreviewParams(
  params: Record<string, string | string[] | undefined>
): { fixture: RallyPreviewFixture; sheet: boolean } {
  const raw = Array.isArray(params.fixture) ? params.fixture[0] : params.fixture;
  const fixture = (RALLY_PREVIEW_FIXTURES as readonly string[]).includes(raw ?? "")
    ? (raw as RallyPreviewFixture)
    : "nudge";
  return { fixture, sheet: params.sheet === "1" };
}
