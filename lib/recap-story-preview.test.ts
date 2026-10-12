import { describe, expect, it } from "vitest";

import { buildRecapStory } from "@/lib/recap-story";
import {
  parseRecapPreviewParams,
  recapPreviewInput,
  RECAP_PREVIEW_FIXTURES,
} from "@/lib/recap-story-preview";

describe("recap preview fixtures", () => {
  it("every fixture builds a story that opens on Loading and ends on Closing", () => {
    for (const f of RECAP_PREVIEW_FIXTURES) {
      const v = buildRecapStory(recapPreviewInput(f));
      expect(v.slides[0]).toBe("loading");
      expect(v.slides[v.slides.length - 1]).toBe("closing");
    }
  });

  it("reproduces the handoff board's numbers", () => {
    const above = buildRecapStory(recapPreviewInput("above"));
    expect(above.hours.text).toBe("11.5");
    expect(above.hours.line).toBe("Above your weekly average of 8.2 hrs.");
    expect(above.where?.totalLabel).toBe("11h 30m");
    expect(above.where?.rows.map((r) => r.meta)).toEqual([
      "5.0h · 43%",
      "2.0h · 17%",
      "1.6h · 14%",
      "1.6h · 14%",
      "1.3h · 11%",
    ]);
    expect(above.goals?.pct).toBe(86);
    expect(above.goals?.meta).toBe("8.6h of 10h");
    expect(above.habits?.best?.copy).toBe("Your best day was Wednesday, when you completed every habit.");
    expect(above.friends.groupHours).toBe(84);
    expect(above.friends.top3?.rank).toBe(2);
    expect(above.rank?.rows.map((r) => r.duration)).toEqual([
      "18h 40m",
      "11h 30m",
      "11h 5m",
      "10h 40m",
      "9h 50m",
      "8h 35m",
      "7h 55m",
      "5h 45m",
    ]);
    expect(above.closing.accent).toBe("#eeb097");

    expect(buildRecapStory(recapPreviewInput("lighter")).hours.line).toBe(
      "Your weekly average is 8.2 hrs."
    );
    expect(buildRecapStory(recapPreviewInput("goals-100")).goals?.complete).toBe(true);
    expect(buildRecapStory(recapPreviewInput("goals-62")).goals?.pct).toBe(62);
    expect(buildRecapStory(recapPreviewInput("best-partial")).habits?.best?.copy).toBe(
      "Your best day was Tuesday, with 4 of 5 habits done."
    );
    expect(buildRecapStory(recapPreviewInput("outside")).friends.top3).toBeNull();
    const few = buildRecapStory(recapPreviewInput("few"));
    expect(few.friends.meta).toBe("2 active friends");
    expect(few.friends.groupHours).toBe(19);
    expect(few.slides).not.toContain("rank");
  });

  it("parses params, defaulting anything unknown", () => {
    expect(parseRecapPreviewParams({})).toEqual({
      fixture: "above",
      slide: "loading",
      still: false,
      welcome: false,
      posted: false,
      fail: false,
      insets: undefined,
    });
    expect(
      parseRecapPreviewParams({ fixture: "few", slide: "friends", still: "1", inset: "59" })
    ).toEqual({
      fixture: "few",
      slide: "friends",
      still: true,
      welcome: false,
      posted: false,
      fail: false,
      insets: { top: 59, bottom: 34 },
    });
    expect(parseRecapPreviewParams({ welcome: "1" }).welcome).toBe(true);
    expect(parseRecapPreviewParams({ slide: "welcome" }).welcome).toBe(true);
    expect(parseRecapPreviewParams({ fixture: "nope", slide: ["rank", "x"] }).slide).toBe("rank");
  });
});
