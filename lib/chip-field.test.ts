import { describe, expect, it } from "vitest";

import {
  CHIP_PLACEHOLDER_MORE,
  addChip,
  addChips,
  chipAnnouncement,
  chipKey,
  chipPlaceholder,
  chipSuggestions,
  committedItems,
  removeChip,
  typeIntoChipField,
} from "@/lib/chip-field";
import {
  INTEREST_MAX,
  MAJOR_MAX,
  MAX_UW_INTERESTS,
  MAX_UW_MAJORS,
  UW_INTERESTS,
  UW_MAJORS,
  cleanInterests,
  cleanMajors,
} from "@/lib/uw";

const majors = (items: string[], draft = "") => ({ items, draft });

describe("addChip, majors (cleanMajors)", () => {
  it("canonicalizes a listed major to the list's spelling", () => {
    expect(addChip([], "  computer   science ", cleanMajors)).toEqual({
      kind: "added",
      items: ["Computer Science"],
      chip: "Computer Science",
    });
  });

  it("keeps free text, tidied, in the student's casing, and appends it last", () => {
    expect(addChip(["Economics"], "Comparative  History of Ideas ", cleanMajors)).toEqual({
      kind: "added",
      items: ["Economics", "Comparative History of Ideas"],
      chip: "Comparative History of Ideas",
    });
  });

  it("calls a duplicate in any casing the chip already held", () => {
    expect(addChip(["Economics"], "ECONOMICS", cleanMajors)).toEqual({
      kind: "duplicate",
      chip: "Economics",
    });
    // Matched after canonicalizing, so a stored free-text spelling counts too.
    expect(addChip(["design"], "Design", cleanMajors)).toEqual({ kind: "duplicate", chip: "design" });
  });

  it("refuses a fourth major, and a duplicate at the cap is still a duplicate", () => {
    const three = ["Economics", "Statistics", "Mathematics"];
    expect(three).toHaveLength(MAX_UW_MAJORS);
    expect(addChip(three, "Physics", cleanMajors)).toEqual({ kind: "full" });
    expect(addChip(three, "statistics", cleanMajors)).toEqual({ kind: "duplicate", chip: "Statistics" });
  });

  it("adds nothing for a blank draft or the Other sentinel", () => {
    expect(addChip([], "   ", cleanMajors)).toEqual({ kind: "empty" });
    expect(addChip(["Economics"], " other ", cleanMajors)).toEqual({ kind: "empty" });
  });

  it("cuts free text at MAJOR_MAX code points", () => {
    const r = addChip([], "x".repeat(MAJOR_MAX + 10), cleanMajors);
    expect(r.kind === "added" && Array.from(r.chip).length).toBe(MAJOR_MAX);
  });
});

describe("addChip, interests (cleanInterests)", () => {
  it("keeps the student's spelling: there is no canonical list", () => {
    expect(addChip([], "ai", cleanInterests)).toEqual({ kind: "added", items: ["ai"], chip: "ai" });
    expect(addChip(["ai"], "AI", cleanInterests)).toEqual({ kind: "duplicate", chip: "ai" });
  });

  it("stops at six and cuts each at INTEREST_MAX", () => {
    const six = UW_INTERESTS.slice(0, MAX_UW_INTERESTS);
    expect(addChip(six, "Chess", cleanInterests)).toEqual({ kind: "full" });
    const r = addChip([], "y".repeat(INTEREST_MAX + 5), cleanInterests);
    expect(r.kind === "added" && r.chip.length).toBe(INTEREST_MAX);
  });
});

describe("the field agrees with the action's cleaner", () => {
  // Whatever order chips are added in, the field ends up showing exactly the
  // list setUwProfile would store for everything that was typed.
  const typed = [
    "economics",
    "Economics ",
    "other",
    "",
    "Data   Science",
    "computer science",
    "Physics",
    "biology",
  ];
  it("for majors", () => {
    expect(addChips([], typed, cleanMajors).items).toEqual(cleanMajors(typed));
  });
  it("for interests", () => {
    const words = ["ai", "AI", "Running", " running ", "Pre-med", "", "Chess", "Film", "Music", "Hiking"];
    expect(addChips([], words, cleanInterests).items).toEqual(cleanInterests(words));
  });
});

describe("addChips", () => {
  it("lists what got in, and the held chips a value matched", () => {
    const typed = ["Chess", "running", " ", "AI", "RUNNING"];
    expect(addChips(["Running"], typed, cleanInterests)).toEqual({
      items: ["Running", "Chess", "AI"],
      added: ["Chess", "AI"],
      duplicates: ["Running"],
      full: false,
    });
  });

  it("says when a value was turned away for room", () => {
    const five = UW_INTERESTS.slice(0, 5);
    expect(addChips(five, ["Chess", "Film"], cleanInterests)).toMatchObject({
      added: ["Chess"],
      full: true,
    });
  });
});

describe("removeChip", () => {
  it("removes the chip at the index and leaves the rest in order", () => {
    expect(removeChip(["A", "B", "C"], 1)).toEqual(["A", "C"]);
    expect(removeChip(["A", "B", "C"], 2)).toEqual(["A", "B"]);
  });

  it("changes nothing for an index that isn't there", () => {
    expect(removeChip(["A"], 3)).toEqual(["A"]);
    expect(removeChip([], 0)).toEqual([]);
  });
});

describe("typeIntoChipField", () => {
  const opts = { clean: cleanInterests, commitOnComma: true, max: MAX_UW_INTERESTS };
  const none = { duplicates: [], overflow: false };

  it("is just the draft while there's no comma", () => {
    expect(typeIntoChipField(majors(["AI"]), "Chess", opts)).toEqual({
      value: { items: ["AI"], draft: "Chess" },
      added: [],
      ...none,
    });
  });

  it("adds what's before a comma and keeps what's after it as the draft", () => {
    expect(typeIntoChipField(majors(["AI"]), "Chess,", opts)).toEqual({
      value: { items: ["AI", "Chess"], draft: "" },
      added: ["Chess"],
      ...none,
    });
    expect(typeIntoChipField(majors([]), "Running, Chess,, ai, Fi", opts)).toEqual({
      value: { items: ["Running", "Chess", "ai"], draft: "Fi" },
      added: ["Running", "Chess", "ai"],
      ...none,
    });
  });

  it("reports a comma'd duplicate as the chip it matched, so the field pops it", () => {
    expect(typeIntoChipField(majors(["AI"]), "ai,", opts)).toEqual({
      value: { items: ["AI"], draft: "" },
      added: [],
      duplicates: ["AI"],
      overflow: false,
    });
  });

  it("takes a pasted list longer than one interest whole", () => {
    // Longer than INTEREST_MAX, which is why the input's maxLength isn't it.
    const paste = "Photography, Pre-med, Writing, Chess, Cooking, Film";
    expect(paste.length).toBeGreaterThan(INTEREST_MAX);
    expect(typeIntoChipField(majors([]), paste, opts).value).toEqual({
      items: ["Photography", "Pre-med", "Writing", "Chess", "Cooking"],
      draft: "Film",
    });
  });

  it("leaves no draft behind once the list is full, and says the rest didn't fit", () => {
    const four = UW_INTERESTS.slice(0, 4);
    // Fills on "g": "h" was typed after it, into an input that is now gone.
    expect(typeIntoChipField(majors(four), "f, g, h", opts)).toEqual({
      value: { items: [...four, "f", "g"], draft: "" },
      added: ["f", "g"],
      duplicates: [],
      overflow: true,
    });
    // A part after the cap is turned away too.
    expect(typeIntoChipField(majors(four), "f, g, h,", opts)).toMatchObject({
      value: { items: [...four, "f", "g"], draft: "" },
      overflow: true,
    });
    // Exactly full with nothing after: no overflow to report.
    expect(typeIntoChipField(majors(four), "f, g,", opts)).toMatchObject({
      value: { items: [...four, "f", "g"], draft: "" },
      overflow: false,
    });
  });

  it("keeps commas in a major, which can contain one", () => {
    expect(
      typeIntoChipField(majors([]), "Law, Societies", {
        clean: cleanMajors,
        commitOnComma: false,
        max: MAX_UW_MAJORS,
      })
    ).toEqual({ value: { items: [], draft: "Law, Societies" }, added: [], ...none });
  });
});

describe("chipAnnouncement", () => {
  it("says what was added, and that the field is full when it fills", () => {
    expect(chipAnnouncement({ added: ["Economics"] }, 1, 3)).toBe("Added Economics");
    expect(chipAnnouncement({ added: ["Physics"] }, 3, 3)).toBe("Added Physics. 3 of 3");
  });

  it("says why nothing was added", () => {
    expect(chipAnnouncement({ duplicates: ["Running"] }, 2, 6)).toBe("Running is already added");
    expect(chipAnnouncement({ duplicates: ["AI", "Chess"] }, 2, 6)).toBe(
      "AI, Chess are already added"
    );
    expect(chipAnnouncement({ refused: ["Other"] }, 0, 3)).toBe("Couldn't add Other");
    expect(chipAnnouncement({ added: ["f", "g"], overflow: true }, 6, 6)).toBe(
      "Added f, g. Up to 6, so the rest wasn't added"
    );
  });

  it("is empty when nothing happened", () => {
    expect(chipAnnouncement({}, 0, 3)).toBe("");
  });
});

describe("committedItems", () => {
  it("adds a typed draft, canonicalized", () => {
    expect(committedItems(majors(["Economics"], "statistics"), cleanMajors)).toEqual([
      "Economics",
      "Statistics",
    ]);
  });

  it("drops a draft the field would refuse", () => {
    expect(committedItems(majors(["Economics"], "economics"), cleanMajors)).toEqual(["Economics"]);
    expect(committedItems(majors(["A", "B", "C"], "D"), cleanMajors)).toEqual(["A", "B", "C"]);
    expect(committedItems(majors(["Economics"], "  "), cleanMajors)).toEqual(["Economics"]);
  });
});

describe("chipSuggestions", () => {
  const rules = { max: MAX_UW_MAJORS, limit: 6 };

  it("offers the first `limit` options in the list's order with nothing typed", () => {
    expect(chipSuggestions(UW_MAJORS, majors([]), rules)).toEqual(UW_MAJORS.slice(0, 6));
  });

  it("filters by substring, not prefix, ignoring case and spacing", () => {
    expect(chipSuggestions(UW_MAJORS, majors([], "  SCIENCE "), rules)).toEqual([
      "Computer Science",
      "Materials Science & Engineering",
      "Neuroscience",
      "Political Science",
      "Environmental Science",
    ]);
  });

  it("leaves out what's picked, in any casing", () => {
    const out = chipSuggestions(UW_MAJORS, majors(["computer science"], "science"), rules);
    expect(out).not.toContain("Computer Science");
    expect(out[0]).toBe("Materials Science & Engineering");
  });

  it("stops at the limit", () => {
    expect(chipSuggestions(UW_INTERESTS, majors([]), { max: 6, limit: 8 })).toHaveLength(8);
    expect(chipSuggestions(UW_MAJORS, majors([], "e"), { max: 3, limit: 2 })).toHaveLength(2);
  });

  it("offers nothing once the field is full", () => {
    expect(chipSuggestions(UW_MAJORS, majors(["A", "B", "C"]), rules)).toEqual([]);
  });

  it("offers nothing when nothing contains the draft", () => {
    expect(chipSuggestions(UW_INTERESTS, majors([], "zzz"), { max: 6, limit: 8 })).toEqual([]);
  });
});

describe("chipPlaceholder and chipKey", () => {
  it("switches to Add another once there's a chip", () => {
    expect(chipPlaceholder([], "e.g. Economics")).toBe("e.g. Economics");
    expect(chipPlaceholder(["Economics"], "e.g. Economics")).toBe(CHIP_PLACEHOLDER_MORE);
    expect(CHIP_PLACEHOLDER_MORE).toBe("Add another");
  });

  it("keys a chip by its normalized form", () => {
    expect(chipKey("  Computer   SCIENCE ")).toBe("computer science");
  });
});
