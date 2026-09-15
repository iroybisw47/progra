"use client";

import { ChevronDownIcon, ClockIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  SIM_REALTIME_MS,
  SIM_TARGET_MS,
  SIM_TOTAL_MS,
  clockSimValue,
  formatSim,
  goalDisplay,
} from "@/lib/onboarding";

import { CARD, Field, StepTemplate, UNDERLINE_INPUT } from "../onboarding-ui";

// Step 4 (practice). A fake clock-in: the timer ticks at true speed for 1.5s
// so it reads as a real one, then fast-forwards to 25:00 and moves on by
// itself. Writes nothing. The simulation is this component's own state, so
// leaving the step (Back) ends it rather than letting it advance whatever
// step you're on next.
export function ClockStep({
  eyebrow,
  goalTitle,
  goalColor,
  task,
  onTask,
  onRunningChange,
  onDone,
}: {
  eyebrow: string | null;
  goalTitle: string;
  goalColor: string;
  task: string;
  onTask: (v: string) => void;
  onRunningChange: (running: boolean) => void;
  onDone: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [sim, setSim] = useState(0);
  const [fast, setFast] = useState(false);
  // The latest onDone, read from inside the interval, so a parent re-render
  // (which hands down a new function) doesn't restart the timer.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    if (!running) return;
    const t0 = Date.now();
    const id = setInterval(() => {
      const real = Date.now() - t0;
      const value = clockSimValue(real);
      if (real >= SIM_REALTIME_MS) setFast(true);
      if (real >= SIM_TOTAL_MS || value >= SIM_TARGET_MS) {
        clearInterval(id);
        setSim(SIM_TARGET_MS);
        onDoneRef.current();
      } else {
        setSim(value);
      }
    }, 100);
    return () => clearInterval(id);
  }, [running]);

  function start() {
    setRunning(true);
    onRunningChange(true);
  }

  const display = goalDisplay(goalTitle);

  return (
    <StepTemplate
      eyebrow={eyebrow}
      title="Try clocking in."
      body="Name the session, pick your goal, and go! This one's 25 minutes, but we will fast forward it."
    >
      <div className={`${CARD} flex flex-col gap-3.5 p-4`}>
        {!running ? (
          <>
            <Field label="Name this session">
              <input
                className={UNDERLINE_INPUT}
                placeholder="What are you working on?"
                value={task}
                onChange={(e) => onTask(e.target.value)}
              />
            </Field>
            <div className="flex gap-2">
              <span className="border-control-border text-body flex h-[38px] min-w-0 flex-1 items-center justify-center gap-[7px] rounded-[12px] border-[1.5px] px-2.5 text-[12.5px] font-semibold">
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: goalColor }}
                />
                <span className="truncate">{display}</span>
                <ChevronDownIcon className="text-disabled size-3 shrink-0" strokeWidth={2.4} />
              </span>
              <span className="border-control-border text-body flex h-[38px] shrink-0 items-center gap-[7px] rounded-[12px] border-[1.5px] px-3 text-[12.5px] font-semibold">
                <ClockIcon className="text-caption size-[13px]" strokeWidth={2} />
                25m
              </span>
            </div>
            <button
              type="button"
              onClick={start}
              className="bg-brand text-primary-foreground h-[50px] w-full rounded-[14px] text-[15px] font-semibold shadow-[0_10px_22px_-10px_rgba(28,58,94,.55)] transition-transform active:scale-[.98]"
            >
              Clock in for 25m
            </button>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <span className="stat-num text-[52px] leading-[0.95]">{formatSim(sim)}</span>
              <div className="flex items-center gap-[7px] pt-2">
                <span
                  aria-hidden
                  className="size-2 shrink-0 animate-[pulse-dot_1.6s_infinite] rounded-full"
                  style={{ backgroundColor: goalColor }}
                />
                <span className="text-body truncate text-[13px] font-semibold">
                  {task.trim() || display}
                </span>
                <span className="flex-1" />
                <span className="text-faint text-xs whitespace-nowrap">25m target</span>
              </div>
            </div>
            <div className="bg-track h-2 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full transition-[width] duration-100 ease-linear"
                style={{
                  width: `${Math.min(100, (sim / SIM_TARGET_MS) * 100)}%`,
                  backgroundColor: goalColor,
                }}
              />
            </div>
            <span className="text-caption text-center text-xs font-medium">
              {fast
                ? "Fast-forwarding — you get the idea."
                : "It's running. Sit back — we'll fast-forward this one."}
            </span>
          </>
        )}
      </div>
    </StepTemplate>
  );
}
