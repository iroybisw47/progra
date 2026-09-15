import { describe, expect, it } from "vitest";

import {
  SIM_TARGET_MS,
  SIM_TOTAL_MS,
  activeSteps,
  clockSimValue,
  doneSummary,
  eyebrowFor,
  formatSim,
  habitPhrase,
  initialsFor,
  inviteMessage,
  nextHabitColor,
} from "@/lib/onboarding";

describe("steps", () => {
  it("numbers seven steps in the shell and six on the web, skipping welcome", () => {
    const native = activeSteps(true);
    const web = activeSteps(false);
    expect(native).toHaveLength(8);
    expect(web).toHaveLength(7);
    expect(web).not.toContain("notify");
    expect(eyebrowFor("welcome", native)).toBe(null);
    expect(eyebrowFor("how", native)).toBe("Step 1 of 7");
    expect(eyebrowFor("friends", native)).toBe("Step 7 of 7");
    expect(eyebrowFor("friends", web)).toBe("Step 6 of 6");
  });

  it("marks the practice steps", () => {
    const native = activeSteps(true);
    expect(eyebrowFor("clock", native)).toBe("Step 4 of 7 · Practice");
    expect(eyebrowFor("post", native)).toBe("Step 6 of 7 · Practice");
    expect(eyebrowFor("post", activeSteps(false))).toBe("Step 5 of 6 · Practice");
  });
});

describe("copy", () => {
  const habits = [
    { name: "Journaling", color: "#6B639C" },
    { name: "Drinking water", color: "#4A6FA5" },
  ];

  it("phrases habits lowercased, comma-joined, or says nothing", () => {
    expect(habitPhrase([])).toBe("");
    expect(habitPhrase(habits)).toBe(", plus journaling, drinking water every day");
  });

  it("builds the invite message with curly quotes around the goal", () => {
    expect(inviteMessage({ hours: 6, goalTitle: " Study math ", habits })).toBe(
      "I'm putting 6 hours into “Study math” this week on Progra, plus journaling, drinking water every day. Join me and hold me accountable."
    );
    expect(inviteMessage({ hours: 5, goalTitle: "", habits: [] })).toBe(
      "I'm putting 5 hours into “your first goal” this week on Progra. Join me and hold me accountable."
    );
  });

  it("builds the done summary", () => {
    expect(doneSummary({ hours: 6, goalTitle: "Study math", habits: [] })).toBe(
      "Your week starts now: 6h on “Study math”. Your friends will see how it goes."
    );
  });

  it("picks initials from the name, then the username", () => {
    expect(initialsFor("Maya Patel", "maya")).toBe("MP");
    expect(initialsFor("maya", "x")).toBe("MA");
    expect(initialsFor("", "ishaan")).toBe("IS");
    expect(initialsFor("  ", "")).toBe("?");
  });

  it("cycles custom habit colours through the presets", () => {
    expect(nextHabitColor(0)).toBe("#6B639C");
    expect(nextHabitColor(4)).toBe("#6B639C");
    expect(nextHabitColor(5)).toBe("#46808A");
  });
});

describe("practice clock", () => {
  it("runs at true speed for 1.5s, then eases to 25:00 by 3.3s", () => {
    expect(clockSimValue(0)).toBe(0);
    expect(clockSimValue(1000)).toBe(1000);
    expect(clockSimValue(1500)).toBe(1500);
    // Quadratic: halfway through the fast phase it's a quarter of the way.
    const half = clockSimValue(1500 + 900);
    expect(half).toBeCloseTo(1500 + 0.25 * (SIM_TARGET_MS - 1500), 6);
    expect(clockSimValue(SIM_TOTAL_MS)).toBe(SIM_TARGET_MS);
    expect(clockSimValue(SIM_TOTAL_MS + 5000)).toBe(SIM_TARGET_MS);
  });

  it("formats m:ss", () => {
    expect(formatSim(0)).toBe("0:00");
    expect(formatSim(61_500)).toBe("1:01");
    expect(formatSim(SIM_TARGET_MS)).toBe("25:00");
  });
});
