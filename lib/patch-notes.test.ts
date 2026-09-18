import { describe, expect, it } from "vitest";

import {
  LATEST_PATCH_VERSION,
  PATCH_NOTES,
  type PatchNote,
  isKnownPatchVersion,
  patchNoteToShow,
} from "@/lib/patch-notes";

const NEWER: PatchNote = { version: "2.0", title: "Newer", items: ["b"] };
const OLDER: PatchNote = { version: "1.9", title: "Older", items: ["a"] };
const TWO = [NEWER, OLDER] as const;

describe("patchNoteToShow", () => {
  // The column-missing case. PostgREST omits the key before the SQL is run, so
  // it reads back undefined — and in that world the dismiss write fails too, so
  // showing the modal would make it un-dismissable. Fail closed.
  it("shows nothing for undefined, even with notes present", () => {
    expect(patchNoteToShow(undefined, TWO)).toBeNull();
  });

  // Every user who predates the column.
  it("shows the newest note for null", () => {
    expect(patchNoteToShow(null, TWO)).toBe(NEWER);
  });

  it("shows nothing once stamped with the newest version", () => {
    expect(patchNoteToShow(NEWER.version, TWO)).toBeNull();
  });

  // Not "the one after theirs" — only ever the newest, so no ordering
  // semantics are needed on the version string.
  it("shows the NEWEST note to someone stamped with an older one", () => {
    expect(patchNoteToShow(OLDER.version, TWO)).toBe(NEWER);
  });

  it("treats an unrecognised version as old", () => {
    expect(patchNoteToShow("nonsense", TWO)).toBe(NEWER);
  });

  // The off switch.
  it("shows nothing at all when there are no notes", () => {
    for (const seen of [undefined, null, "2.0", ""]) {
      expect(patchNoteToShow(seen, [])).toBeNull();
    }
  });
});

describe("isKnownPatchVersion", () => {
  it("accepts an authored version and rejects anything else", () => {
    expect(isKnownPatchVersion(NEWER.version, TWO)).toBe(true);
    expect(isKnownPatchVersion(OLDER.version, TWO)).toBe(true);
    expect(isKnownPatchVersion("1.0", TWO)).toBe(false);
    expect(isKnownPatchVersion("", TWO)).toBe(false);
    expect(isKnownPatchVersion(NEWER.version, [])).toBe(false);
  });
});

// Guardrails against the LIVE array — these are what stop a bad note shipping.
describe("PATCH_NOTES", () => {
  it("agrees with LATEST_PATCH_VERSION", () => {
    expect(LATEST_PATCH_VERSION).toBe(PATCH_NOTES[0]?.version ?? null);
  });

  // A duplicate silently hides a note: the older twin can never be reached.
  it("has unique versions", () => {
    const versions = PATCH_NOTES.map((n) => n.version);
    expect(new Set(versions).size).toBe(versions.length);
  });

  // The highest-value test here. Index 0 is the only entry ever shown, so an
  // entry appended to the bottom would ship and reach nobody.
  //
  // Compared NUMERICALLY, not as strings: "1.10" sorts before "1.9"
  // lexicographically, so a string sort would start lying at the tenth patch of
  // a major version and would do it silently.
  it("is sorted newest first", () => {
    const rank = (v: string) => v.split(".").map(Number);
    for (let i = 1; i < PATCH_NOTES.length; i++) {
      const [majA, minA] = rank(PATCH_NOTES[i - 1].version);
      const [majB, minB] = rank(PATCH_NOTES[i].version);
      expect(
        majA > majB || (majA === majB && minA > minB),
        `${PATCH_NOTES[i - 1].version} must come before ${PATCH_NOTES[i].version}`
      ).toBe(true);
    }
  });

  it("uses major.minor patch numbers", () => {
    for (const n of PATCH_NOTES) {
      expect(n.version, n.title).toMatch(/^\d+\.\d+$/);
    }
  });

  it("has no empty intro — omit the field instead", () => {
    for (const n of PATCH_NOTES) {
      if (n.intro !== undefined) expect(n.intro.trim(), n.version).not.toBe("");
    }
  });

  it("has a title and at least one non-empty item in every entry", () => {
    for (const n of PATCH_NOTES) {
      expect(n.title.trim(), n.version).not.toBe("");
      expect(n.items.length, n.version).toBeGreaterThan(0);
      for (const item of n.items) expect(item.trim(), n.version).not.toBe("");
    }
  });
});
