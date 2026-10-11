"use client";

import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useTransition,
  type FocusEvent,
  type Ref,
} from "react";
import { flushSync } from "react-dom";
import { XIcon } from "lucide-react";
import { toast } from "sonner";

import {
  GOAL_TITLE_MAX,
  MAX_GOALS,
  goalExamplesFor,
  goalHint,
  goalHoursOrDefault,
  goalKeys,
  goalPlaceholder,
} from "@/lib/onboarding-v3";
import {
  afterGoalStep,
  goalColors,
  goalRowsFrom,
  goalSteps,
  savedRowIds,
  type AccountGoal,
  type GoalRow,
} from "@/lib/onboarding-v3-goals-habits";
import { isImeKeyDown, overlapPx } from "@/lib/keyboard";
import type { OnboardingV3Services } from "@/lib/onboarding-v3-services";
import {
  CHIP_TYPING_MS_PER_CHAR,
  EASING,
  TRAVEL,
  itemStyle,
  motion,
  play,
  transition,
  typedPrefix,
  type ItemPhase,
} from "@/lib/motion";

import { KEYBOARD_LIFT, aboveCta } from "./frame";
import { GoalHours, type GoalHoursHandle } from "./goal-hours";
import { focusField, keepFocus } from "./focus";
import { KeyboardFit, layoutTopWithin, type CtaEdge } from "./keyboard-fit";

// Screen 2, "Your goal" (R:90-96): up to three goals, typed or picked from
// the example chips, each listed in its color. Continue needs at least one
// and saves them for real (plan D15). Each goal has its weekly hours in a
// box under its title (OWNER-FIX-2, goal-hours.tsx), which comes in with the
// goal, at 5h or at the quota the goal already has.

// ---- Writes -----------------------------------------------------------------

const SAVE_FAILED = "Couldn't save your goals. Check your connection and try again.";

// Screen 2's writes, held by the wizard shell like the welcome's: the CTA that
// triggers them lives there. `rows` is every goal the wizard knows exists,
// starting from the account's (lib/onboarding-v3-goals-habits.ts has the
// whole model), and it's state rather than a ref because the list draws an
// account goal in its own color from it.
//
// Continue diffs the list against the rows (goalSteps) and makes only those
// writes, one at a time, applying each to the rows as it succeeds. So Back and
// Continue again writes nothing, a goal this run created and then removed is
// archived once, and a failure halfway leaves the rows true to what was
// written: it toasts, the wizard stays on Screen 2, and the next Continue
// picks up the rest. However far it got, it then reports the row each goal
// is on (savedRowIds), new ones included, which the reducer keeps beside the
// goals (goalRowIds), so the next diff starts from those rows instead of
// working them out from titles again. A goal the account already had is
// never archived from here, even when it's removed from the list, and the
// only thing ever written to it is new hours from its box (the module says
// why). The toast is generic, since the goal actions return raw database
// messages.
export function useGoalWrites({
  services,
  account,
}: {
  services: OnboardingV3Services;
  account: readonly AccountGoal[];
}) {
  // Seeded once. The page re-renders with fresh goals after every write
  // (revalidateGoalSurfaces), and those must not replace what's tracked here.
  const [rows, setRows] = useState<GoalRow[]>(() => goalRowsFrom(account));
  const [saving, startSaving] = useTransition();
  // Set the moment Continue is pressed, before `saving` has rendered, so a
  // second press can't start a second diff from the same rows.
  const writing = useRef(false);

  // `hours` are the boxes' hours and `rowIds` the rows the goals already
  // know, by position (the reducer's goalHours and goalRowIds). `onRowIds`
  // gets the row each goal is on once the save has settled, whether every
  // write landed or not, and `onSaved` follows it when they all did.
  function save(
    titles: readonly string[],
    hours: readonly number[],
    rowIds: readonly (string | null)[],
    onRowIds: (ids: (string | null)[]) => void,
    onSaved: () => void
  ) {
    if (writing.current) return;
    const steps = goalSteps(rows, titles, hours, rowIds);
    // The ids createGoal returned, by the goal each was created for.
    const created = new Map<number, string>();
    const report = () => onRowIds(savedRowIds(rows, titles, hours, rowIds, created));
    if (steps.length === 0) {
      report();
      onSaved();
      return;
    }
    writing.current = true;
    startSaving(async () => {
      let now = rows;
      let saved = false;
      try {
        for (const step of steps) {
          if (step.kind === "create") {
            const r = await services.createGoal({
              title: step.title,
              weeklyQuotaHours: step.hours,
              color: step.color,
            });
            if ("error" in r) {
              toast.error(SAVE_FAILED);
              return;
            }
            now = afterGoalStep(now, step, r.id);
            created.set(step.slot, r.id);
            services.track("goal_created", { goal_id: r.id });
          } else if (step.kind === "update") {
            const r = await services.updateGoal(step.id, step.patch);
            if ("error" in r) {
              toast.error(SAVE_FAILED);
              return;
            }
            now = afterGoalStep(now, step);
            services.track("goal_updated", { goal_id: step.id });
          } else {
            const r = await services.archiveGoal(step.id);
            if ("error" in r) {
              toast.error(SAVE_FAILED);
              return;
            }
            now = afterGoalStep(now, step);
          }
        }
        saved = true;
      } catch {
        toast.error(SAVE_FAILED);
      } finally {
        setRows(now);
        report();
        writing.current = false;
      }
      if (saved) onSaved();
    });
  }

  return { rows, saving, save };
}

// ---- Screen -------------------------------------------------------------------

// What the shell's CTA calls: commit whatever is typed and continue.
export type GoalScreenHandle = { continue: () => void };

// Hours typed into a box and not yet committed when Continue is pressed: the
// goal's index and the hours, for the shell to apply before it saves. One
// per box that has any.
export type GoalHoursEdit = { index: number; hours: number };

// Types `text` in through `show`, a character every 20ms (R:94), and calls
// `done` once it's all there. Paced by elapsed time rather than by ticks, so a
// busy main thread catches up instead of typing slower.
function typeIn(
  text: string,
  show: (shown: string) => void,
  done: () => void
): ReturnType<typeof setInterval> {
  const start = performance.now();
  return setInterval(() => {
    const shown = typedPrefix(text, performance.now() - start, false);
    show(shown);
    if (shown === text) done();
  }, CHIP_TYPING_MS_PER_CHAR);
}

// A goal row is its 40px title line (R:92) and, since OWNER-FIX-2, the 44px
// hours box under it, then 7px of room and the 1px divider: 92px. The field
// sits under the list, 14px further down once there's a list at all.
const ROW_PX = 92;
const fieldOffset = (n: number) => n * ROW_PX + (n > 0 ? 14 : 0);

// For the keyboard fit (KeyboardFit): the room kept between the field's text
// box (or the focused hours box) and the lifted CTA, and between the field
// and the example chips, which rest 12px above the CTA (R:94).
const CTA_CLEARANCE_PX = 8;
const EXAMPLES_CLEARANCE_PX = 4;
const EXAMPLES_GAP_PX = 12;

export function GoalScreen({
  ref,
  phase,
  reduced,
  goals,
  goalHours,
  goalRowIds,
  rows,
  busy,
  initialDraft = "",
  onAdd,
  onRemove,
  onSetHours,
  onContinue,
  onDraftChange,
}: {
  ref?: Ref<GoalScreenHandle>;
  phase: ItemPhase;
  reduced: boolean;
  goals: readonly string[];
  // Each goal's hours and the row it's on, by position (the reducer's
  // goalHours and goalRowIds).
  goalHours: readonly number[];
  goalRowIds: readonly (string | null)[];
  // useGoalWrites' rows, for the colors (goalColors).
  rows: readonly GoalRow[];
  // A save is in flight: the list is frozen until it settles.
  busy: boolean;
  // Dev preview only: the field opens with this typed in.
  initialDraft?: string;
  onAdd: (title: string) => void;
  onRemove: (index: number) => void;
  onSetHours: (index: number, hours: number) => void;
  // Continue with `draft` (possibly empty) added to the list first, and the
  // hours still being typed into any box applied before that.
  onContinue: (draft: string, hoursEdits: readonly GoalHoursEdit[]) => void;
  // Whether the field holds anything, for the CTA's disabled state (R:96).
  onDraftChange: (hasDraft: boolean) => void;
}) {
  const active = phase === "active";
  // The draft lives here, not in the shell: typing an example in sets it
  // every 20ms, and in the shell that would re-render all six screens each
  // time. The shell only hears whether there is one.
  const [draft, setDraftState] = useState(initialDraft);
  // The draft as last set, for a blur that comes before the render showing
  // it. Continue takes the draft and, with nothing to write, moves on in the
  // same tick, and the move blurs the field while its handlers still hold
  // the old draft: leaveField would add it a second time.
  const draftNow = useRef(initialDraft);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const fieldRowRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  // The keyboard fit (KeyboardFit, fit below): whether the example chips
  // can sit above the CTA, at rest or riding up with it, without covering
  // the field; how far the question, list and field move up to keep the
  // focused control clear of the lifted CTA; and, while an hours box is
  // focused with the keyboard up, the row it's in, everything below which
  // fades out.
  const [examplesFit, setExamplesFit] = useState(true);
  const [shift, setShift] = useState(0);
  const [fadeBelow, setFadeBelow] = useState<number | null>(null);
  // The example chip being typed in, and its interval.
  const typing = useRef<{ text: string; timer: ReturnType<typeof setInterval> } | null>(null);
  // The hours box whose field has the focus, by its row's key, so the
  // keyboard fit keeps that box clear of the CTA rather than the goal field.
  const [hoursKey, setHoursKey] = useState<string | null>(null);
  // Each row's box, by key, for Continue to take a typed draft from.
  const hoursRefs = useRef(new Map<string, GoalHoursHandle>());

  const n = goals.length;
  const full = n >= MAX_GOALS;
  const typed = draft.trim().length > 0;
  const keys = goalKeys(goals);
  const { colors, next } = goalColors(rows, goals, goalHours, goalRowIds);
  // The field and its hint fade out (fit, and the list at the cap).
  const fieldHidden = full || fadeBelow !== null;
  const examples = goalExamplesFor(goals);
  const hint = goalHint(n, draft);

  function setDraft(value: string) {
    draftNow.current = value;
    setDraftState(value);
    onDraftChange(value.trim().length > 0);
  }

  // Stops an example mid-typing and returns its full text, or null if none
  // was being typed.
  function stopTyping(): string | null {
    const t = typing.current;
    if (!t) return null;
    clearInterval(t.timer);
    typing.current = null;
    return t.text;
  }

  // The draft to commit. An example still being typed in counts as its whole
  // text, so Return 100ms after a tap adds "Learn Spanish", not "Learn S".
  function takeDraft(): string {
    return (stopTyping() ?? draftNow.current).trim();
  }

  // Hours typed into the boxes and not yet committed, from every box that
  // holds any (the focused one, and one the window took the focus from
  // mid-edit), each handed over by its take().
  function takeHours(): GoalHoursEdit[] {
    const edits: GoalHoursEdit[] = [];
    keys.forEach((key, index) => {
      const hours = hoursRefs.current.get(key)?.take() ?? null;
      if (hours !== null) edits.push({ index, hours });
    });
    return edits;
  }

  // The layout as the keyboard leaves it, and as a very short screen leaves
  // it at rest. On the 852 frame with the prototype's keyboard nothing
  // changes. Where the lifted CTA would cover the focused control (the field
  // on an SE with two goals listed, or the hours box being typed into),
  // everything above the CTA moves up by the overlap, clipped at the top of
  // the screen, as iOS would scroll a page.
  //
  // While an hours box has the focus with the keyboard up, the rows below
  // its own and the field fade out, inert, with the example chips (which are
  // for the field): they'd sit under the lifted CTA, and a lower row's ✕
  // reached into Continue's, a near miss away from removing a goal. They all
  // come back as the box is left or the keyboard goes down.
  //
  // Where only the examples would cover the field, they fade out until
  // there's room: with the keyboard up, or at rest on a screen as short as
  // an SE's in Safari. Measured from layout, not from the moving boxes, so
  // mid-transition values never feed back in.
  function fit(cta: CtaEdge) {
    const field = fieldRef.current;
    const section = topRef.current?.parentElement;
    if (!active || !field || !section || !Number.isFinite(cta.top)) {
      setExamplesFit(true);
      setShift(0);
      setFadeBelow(null);
      return;
    }
    const lifted = cta.lift > 0;
    const at = hoursKey === null ? -1 : keys.indexOf(hoursKey);
    const box =
      lifted && at >= 0
        ? listRef.current?.children[at]?.querySelector<HTMLElement>("[data-goal-hours]")
        : null;
    if (box) {
      const top = layoutTopWithin(box, section);
      const bottom = top + box.offsetHeight;
      setShift(
        Number.isFinite(top)
          ? Math.min(overlapPx(bottom, cta.top, CTA_CLEARANCE_PX), Math.max(0, top))
          : 0
      );
      setExamplesFit(false);
      setFadeBelow(at);
      return;
    }
    setFadeBelow(null);
    const top = layoutTopWithin(field, section) + fieldOffset(n);
    if (!Number.isFinite(top)) {
      setExamplesFit(true);
      setShift(0);
      return;
    }
    const bottom = top + field.offsetHeight;
    // Nothing moves at rest, nor for a field the cap has hidden.
    const up =
      lifted && !full
        ? Math.min(overlapPx(bottom, cta.top, CTA_CLEARANCE_PX), Math.max(0, top))
        : 0;
    setShift(up);
    const railTop = cta.top - EXAMPLES_GAP_PX - (railRef.current?.offsetHeight ?? 0);
    setExamplesFit(up === 0 && overlapPx(bottom, railTop, EXAMPLES_CLEARANCE_PX) === 0);
  }

  // Removing a goal unmounts its row. When focus was in it (its ✕ for a
  // keyboard or switch user, or for anyone its hours field, since a tap on
  // the ✕ keeps the focus where it was, keepFocus), focus goes to the ✕ now
  // in its place, else the one above, else the field, so it isn't dropped on
  // the page.
  //
  // It's let go of first, while the row is still there. The browser blurs a
  // focused field as it's taken out of the page, and an hours draft that
  // committed then would land on the index of the goal that moves into the
  // removed one's place. The row React takes out is the one whose key goes,
  // which is row i unless an identical title below it moves up into its key
  // (goalKeys); focus there is let go of the same way, and goes to the field.
  function remove(i: number) {
    if (busy) return;
    const after = goalKeys(goals.filter((_, k) => k !== i));
    const gone = keys.findIndex((k) => !after.includes(k));
    const holds = (at: number) =>
      listRef.current?.children[at]?.contains(document.activeElement) ?? false;
    const held = holds(i);
    if (!held && !holds(gone)) {
      onRemove(i);
      return;
    }
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    flushSync(() => {
      onRemove(i);
      setHoursKey((k) => (k === keys[gone] ? null : k));
    });
    const left = held
      ? listRef.current?.querySelectorAll<HTMLButtonElement>("[data-goal-remove]")
      : undefined;
    const target = left?.[i] ?? left?.[i - 1];
    if (target) target.focus({ preventScroll: true });
    else focusField(fieldRef.current);
  }

  // Unmount only. stopTyping reads the ref when it runs.
  useEffect(() => {
    return () => {
      stopTyping();
    };
  }, []);

  // Return adds the draft and keeps the field for another. Return on an
  // empty field continues, once there's a goal (R:96, P:918-924), and with
  // none it's invalid input, so the field shakes (R:50; not under reduced
  // motion, R:54). At the cap the field is faded out and inert (and
  // read-only), so no Return reaches it there.
  //
  // The goal that fills the list takes the field out with it, which would
  // drop the focus on the page. So that one hands the focus to its own hours
  // box instead, the one thing on the screen left to set.
  function commit() {
    if (busy) return;
    const text = takeDraft();
    if (!text) {
      if (n > 0) onContinue("", takeHours());
      else play(fieldRowRef.current, motion("shake", reduced));
      return;
    }
    if (full) return;
    if (n + 1 < MAX_GOALS) {
      onAdd(text);
      setDraft("");
      return;
    }
    flushSync(() => {
      onAdd(text);
      setDraft("");
    });
    listRef.current?.lastElementChild
      ?.querySelector<HTMLInputElement>("[data-goal-hours] input")
      ?.focus({ preventScroll: true });
  }

  // Leaving the field adds what's typed, as Return does (OWNER-FIX-2): either
  // one commits a goal, and its hours box comes in under it. Not when it's
  // the window or the app that lost focus, which comes straight back to the
  // field, nor while a save is in flight or the list is full.
  function leaveField(e: FocusEvent<HTMLTextAreaElement>) {
    if (document.activeElement === e.currentTarget || document.hidden || busy || full) return;
    const text = takeDraft();
    if (!text) return;
    onAdd(text);
    setDraft("");
  }

  useImperativeHandle(ref, () => ({
    continue() {
      if (busy) return;
      const text = full ? "" : takeDraft();
      if (text) setDraft("");
      onContinue(text, takeHours());
    },
  }));

  // An example chip focuses the field and types itself in at 20ms a
  // character (R:94), or lands whole under reduced motion (R:54). It replaces
  // whatever was typed, as the prototype's does (P:926-933). The focus is in
  // the tap itself, so it can raise the keyboard.
  function pickExample(text: string) {
    if (busy || full) return;
    stopTyping();
    focusField(fieldRef.current);
    if (reduced) {
      setDraft(text);
      return;
    }
    setDraft("");
    typing.current = { text, timer: typeIn(text, setDraft, stopTyping) };
  }

  // Autofocus on entry (R:39, P:913), unless the list is full. Entry only:
  // re-running on every change would steal focus back from a chip or the
  // remove buttons.
  useEffect(() => {
    if (!active || full) return;
    const t = setTimeout(() => focusField(fieldRef.current), 140);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // A goal added: the new last row rises in (R:92, P:934-939), and its hours
  // box a beat behind it. Not on mount, so goals already saved don't animate
  // in.
  const lastCount = useRef(n);
  useEffect(() => {
    const was = lastCount.current;
    lastCount.current = n;
    if (n <= was) return;
    const last = listRef.current?.lastElementChild;
    play(last, motion("goalRowIn", reduced));
    play(last?.querySelector("[data-goal-hours]"), motion("goalHoursIn", reduced));
  }, [n, reduced]);

  const keyboard = transition(reduced ? TRAVEL.keyboard.reduced : TRAVEL.keyboard.normal);

  return (
    <>
      <KeyboardFit atRest={active} onMeasure={fit} />
      {/* Clipped at the top of the screen only, for the keyboard shift
          (fit): the content never paints over the top row. The item exits
          travel 14px from a 16px top padding, so nothing else is cut. */}
      <div ref={topRef} style={{ clipPath: "inset(0 -100vmax -100vmax)" }}>
        <div
          className="px-5 pt-4"
          style={{ transform: shift ? `translateY(${-shift}px)` : undefined, transition: keyboard }}
        >
          <div className="section-label" style={itemStyle(phase, 0, reduced)}>
            Your goal
          </div>
          <h2
            id="v3-goal-question"
            className="text-ink mt-2.5 font-serif text-[25px] leading-[1.18] font-medium tracking-[-0.015em] text-pretty"
            style={itemStyle(phase, 1, reduced)}
          >
            What&apos;s something you want to put real time toward in the next few months?
          </h2>

          {/* The list and the field share an origin. The field rides below
              the list by transform (420ms E, R:93), so adding or removing a
              goal moves it without reflowing anything. The origin is y=240
              (R:92), 108px under the question's top: its three 29.5px lines,
              then 19.5px. */}
          <div className="relative mt-[19.5px]">
            <div className="absolute inset-x-0 top-0" style={itemStyle(phase, 2, reduced)}>
              {/* role="list": WebKit drops a list-style:none list's semantics,
                  and with them this label and the item count. */}
              <ul ref={listRef} role="list" aria-label="Your goals">
                {goals.map((title, i) => {
                  const key = keys[i];
                  const faded = fadeBelow !== null && i > fadeBelow;
                  return (
                    <li
                      key={key}
                      inert={faded}
                      aria-hidden={faded || undefined}
                      className="border-divider flex h-[92px] flex-col border-b"
                      style={{
                        opacity: faded ? 0 : 1,
                        pointerEvents: faded ? "none" : undefined,
                        transition: "opacity 160ms linear",
                      }}
                    >
                      <div className="flex h-10 shrink-0 items-center gap-2.5">
                        <span
                          aria-hidden
                          className="h-5 w-[3px] shrink-0 rounded-[2px]"
                          style={{ background: colors[i] }}
                        />
                        <span className="text-ink min-w-0 flex-1 truncate font-serif text-[18px] font-medium tracking-[-0.01em]">
                          {title}
                        </span>
                        <button
                          type="button"
                          data-goal-remove
                          aria-label={`Remove “${title}”`}
                          aria-disabled={busy || undefined}
                          onPointerDown={keepFocus}
                          onClick={() => remove(i)}
                          className="text-disabled relative flex size-7 shrink-0 items-center justify-center before:absolute before:-inset-2 before:content-['']"
                        >
                          <XIcon className="size-[13px]" strokeWidth={2.5} />
                        </button>
                      </div>
                      <GoalHours
                        ref={(h) => {
                          if (h) hoursRefs.current.set(key, h);
                          else hoursRefs.current.delete(key);
                        }}
                        title={title}
                        value={goalHoursOrDefault(goalHours[i])}
                        busy={busy}
                        reduced={reduced}
                        onChange={(hours) => onSetHours(i, hours)}
                        onFocusChange={(focused) =>
                          setHoursKey((k) => (focused ? key : k === key ? null : k))
                        }
                      />
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* The field fades out, inert, where it's out of use (fieldHidden):
                at the cap, where "Three is plenty" would sit under Continue on
                a screen as short as an SE's in Safari, and while an hours box
                is being typed into with the keyboard up (fit). It keeps its
                place in the layout, so nothing else moves. */}
            <div style={itemStyle(phase, 3, reduced)}>
              <div
                inert={fieldHidden}
                aria-hidden={fieldHidden || undefined}
                style={{
                  transform: `translateY(${fieldOffset(n)}px)`,
                  opacity: fieldHidden ? 0 : 1,
                  pointerEvents: fieldHidden ? "none" : undefined,
                  transition: reduced
                    ? "opacity 160ms linear"
                    : `transform 420ms ${EASING.E}, opacity 160ms linear`,
                }}
              >
                <div ref={fieldRowRef} className="flex items-start gap-2.5">
                  {/* The next goal's color, while one is being typed (R:93). */}
                  <span
                    aria-hidden
                    className="mt-2 h-[26px] w-[3px] shrink-0 origin-top rounded-[2px]"
                    style={{
                      background: next,
                      opacity: typed ? 1 : 0,
                      transform: `scaleY(${typed || reduced ? 1 : 0.2})`,
                      transition: `opacity 200ms linear, transform 320ms ${EASING.E}`,
                    }}
                  />
                  <textarea
                    ref={fieldRef}
                    value={draft}
                    rows={2}
                    maxLength={GOAL_TITLE_MAX}
                    readOnly={full}
                    onChange={(e) => {
                      if (busy) return;
                      stopTyping();
                      // One line: a pasted newline becomes a space.
                      setDraft(e.target.value.replace(/[\r\n]+/g, " "));
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" || isImeKeyDown(e.nativeEvent)) return;
                      e.preventDefault();
                      commit();
                    }}
                    onBlur={leaveField}
                    aria-labelledby="v3-goal-question"
                    aria-describedby="v3-goal-hint"
                    placeholder={goalPlaceholder(n)}
                    autoComplete="off"
                    autoCapitalize="sentences"
                    spellCheck={false}
                    className="text-ink placeholder:text-disabled m-0 h-[72px] min-w-0 flex-1 resize-none overflow-hidden border-0 bg-transparent p-0 font-serif text-[28px] leading-[1.22] font-medium tracking-[-0.015em] caret-[var(--brand)] outline-none"
                  />
                </div>
                <div
                  id="v3-goal-hint"
                  className="text-caption mt-1 h-4 pl-[13px] text-[11.5px] leading-[1.5] font-medium"
                  style={{ opacity: hint ? 1 : 0, transition: "opacity 200ms linear" }}
                >
                  {hint}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* The examples (R:94): 12px above the CTA, riding up with it when the
          keyboard opens, so they stay in reach while typing. None once three
          goals are in, and never one already added. Faded out wherever they'd
          cover the field, keyboard up or not, and while an hours box is
          being typed into (fit). */}
      <div
        ref={railRef}
        inert={!examplesFit}
        aria-hidden={!examplesFit || undefined}
        className="absolute inset-x-0"
        style={{
          bottom: aboveCta(EXAMPLES_GAP_PX),
          transform: KEYBOARD_LIFT,
          opacity: examplesFit ? 1 : 0,
          pointerEvents: examplesFit ? undefined : "none",
          transition: `${keyboard}, opacity 160ms linear`,
        }}
      >
        <div style={itemStyle(phase, 4, reduced)}>
          <div className="flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {examples.map((text) => (
              <button
                key={text}
                type="button"
                onPointerDown={keepFocus}
                onClick={() => pickExample(text)}
                className="border-control-border text-body h-[34px] shrink-0 rounded-full border-[1.5px] bg-white px-3.5 text-[13px] font-semibold whitespace-nowrap transition-transform active:scale-[.96]"
              >
                {text}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
