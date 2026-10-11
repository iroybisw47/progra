// The chip field's rules (components/v2/chip-field.tsx): what Return, a
// suggestion tap, a comma, the ✕ and Backspace do to the list, which
// suggestions show, and the placeholder. Pure, so lib/chip-field.test.ts pins
// them without a DOM.
//
// The field takes the LIST CLEANER the server action runs (cleanMajors or
// cleanInterests, lib/uw.ts) and adds a chip by cleaning the list with the
// draft on the end. That makes the cleaner the one authority on tidying,
// canonicalizing ("computer science" → "Computer Science"), dropping the
// "Other" sentinel, the per-item length cap, the case-insensitive dedupe and
// the count cap. A field with its own copy of those rules would sooner or
// later show a list the action then stores differently. The UW Settings block
// (P9b) and Screen 1's quick-add (P9c) share it for that reason.

import { normalizeMatchText } from "@/lib/uw";

// A cleaner in lib/uw.ts' shape: tidy, dedupe on the normalized form keeping
// the first spelling, stop at the cap. cleanMajors and cleanInterests take
// `unknown`, which this accepts.
export type ChipCleaner = (values: readonly string[]) => string[];

// What the field holds: the chips, and the text typed but not yet added.
// One object, so a change that touches both (a comma commits a chip and
// leaves the rest as the draft) is one update rather than two racing ones.
export type ChipValue = { items: readonly string[]; draft: string };

// The placeholder once there's a chip (R:85, R:87). Before then it is the
// field's own ("e.g. Economics").
export const CHIP_PLACEHOLDER_MORE = "Add another";

// Chips are deduped on this, so it is also a chip's identity: its React key,
// and how the field finds a chip again to pop it.
export function chipKey(item: string): string {
  return normalizeMatchText(item);
}

// What adding one value did.
//   added      it's in, as `chip` (the cleaner's spelling of it), last
//   duplicate  it's already there, as `chip` (the spelling already held)
//   full       there's no room: the list is at the cleaner's cap
//   empty      nothing to add: blank, or a value the cleaner refuses
export type ChipAdd =
  | { kind: "added"; items: string[]; chip: string }
  | { kind: "duplicate"; chip: string }
  | { kind: "full" }
  | { kind: "empty" };

export function addChip(items: readonly string[], raw: string, clean: ChipCleaner): ChipAdd {
  // The value on its own, cleaned: what it would be stored as, or nothing.
  const alone = clean([raw])[0];
  if (alone === undefined) return { kind: "empty" };
  const key = chipKey(alone);
  const held = items.find((item) => chipKey(item) === key);
  if (held !== undefined) return { kind: "duplicate", chip: held };
  // The cleaner keeps order and stops at its cap, so an added value is last,
  // and a list that didn't grow had no room.
  const before = clean(items);
  const after = clean([...items, raw]);
  if (after.length <= before.length) return { kind: "full" };
  return { kind: "added", items: after, chip: after[after.length - 1] };
}

// Several values in order, each through addChip: what a pasted
// "Running, Chess, AI" commits. `added` lists what got in, `duplicates` the
// chips already held that a value matched (in the list's spelling, so the
// field can pop them, as Return does), and `full` whether any value was
// turned away for want of room.
export function addChips(
  items: readonly string[],
  values: readonly string[],
  clean: ChipCleaner
): { items: readonly string[]; added: string[]; duplicates: string[]; full: boolean } {
  let list = items;
  const added: string[] = [];
  const duplicates: string[] = [];
  let full = false;
  for (const value of values) {
    const r = addChip(list, value, clean);
    if (r.kind === "added") {
      list = r.items;
      added.push(r.chip);
    } else if (r.kind === "duplicate") {
      if (!duplicates.includes(r.chip)) duplicates.push(r.chip);
    } else if (r.kind === "full") {
      full = true;
    }
  }
  return { items: list, added, duplicates, full };
}

// The list without the chip at `index` (its ✕, or Backspace on an empty field
// for the last one). An index that isn't there changes nothing.
export function removeChip(items: readonly string[], index: number): string[] {
  return items.filter((_, i) => i !== index);
}

// What typing did: the new value, and what a screen reader should hear about
// it (chipAnnouncement). `overflow` is text turned away because the list
// filled: parts after the cap, or what followed the last comma once it hit.
export type ChipTyped = {
  value: ChipValue;
  added: string[];
  duplicates: string[];
  overflow: boolean;
};

// Typing into the field. With `commitOnComma` (interests, R:87: "Return or
// comma adds"), every comma ends a chip: what's before the last comma is
// added and what's after it stays as the draft, so a paste of a whole list
// lands as chips. Majors don't, because a major can contain one ("Law,
// Societies & Justice").
//
// Once the list reaches `max` (the cleaner's cap) the input goes, so a draft
// left behind would be out of sight until a chip came off, and Save would
// quietly drop it. It is cleared instead, and reported as overflow.
export function typeIntoChipField(
  value: ChipValue,
  typed: string,
  { clean, commitOnComma, max }: { clean: ChipCleaner; commitOnComma: boolean; max: number }
): ChipTyped {
  if (!commitOnComma || !typed.includes(",")) {
    return {
      value: { items: value.items, draft: typed },
      added: [],
      duplicates: [],
      overflow: false,
    };
  }
  const parts = typed.split(",");
  const rest = parts.pop() ?? "";
  const r = addChips(value.items, parts, clean);
  const atCap = r.items.length >= max;
  const restOverflows = atCap && addChip(r.items, rest, clean).kind === "full";
  return {
    value: { items: r.items, draft: atCap ? "" : rest.trimStart() },
    added: r.added,
    duplicates: r.duplicates,
    overflow: r.full || restOverflows,
  };
}

// What the field's live region says after Return, Add, a suggestion or a
// comma: the chips themselves are silent when they come and go. Reaching the
// cap is said too, because the input then goes and there's no other sign of
// why. `refused` is a value the cleaner wouldn't take ("Other").
export function chipAnnouncement(
  {
    added = [],
    duplicates = [],
    refused = [],
    overflow = false,
  }: {
    added?: readonly string[];
    duplicates?: readonly string[];
    refused?: readonly string[];
    overflow?: boolean;
  },
  count: number,
  max: number
): string {
  const parts: string[] = [];
  if (added.length > 0) parts.push(`Added ${added.join(", ")}`);
  if (duplicates.length > 0) {
    parts.push(`${duplicates.join(", ")} ${duplicates.length === 1 ? "is" : "are"} already added`);
  }
  if (refused.length > 0) parts.push(`Couldn't add ${refused.join(", ")}`);
  if (overflow) parts.push(`Up to ${max}, so the rest wasn't added`);
  else if (added.length > 0 && count >= max) parts.push(`${max} of ${max}`);
  return parts.join(". ");
}

// The list a save should store: the chips, plus the draft if it would be
// added. A Continue or a Save commits what was typed but never Returned
// (R:88), and a draft the field would refuse (a duplicate, no room) is
// dropped, as Return would drop it.
export function committedItems(value: ChipValue, clean: ChipCleaner): string[] {
  const r = addChip(value.items, value.draft, clean);
  return r.kind === "added" ? r.items : [...value.items];
}

// The suggestion row under the field (R:86-87): the options containing the
// draft (case- and space-insensitively), none already picked, at most
// `limit`, in the options' own order. Nothing at all once the field is full,
// since none of them could be added. An empty draft offers the first `limit`.
export function chipSuggestions(
  options: readonly string[],
  value: ChipValue,
  { max, limit }: { max: number; limit: number }
): string[] {
  if (value.items.length >= max) return [];
  const q = chipKey(value.draft);
  const picked = new Set(value.items.map(chipKey));
  const out: string[] = [];
  for (const option of options) {
    if (out.length >= limit) break;
    const key = chipKey(option);
    if (picked.has(key) || (q && !key.includes(q))) continue;
    out.push(option);
  }
  return out;
}

// "e.g. Economics" until there's a chip, then "Add another".
export function chipPlaceholder(items: readonly string[], empty: string): string {
  return items.length > 0 ? CHIP_PLACEHOLDER_MORE : empty;
}
