"use client";

import { useState } from "react";
import { MinusIcon, PlusIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MAX_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
  clampDurationMinutes,
  formatDuration,
  stepDurationDown,
  stepDurationUp,
} from "@/lib/duration";
import {
  breakFitsTarget,
  estimatedWallClockMs,
  plannedBreakCount,
} from "@/lib/session";

// Break schedules, named the way people say them. "None" is a real choice, not
// an absence — a target with no breaks is a perfectly ordinary way to work.
export const BREAK_PRESETS = {
  none: { label: "None", workIntervalMs: null, breakMs: null },
  "25/5": { label: "25 / 5", workIntervalMs: 25 * 60_000, breakMs: 5 * 60_000 },
  "50/10": { label: "50 / 10", workIntervalMs: 50 * 60_000, breakMs: 10 * 60_000 },
} as const;

export type BreakPreset = keyof typeof BREAK_PRESETS;

// What the stepper starts at when someone switches to a timed session. A real
// value beats an empty box: the control reads as a control, and the clock-in
// button already states the target, so nothing starts by surprise.
export const DEFAULT_DURATION_MINUTES = 60;

const asMinutes = (min: number) => formatDuration(min * 60_000);

// A break preset can only be offered if its interval falls strictly INSIDE the
// target — otherwise the break never fires, and resolvePlan rejects it server
// side. Mirrors that guard so the UI can't compose something the action refuses.
export function presetFitsDuration(
  preset: BreakPreset,
  plannedMinutes: number | null
): boolean {
  const cfg = BREAK_PRESETS[preset];
  if (cfg.workIntervalMs === null) return true;
  if (plannedMinutes === null) return true;
  return breakFitsTarget(cfg.workIntervalMs, plannedMinutes * 60_000);
}

type Props = {
  mode: "open" | "timed";
  onModeChange: (mode: "open" | "timed") => void;
  plannedMinutes: number | null;
  onPlannedMinutesChange: (min: number | null) => void;
  breakPreset: BreakPreset;
  onBreakPresetChange: (preset: BreakPreset) => void;
};

// The clock-in mode chooser: work until you stop, or work to a target with
// optional breaks.
//
// The mode control deliberately reuses the two-button shape the Category/Goal
// toggle uses one row above — same variants, same aria-pressed, same flex-1.
// Someone learns that idiom choosing Category vs Goal and then applies it again
// three seconds later, which beats teaching them a second control.
export function SessionPlanPicker({
  mode,
  onModeChange,
  plannedMinutes,
  onPlannedMinutesChange,
  breakPreset,
  onBreakPresetChange,
}: Props) {
  const timed = mode === "timed";
  const cfg = BREAK_PRESETS[breakPreset];
  const minutes = plannedMinutes ?? DEFAULT_DURATION_MINUTES;

  // While the value is being typed it lives here as a raw string, so a
  // half-finished entry ("4" on the way to "45") isn't clamped out from under
  // the user's fingers. null = not editing.
  const [draft, setDraft] = useState<string | null>(null);

  // The ONLY way the duration changes — both buttons and the typed commit go
  // through it, so the break-preset reset can't be forgotten on one path.
  function setDuration(next: number) {
    onPlannedMinutesChange(next);
    // Stepping down can strand a preset whose interval no longer fits (1h with
    // 50/10, stepped to 50m). The chip disables in the same frame, so the cause
    // is on screen — but the selection has to move or the server would reject
    // a combination this UI itself offered.
    if (!presetFitsDuration(breakPreset, next)) onBreakPresetChange("none");
  }

  function commitDraft() {
    if (draft === null) return;
    const parsed = Number.parseInt(draft, 10);
    // Empty or unparseable reverts to what was there. Clearing the field should
    // never leave the session with no target.
    if (Number.isFinite(parsed)) setDuration(clampDurationMinutes(parsed));
    setDraft(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Button
          type="button"
          variant={!timed ? "secondary" : "outline"}
          className="h-9 flex-1"
          aria-pressed={!timed}
          onClick={() => onModeChange("open")}
        >
          Until I stop
        </Button>
        <Button
          type="button"
          variant={timed ? "secondary" : "outline"}
          className="h-9 flex-1"
          aria-pressed={timed}
          onClick={() => {
            onModeChange("timed");
            // Seed a real target so the stepper never renders empty.
            if (plannedMinutes === null) {
              onPlannedMinutesChange(DEFAULT_DURATION_MINUTES);
            }
          }}
        >
          Set a timer
        </Button>
      </div>

      {timed && (
        <div className="flex flex-col gap-3 pt-1">
          <div className="flex flex-col gap-2">
            <span className="text-caption text-xs font-medium">How long</span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-10 shrink-0"
                aria-label="10 minutes less"
                disabled={minutes <= MIN_DURATION_MINUTES}
                onClick={() => setDuration(stepDurationDown(minutes))}
              >
                <MinusIcon className="size-4" />
              </Button>

              {draft !== null ? (
                <Input
                  autoFocus
                  type="number"
                  inputMode="numeric"
                  step={10}
                  min={MIN_DURATION_MINUTES}
                  max={MAX_DURATION_MINUTES}
                  aria-label="Minutes"
                  className="h-10 flex-1 text-center text-base tabular-nums"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commitDraft}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.currentTarget.blur();
                    }
                    if (e.key === "Escape") setDraft(null);
                  }}
                />
              ) : (
                // The number IS the edit affordance. At 10-minute steps, 1h to
                // 3h is 12 taps and the 10h ceiling is 54 — typing is the
                // escape hatch, so it can't hide behind a small icon.
                <button
                  type="button"
                  className="border-hairline hover:bg-muted/50 h-10 flex-1 rounded-xl border text-center text-base font-medium tabular-nums transition-colors"
                  aria-label={`Work for ${asMinutes(minutes)}. Tap to type a different length`}
                  onClick={() => setDraft(String(minutes))}
                >
                  {asMinutes(minutes)}
                </button>
              )}

              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-10 shrink-0"
                aria-label="10 minutes more"
                disabled={minutes >= MAX_DURATION_MINUTES}
                onClick={() => setDuration(stepDurationUp(minutes))}
              >
                <PlusIcon className="size-4" />
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-caption text-xs font-medium">Breaks</span>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(BREAK_PRESETS) as BreakPreset[]).map((key) => {
                const fits = presetFitsDuration(key, plannedMinutes);
                return (
                  <Badge
                    key={key}
                    variant={breakPreset === key ? "default" : "outline"}
                    className="h-8 cursor-pointer px-3 text-sm tabular-nums disabled:cursor-not-allowed disabled:opacity-40"
                    render={
                      <button
                        type="button"
                        // Disabled rather than hidden: a control that vanishes
                        // when you change something else is more confusing than
                        // one that's visibly unavailable.
                        disabled={!fits}
                        aria-pressed={breakPreset === key}
                        onClick={() => onBreakPresetChange(key)}
                      />
                    }
                  >
                    {BREAK_PRESETS[key].label}
                  </Badge>
                );
              })}
            </div>
          </div>

          {/* Says out loud that the target is WORK time and the wall clock runs
              longer — the one thing people would otherwise guess wrong. */}
          {/* Says out loud that the target is WORK time and the wall clock runs
              longer — the one thing people would otherwise guess wrong. */}
          <p className="text-caption text-xs text-pretty">
            {asMinutes(minutes)} of work
            {cfg.workIntervalMs !== null && cfg.breakMs !== null && (
              <>
                {" · "}
                {cfg.breakMs / 60_000}m break every {cfg.workIntervalMs / 60_000}m
                {" · about "}
                {formatDuration(
                  estimatedWallClockMs(
                    minutes * 60_000,
                    cfg.workIntervalMs,
                    cfg.breakMs
                  )
                )}{" "}
                total
                {plannedBreakCount(minutes * 60_000, cfg.workIntervalMs) === 0 &&
                  " (no break fits)"}
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
