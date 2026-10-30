"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ChevronDownIcon, ClockIcon } from "lucide-react";

import { themedColor } from "@/lib/colors";
import { itemStyle, type ItemPhase } from "@/lib/motion";
import { formatSim } from "@/lib/onboarding";
import {
  PRACTICE_HOLD_MS,
  PRACTICE_NAME,
  PRACTICE_REALTIME_MS,
  PRACTICE_TARGET_MS,
  PRACTICE_TOTAL_MS,
  practiceElapsed,
  practiceName,
  type FirstGoal,
} from "@/lib/onboarding-v4";

import { CARD, UNDERLINE_INPUT } from "../onboarding-ui";

// Screen 05, "Try clocking in." (R:116-123): v2's practice clock-in in the v3
// shell. Name the session (prefilled "Practice"), see goal 1 and the 25m
// target, and Clock in: the timer runs in real time for 1.5s, eases out to
// 25:00 over 1.8s, holds 500ms and moves on to the post by itself. The CTA is
// the shell's, disabled throughout. Nothing is saved.
//
// The timer is this screen's own state, so leaving it (Back) stops it rather
// than letting it carry whatever screen is in front onward. Coming back finds
// the card ready to clock in again.

// The running card's pieces rise in at 0, .08 and .16s (R:120).
const rise = (delay: string): CSSProperties => ({ "--rise-delay": delay }) as CSSProperties;

export function PracticeClockScreen({
  phase,
  reduced,
  eyebrow,
  goal,
  onRunning,
  onStart,
  onDone,
}: {
  phase: ItemPhase;
  reduced: boolean;
  // "Step 5 of 8 · Practice" (lib/onboarding-v4.ts, stepEyebrow).
  eyebrow: string;
  goal: FirstGoal;
  // For the shell's CTA: "Clocking in…" while it runs.
  onRunning: (running: boolean) => void;
  // The session's name as Clock in takes it, for the post.
  onStart: (name: string) => void;
  // 25:00 reached and held.
  onDone: () => void;
}) {
  const active = phase === "active";
  const [task, setTask] = useState(PRACTICE_NAME);
  // When Clock in was pressed (performance.now()), or null while idle.
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [sim, setSim] = useState(0);
  const [fast, setFast] = useState(false);
  const onDoneRef = useRef(onDone);
  const onRunningRef = useRef(onRunning);
  useEffect(() => {
    onDoneRef.current = onDone;
    onRunningRef.current = onRunning;
  });

  // Left mid-run, or after it: the card goes back to idle, ready to clock in
  // again, rather than running on behind the next screen.
  const [wasActive, setWasActive] = useState(active);
  if (wasActive !== active) {
    setWasActive(active);
    if (!active && startedAt !== null) {
      setStartedAt(null);
      setSim(0);
      setFast(false);
    }
  }

  useEffect(() => {
    if (startedAt === null) return;
    let hold: ReturnType<typeof setTimeout> | null = null;
    const id = setInterval(() => {
      const real = performance.now() - startedAt;
      if (real >= PRACTICE_REALTIME_MS) setFast(true);
      if (real >= PRACTICE_TOTAL_MS) {
        clearInterval(id);
        setSim(PRACTICE_TARGET_MS);
        hold = setTimeout(() => onDoneRef.current(), PRACTICE_HOLD_MS);
      } else {
        setSim(practiceElapsed(real));
      }
    }, 50);
    return () => {
      clearInterval(id);
      if (hold) clearTimeout(hold);
      onRunningRef.current(false);
    };
  }, [startedAt]);

  function start() {
    if (startedAt !== null || !active) return;
    (document.activeElement as HTMLElement | null)?.blur?.();
    onStart(practiceName(task));
    onRunning(true);
    setStartedAt(performance.now());
  }

  const running = startedAt !== null;
  const color = themedColor(goal.color);

  return (
    <div className="absolute inset-x-0 top-0 bottom-[108px] overflow-y-auto overscroll-contain px-6">
      <div className="mx-auto flex max-w-[420px] flex-col gap-[18px] pt-[18px] pb-6">
        <span className="section-label" style={itemStyle(phase, 0, reduced)}>
          {eyebrow}
        </span>
        <h2
          className="text-ink font-serif text-[30px] leading-[1.12] font-medium tracking-[-0.02em]"
          style={itemStyle(phase, 1, reduced)}
        >
          Try clocking in.
        </h2>
        <p
          className="text-secondary-ink text-[14px] leading-[1.6] text-pretty"
          style={itemStyle(phase, 2, reduced)}
        >
          Name the session, pick your goal, and go! This one&apos;s 25 minutes, but we will fast
          forward it.
        </p>

        <div className={`${CARD} flex flex-col gap-3.5 p-4`} style={itemStyle(phase, 3, reduced)}>
          {!running ? (
            <>
              <div className="flex flex-col gap-[7px]">
                <label htmlFor="v4-practice-name" className="section-label">
                  Name this session
                </label>
                <input
                  id="v4-practice-name"
                  className={UNDERLINE_INPUT}
                  placeholder="What are you working on?"
                  value={task}
                  maxLength={80}
                  autoComplete="off"
                  onChange={(e) => setTask(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      start();
                    }
                  }}
                />
              </div>
              <div className="flex gap-2">
                <span className="border-control-border text-body flex h-[38px] min-w-0 flex-1 items-center justify-center gap-[7px] rounded-[12px] border-[1.5px] px-2.5 text-[12.5px] font-semibold">
                  <span aria-hidden className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: color }} />
                  <span className="truncate">{goal.title}</span>
                  <ChevronDownIcon aria-hidden className="text-disabled size-3 shrink-0" strokeWidth={2.4} />
                </span>
                <span className="border-control-border text-body flex h-[38px] shrink-0 items-center gap-[7px] rounded-[12px] border-[1.5px] px-3 text-[12.5px] font-semibold">
                  <ClockIcon aria-hidden className="text-caption size-[13px]" strokeWidth={2} />
                  25m
                </span>
              </div>
              <button
                type="button"
                onClick={start}
                className="bg-brand text-primary-foreground h-[50px] w-full rounded-[14px] text-[15px] font-semibold shadow-[0_10px_22px_-10px_var(--glow)] transition-transform active:scale-[.98]"
              >
                Clock in for 25m
              </button>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <span
                  className="text-ink rise font-serif text-[52px] leading-[0.95] font-medium tracking-[-0.03em] tabular-nums"
                  style={rise("0s")}
                  role="timer"
                >
                  {formatSim(sim)}
                </span>
                <div className="rise flex items-center gap-[7px] pt-2" style={rise(".08s")}>
                  <span
                    aria-hidden
                    className="size-2 shrink-0 animate-[pulse-dot_1.6s_infinite] rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-body truncate text-[13px] font-semibold">
                    {practiceName(task)}
                  </span>
                  <span className="flex-1" />
                  <span className="text-faint text-[12px] whitespace-nowrap">25m target</span>
                </div>
              </div>
              <div className="rise flex flex-col gap-3.5" style={rise(".16s")}>
                <div className="bg-track h-2 overflow-hidden rounded-full">
                  <div
                    className="h-full origin-left rounded-full"
                    style={{
                      transform: `scaleX(${Math.min(1, sim / PRACTICE_TARGET_MS)})`,
                      backgroundColor: color,
                    }}
                  />
                </div>
                <span className="text-caption text-center text-[12px] font-medium" aria-live="polite">
                  {fast
                    ? "Fast-forwarding — you get the idea."
                    : "It’s running. Sit back — we’ll fast-forward this one."}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
