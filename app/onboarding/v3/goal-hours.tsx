"use client";

import { useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from "react";
import { MinusIcon, PlusIcon } from "lucide-react";

import { isImeKeyDown } from "@/lib/keyboard";
import { motion, play } from "@/lib/motion";
import { cn } from "@/lib/utils";
import {
  GOAL_HOURS_MAX,
  GOAL_HOURS_MIN,
  formatGoalHours,
  hoursFieldText,
  hoursText,
  resolveHoursDraft,
  stepGoalHours,
} from "@/lib/onboarding-v3";

import { keepFocus } from "./focus";

// A goal's weekly hours on Screen 2 (OWNER-FIX-2), in the box under its
// title: − on the left, + on the right, an hour a step, and the hours
// typeable in between. The owner asked for it "in the wizard's own animation
// style", so it's made of the wizard's own pieces: the chip field's box
// (components/v2/chip-field.tsx), 30px buttons with a 44px reach as in
// person-row, `pop` on the number when the hours change and `shake` on the
// box when they can't (a limit, or typed hours out of range), each with its
// reduced-motion twin.
//
// The hours are the shell's (the reducer's goalHours); this only holds the
// text being edited. Focus makes the hours as they stand that text, all of
// it selected, so a screen reader still has the number to read and a number
// typed replaces it rather than gaining a digit. The text commits when the
// field is left, or on Return, which also lets go of the field (the
// keyboard's "done"), snapped into 1–40 (resolveHoursDraft). Left as it was,
// it keeps the hours exactly, a stored 2.5 or 60 included. −, + and the arrow
// keys leave the new hours in the field, selected again, and Escape puts back
// the hours as they were. While the field has no focus it renders straight
// from `value`, so a change from outside (a Continue) needs no syncing effect.
//
// The text is cleaned on every keystroke (hoursFieldText): digits and one
// decimal point, the point kept so "2.5" doesn't run on into 25. It commits
// as whole hours ("2.5" is 2). A Japanese or Chinese keyboard in full-width
// mode composes its digits in the field, and rewriting the text
// mid-composition breaks it ("１２" came out as "11"). So while a
// composition is open the text is left as the IME has it, and it's cleaned
// when the composition ends, and in any case when it commits.
//
// − and + keep the focus where it is (keepFocus), so tapping them while the
// keyboard is up, for this box or for the goal field, doesn't drop it. At a
// limit they're aria-disabled rather than disabled, so a tap there still
// arrives and shakes the box, as invalid input does elsewhere (R:50).

// Continue pressed while this box is being typed in. The shell has to save
// the typed hours in the same tick as the goals, so `take` hands them back
// (null when they're the hours already held), instead of going through
// onChange's dispatch, and leaves them in the field.
export type GoalHoursHandle = { take(): number | null };

const STEP_BUTTON =
  "border-hairline text-caption relative flex size-[30px] shrink-0 items-center justify-center rounded-[10px] border-[1.5px] bg-card transition-transform active:scale-[.94] aria-disabled:opacity-35 before:absolute before:-inset-[7px] before:content-['']";

// A refused change in words. The shake itself is silent.
const MOST = `${hoursText(GOAL_HOURS_MAX)} is the most`;
const LEAST = `${hoursText(GOAL_HOURS_MIN)} is the least`;

export function GoalHours({
  ref,
  title,
  value,
  busy,
  reduced,
  onChange,
  onFocusChange,
}: {
  ref?: Ref<GoalHoursHandle>;
  // The goal's title, which names the box and its controls.
  title: string;
  // The hours held: whole hours, or a replayer's quota as stored (2.5, 60).
  value: number;
  // A save is in flight: the hours are frozen until it settles.
  busy: boolean;
  reduced: boolean;
  onChange: (hours: number) => void;
  // The field gained or lost focus, for the screen's keyboard fit.
  onFocusChange: (focused: boolean) => void;
}) {
  // The text being edited while the field has the focus, null while it
  // hasn't.
  const [draft, setDraft] = useState<string | null>(null);
  // The last change in words, for a screen reader (announce).
  const [announcement, setAnnouncement] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const numberRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // An IME composition is open, compositionstart to compositionend.
  const composing = useRef(false);
  // The press on the field that's focusing it. Its mouseup would put the
  // caret where the press was, undoing the selection focus just made.
  const focusingPress = useRef(false);
  // The text the last change set is to end up selected, once the render
  // has put it in the field (selectText).
  const selectNext = useRef(false);

  const shown = draft ?? formatGoalHours(value);
  // What − and + go from, and what their limits are judged by: the typed
  // hours, while there are any.
  const current = draft === null ? value : resolveHoursDraft(draft, value).hours;

  useLayoutEffect(() => {
    if (!selectNext.current) return;
    selectNext.current = false;
    selectField();
  });

  function hasFocus(): boolean {
    return inputRef.current !== null && document.activeElement === inputRef.current;
  }

  function selectField() {
    const el = inputRef.current;
    if (el && document.activeElement === el) el.setSelectionRange(0, el.value.length);
  }

  // `text` as the field's text, all of it selected, so the next digit typed
  // replaces it. Only while the field has the focus: without it, the field
  // just shows the hours.
  function selectText(text: string) {
    if (!hasFocus()) {
      setDraft(null);
      return;
    }
    if (text === draft) {
      selectField();
      return;
    }
    selectNext.current = true;
    setDraft(text);
  }

  // A repeat of the same words wouldn't change the live region, so it would
  // go unheard; a trailing no-break space makes it a change (as ChipField's).
  function announce(text: string) {
    setAnnouncement((prev) => (prev === text ? `${text} ` : text));
  }

  // The draft as hours, with its feedback: a shake, and the limit in words,
  // when it was out of range, or a pop when it changes the hours. Returns the
  // new hours, or null when they're the ones already held.
  function resolveDraft(): number | null {
    if (draft === null) return null;
    const { hours, snapped } = resolveHoursDraft(draft, value);
    if (snapped) {
      play(boxRef.current, motion("shake", reduced));
      announce(hours === GOAL_HOURS_MAX ? MOST : LEAST);
    } else if (hours !== value) {
      play(numberRef.current, motion("pop", reduced));
    }
    return hours === value ? null : hours;
  }

  function commit() {
    const hours = resolveDraft();
    if (hours !== null) onChange(hours);
  }

  // − or +, from the typed hours if there are any. In a field with the focus
  // the new hours replace the text, selected.
  function step(dir: 1 | -1) {
    if (busy) return;
    const next = stepGoalHours(current, dir);
    if (next === current) {
      play(boxRef.current, motion("shake", reduced));
      announce(dir > 0 ? MOST : LEAST);
      return;
    }
    onChange(next);
    play(numberRef.current, motion("pop", reduced));
    announce(hoursText(next));
    if (draft !== null) selectText(formatGoalHours(next));
  }

  useImperativeHandle(ref, () => ({
    take() {
      if (draft === null) return null;
      const hours = resolveDraft();
      // Continue keeps the focus where it was, and a field that still has it
      // holds the hours it now has, as after a step.
      selectText(formatGoalHours(hours ?? value));
      return hours;
    },
  }));

  // Radius 12, spelled out as the chip field's is (rounded-xl is ~20px
  // here). 5.5px inside the 1.5px border puts the 30px buttons 7px from each
  // edge, which is how far their reach extends: 44px, edge to edge.
  return (
    <div
      ref={boxRef}
      role="group"
      aria-label={`Weekly hours for “${title}”`}
      data-goal-hours
      className="border-control-border focus-within:border-brand flex h-11 items-center rounded-[12px] border-[1.5px] bg-card px-[5.5px] transition-colors duration-200"
    >
      <button
        type="button"
        aria-label={`Fewer hours for “${title}”`}
        aria-disabled={busy || current <= GOAL_HOURS_MIN || undefined}
        onPointerDown={keepFocus}
        onClick={() => step(-1)}
        className={STEP_BUTTON}
      >
        <MinusIcon aria-hidden className="size-[14px]" strokeWidth={2.25} />
      </button>

      {/* A tap anywhere between the buttons focuses the field, as on a text
          box. The field is exactly as wide as what it shows: the hidden twin
          in the same grid cell sizes the cell, and the input (0 wide, at
          least the cell) fills it. So "h / week" follows the number, "10h"
          as the Goals page writes it, and the three stay centered together.
          While it's being typed in, the twin keeps 2px more for the caret
          after the last digit, which the input would otherwise scroll to
          show, nudging the digits. Emptied, the field shows the hours it
          keeps as its placeholder. */}
      <label className="flex min-w-0 flex-1 cursor-text items-center justify-center self-stretch">
        <span ref={numberRef} data-goal-hours-value className="inline-grid">
          <span
            aria-hidden
            className={cn(
              "invisible col-start-1 row-start-1 text-[16px] font-semibold whitespace-pre tabular-nums",
              draft !== null && "pr-0.5"
            )}
          >
            {shown || formatGoalHours(value)}
          </span>
          {/* No `pattern`: a stored 2.5 would fail [0-9]* and read as
              invalid. Three characters, so a third digit isn't swallowed
              (100 snaps to 40 rather than being read as 10). */}
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            enterKeyHint="done"
            maxLength={3}
            size={1}
            autoComplete="off"
            spellCheck={false}
            role="spinbutton"
            aria-label={`Hours per week for “${title}”`}
            aria-valuenow={value}
            aria-valuemin={GOAL_HOURS_MIN}
            aria-valuemax={GOAL_HOURS_MAX}
            aria-valuetext={hoursText(value)}
            readOnly={busy}
            value={shown}
            placeholder={formatGoalHours(value)}
            onPointerDown={(e) => {
              focusingPress.current = document.activeElement !== e.currentTarget;
            }}
            onMouseUp={(e) => {
              if (!focusingPress.current) return;
              focusingPress.current = false;
              e.preventDefault();
            }}
            onFocus={(e) => {
              // The hours become the text to edit, selected in the focus
              // handler itself rather than a moment later, when it can lose
              // to the caret the tap places. A draft already typed survives
              // the window or the app taking the focus and giving it back
              // (onBlur), caret and all.
              if (draft === null) {
                setDraft(formatGoalHours(value));
                e.currentTarget.setSelectionRange(0, e.currentTarget.value.length);
              }
              onFocusChange(true);
            }}
            onChange={(e) => {
              if (busy) return;
              const raw = e.target.value;
              const ime = composing.current || (e.nativeEvent as InputEvent).isComposing === true;
              setDraft(ime ? raw : hoursFieldText(raw));
            }}
            onCompositionStart={() => {
              composing.current = true;
            }}
            onCompositionEnd={(e) => {
              composing.current = false;
              if (!busy) setDraft(hoursFieldText(e.currentTarget.value));
            }}
            onBlur={(e) => {
              focusingPress.current = false;
              // The window or the app losing focus blurs the field too, and
              // the focus comes straight back to it, so the draft waits.
              if (document.activeElement === e.currentTarget || document.hidden) return;
              composing.current = false;
              commit();
              setDraft(null);
              onFocusChange(false);
            }}
            onKeyDown={(e) => {
              if (isImeKeyDown(e.nativeEvent)) return;
              if (e.key === "Enter") {
                // Commits, and lets go of the field: its blur commits.
                e.preventDefault();
                e.currentTarget.blur();
              } else if (e.key === "Escape") {
                // Back to the hours as they were, still in the field.
                e.preventDefault();
                selectText(formatGoalHours(value));
              } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                // A spinbutton's own keys.
                e.preventDefault();
                step(e.key === "ArrowUp" ? 1 : -1);
              }
            }}
            className="text-ink placeholder:text-disabled col-start-1 row-start-1 m-0 w-0 min-w-full border-0 bg-transparent p-0 text-[16px] font-semibold tabular-nums caret-[var(--brand)] outline-none"
          />
        </span>
        <span aria-hidden className="text-ink text-[16px] font-semibold">
          h
        </span>
        <span aria-hidden className="text-caption ml-1 text-[13px] font-medium">
          / week
        </span>
      </label>

      <button
        type="button"
        aria-label={`More hours for “${title}”`}
        aria-disabled={busy || current >= GOAL_HOURS_MAX || undefined}
        onPointerDown={keepFocus}
        onClick={() => step(1)}
        className={STEP_BUTTON}
      >
        <PlusIcon aria-hidden className="size-[14px]" strokeWidth={2.25} />
      </button>

      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>
    </div>
  );
}
