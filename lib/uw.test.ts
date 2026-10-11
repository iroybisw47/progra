import { describe, expect, it } from "vitest";

import {
  CLUB_MAX,
  INTEREST_MAX,
  MAJOR_MAX,
  MAX_UW_CLUBS,
  MAX_UW_INTERESTS,
  MAX_UW_MAJORS,
  OTHER_MAJOR,
  UW_INTERESTS,
  UW_MAJORS,
  cleanClubs,
  cleanInterests,
  cleanMajor,
  cleanMajors,
  clubTokens,
  clubsMatch,
  goalTokens,
  goalsMatch,
  isListedMajor,
  isUwProfileChange,
  listedMajor,
  normalizeMatchText,
  uwProfilePayload,
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

  // The handoff's list (R:86), which plan D3 folds into this one rather than
  // keeping a second list beside it.
  it("contains every major the onboarding design offers", () => {
    const readme = [
      "Economics", "Computer Science", "Informatics", "Psychology", "Biology",
      "Business Administration", "Bioengineering", "Neuroscience",
      "Political Science", "Mechanical Engineering", "Biochemistry",
      "Communication", "Statistics", "Mathematics",
      "Electrical & Computer Engineering", "Public Health", "Design", "Nursing",
      "English", "Philosophy", "Chemistry", "Physics",
      "Human Centered Design & Engineering", "International Studies",
      "Sociology", "Environmental Science",
    ];
    for (const major of readme) expect(UW_MAJORS).toContain(major);
  });

  it("is unique after normalization too, so no two entries canonicalize alike", () => {
    expect(new Set(UW_MAJORS.map(normalizeMatchText)).size).toBe(UW_MAJORS.length);
  });
});

describe("the interest suggestions", () => {
  it("are the handoff's fifteen, in its order (R:87)", () => {
    expect(UW_INTERESTS).toEqual([
      "Startups", "Investing", "Running", "Lifting", "Climbing", "Hiking",
      "Design", "AI", "Music", "Photography", "Pre-med", "Writing", "Chess",
      "Cooking", "Film",
    ]);
  });

  it("each survive cleanInterests unchanged", () => {
    expect(cleanInterests(UW_INTERESTS.slice(0, MAX_UW_INTERESTS))).toEqual(
      UW_INTERESTS.slice(0, MAX_UW_INTERESTS)
    );
  });
});

// The STEP 5 CHECKs can only bound each array's TOTAL text, joined with commas
// (uw-cohort.sql, plan §4.2). A full list of maximum-length entries must fit,
// or a save that every per-entry cap allowed would fail as a whole.
describe("the STEP 5 shape CHECKs", () => {
  const joined = (n: number, each: number) => n * each + (n - 1);

  it("fits three maximum-length majors in profiles_uw_majors_shape's 245", () => {
    expect(MAX_UW_MAJORS).toBe(3);
    expect(joined(MAX_UW_MAJORS, MAJOR_MAX)).toBeLessThanOrEqual(245);
  });

  it("fits six maximum-length interests in profiles_uw_interests_shape's 300", () => {
    expect(MAX_UW_INTERESTS).toBe(6);
    expect(joined(MAX_UW_INTERESTS, INTEREST_MAX)).toBeLessThanOrEqual(300);
  });

  it("holds for what the cleaners actually return", () => {
    const majors = cleanMajors(["a".repeat(500), "b".repeat(500), "c".repeat(500), "d"]);
    const interests = cleanInterests(
      ["a", "b", "c", "d", "e", "f", "g"].map((c) => c.repeat(500))
    );
    expect(Array.from(majors.join(",")).length).toBeLessThanOrEqual(245);
    expect(Array.from(interests.join(",")).length).toBeLessThanOrEqual(300);
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

  it("refuses the sentinel in any casing or spacing, so typed \"other\" can't match", () => {
    expect(cleanMajor("other")).toBe(null);
    expect(cleanMajor("OTHER")).toBe(null);
    expect(cleanMajor("  oTher  ")).toBe(null);
    // Only the whole word: a major that merely contains it is free text.
    expect(cleanMajor("Other Studies")).toBe("Other Studies");
  });

  it("caps free text at the column's bound", () => {
    const stored = cleanMajor("x".repeat(MAJOR_MAX + 50));
    expect(stored).toHaveLength(MAJOR_MAX);
  });

  // char_length() counts code points, and half a surrogate pair is a value
  // PostgREST won't store.
  it("caps by code point, never splitting an emoji", () => {
    const stored = cleanMajor("🎓".repeat(MAJOR_MAX + 5)) ?? "";
    expect(Array.from(stored)).toHaveLength(MAJOR_MAX);
    expect(stored).toBe("🎓".repeat(MAJOR_MAX));
  });

  it("leaves no trailing space where the cap cut between words", () => {
    const stored = cleanMajor(`${"x".repeat(MAJOR_MAX - 1)} yz`) ?? "";
    expect(stored).toBe("x".repeat(MAJOR_MAX - 1));
  });
});

describe("listedMajor / isListedMajor", () => {
  it("knows a list entry in any casing or spacing, in the list's spelling", () => {
    expect(listedMajor("  computer   SCIENCE ")).toBe("Computer Science");
    expect(isListedMajor("economics")).toBe(true);
    expect(isListedMajor("Design")).toBe(true);
    expect(isListedMajor("Environmental Science")).toBe(true);
  });

  it("refuses free text, so a typed major is never shown to strangers", () => {
    expect(listedMajor("Comparative History of Ideas")).toBe(null);
    expect(isListedMajor("Comparative History of Ideas")).toBe(false);
    // Close isn't on the list.
    expect(isListedMajor("Computer Sciences")).toBe(false);
  });

  it("refuses the Other sentinel, blanks and anything that isn't a string", () => {
    expect(isListedMajor(OTHER_MAJOR)).toBe(false);
    expect(isListedMajor("")).toBe(false);
    expect(isListedMajor("   ")).toBe(false);
    expect(isListedMajor(null)).toBe(false);
    expect(isListedMajor(undefined)).toBe(false);
    expect(isListedMajor(42)).toBe(false);
    expect(isListedMajor(["Economics"])).toBe(false);
  });
});

describe("cleanMajors", () => {
  it("canonicalizes list entries and keeps free text with its casing", () => {
    expect(cleanMajors(["economics", " Comparative  History of Ideas "])).toEqual([
      "Economics",
      "Comparative History of Ideas",
    ]);
  });

  it("dedupes after canonicalizing, keeping the first", () => {
    expect(cleanMajors(["Computer Science", "computer science", "COMPUTER  SCIENCE"])).toEqual(
      ["Computer Science"]
    );
    expect(cleanMajors(["Underwater Basketry", "underwater basketry"])).toEqual([
      "Underwater Basketry",
    ]);
  });

  it("caps at three, in the order given", () => {
    expect(cleanMajors(["Economics", "Statistics", "Mathematics", "Physics"])).toEqual([
      "Economics",
      "Statistics",
      "Mathematics",
    ]);
  });

  it("doesn't let a duplicate or blank use up a slot", () => {
    expect(cleanMajors(["Economics", "economics", "", "  ", "Statistics", "Physics"])).toEqual([
      "Economics",
      "Statistics",
      "Physics",
    ]);
  });

  it("drops the Other sentinel", () => {
    expect(cleanMajors([OTHER_MAJOR, "Economics"])).toEqual(["Economics"]);
    expect(cleanMajors(["OTHER", "other", " Other ", "Economics"])).toEqual(["Economics"]);
  });

  it("is total over anything an action can be POSTed", () => {
    expect(cleanMajors(null)).toEqual([]);
    expect(cleanMajors(undefined)).toEqual([]);
    expect(cleanMajors("Economics")).toEqual([]);
    expect(cleanMajors({ 0: "Economics" })).toEqual([]);
    expect(cleanMajors([1, null, { m: "x" }, "Economics"])).toEqual(["Economics"]);
  });
});

describe("cleanInterests", () => {
  it("tidies whitespace and keeps the student's own spelling", () => {
    expect(cleanInterests(["  rock   climbing ", "AI"])).toEqual(["rock climbing", "AI"]);
  });

  // An interest is free text: "ai" is not snapped to the chip's "AI".
  it("does not canonicalize to the suggestion list", () => {
    expect(cleanInterests(["ai"])).toEqual(["ai"]);
  });

  it("dedupes case-insensitively, keeping the first spelling", () => {
    expect(cleanInterests(["Pre-med", "pre-med", "PRE-MED"])).toEqual(["Pre-med"]);
  });

  it("caps at six", () => {
    expect(cleanInterests(["a1", "a2", "a3", "a4", "a5", "a6", "a7"])).toHaveLength(
      MAX_UW_INTERESTS
    );
  });

  it("caps each at INTEREST_MAX code points", () => {
    expect(cleanInterests(["x".repeat(INTEREST_MAX + 20)])[0]).toHaveLength(INTEREST_MAX);
    expect(Array.from(cleanInterests(["🧗".repeat(INTEREST_MAX + 3)])[0])).toHaveLength(
      INTEREST_MAX
    );
  });

  it("drops blanks without spending a slot", () => {
    expect(cleanInterests(["", "   ", "Chess"])).toEqual(["Chess"]);
  });

  it("is total over anything an action can be POSTed", () => {
    expect(cleanInterests(null)).toEqual([]);
    expect(cleanInterests("Chess")).toEqual([]);
    expect(cleanInterests([7, undefined, "Chess"])).toEqual(["Chess"]);
  });
});

describe("uwProfilePayload", () => {
  // Every UW column, on both paths: a payload that left one out would leave
  // whatever an older shape wrote.
  const COLUMNS = [
    "is_uw",
    "uw_clubs",
    "uw_interests",
    "uw_listed",
    "uw_major",
    "uw_majors",
    "uw_share_goals",
  ];

  it("joins with the cleaned lists, the opt-in, and the retired columns nulled", () => {
    expect(
      uwProfilePayload({
        isUw: true,
        majors: ["economics", "Statistics", "economics"],
        interests: [" Chess ", "chess", "Film"],
        listed: true,
      })
    ).toEqual({
      is_uw: true,
      uw_majors: ["Economics", "Statistics"],
      uw_interests: ["Chess", "Film"],
      uw_listed: true,
      uw_share_goals: false,
      uw_major: null,
      uw_clubs: null,
    });
  });

  it("names every UW column on a join and on a leave", () => {
    expect(Object.keys(uwProfilePayload({ isUw: true }) ?? {}).sort()).toEqual(COLUMNS);
    expect(Object.keys(uwProfilePayload({ isUw: false }) ?? {}).sort()).toEqual(COLUMNS);
  });

  it("never shares goals, on either path", () => {
    expect(uwProfilePayload({ isUw: true, listed: true })?.uw_share_goals).toBe(false);
    expect(uwProfilePayload({ isUw: false })?.uw_share_goals).toBe(false);
  });

  // D2: the column fails closed, and so does the action.
  it("lists a student only on an explicit true", () => {
    expect(uwProfilePayload({ isUw: true })?.uw_listed).toBe(false);
    expect(uwProfilePayload({ isUw: true, listed: false })?.uw_listed).toBe(false);
    expect(uwProfilePayload({ isUw: true, listed: "true" })?.uw_listed).toBe(false);
    expect(uwProfilePayload({ isUw: true, listed: 1 })?.uw_listed).toBe(false);
  });

  it("stores no majors or interests as null, not an empty list", () => {
    const skipped = uwProfilePayload({ isUw: true, majors: [], interests: ["  "], listed: true });
    expect(skipped?.uw_majors).toBe(null);
    expect(skipped?.uw_interests).toBe(null);
    expect(skipped?.is_uw).toBe(true);
  });

  it("clears everything on leaving, whatever else was sent", () => {
    expect(
      uwProfilePayload({
        isUw: false,
        majors: ["Economics"],
        interests: ["Chess"],
        listed: true,
      })
    ).toEqual({
      is_uw: false,
      uw_majors: null,
      uw_interests: null,
      uw_listed: false,
      uw_share_goals: false,
      uw_major: null,
      uw_clubs: null,
    });
  });

  it("refuses anything that isn't an input", () => {
    expect(uwProfilePayload(null)).toBe(null);
    expect(uwProfilePayload(undefined)).toBe(null);
    expect(uwProfilePayload("join")).toBe(null);
    expect(uwProfilePayload({})).toBe(null);
    expect(uwProfilePayload({ isUw: "true" })).toBe(null);
    expect(uwProfilePayload({ isUw: 1 })).toBe(null);
  });
});

describe("isUwProfileChange", () => {
  const saved = {
    isUw: true,
    majors: ["Economics", "Statistics"],
    interests: ["Chess"],
    listed: true,
  };

  it("is no change when nothing in the UW block was touched", () => {
    expect(isUwProfileChange(saved, { ...saved })).toBe(false);
    expect(isUwProfileChange({ isUw: false }, { isUw: false })).toBe(false);
  });

  it("is no change when the cleaners undo the edit", () => {
    expect(
      isUwProfileChange(saved, {
        ...saved,
        majors: ["economics", " Statistics ", ""],
        interests: ["  Chess ", "chess"],
      })
    ).toBe(false);
  });

  it("counts a re-cased interest as a change, since interests keep their spelling", () => {
    expect(isUwProfileChange(saved, { ...saved, interests: ["chess"] })).toBe(true);
  });

  it("ignores what a leave would clear anyway", () => {
    expect(isUwProfileChange({ isUw: false, listed: true }, { isUw: false, majors: ["Art"] })).toBe(
      false
    );
  });

  it("is a change on a join, a leave, or any stored value", () => {
    expect(isUwProfileChange({ isUw: false }, saved)).toBe(true);
    expect(isUwProfileChange(saved, { isUw: false })).toBe(true);
    expect(isUwProfileChange(saved, { ...saved, listed: false })).toBe(true);
    expect(isUwProfileChange(saved, { ...saved, majors: ["Statistics", "Economics"] })).toBe(true);
    expect(isUwProfileChange(saved, { ...saved, interests: ["Chess", "Film"] })).toBe(true);
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
