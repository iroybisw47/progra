"use client";

import { useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from "react";
import { CheckIcon } from "lucide-react";

import { themedColor } from "@/lib/colors";
import { isImeKeyDown } from "@/lib/keyboard";
import { itemStyle, motion, play, type ItemPhase } from "@/lib/motion";
import { HABIT_NAME_MAX } from "@/lib/onboarding-v3";
import { V4_HABITS, customHabitColor } from "@/lib/onboarding-v4";
import { normalizeMatchText } from "@/lib/uw";

// Screen 03, "Add daily habits." (R:89-97): v2's habits step in the v3 shell.
// Four preset tiles, any typed through "Or add your own…" appended after
// them, each with its color. The CTA ("Save habit(s)") and the skip link are
// the shell's; this screen tells it whether anything is typed, and its
// continue() hands over what is, to be added and selected before the save.

export type HabitsScreenHandle = { continue: () => void };

// The scroll area ends this far above the screen's bottom, clear of the CTA
// and the skip link (R:91).
const SCROLL_BOTTOM_PX = 108;

// The checkbox's border while off (R:93): the app's dash grey.
const CHECK_OFF = "var(--dash)";

export function HabitsScreen({
  ref,
  phase,
  reduced,
  eyebrow,
  habits,
  customHabits,
  busy,
  initialDraft,
  onToggle,
  onAddCustom,
  onDraftChange,
  onContinue,
}: {
  ref?: Ref<HabitsScreenHandle>;
  phase: ItemPhase;
  reduced: boolean;
  // "Step 3 of 8" (lib/onboarding-v4.ts, stepEyebrow).
  eyebrow: string;
  habits: readonly string[]; // selected, in pick order
  customHabits: readonly string[];
  // A save is in flight: the tiles are frozen until it settles.
  busy: boolean;
  // Dev preview only: the field opens with this typed in.
  initialDraft?: string;
  onToggle: (name: string) => void;
  onAddCustom: (name: string) => void;
  // Whether the field holds anything, for the CTA (R:97).
  onDraftChange: (hasDraft: boolean) => void;
  // "Save habit(s)", with `custom` (possibly empty) added and selected first.
  onContinue: (custom: string) => void;
}) {
  const [draft, setDraftState] = useState(initialDraft ?? "");
  const gridRef = useRef<HTMLDivElement>(null);
  // A typed habit that became a new tile, to pop in once it has rendered.
  const popKey = useRef<string | null>(null);

  const tiles = [
    ...V4_HABITS,
    ...customHabits.map((name, k) => ({ name, color: customHabitColor(k) })),
  ];
  const selected = new Set(habits);

  function setDraft(value: string) {
    setDraftState(value);
    onDraftChange(value.trim().length > 0);
  }

  function tileFor(name: string): HTMLElement | undefined {
    const key = normalizeMatchText(name);
    return Array.from(gridRef.current?.querySelectorAll<HTMLElement>("[data-habit]") ?? []).find(
      (el) => normalizeMatchText(el.dataset.habit ?? "") === key
    );
  }

  // Select: the tile pops (scale .9 → 1.08 → 1, 340ms) and its check pops in.
  // Deselect: a small release, .94 → 1 over 220ms (R:95).
  function toggle(name: string) {
    if (busy) return;
    const on = selected.has(name);
    const tile = tileFor(name);
    if (on) play(tile, motion("chipRelease", reduced));
    else play(tile, motion("pop", reduced));
    onToggle(name);
  }

  // "+ Add" or Return: the typed habit joins the grid, selected, and pops in
  // (R:96). One a tile already has, ignoring case, selects that tile instead.
  function add() {
    if (busy) return;
    const name = draft.trim();
    if (!name) return;
    const key = normalizeMatchText(name);
    const existing = tiles.find((t) => normalizeMatchText(t.name) === key);
    if (existing) {
      if (!selected.has(existing.name)) toggle(existing.name);
    } else {
      popKey.current = key;
      onAddCustom(name);
    }
    setDraft("");
  }

  useLayoutEffect(() => {
    const key = popKey.current;
    if (!key) return;
    popKey.current = null;
    play(tileFor(key), motion("bigPop", reduced));
  });

  useImperativeHandle(ref, () => ({
    continue() {
      if (busy) return;
      const text = draft.trim();
      if (text) setDraft("");
      onContinue(text);
    },
  }));

  return (
    <div
      className="absolute inset-x-0 top-0 overflow-y-auto overscroll-contain px-6"
      style={{ bottom: SCROLL_BOTTOM_PX }}
    >
      <div className="mx-auto flex max-w-[420px] flex-col gap-[18px] pt-[18px] pb-6">
        <span className="section-label" style={itemStyle(phase, 0, reduced)}>
          {eyebrow}
        </span>
        <h2
          className="text-ink font-serif text-[30px] leading-[1.12] font-medium tracking-[-0.02em]"
          style={itemStyle(phase, 1, reduced)}
        >
          Add daily habits.
        </h2>
        <p
          className="text-secondary-ink text-[14px] leading-[1.6] text-pretty"
          style={itemStyle(phase, 2, reduced)}
        >
          Small daily habits compound. They keep you moving on the days you can&apos;t put in
          hours, and your friends see your streak right next to your goals.
        </p>

        <div className="flex flex-col gap-[7px]" style={itemStyle(phase, 3, reduced)}>
          <span className="section-label" id="v4-habits-pick">
            Pick a few
          </span>
          <div
            ref={gridRef}
            role="group"
            aria-labelledby="v4-habits-pick"
            className="grid grid-cols-2 gap-2"
          >
            {tiles.map((t) => {
              const on = selected.has(t.name);
              const color = themedColor(t.color);
              return (
                <button
                  key={t.name}
                  type="button"
                  data-habit={t.name}
                  aria-pressed={on}
                  aria-disabled={busy || undefined}
                  onClick={() => toggle(t.name)}
                  className="text-body flex min-w-0 items-center gap-[7px] rounded-[12px] border-[1.5px] bg-white px-2.5 py-[9px] text-[12.5px] font-semibold transition-[border-color] duration-150 active:scale-[.96]"
                  style={{ borderColor: on ? color : "var(--control-border)" }}
                >
                  <span
                    aria-hidden
                    className="flex size-[18px] shrink-0 items-center justify-center rounded-[6px] border-[1.5px] text-white transition-colors duration-150"
                    style={{
                      borderColor: on ? color : CHECK_OFF,
                      backgroundColor: on ? color : "transparent",
                    }}
                  >
                    {on && (
                      <CheckIcon
                        className="size-3 animate-[check-pop_.25s_ease_both]"
                        strokeWidth={3.2}
                      />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-left">{t.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-end gap-2" style={itemStyle(phase, 4, reduced)}>
          <input
            aria-label="Add your own habit"
            className="text-ink border-hairline placeholder:text-disabled focus:border-brand min-w-0 flex-1 border-b-2 bg-transparent pb-2 text-[15px] font-medium transition-colors outline-none"
            placeholder="Or add your own…"
            maxLength={HABIT_NAME_MAX}
            value={draft}
            autoCapitalize="sentences"
            autoComplete="off"
            onChange={(e) => {
              if (!busy) setDraft(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || isImeKeyDown(e.nativeEvent)) return;
              e.preventDefault();
              add();
            }}
          />
          <button
            type="button"
            onClick={add}
            aria-disabled={busy || undefined}
            className="border-hairline text-brand hover:border-brand h-[34px] shrink-0 rounded-[11px] border-[1.5px] px-3 text-[12px] font-semibold transition-colors"
          >
            + Add
          </button>
        </div>
      </div>
    </div>
  );
}
