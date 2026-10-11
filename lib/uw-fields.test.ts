import { describe, expect, it, vi } from "vitest";

import { chipSuggestions } from "@/lib/chip-field";
import {
  INTEREST_MAX,
  MAJOR_MAX,
  MAX_UW_INTERESTS,
  MAX_UW_MAJORS,
  UW_INTERESTS,
  UW_MAJORS,
  cleanInterests,
  cleanMajors,
  isUwProfileChange,
  uwProfilePayload,
} from "@/lib/uw";
import {
  UW_INTEREST_FIELD,
  UW_LISTED_DISCLOSURE,
  UW_LISTED_LABEL,
  UW_MAJOR_FIELD,
  UW_MAJOR_SUGGESTIONS,
  isLeavingUw,
  saveUwBlock,
  uwBlockSaveInput,
  uwBlockState,
  type SavedUw,
  type UwBlockState,
} from "@/lib/uw-fields";

const MEMBER: SavedUw = {
  isUw: true,
  majors: ["Economics", "Computer Science"],
  interests: ["Startups", "Running", "AI"],
  listed: true,
};
const NEW: SavedUw = { isUw: false, majors: [], interests: [], listed: false };

const edit = (saved: SavedUw, change: (s: UwBlockState) => UwBlockState) =>
  change(uwBlockState(saved));

describe("the field specs", () => {
  it("run on the action's own cleaners, caps and lists", () => {
    expect(UW_MAJOR_FIELD).toMatchObject({
      clean: cleanMajors,
      max: MAX_UW_MAJORS,
      maxLength: MAJOR_MAX,
      suggestions: UW_MAJOR_SUGGESTIONS,
      suggestionLimit: 6,
      commitOnComma: false,
    });
    expect(UW_INTEREST_FIELD).toMatchObject({
      clean: cleanInterests,
      max: MAX_UW_INTERESTS,
      maxLength: INTEREST_MAX,
      suggestions: UW_INTERESTS,
      suggestionLimit: 8,
      commitOnComma: true,
    });
  });

  it("suggest majors in the handoff's order, from the one canonical list", () => {
    // R:86's row before anything is typed.
    const empty = { items: [], draft: "" };
    expect(chipSuggestions(UW_MAJOR_SUGGESTIONS, empty, { max: 3, limit: 6 })).toEqual([
      "Economics",
      "Computer Science",
      "Informatics",
      "Psychology",
      "Biology",
      "Business Administration",
    ]);
    // A reordering of UW_MAJORS: nothing added, nothing lost, nothing twice.
    expect(UW_MAJOR_SUGGESTIONS).toHaveLength(UW_MAJORS.length);
    expect([...UW_MAJOR_SUGGESTIONS].sort()).toEqual([...UW_MAJORS].sort());
    // All 26 handoff entries are on the list, so none was filtered out of
    // the front: the handoff's last is 26th.
    expect(UW_MAJOR_SUGGESTIONS[25]).toBe("Environmental Science");
  });

  it("carry the handoff's copy and the D2 and D3 lines", () => {
    expect(UW_MAJOR_FIELD).toMatchObject({
      label: "Major",
      hint: "Double major? Add both",
      placeholder: "e.g. Economics",
    });
    expect(UW_INTEREST_FIELD).toMatchObject({
      label: "Interests",
      placeholder: "Type your own, or pick below",
      note: "UW students who add the same interest will see you share it.",
    });
    expect(UW_LISTED_LABEL).toBe("Show me in More at UW");
    expect(UW_LISTED_DISCLOSURE).toBe("UW students on Progra will see you're at UW and your major.");
  });
});

describe("uwBlockState", () => {
  it("opens on the saved profile with nothing typed, on copies of its lists", () => {
    const s = uwBlockState(MEMBER);
    expect(s).toEqual({
      isUw: true,
      majors: { items: ["Economics", "Computer Science"], draft: "" },
      interests: { items: ["Startups", "Running", "AI"], draft: "" },
      listed: true,
    });
    expect(s.majors.items).not.toBe(MEMBER.majors);
  });
});

describe("uwBlockSaveInput", () => {
  it("sends an untouched member back as saved, which isn't a change", () => {
    const input = uwBlockSaveInput(uwBlockState(MEMBER));
    expect(input).toEqual({
      isUw: true,
      majors: ["Economics", "Computer Science"],
      interests: ["Startups", "Running", "AI"],
      listed: true,
    });
    expect(isUwProfileChange(MEMBER, input)).toBe(false);
  });

  it("commits what's typed but not Returned, canonicalized", () => {
    const input = uwBlockSaveInput(
      edit(MEMBER, (s) => ({
        ...s,
        majors: { ...s.majors, draft: "statistics " },
        interests: { ...s.interests, draft: "Chess" },
      }))
    );
    expect(input.majors).toEqual(["Economics", "Computer Science", "Statistics"]);
    expect(input.interests).toEqual(["Startups", "Running", "AI", "Chess"]);
  });

  it("drops a typed duplicate, and a draft with no room", () => {
    const input = uwBlockSaveInput(
      edit(MEMBER, (s) => ({
        ...s,
        majors: { items: ["Economics", "Statistics", "Physics"], draft: "Biology" },
        interests: { ...s.interests, draft: "running" },
      }))
    );
    expect(input.majors).toEqual(["Economics", "Statistics", "Physics"]);
    expect(input.interests).toEqual(["Startups", "Running", "AI"]);
  });

  it("is a bare leave with the switch off, whatever the fields still hold", () => {
    const input = uwBlockSaveInput(edit(MEMBER, (s) => ({ ...s, isUw: false })));
    expect(input).toEqual({ isUw: false });
    // ...which the payload builder turns into clearing every UW column.
    expect(uwProfilePayload(input)).toEqual({
      is_uw: false,
      uw_majors: null,
      uw_interests: null,
      uw_listed: false,
      uw_share_goals: false,
      uw_major: null,
      uw_clubs: null,
    });
  });

  it("joins a new student unlisted, with empty fields stored as none (D2)", () => {
    const input = uwBlockSaveInput(edit(NEW, (s) => ({ ...s, isUw: true })));
    expect(input).toEqual({ isUw: true, majors: [], interests: [], listed: false });
    expect(uwProfilePayload(input)).toMatchObject({
      is_uw: true,
      uw_majors: null,
      uw_interests: null,
      uw_listed: false,
    });
  });

  it("sends the opt-in exactly as the switch shows it", () => {
    const on = uwBlockSaveInput(edit(NEW, (s) => ({ ...s, isUw: true, listed: true })));
    expect(on.listed).toBe(true);
    const off = uwBlockSaveInput(edit(MEMBER, (s) => ({ ...s, listed: false })));
    expect(off.listed).toBe(false);
    expect(isUwProfileChange(MEMBER, off)).toBe(true);
  });

  it("keeps the fields while the switch is off, so on again is no change", () => {
    const back = edit(MEMBER, (s) => ({ ...s, isUw: false }));
    expect(isUwProfileChange(MEMBER, uwBlockSaveInput({ ...back, isUw: true }))).toBe(false);
  });
});

describe("isLeavingUw", () => {
  it("holds only when the switch is off on a saved member", () => {
    expect(isLeavingUw(MEMBER, edit(MEMBER, (s) => ({ ...s, isUw: false })))).toBe(true);
    expect(isLeavingUw(MEMBER, uwBlockState(MEMBER))).toBe(false);
    expect(isLeavingUw(NEW, uwBlockState(NEW))).toBe(false);
  });
});

describe("saveUwBlock", () => {
  it("doesn't call the action when nothing would change", async () => {
    const save = vi.fn(async () => ({ ok: true as const }));
    await expect(saveUwBlock(MEMBER, uwBlockState(MEMBER), save)).resolves.toEqual({
      ok: true,
      wrote: false,
    });
    // A re-spelling the cleaner undoes is no change either.
    const respelled = edit(MEMBER, (s) => ({
      ...s,
      majors: { items: ["economics", "computer  science"], draft: "" },
    }));
    await expect(saveUwBlock(MEMBER, respelled, save)).resolves.toEqual({ ok: true, wrote: false });
    expect(save).not.toHaveBeenCalled();
  });

  it("sends the block's input when it changed", async () => {
    const save = vi.fn(async () => ({ ok: true as const }));
    const state = edit(MEMBER, (s) => ({ ...s, isUw: false }));
    await expect(saveUwBlock(MEMBER, state, save)).resolves.toEqual({ ok: true, wrote: true });
    expect(save).toHaveBeenCalledWith({ isUw: false });
  });

  it("hands back the action's error", async () => {
    const save = vi.fn(async () => ({ error: "Couldn't save your UW details." }));
    const state = edit(NEW, (s) => ({ ...s, isUw: true }));
    await expect(saveUwBlock(NEW, state, save)).resolves.toEqual({
      error: "Couldn't save your UW details.",
    });
  });
});
