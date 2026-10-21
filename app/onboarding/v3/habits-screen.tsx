"use client";

import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
  type Ref,
} from "react";
import { flushSync } from "react-dom";
import { CheckIcon, HandIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { NUDGES } from "@/lib/flags";
import { isImeKeyDown, keyboardInset, readViewportMetrics } from "@/lib/keyboard";
import {
  HABIT_NAME_MAX,
  V3_HABITS,
  formatHabitName,
  habitNudgeText,
} from "@/lib/onboarding-v3";
import {
  afterHabitStep,
  habitRowsFrom,
  habitSteps,
  type AccountHabit,
  type HabitRow,
} from "@/lib/onboarding-v3-goals-habits";
import type { OnboardingV3Services } from "@/lib/onboarding-v3-services";
import { itemStyle, motion, play, type ItemPhase } from "@/lib/motion";
import { normalizeMatchText } from "@/lib/uw";
import { cn } from "@/lib/utils";

import { aboveCta } from "./frame";
import { focusField, keepFocus } from "./focus";
import { KeyboardFit, type CtaEdge } from "./keyboard-fit";

// Screen 3, "Your habits" (R:98-104): the five preset chips, any typed through
// "+ Your own", and the line about nudges. Optional: the CTA reads "Skip for
// now" until a habit is picked (R:104).

// ---- Writes -----------------------------------------------------------------

const SAVE_FAILED = "Couldn't save your habits. Check your connection and try again.";

// Screen 3's writes, held by the shell for its CTA, as useGoalWrites is. The
// selected chips are diffed against the habits the wizard knows exist
// (habitSteps): new ones are created, ones this run created and that were
// deselected after Back are archived, and nothing is written twice. A habit
// the account already had is never archived, deselected or not, so "Skip for
// now" can't take a replayer's habits away (the module says why). A failure
// toasts and stays, with the rows true to what was written.
export function useHabitWrites({
  services,
  account,
}: {
  services: OnboardingV3Services;
  account: readonly AccountHabit[];
}) {
  // Seeded once, for the reason useGoalWrites gives.
  const [rows, setRows] = useState<HabitRow[]>(() => habitRowsFrom(account));
  const [saving, startSaving] = useTransition();
  const writing = useRef(false);

  function save(selected: readonly string[], onSaved: () => void) {
    if (writing.current) return;
    const steps = habitSteps(rows, selected);
    if (steps.length === 0) {
      onSaved();
      return;
    }
    writing.current = true;
    startSaving(async () => {
      let now = rows;
      try {
        for (const step of steps) {
          if (step.kind === "create") {
            const r = await services.createHabit(step.name);
            if ("error" in r) {
              toast.error(SAVE_FAILED);
              return;
            }
            now = afterHabitStep(now, step, r.id);
          } else {
            const r = await services.archiveHabit(step.id);
            if ("error" in r) {
              toast.error(SAVE_FAILED);
              return;
            }
            now = afterHabitStep(now, step);
          }
        }
        onSaved();
      } catch {
        toast.error(SAVE_FAILED);
      } finally {
        setRows(now);
        writing.current = false;
      }
    });
  }

  return { saving, save };
}

// ---- Screen -------------------------------------------------------------------

// What the shell's CTA calls: add whatever is typed in "Your own", then
// continue (P:991).
export type HabitsScreenHandle = { continue: () => void };

// The chip whose label matches `key` (normalizeMatchText), found by the
// data-habit attribute rather than a selector, since a typed habit can hold
// quotes.
function chipFor(box: HTMLElement | null, key: string): HTMLElement | undefined {
  return Array.from(box?.querySelectorAll<HTMLElement>("[data-habit]") ?? []).find(
    (el) => normalizeMatchText(el.dataset.habit ?? "") === key
  );
}

// The nudge line's top edge sits 68px above the CTA's: (20,690) with the CTA
// at y=758 in the 852 frame (R:103, P:206). Anchored by its top, as the
// prototype is, so a wrapped line grows down toward the CTA rather than up
// into the chips. The chips stop 16px above it.
const NUDGE_ABOVE_CTA_PX = 68;
// With the keyboard up, the room kept between the chips and the lifted CTA.
const CTA_CLEARANCE_PX = 8;

// Whether the on-screen keyboard is up right now.
function softKeyboardUp(): boolean {
  const m = readViewportMetrics(window);
  return m ? keyboardInset(m) > 0 : false;
}

// Select: the chip pops and its check big-pops in. Deselect: a small release
// (R:100). Reduced motion turns both pops into a fade and drops the release.
function playSelect(chip: HTMLElement | null | undefined, reduced: boolean) {
  play(chip, motion("pop", reduced));
  play(chip?.querySelector("[data-check]"), motion("bigPop", reduced));
}

export function HabitsScreen({
  ref,
  phase,
  reduced,
  habits,
  customHabits,
  busy,
  initialDraft,
  onToggle,
  onAddCustom,
  onContinue,
}: {
  ref?: Ref<HabitsScreenHandle>;
  phase: ItemPhase;
  reduced: boolean;
  habits: readonly string[]; // selected, in pick order
  customHabits: readonly string[];
  // A save is in flight: the chips are frozen until it settles.
  busy: boolean;
  // Dev preview only: "Your own" opens with this typed in.
  initialDraft?: string;
  onToggle: (name: string) => void;
  onAddCustom: (name: string) => void;
  // Continue with `custom` (possibly empty) added and selected first.
  onContinue: (custom: string) => void;
}) {
  const active = phase === "active";
  const [open, setOpen] = useState(initialDraft !== undefined);
  const [draft, setDraft] = useState(initialDraft ?? "");
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const ownRef = useRef<HTMLButtonElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // With the keyboard up, the chips' bottom margin that keeps them above the
  // lifted CTA, in px; null with it down. The chips are laid out to end above
  // the RESTING CTA, and on a short phone the lifted one lands on a third row
  // of chips, where "Your own" opens (P4 review).
  const [keyboardMargin, setKeyboardMargin] = useState<number | null>(null);
  // A typed habit that became a new chip, to pop once it has rendered.
  const popKey = useRef<string | null>(null);

  const chips = [...V3_HABITS, ...customHabits];
  const selected = new Set(habits);

  useEffect(() => {
    return () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    };
  }, []);

  // Arriving with "Your own" already open (Back from Screen 4 with something
  // typed, or the dev preview) puts the focus back in it, as Screen 2 does
  // for its field (R:39). Entry only.
  useEffect(() => {
    if (!active || !open) return;
    const t = setTimeout(() => focusField(inputRef.current), 140);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  function toggle(name: string, chip: HTMLElement) {
    if (busy) return;
    const on = selected.has(name);
    onToggle(name);
    if (on) play(chip, motion("chipRelease", reduced));
    else playSelect(chip, reduced);
  }

  // Opened from a tap, the field renders and takes focus inside that tap
  // (flushSync), which is what lets iOS raise the keyboard for it.
  function openCustom() {
    if (busy) return;
    flushSync(() => setOpen(true));
    focusField(inputRef.current);
  }

  // Closing unmounts the field. When focus was in it and no on-screen
  // keyboard is up (a hardware keyboard, or a desktop), `refocus` puts focus
  // on "+ Your own" so it isn't dropped on the page. After a tap, with the
  // keyboard up, closing is meant to drop the keyboard, so focus is left
  // alone. Focusing a button never raises the iOS keyboard either way.
  function closeCustom(refocus = false) {
    const restore =
      refocus && (pillRef.current?.contains(document.activeElement) ?? false) && !softKeyboardUp();
    inputRef.current?.blur();
    if (!restore) {
      setOpen(false);
      setDraft("");
      return;
    }
    flushSync(() => {
      setOpen(false);
      setDraft("");
    });
    ownRef.current?.focus({ preventScroll: true });
  }

  // "Your own" closes once focus has really left it with nothing typed
  // (R:102). The wait lets a tap on "Add" land first (P:978), and focus
  // moving from the field to "Add" (Tab) keeps it open.
  function closeIfLeft() {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    blurTimer.current = setTimeout(() => {
      const el = inputRef.current;
      if (el && !el.value.trim() && !pillRef.current?.contains(document.activeElement)) {
        setOpen(false);
      }
    }, 160);
  }

  // With the keyboard up, end the chips above the lifted CTA (keyboardMargin)
  // rather than the resting one. Only while this screen is in front: another
  // screen's keyboard is none of its business.
  function fit(cta: CtaEdge) {
    const section = topRef.current?.parentElement;
    if (!active || cta.lift === 0 || !section) {
      setKeyboardMargin(null);
      return;
    }
    setKeyboardMargin(Math.ceil(section.clientHeight - cta.top + CTA_CLEARANCE_PX));
  }

  // Once the chips have shrunk for the keyboard, scroll them so the open
  // field sits inside what's left, above the CTA.
  useLayoutEffect(() => {
    const box = scrollRef.current;
    const pill = pillRef.current;
    if (keyboardMargin === null || !open || !box || !pill) return;
    const bottom =
      pill.getBoundingClientRect().bottom - box.getBoundingClientRect().top + box.scrollTop;
    const over = bottom + 4 - (box.scrollTop + box.clientHeight);
    if (over > 0) box.scrollTop += over;
  }, [keyboardMargin, open]);

  // Return or "Add": the habit, first letter capitalized, becomes a chip and
  // is selected (R:102). One matching a chip already there selects that chip
  // instead (the reducer's rule), and pops it now. A new chip pops once it
  // exists. Empty just closes the field.
  function addCustom() {
    if (busy) return;
    const name = formatHabitName(draft);
    closeCustom(true);
    if (!name) return;
    const key = normalizeMatchText(name);
    const existing = chipFor(boxRef.current, key);
    if (existing) {
      if (!selected.has(existing.dataset.habit ?? "")) playSelect(existing, reduced);
    } else {
      popKey.current = key;
    }
    onAddCustom(name);
  }

  useEffect(() => {
    const key = popKey.current;
    if (!key) return;
    popKey.current = null;
    play(chipFor(boxRef.current, key), motion("bigPop", reduced));
  }, [customHabits, reduced]);

  useImperativeHandle(ref, () => ({
    continue() {
      if (busy) return;
      const custom = open ? formatHabitName(draft) : "";
      if (open) closeCustom();
      onContinue(custom);
    },
  }));

  return (
    <>
      <KeyboardFit onMeasure={fit} />
      <div ref={topRef} className="flex h-full flex-col px-5 pt-4">
        <div className="section-label" style={itemStyle(phase, 0, reduced)}>
          Your habits
        </div>
        <h2
          className="text-ink mt-2.5 font-serif text-[25px] leading-[1.18] font-medium tracking-[-0.015em] text-pretty"
          style={itemStyle(phase, 1, reduced)}
        >
          Small things you want to do every day
        </h2>
        <p
          className="text-secondary-ink mt-[9px] text-[13px] leading-[1.45] text-pretty"
          style={itemStyle(phase, 2, reduced)}
        >
          Separate from your goals. You tick these off once a day.
        </p>

        {/* Scrolls only for a replayer with more habits than fit above the
            nudge line, or above the keyboard. The 14px side gutter gives a
            popping chip room before the scroll box clips it: the pop peaks
            at scale(1.08), 13.4px a side on the widest chip. overflow-x is
            hidden, since overflow-y: auto would otherwise make it auto and
            flash a sideways scrollbar for that overshoot. The chips start
            at y=244 (R:100), 44px under the sub's top: its one 18.85px line,
            21.15px, and the 4px of room at the top for a pop. */}
        <div
          ref={scrollRef}
          className="-mx-3.5 mt-[21.15px] min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3.5 pt-1"
          style={{
            ...itemStyle(phase, 3, reduced),
            marginBottom:
              keyboardMargin === null
                ? aboveCta(NUDGES ? NUDGE_ABOVE_CTA_PX + 16 : 16)
                : `max(${aboveCta(NUDGES ? NUDGE_ABOVE_CTA_PX + 16 : 16)}, ${keyboardMargin}px)`,
          }}
        >
          <div ref={boxRef} role="group" aria-label="Habits" className="flex flex-wrap gap-2 pb-1">
            {chips.map((name) => {
              const on = selected.has(name);
              return (
                <button
                  key={name}
                  type="button"
                  data-habit={name}
                  aria-pressed={on}
                  onPointerDown={keepFocus}
                  onClick={(e) => toggle(name, e.currentTarget)}
                  className={cn(
                    "inline-flex h-[38px] max-w-full items-center gap-[7px] rounded-full border-[1.5px] pr-3.5 pl-2.5 text-[13px] font-semibold transition-[background-color,border-color,color] duration-[160ms] ease-[ease]",
                    on ? "border-brand bg-brand text-primary-foreground" : "border-control-border text-body bg-card"
                  )}
                >
                  <span aria-hidden className="relative size-[18px] shrink-0">
                    <span
                      className="text-disabled absolute inset-0 flex items-center justify-center"
                      style={{ opacity: on ? 0 : 1, transition: "opacity 120ms linear" }}
                    >
                      <PlusIcon className="size-3.5" strokeWidth={2.5} />
                    </span>
                    <span
                      data-check
                      className="text-brand bg-primary-foreground absolute inset-0 flex items-center justify-center rounded-full"
                      style={{ opacity: on ? 1 : 0 }}
                    >
                      <CheckIcon className="size-[11px]" strokeWidth={3.5} />
                    </span>
                  </span>
                  <span className="truncate">{name}</span>
                </button>
              );
            })}

            {open ? (
              <span
                ref={pillRef}
                className="border-brand inline-flex h-[38px] items-center rounded-full border-[1.5px] bg-card pr-1.5 pl-3.5"
              >
                <input
                  ref={inputRef}
                  value={draft}
                  maxLength={HABIT_NAME_MAX}
                  onChange={(e) => {
                    if (!busy) setDraft(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (isImeKeyDown(e.nativeEvent)) return;
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustom();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      closeCustom(true);
                    }
                  }}
                  onBlur={closeIfLeft}
                  aria-label="Your own habit"
                  placeholder="e.g. Floss"
                  autoComplete="off"
                  autoCapitalize="sentences"
                  spellCheck={false}
                  enterKeyHint="done"
                  className="text-body placeholder:text-disabled h-[30px] w-[130px] border-0 bg-transparent p-0 text-[15px] outline-none"
                />
                {/* 28px tall (P:202); the extended hit area makes it 44. */}
                <button
                  type="button"
                  onPointerDown={keepFocus}
                  onClick={addCustom}
                  onBlur={closeIfLeft}
                  className="text-brand relative h-7 px-2 text-[12px] font-bold before:absolute before:-inset-x-1 before:-inset-y-2 before:content-['']"
                >
                  Add
                </button>
              </span>
            ) : (
              <button
                ref={ownRef}
                type="button"
                onClick={openCustom}
                className="border-disabled text-caption inline-flex h-[38px] items-center rounded-full border-[1.5px] border-dashed bg-card px-3.5 text-[13px] font-semibold"
              >
                + Your own
              </button>
            )}
          </div>
        </div>
      </div>

      {/* The nudge line (R:103), its top NUDGE_ABOVE_CTA_PX above the CTA.
          Hidden with NUDGES off (D15): it would promise something the app
          can't do. Three lines at most, for a replayer's long habit name. */}
      {NUDGES && (
        <div
          className="absolute inset-x-5 flex items-center gap-2.5"
          style={{
            top: `calc(100% - ${aboveCta(NUDGE_ABOVE_CTA_PX)})`,
            ...itemStyle(phase, 4, reduced),
          }}
        >
          <span className="border-hairline text-caption inline-flex h-[26px] shrink-0 items-center gap-[5px] rounded-full border-[1.5px] px-2.5 text-[11px] font-semibold">
            <HandIcon aria-hidden className="size-3" strokeWidth={2.2} />
            Nudge
          </span>
          <span className="text-secondary-ink line-clamp-3 text-[12px] leading-[1.4] text-pretty">
            {habitNudgeText(habits[0])}
          </span>
        </div>
      )}
    </>
  );
}
