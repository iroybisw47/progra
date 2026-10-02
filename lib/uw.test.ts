import { describe, expect, it } from "vitest";

import {
  CLUB_MAX,
  MAJOR_MAX,
  MAX_UW_CLUBS,
  OTHER_MAJOR,
  UW_MAJORS,
  cleanClubs,
  cleanMajor,
  clubTokens,
  clubsMatch,
  goalTokens,
  goalsMatch,
  matchReason,
  normalizeMatchText,
} from "@/lib/uw";

describe("the major list", () => {
  it("holds no duplicates and no stray whitespace", () => {
    expect(new Set(UW_MAJORS).size).toBe(UW_MAJORS.length);
    for (const entry of UW_MAJORS) expect(entry).toBe(entry.trim());
  });

  it("keeps the Other sentinel out of the majors, so it can never be matched on", () => {
    expect(UW_MAJORS).not.toContain(OTHER_MAJOR);
  });

  it("holds no major longer than the column allows", () => {
    for (const major of UW_MAJORS) expect(major.length).toBeLessThanOrEqual(MAJOR_MAX);
  });
});

describe("normalizeMatchText", () => {
  it("folds case, ends and inner runs of whitespace", () => {
    expect(normalizeMatchText("  Computer   Science ")).toBe("computer science");
    expect(normalizeMatchText("STUDY FOR CSE 143")).toBe("study for cse 143");
  });

  it("matches two students who typed the same thing differently", () => {
    expect(normalizeMatchText("informatics")).toBe(normalizeMatchText("  Informatics  "));
  });

  it("does not match two different things", () => {
    expect(normalizeMatchText("Biology")).not.toBe(normalizeMatchText("Bioengineering"));
  });
});

describe("cleanMajor", () => {
  it("stores a list entry verbatim", () => {
    expect(cleanMajor("Computer Science")).toBe("Computer Science");
  });

  it("snaps a differently-cased list entry back onto the canonical spelling", () => {
    // Two students who both mean CS must match, so a free-typed "computer
    // science" is stored as the list's own casing rather than as free text.
    expect(cleanMajor("computer science")).toBe("Computer Science");
    expect(cleanMajor("  COMPUTER   SCIENCE ")).toBe("Computer Science");
  });

  it("keeps free text that isn't on the list, with its casing", () => {
    expect(cleanMajor("Comparative History of Ideas")).toBe(
      "Comparative History of Ideas"
    );
  });

  it("treats no major as a legitimate state", () => {
    expect(cleanMajor(null)).toBe(null);
    expect(cleanMajor(undefined)).toBe(null);
    expect(cleanMajor("")).toBe(null);
    expect(cleanMajor("   ")).toBe(null);
  });

  it("never stores the Other sentinel itself", () => {
    expect(cleanMajor(OTHER_MAJOR)).toBe(null);
  });

  it("caps free text at the column's bound", () => {
    const stored = cleanMajor("x".repeat(MAJOR_MAX + 50));
    expect(stored).toHaveLength(MAJOR_MAX);
  });
});

describe("clubTokens", () => {
  it("keeps only the words that carry signal", () => {
    expect(clubTokens("UW Robotics Club")).toEqual(["robotics"]);
    expect(clubTokens("Husky Robotics")).toEqual(["robotics"]);
    expect(clubTokens("Society of Women Engineers")).toEqual(["women", "engineers"]);
  });

  it("ignores punctuation and casing", () => {
    expect(clubTokens("Rocket Team (SARP)")).toEqual(["rocket", "sarp"]);
    // A hyphen JOINS rather than splits, or "pre-med" and "pre-law" would
    // share the token "pre" and match.
    expect(clubTokens("pre-med")).toEqual(["premed"]);
    expect(clubTokens("U.W. Taiko")).toEqual(["taiko"]);
  });

  it("drops one-letter words and dedupes", () => {
    expect(clubTokens("a cappella")).toEqual(["cappella"]);
    expect(clubTokens("Dance Dance")).toEqual(["dance"]);
  });

  it("returns nothing for a name that is all furniture", () => {
    // Too generic to connect two people, so it must match nobody.
    expect(clubTokens("UW Student Club")).toEqual([]);
    expect(clubTokens("the group")).toEqual([]);
  });
});

describe("clubsMatch", () => {
  it("matches two names for the same org", () => {
    expect(clubsMatch("UW Robotics Club", "Husky Robotics")).toBe(true);
    expect(clubsMatch("Dubstech", "dubstech")).toBe(true);
    expect(clubsMatch("UW Formula Motorsports", "formula motorsports")).toBe(true);
  });

  it("absorbs plurals and truncations from four characters up", () => {
    expect(clubsMatch("Robotics", "Robotic")).toBe(true);
    expect(clubsMatch("Ultimate", "Ultimate Frisbee")).toBe(true);
  });

  it("does not match on the mascot, the school or the word club", () => {
    expect(clubsMatch("Husky Marching Band", "Husky Sailing")).toBe(false);
    expect(clubsMatch("UW Investment Club", "UW Debate Club")).toBe(false);
  });

  it("keeps near-neighbours apart", () => {
    expect(clubsMatch("Pre-med Club", "Pre-law Club")).toBe(false);
    expect(clubsMatch("Rowing", "Climbing")).toBe(false);
  });

  it("never matches a name with no signal left", () => {
    expect(clubsMatch("UW Student Club", "UW Student Club")).toBe(false);
  });

  it("is symmetric", () => {
    for (const [a, b] of [
      ["Husky Robotics", "UW Robotics Club"],
      ["Rowing", "Climbing"],
      ["Ultimate", "Ultimate Frisbee"],
    ]) {
      expect(clubsMatch(a, b)).toBe(clubsMatch(b, a));
    }
  });
});

describe("goalTokens", () => {
  it("strips the verb and keeps the subject", () => {
    expect(goalTokens("Study for CSE 143")).toEqual(["cse"]);
    expect(goalTokens("Read more")).toEqual(["read"]);
    expect(goalTokens("Marathon training")).toEqual(["marathon", "training"]);
  });

  it("drops a bare quantity, because two goals the same SIZE are not the same goal", () => {
    expect(goalTokens("Study physics 3hr a week")).toEqual(["physics"]);
    expect(goalTokens("30min meditation")).toEqual(["meditation"]);
    expect(goalTokens("Gym 5x")).toEqual(["gym"]);
  });

  it("reduces a course to its department, so neighbouring courses still meet", () => {
    // The number is a size-like coincidence risk; the department is the signal.
    expect(goalTokens("MATH 126")).toEqual(["math"]);
    expect(goalsMatch("CSE 143", "CSE 142")).toBe(true);
  });

  it("keeps digits inside a word", () => {
    expect(goalTokens("Learn 3d modelling")).toEqual(["3d", "modelling"]);
  });

  it("returns nothing for a goal that is all verb and quantity", () => {
    expect(goalTokens("Work more hours")).toEqual([]);
    expect(goalTokens("Study 3hr a day")).toEqual([]);
  });
});

describe("goalsMatch", () => {
  it("matches two phrasings of the same goal", () => {
    expect(goalsMatch("Study for CSE 143", "CSE 143 problem sets")).toBe(true);
    expect(goalsMatch("Marathon training", "Marathon")).toBe(true);
    expect(goalsMatch("MCAT prep", "Studying for the MCAT")).toBe(true);
  });

  it("does not collide on the verb", () => {
    // The bug this stop list exists to prevent.
    expect(goalsMatch("Study physics", "Study piano")).toBe(false);
    expect(goalsMatch("Work on my thesis", "Work out")).toBe(false);
  });

  it("does not collide on the size of the goal", () => {
    expect(goalsMatch("3hr club apps", "Study physics 3hr a week")).toBe(false);
  });

  it("never matches a goal with no subject left", () => {
    expect(goalsMatch("Work more hours", "Work more hours")).toBe(false);
  });

  it("is symmetric", () => {
    for (const [a, b] of [
      ["Marathon training", "Marathon"],
      ["Study physics", "Study piano"],
      ["MCAT prep", "Studying for the MCAT"],
    ]) {
      expect(goalsMatch(a, b)).toBe(goalsMatch(b, a));
    }
  });
});

describe("cleanClubs", () => {
  it("stores what the student typed, tidied", () => {
    expect(cleanClubs(["Husky Robotics", "  Taiko   Kai "])).toEqual([
      "Husky Robotics",
      "Taiko Kai",
    ]);
  });

  it("does not rewrite their spelling — there is no canonical list", () => {
    expect(cleanClubs(["dubstech"])).toEqual(["dubstech"]);
    expect(cleanClubs(["GREEK LIFE"])).toEqual(["GREEK LIFE"]);
  });

  it("dedupes case-insensitively", () => {
    expect(cleanClubs(["Rowing", "rowing", "  ROWING  "])).toEqual(["Rowing"]);
  });

  it("caps each name", () => {
    expect(cleanClubs(["x".repeat(CLUB_MAX + 40)])[0]).toHaveLength(CLUB_MAX);
  });

  it("drops blanks rather than storing them", () => {
    expect(cleanClubs(["", "   ", "Rowing"])).toEqual(["Rowing"]);
  });

  it("caps the count", () => {
    expect(cleanClubs(["a", "b", "c", "d", "e", "f", "g"])).toHaveLength(MAX_UW_CLUBS);
  });

  it("treats no clubs as a legitimate state", () => {
    expect(cleanClubs(null)).toEqual([]);
    expect(cleanClubs([])).toEqual([]);
  });
});

describe("matchReason", () => {
  const peer = (over: Partial<Parameters<typeof matchReason>[0]> = {}) => ({
    sameMajor: false,
    sharedClubs: 0,
    sharedGoals: 0,
    ...over,
  });

  it("names each signal on its own", () => {
    expect(matchReason(peer({ sameMajor: true }))).toBe("Same major");
    expect(matchReason(peer({ sharedClubs: 2 }))).toBe("2 clubs in common");
    expect(matchReason(peer({ sharedGoals: 3 }))).toBe("3 goals in common");
  });

  it("says one club, not 1 clubs", () => {
    expect(matchReason(peer({ sharedClubs: 1 }))).toBe("1 club in common");
    expect(matchReason(peer({ sharedGoals: 1 }))).toBe("1 goal in common");
  });

  it("joins signals major-first", () => {
    expect(matchReason(peer({ sameMajor: true, sharedClubs: 1, sharedGoals: 2 }))).toBe(
      "Same major · 1 club in common · 2 goals in common"
    );
  });

  it("stays total when the RPC's score > 0 filter is bypassed", () => {
    expect(matchReason(peer())).toBe("Also at UW");
  });
});
