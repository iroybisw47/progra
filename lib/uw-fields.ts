// The UW block's fields and its save (components/uw-fields.tsx, plan P9b):
// the two chip fields' rules and copy, the Settings block's state, and what
// its Save sends to setUwProfile. Pure apart from saveUwBlock, which takes the
// action as an argument, so lib/uw-fields.test.ts pins all of it.
//
// The field specs are here rather than in the component because Screen 1's
// quick-add (P9c) offers the same two fields with the same limits, lists and
// copy. Each cleaner is the one setUwProfile runs before its write (lib/uw.ts),
// and each `max` is that cleaner's cap, so neither surface can show a list
// the action would then store differently.

import { committedItems, type ChipCleaner, type ChipValue } from "@/lib/chip-field";
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
  type UwProfileInput,
} from "@/lib/uw";

// One chip field's rules and copy, in ChipField's prop names.
export type UwChipFieldSpec = {
  label: string;
  hint?: string;
  placeholder: string;
  note?: string;
  clean: ChipCleaner;
  max: number;
  maxLength: number;
  suggestions: readonly string[];
  suggestionLimit: number;
  commitOnComma: boolean;
};

// The handoff's major list (R:86, P:631), in its order.
const HANDOFF_MAJOR_ORDER: readonly string[] = [
  "Economics",
  "Computer Science",
  "Informatics",
  "Psychology",
  "Biology",
  "Business Administration",
  "Bioengineering",
  "Neuroscience",
  "Political Science",
  "Mechanical Engineering",
  "Biochemistry",
  "Communication",
  "Statistics",
  "Mathematics",
  "Electrical & Computer Engineering",
  "Public Health",
  "Design",
  "Nursing",
  "English",
  "Philosophy",
  "Chemistry",
  "Physics",
  "Human Centered Design & Engineering",
  "International Studies",
  "Sociology",
  "Environmental Science",
];

// The Major suggestion row's order: the handoff's list first, so the row a
// student sees before typing is R:86's (Economics, Computer Science,
// Informatics, Psychology, Biology, Business Administration), then the rest
// of UW_MAJORS in its own order. Order only: UW_MAJORS stays the one list
// that canonicalizes a typed major and that isListedMajor checks (plan D3),
// and lib/uw-fields.test.ts pins this as a reordering of it.
export const UW_MAJOR_SUGGESTIONS: readonly string[] = [
  ...HANDOFF_MAJOR_ORDER.filter((m) => UW_MAJORS.includes(m)),
  ...UW_MAJORS.filter((m) => !HANDOFF_MAJOR_ORDER.includes(m)),
];

// R:85-86. Return adds, canonicalized to UW_MAJORS' spelling when the typed
// major is on it; up to six suggestions. No comma commit: "Law, Societies &
// Justice" is one major.
export const UW_MAJOR_FIELD: UwChipFieldSpec = {
  label: "Major",
  hint: "Double major? Add both",
  placeholder: "e.g. Economics",
  clean: cleanMajors,
  max: MAX_UW_MAJORS,
  maxLength: MAJOR_MAX,
  suggestions: UW_MAJOR_SUGGESTIONS,
  suggestionLimit: 6,
  commitOnComma: false,
};

// R:87, plus plan D3's line. Interests match by exact (uw_norm) equality, so
// the note says what a match shows and nothing about fuzzier matching.
export const UW_INTEREST_FIELD: UwChipFieldSpec = {
  label: "Interests",
  placeholder: "Type your own, or pick below",
  note: "UW students who add the same interest will see you share it.",
  clean: cleanInterests,
  max: MAX_UW_INTERESTS,
  maxLength: INTEREST_MAX,
  suggestions: UW_INTERESTS,
  suggestionLimit: 8,
  commitOnComma: true,
};

// The listing opt-in (plan D2), bound to uw_listed. The disclosure is the one
// on Screen 1's Yes bar, word for word. Its second sentence is the part a
// "More at UW" label can't say: an unlisted student is in NO group, not just
// missing from "More at UW" (list_uw_peers filters every bucket on it).
export const UW_LISTED_LABEL = "Show me in More at UW";
export const UW_LISTED_DISCLOSURE = "UW students on Progra will see you're at UW and your major.";
export const UW_UNLISTED_NOTE = "Off, you won't appear in any UW group.";

// Under the UW switch once it's off on a profile that's in the cohort: a Save
// then leaves, and leaving clears everything (uwProfilePayload).
export const UW_LEAVING_NOTE = "Saving takes you out of UW groups and clears your majors and interests.";

// What the Settings page reads (app/settings/page.tsx): the saved profile.
export type SavedUw = {
  isUw: boolean;
  majors: readonly string[];
  interests: readonly string[];
  listed: boolean;
};

// The block while it's being edited. The lists and their drafts stay put when
// the UW switch goes off, so switching it straight back on loses nothing.
// Only a Save with it off clears them.
export type UwBlockState = {
  isUw: boolean;
  majors: ChipValue;
  interests: ChipValue;
  listed: boolean;
};

// The block as the sheet opens: the saved profile, nothing typed.
export function uwBlockState(saved: SavedUw): UwBlockState {
  return {
    isUw: saved.isUw,
    majors: { items: [...saved.majors], draft: "" },
    interests: { items: [...saved.interests], draft: "" },
    listed: saved.listed,
  };
}

// What the Save sends to setUwProfile. Off is just `{ isUw: false }`, which
// the payload builder turns into a leave. On sends both lists with whatever
// was typed but not yet added (the Save commits it, as Continue does on
// Screen 1), and the opt-in exactly as the switch shows it. A student who
// joins from here starts unlisted until they turn the switch on next to its
// disclosure (D2).
export function uwBlockSaveInput(state: UwBlockState): UwProfileInput {
  if (!state.isUw) return { isUw: false };
  return {
    isUw: true,
    majors: committedItems(state.majors, UW_MAJOR_FIELD.clean),
    interests: committedItems(state.interests, UW_INTEREST_FIELD.clean),
    listed: state.listed,
  };
}

// Whether the switch is off on a profile that's in the cohort, so a Save
// would leave it.
export function isLeavingUw(saved: SavedUw, state: UwBlockState): boolean {
  return saved.isUw && !state.isUw;
}

type SaveResult = { ok: true } | { error: string };

// The block's half of Edit profile's Save. It writes only when the block would
// store something other than what's saved: every value in Settings is the
// page-load snapshot, so an unconditional write would let a bio-only save from
// a stale tab re-join or re-list a student who left or unlisted on another
// device since. `wrote` says whether it called the action at all.
export async function saveUwBlock(
  saved: SavedUw,
  state: UwBlockState,
  save: (input: UwProfileInput) => Promise<SaveResult>
): Promise<{ ok: true; wrote: boolean } | { error: string }> {
  const input = uwBlockSaveInput(state);
  if (!isUwProfileChange(saved, input)) return { ok: true, wrote: false };
  const r = await save(input);
  if ("error" in r) return { error: r.error };
  return { ok: true, wrote: true };
}
