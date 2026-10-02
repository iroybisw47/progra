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
    const native = activeSteps(true, false);
    const web = activeSteps(false, false);
    expect(native).toHaveLength(8);
    expect(web).toHaveLength(7);
    expect(web).not.toContain("notify");
    expect(eyebrowFor("welcome", native)).toBe(null);
    expect(eyebrowFor("how", native)).toBe("Step 1 of 7");
    expect(eyebrowFor("friends", native)).toBe("Step 7 of 7");
    expect(eyebrowFor("friends", web)).toBe("Step 6 of 6");
  });

  it("marks the practice steps", () => {
    const native = activeSteps(true, false);
    expect(eyebrowFor("clock", native)).toBe("Step 4 of 7 · Practice");
    expect(eyebrowFor("post", native)).toBe("Step 6 of 7 · Practice");
    expect(eyebrowFor("post", activeSteps(false, false))).toBe("Step 5 of 6 · Practice");
  });

  it("adds the UW step for a UW student, and only for them", () => {
    const native = activeSteps(true, true);
    const web = activeSteps(false, true);
    expect(native).toHaveLength(9);
    expect(web).toHaveLength(8);
    expect(native).toContain("uw");
    expect(web).toContain("uw");
    expect(activeSteps(true, false)).not.toContain("uw");
    expect(activeSteps(false, false)).not.toContain("uw");
  });

  it("renumbers the whole run when the UW step is in it", () => {
    const native = activeSteps(true, true);
    const web = activeSteps(false, true);
    // uw sits after post and before friends, and is not practice.
    expect(eyebrowFor("post", native)).toBe("Step 6 of 8 · Practice");
    expect(eyebrowFor("uw", native)).toBe("Step 7 of 8");
    expect(eyebrowFor("friends", native)).toBe("Step 8 of 8");
    expect(eyebrowFor("uw", web)).toBe("Step 6 of 7");
    expect(eyebrowFor("friends", web)).toBe("Step 7 of 7");
  });

  it("orders uw after goal, so a goal exists before it is matched on", () => {
    const native = activeSteps(true, true);
    expect(native.indexOf("uw")).toBeGreaterThan(native.indexOf("goal"));
    expect(native.indexOf("uw")).toBeLessThan(native.indexOf("friends"));
  });
});

describe("copy", () => {
  const habits = [
    { name: "Journaling", color: "#6F4E93" },
    { name: "Drinking water", color: "#395AA0" },
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
    expect(nextHabitColor(0)).toBe("#6F4E93");
    expect(nextHabitColor(4)).toBe("#6F4E93");
    expect(nextHabitColor(5)).toBe("#77B7C6");
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
