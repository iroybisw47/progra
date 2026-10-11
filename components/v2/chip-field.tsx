"use client";

import { useId, useRef, useState, type FocusEvent, type RefObject } from "react";
import { flushSync } from "react-dom";
import { XIcon } from "lucide-react";

import {
  addChip,
  chipAnnouncement,
  chipKey,
  chipPlaceholder,
  chipSuggestions,
  removeChip,
  typeIntoChipField,
  type ChipCleaner,
  type ChipValue,
} from "@/lib/chip-field";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { isImeKeyDown } from "@/lib/keyboard";
import { motion, play } from "@/lib/motion";

// A tap on a chip's ✕, a suggestion or Add keeps the keyboard up (plan §6),
// as on the wizard's chips (keepFocus in app/onboarding/v3/focus.ts).
const keepFocus = (e: React.PointerEvent) => e.preventDefault();

// Focus without scrolling, caret at the end (P:727).
function focusEnd(el: HTMLInputElement | null) {
  if (!el) return;
  try {
    el.focus({ preventScroll: true });
    const n = el.value.length;
    el.setSelectionRange(n, n);
  } catch {
    // Focus is what matters if the caret can't be placed.
  }
}

// What held focus as a commit began: the input, Add, or the suggestion at
// an index. Null when focus was elsewhere (a tap that kept it off the field).
type Held = { kind: "input" } | { kind: "add" } | { kind: "suggestion"; index: number } | null;

// The chip field of the handoff's UW quick-add (R:85-87), shared by the
// Settings UW block (P9b) and Screen 1 (P9c): a 44px box of 28px navy chips
// with the input after them, the suggestion row under it, and an optional
// note. Return adds the draft, Return on an empty draft is the caller's
// (onEmptyReturn), Backspace on an empty draft takes back the last chip, and
// "Add" shows while there's something to add, since Return is easy to miss on
// a phone keyboard. A new chip pops (lib/motion's pop, opacity only under
// reduced motion), and so does the chip a duplicate draft matched (Return, Add
// or a comma), so it's clear why nothing was added.
//
// Controlled: the caller holds the chips AND the draft (ChipValue), so its
// Save or Continue can commit what was typed but never Returned. What gets in
// is the `clean` function's call (lib/chip-field.ts says why it must be the
// action's own cleaner), so this file has no rules of its own about case,
// spaces, length or duplicates. `max` is that cleaner's cap: at it, the input
// and the suggestions go, until a chip is removed.
//
// Focus: a tap on a ✕, a suggestion or Add keeps it in the input. A keyboard,
// Switch Control or VoiceOver press focuses the control itself, and most of
// them then go (a picked suggestion leaves the row, Add goes with the draft),
// so focus moves on rather than dropping onto the page: Add's to the input, a
// suggestion's to the one now in its place. At the cap, focus goes to the box
// itself, never to a ✕, where the next Return (or a held one repeating) would
// take back the chip just added. The box then carries the limit's wording.
export function ChipField({
  label,
  hint,
  placeholder,
  note,
  value,
  onChange,
  clean,
  max,
  maxLength,
  suggestions = [],
  suggestionLimit = 6,
  commitOnComma = false,
  onEmptyReturn,
  inputRef,
  onFocus,
  onBlur,
  describedBy: extraDescribedBy,
  disabled = false,
  reduced,
}: {
  // The visible label, which also names the input and the chip group.
  label: string;
  // The right-aligned caption beside the label ("Double major? Add both").
  hint?: string;
  // Before the first chip. After it, "Add another".
  placeholder: string;
  // A line under the suggestions, read with the input (plan D3's interests line).
  note?: string;
  value: ChipValue;
  onChange: (next: ChipValue) => void;
  clean: ChipCleaner;
  max: number;
  // The cleaner's per-item cap (MAJOR_MAX, INTEREST_MAX), and the input's
  // maxLength unless commas commit (see inputMaxLength).
  maxLength: number;
  suggestions?: readonly string[];
  suggestionLimit?: number;
  // Interests only: a comma ends a chip (R:87).
  commitOnComma?: boolean;
  // Return with nothing typed: the next field, or closing the keyboard.
  onEmptyReturn?: (input: HTMLInputElement) => void;
  // For a caller that focuses this field (the field before it, Screen 1's
  // autofocus). The field uses its own when there's none.
  inputRef?: RefObject<HTMLInputElement | null>;
  onFocus?: (e: FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
  // A line elsewhere that the input should be read with, first (the UW
  // sheet's disclosure over its major field).
  describedBy?: string;
  // While a save is in flight: the chips can't change, and nothing is lost.
  disabled?: boolean;
  // The wizard passes its own; elsewhere the OS setting decides.
  reduced?: boolean;
}) {
  const id = useId();
  const inputId = `${id}-input`;
  const labelId = `${id}-label`;
  const hintId = `${id}-hint`;
  const limitId = `${id}-limit`;
  const noteId = `${id}-note`;

  const ownInputRef = useRef<HTMLInputElement>(null);
  const input = inputRef ?? ownInputRef;
  const boxRef = useRef<HTMLDivElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  // Each chip's element by chipKey, so a pop finds the right one.
  const chipEls = useRef(new Map<string, HTMLElement>());
  const prefersReduced = usePrefersReducedMotion();
  const reducedMotion = reduced ?? prefersReduced;
  // The last change in words, for a screen reader: the chips themselves are
  // silent when they come and go.
  const [announcement, setAnnouncement] = useState("");

  const full = value.items.length >= max;
  const showAdd = !full && value.draft.trim() !== "";
  const offered = chipSuggestions(suggestions, value, { max, limit: suggestionLimit });
  const describedBy = [extraDescribedBy ?? null, hint ? hintId : null, limitId, note ? noteId : null]
    .filter(Boolean)
    .join(" ");
  // A comma field takes a pasted list whole: a per-item maxLength on the input
  // would have the browser cut the paste before it's split, leaving the tail
  // lost or half a word as a chip. The cleaner still cuts each item.
  const inputMaxLength = commitOnComma ? max * (maxLength + 2) : maxLength;

  function pop(chip: string) {
    play(chipEls.current.get(chipKey(chip)), motion("pop", reducedMotion));
  }

  // A repeat of the same words wouldn't change the live region, so it would
  // go unheard; a trailing no-break space makes it a change.
  function announce(text: string) {
    if (!text) return;
    setAnnouncement((prev) => (prev === text ? `${text}\u00a0` : text));
  }

  function heldFocus(button?: HTMLElement, index?: number): Held {
    const active = document.activeElement;
    if (active !== null && active === input.current) return { kind: "input" };
    if (button === undefined || active !== button) return null;
    return index === undefined ? { kind: "add" } : { kind: "suggestion", index };
  }

  // After the render a commit caused (see the focus note above).
  function restoreFocus(held: Held, count: number) {
    if (held === null) return;
    if (count >= max) {
      boxRef.current?.focus({ preventScroll: true });
      return;
    }
    if (held.kind === "input") return;
    if (held.kind === "add") {
      focusEnd(input.current);
      return;
    }
    const left =
      suggestionsRef.current?.querySelectorAll<HTMLButtonElement>("[data-chip-suggestion]");
    const next = left && left.length > 0 ? left[Math.min(held.index, left.length - 1)] : null;
    if (next) next.focus({ preventScroll: true });
    else focusEnd(input.current);
  }

  // Return, Add, or a suggestion. The draft is consumed whatever happens, as
  // in the prototype (P:827): a duplicate pops the chip it matches instead,
  // and a value the cleaner refuses ("Other") is said to be refused.
  function commit(raw: string, button?: HTMLElement, index?: number) {
    if (disabled) return;
    const held = heldFocus(button, index);
    const r = addChip(value.items, raw, clean);
    const items = r.kind === "added" ? r.items : value.items;
    // Rendered now, so a new chip is there to pop and focus has its target.
    flushSync(() => onChange({ items, draft: "" }));
    if (r.kind === "added") {
      pop(r.chip);
      announce(chipAnnouncement({ added: [r.chip] }, items.length, max));
    } else if (r.kind === "duplicate") {
      pop(r.chip);
      announce(chipAnnouncement({ duplicates: [r.chip] }, items.length, max));
    } else if (r.kind === "full") {
      announce(chipAnnouncement({ overflow: true }, items.length, max));
    } else if (raw.trim()) {
      announce(chipAnnouncement({ refused: [raw.trim()] }, items.length, max));
    }
    restoreFocus(held, items.length);
  }

  // A ✕, or Backspace on an empty draft. A ✕ that held focus (a keyboard or
  // switch user; a tap keeps it in the input) hands it to the input, which is
  // back if the field was full.
  function remove(index: number, button: HTMLButtonElement | null) {
    if (disabled) return;
    const chip = value.items[index];
    if (chip === undefined) return;
    const buttonHadFocus = button !== null && document.activeElement === button;
    flushSync(() => onChange({ items: removeChip(value.items, index), draft: value.draft }));
    announce(`Removed ${chip}`);
    if (buttonHadFocus) focusEnd(input.current);
  }

  function typeDraft(typed: string) {
    if (disabled) return;
    const r = typeIntoChipField(value, typed, { clean, commitOnComma, max });
    if (r.added.length === 0 && r.duplicates.length === 0 && !r.overflow) {
      onChange(r.value);
      return;
    }
    const held = heldFocus();
    flushSync(() => onChange(r.value));
    r.added.forEach(pop);
    r.duplicates.forEach(pop);
    announce(chipAnnouncement(r, r.value.items.length, max));
    restoreFocus(held, r.value.items.length);
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-baseline justify-between gap-2.5">
        <label id={labelId} htmlFor={inputId} className="text-body text-[13px] font-semibold">
          {label}
        </label>
        {hint && (
          <span id={hintId} className="text-caption text-[11px]">
            {hint}
          </span>
        )}
      </div>
      <span id={limitId} className="sr-only">
        {full ? `${max} of ${max}. Remove one to add another.` : `Up to ${max}.`}
      </span>

      {/* A tap on the box's own padding focuses the input, as a text field
          would (P:832). Chips, ✕ and Add handle their own taps. Full, the box
          takes focus itself (restoreFocus), so it carries the limit's wording
          then, with the input that carried it gone; its brand border is the
          focus ring. Radius 12 (R:85), spelled out: rounded-xl is ~20px here. */}
      <div
        ref={boxRef}
        role="group"
        aria-labelledby={labelId}
        aria-describedby={full ? describedBy : undefined}
        tabIndex={full ? -1 : undefined}
        onClick={(e) => {
          if (e.target === e.currentTarget) focusEnd(input.current);
        }}
        className="border-control-border focus-within:border-brand mt-[7px] flex min-h-11 cursor-text flex-wrap items-center gap-1.5 rounded-[12px] border-[1.5px] bg-white p-1.5 outline-none transition-colors duration-200"
      >
        {value.items.map((item, i) => {
          const key = chipKey(item);
          return (
            <span
              key={key}
              ref={(el) => {
                if (el) chipEls.current.set(key, el);
                else chipEls.current.delete(key);
              }}
              className="bg-brand inline-flex h-7 max-w-full items-center gap-0.5 rounded-full pr-[3px] pl-[11px] text-[12px] font-semibold text-white"
            >
              <span className="truncate" title={item}>
                {item}
              </span>
              {/* The ✕'s touch target is 38×34. Up and down it stops at half
                  the 6px gap between rows, so ✕s on stacked rows never share a
                  tap; sideways it reaches only into the gap and over the
                  chip's own label, which is inert. */}
              <button
                type="button"
                data-chip-remove
                aria-label={`Remove ${item}`}
                aria-disabled={disabled || undefined}
                onPointerDown={keepFocus}
                onClick={(e) => remove(i, e.currentTarget)}
                className="relative flex size-[22px] shrink-0 items-center justify-center text-white/70 before:absolute before:-inset-x-2 before:-inset-y-1.5 before:content-['']"
              >
                <XIcon aria-hidden className="size-2.5" strokeWidth={3} />
              </button>
            </span>
          );
        })}

        {!full && (
          <input
            ref={input}
            id={inputId}
            value={value.draft}
            maxLength={inputMaxLength}
            readOnly={disabled}
            onChange={(e) => typeDraft(e.target.value)}
            onKeyDown={(e) => {
              if (isImeKeyDown(e.nativeEvent)) return;
              if (e.key === "Enter") {
                e.preventDefault();
                if (value.draft.trim()) commit(value.draft);
                else onEmptyReturn?.(e.currentTarget);
              } else if (e.key === "Backspace" && value.draft === "" && value.items.length > 0) {
                e.preventDefault();
                remove(value.items.length - 1, null);
              }
            }}
            onFocus={onFocus}
            onBlur={onBlur}
            aria-describedby={describedBy}
            placeholder={chipPlaceholder(value.items, placeholder)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="words"
            spellCheck={false}
            className="text-body placeholder:text-disabled h-[30px] min-w-[120px] flex-1 border-0 bg-transparent px-2 text-[15px] outline-none"
          />
        )}
        {showAdd && (
          <button
            type="button"
            aria-disabled={disabled || undefined}
            onPointerDown={keepFocus}
            onClick={(e) => commit(value.draft, e.currentTarget)}
            className="text-brand relative h-[30px] px-2.5 text-[12px] font-bold before:absolute before:inset-x-0 before:-inset-y-[7px] before:content-['']"
          >
            Add
          </button>
        )}
      </div>

      {/* Each pill's ::before stretches its touch target to 44px tall, as the
          30px buttons in person-row do. The row's 7px of padding holds that
          (a horizontal scroller clips vertically too), and its margins take
          the padding back out, so the row still sits 8px under the box. */}
      {offered.length > 0 && (
        <div
          ref={suggestionsRef}
          role="group"
          aria-label={`Suggested ${label.toLowerCase()}`}
          className="mt-px -mb-[7px] flex gap-1.5 overflow-x-auto py-[7px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {offered.map((option, i) => (
            <button
              key={option}
              type="button"
              data-chip-suggestion
              aria-label={`Add ${option}`}
              aria-disabled={disabled || undefined}
              onPointerDown={keepFocus}
              onClick={(e) => commit(option, e.currentTarget, i)}
              className="border-control-border text-body relative h-[30px] shrink-0 rounded-full border-[1.5px] bg-white px-3 text-[12px] font-semibold whitespace-nowrap transition-transform active:scale-[.96] before:absolute before:inset-x-0 before:-inset-y-[7px] before:content-['']"
            >
              + {option}
            </button>
          ))}
        </div>
      )}

      {note && (
        <p id={noteId} className="text-caption pt-2 text-[11px] leading-snug">
          {note}
        </p>
      )}

      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>
    </div>
  );
}
