"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { sendRally } from "@/app/actions/rally";
import { CategoryMarker } from "@/components/category-marker";
import { BottomSheet, BottomSheetContent } from "@/components/v2/bottom-sheet";
import { MenuRow } from "@/components/v2/menu-row";
import { track } from "@/lib/analytics";
import {
  NUDGE_PRESETS,
  NUDGE_PRESET_KEYS,
  PRAISE_PRESETS,
  PRAISE_PRESET_KEYS,
  type NudgePresetKey,
  type PraisePresetKey,
} from "@/lib/social/nudges";
import {
  goalPaceMeta,
  rallyRefusalMessage,
  type RallyHabit,
  type RallyGoal,
  type RallyKind,
  type RallyMode,
  type RallyState,
} from "@/lib/social/rally";

type Target =
  | { kind: "habit"; habit: RallyHabit }
  | { kind: "goal"; goal: RallyGoal }
  | { kind: "streak"; current: number };

type Step =
  | { at: "mode" }
  | { at: "target"; mode: RallyMode }
  | { at: "preset"; mode: RallyMode; target: Target };

export type RallySend = (input: {
  kind: RallyKind;
  targetId: string | null;
  preset: NudgePresetKey | PraisePresetKey;
}) => Promise<void>;

const targetId = (t: Target) =>
  t.kind === "habit" ? t.habit.habitId : t.kind === "goal" ? t.goal.goalId : null;

const targetLabel = (t: Target) =>
  t.kind === "habit" ? t.habit.name : t.kind === "goal" ? t.goal.title : "Streak";

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

// Three taps: Cheer or Nudge, then what about, then what to say. Preset
// messages only, like Nudge: a push body is unfilterable, and the presets are
// what keep it one-tap.
//
// The database offers at most one mode (rally_targets), so step 1 always shows
// both rows and dims the one that's closed, with why in its meta: that's how
// the rule ("cheer once they've clocked in and finished something") gets
// learned without a help screen.
export function RallySheet({
  open,
  onOpenChange,
  state,
  recipientId,
  name,
  onSend,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: Extract<RallyState, { status: "ok" }>;
  recipientId: string;
  name: string;
  // Dev preview only: replaces the real send.
  onSend?: RallySend;
}) {
  const [step, setStep] = useState<Step>({ at: "mode" });
  const [pending, startTransition] = useTransition();

  const cheerTargets: Target[] = (state.cheer?.habits ?? []).map((habit) => ({
    kind: "habit",
    habit,
  }));
  const nudge = state.nudge;
  // Streak first (it's the one with a clock on it), then goals, then habits.
  const nudgeTargets: Target[] = nudge
    ? [
        ...(nudge.streak ? [{ kind: "streak" as const, current: nudge.streak.current }] : []),
        ...nudge.goals.map((goal): Target => ({ kind: "goal", goal })),
        ...nudge.habits.map((habit): Target => ({ kind: "habit", habit })),
      ]
    : [];

  function choose(mode: RallyMode) {
    track("rally_mode_chosen", { mode });
    setStep({ at: "target", mode });
  }

  function send(mode: RallyMode, target: Target, preset: NudgePresetKey | PraisePresetKey) {
    startTransition(async () => {
      if (onSend) {
        await onSend({ kind: target.kind, targetId: targetId(target), preset });
        onOpenChange(false);
        return;
      }
      const result = await sendRally({
        recipientId,
        kind: target.kind,
        targetId: targetId(target),
        preset,
      });

      if ("error" in result) {
        toast.error(rallyRefusalMessage(result, name, Date.now()));
        track("rally_rejected", { reason: result.reason });
        onOpenChange(false);
        return;
      }

      toast.success(mode === "cheer" ? `Cheered ${name} on` : `Nudged ${name}`);
      track("rally_sent", {
        nudge_id: result.nudgeId,
        mode,
        kind: target.kind,
        preset,
        pushed: result.pushed,
      });
      // No router.refresh(): the action's revalidation delivers the cooldown
      // state in the same POST.
      onOpenChange(false);
    });
  }

  const title =
    step.at === "mode"
      ? `Rally ${name}`
      : step.at === "target"
        ? step.mode === "cheer"
          ? `Cheer ${name} on`
          : `Nudge ${name}`
        : "Say what?";

  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setStep({ at: "mode" });
      }}
    >
      <BottomSheetContent
        title={title}
        meta={step.at === "preset" ? targetLabel(step.target) : undefined}
      >
        <div className="flex flex-col pb-1">
          {step.at === "mode" && (
            <>
              <MenuRow
                label="Cheer"
                meta={
                  state.cheer
                    ? `${plural(state.cheer.habits.length, "habit")} done today`
                    : "once they clock in and finish a habit"
                }
                disabled={!state.cheer}
                onClick={() => choose("cheer")}
              />
              <MenuRow
                label="Nudge"
                meta={nudge ? plural(nudgeTargets.length, "thing") + " to nudge" : "they're on a roll"}
                disabled={!nudge}
                onClick={() => choose("nudge")}
              />
            </>
          )}

          {step.at === "target" &&
            (step.mode === "cheer" ? cheerTargets : nudgeTargets).map((target) => {
              const pick = () => setStep({ at: "preset", mode: step.mode, target });
              switch (target.kind) {
                case "streak":
                  return (
                    <MenuRow
                      key="streak"
                      label="Streak"
                      meta={`${target.current}-day streak at risk`}
                      onClick={pick}
                    />
                  );
                case "goal":
                  return (
                    <MenuRow
                      key={target.goal.goalId}
                      label={`Goal · ${target.goal.title}`}
                      meta={goalPaceMeta(target.goal)}
                      marker={<CategoryMarker isGoal color={target.goal.color} />}
                      onClick={pick}
                    />
                  );
                case "habit":
                  return (
                    <MenuRow
                      key={target.habit.habitId}
                      label={step.mode === "cheer" ? target.habit.name : `Habit · ${target.habit.name}`}
                      meta={step.mode === "cheer" ? "done today" : "not done today"}
                      marker={<CategoryMarker isGoal={false} color={target.habit.color} />}
                      onClick={pick}
                    />
                  );
              }
            })}

          {step.at === "preset" &&
            (step.mode === "cheer"
              ? PRAISE_PRESET_KEYS.map((key) => (
                  <MenuRow
                    key={key}
                    label={PRAISE_PRESETS[key]}
                    disabled={pending}
                    onClick={() => send(step.mode, step.target, key)}
                  />
                ))
              : NUDGE_PRESET_KEYS.map((key) => (
                  <MenuRow
                    key={key}
                    label={NUDGE_PRESETS[key]}
                    disabled={pending}
                    onClick={() => send(step.mode, step.target, key)}
                  />
                )))}
        </div>
      </BottomSheetContent>
    </BottomSheet>
  );
}
