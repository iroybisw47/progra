"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { estimatedWallClockMs, plannedBreakCount } from "@/lib/session";

// Break schedules, named the way people say them. "None" is a real choice, not
// an absence — a target with no breaks is a perfectly ordinary way to work.
export const BREAK_PRESETS = {
  none: { label: "None", workIntervalMs: null, breakMs: null },
  "25/5": { label: "25 / 5", workIntervalMs: 25 * 60_000, breakMs: 5 * 60_000 },
  "50/10": { label: "50 / 10", workIntervalMs: 50 * 60_000, breakMs: 10 * 60_000 },
} as const;

export type BreakPreset = keyof typeof BREAK_PRESETS;

// Five options cover essentially every study session. Deliberately no custom
// field: every extra input is a decision standing between someone and starting
// work, and the common path here should be two taps.
const DURATIONS_MIN = [30, 60, 90, 120, 180] as const;

function formatDuration(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${m}`;
}

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
  return cfg.workIntervalMs < plannedMinutes * 60_000;
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

  // Changing the duration can strand a break preset that no longer fits (pick
  // 1h + 50/10, drop to 30m). Reset it here rather than letting the server
  // reject a combination the UI itself offered.
  function selectDuration(min: number) {
    const next = plannedMinutes === min ? null : min;
    onPlannedMinutesChange(next);
    if (next !== null && !presetFitsDuration(breakPreset, next)) {
      onBreakPresetChange("none");
    }
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
          onClick={() => onModeChange("timed")}
        >
          Set a timer
        </Button>
      </div>

      {timed && (
        <div className="flex flex-col gap-3 pt-1">
          <div className="flex flex-col gap-2">
            <span className="text-caption text-xs font-medium">How long</span>
            <div className="flex flex-wrap gap-2">
              {DURATIONS_MIN.map((min) => (
                <Badge
                  key={min}
                  variant={plannedMinutes === min ? "default" : "outline"}
                  className="h-8 cursor-pointer px-3 text-sm tabular-nums"
                  render={
                    <button
                      type="button"
                      aria-pressed={plannedMinutes === min}
                      onClick={() => selectDuration(min)}
                    />
                  }
                >
                  {formatDuration(min)}
                </Badge>
              ))}
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
          {plannedMinutes !== null && (
            <p className="text-caption text-xs text-pretty">
              {formatDuration(plannedMinutes)} of work
              {cfg.workIntervalMs !== null && cfg.breakMs !== null && (
                <>
                  {" · "}
                  {cfg.breakMs / 60_000}m break every {cfg.workIntervalMs / 60_000}m
                  {" · about "}
                  {formatDuration(
                    Math.round(
                      estimatedWallClockMs(
                        plannedMinutes * 60_000,
                        cfg.workIntervalMs,
                        cfg.breakMs
                      ) / 60_000
                    )
                  )}{" "}
                  total
                  {plannedBreakCount(
                    plannedMinutes * 60_000,
                    cfg.workIntervalMs
                  ) === 0 && " (no break fits)"}
                </>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
