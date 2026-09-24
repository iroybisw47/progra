"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { sendNudge } from "@/app/actions/nudges";
import { CategoryMarker } from "@/components/category-marker";
import { BottomSheet, BottomSheetContent } from "@/components/v2/bottom-sheet";
import { MenuRow } from "@/components/v2/menu-row";
import { track } from "@/lib/analytics";
import {
  NUDGE_PRESETS,
  NUDGE_PRESET_KEYS,
  PRAISE_PRESETS,
  PRAISE_PRESET_KEYS,
  nudgeRefusalMessage,
  type NudgeGoalTarget,
  type NudgePraiseGoal,
  type NudgePresetKey,
  type NudgeState,
  type PraisePresetKey,
} from "@/lib/social/nudges";

// A target carries its own half, because the presets shown in step 2 — and the
// list the database checks the send against — follow from it.
type Target =
  | { kind: "goal"; goal: NudgeGoalTarget }
  | { kind: "habits"; left: number; total: number }
  | { kind: "praise-goal"; goal: NudgePraiseGoal }
  | { kind: "praise-habits"; total: number };

const isPraiseTarget = (t: Target) =>
  t.kind === "praise-goal" || t.kind === "praise-habits";

// What the database wants: praise still targets a `goal` or `habits`; the
// preset carries the tone.
const sendKind = (t: Target) =>
  t.kind === "goal" || t.kind === "praise-goal" ? "goal" : "habits";

// Two taps: pick what they're behind on, pick what to say. No free text in v1 —
// a push body is unfilterable, and "nudge" works BECAUSE it's one tap.
export function NudgeSheet({
  open,
  onOpenChange,
  state,
  recipientId,
  name,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: Extract<NudgeState, { status: "ok" }>;
  recipientId: string;
  name: string;
}) {
  const [target, setTarget] = useState<Target | null>(null);
  const [pending, startTransition] = useTransition();

  // Praise first: when someone has just finished something, that's the thing
  // worth reacting to, and the prods below it are for whatever's still open.
  const targets: Target[] = [
    ...(state.praise?.habitsDone
      ? [{ kind: "praise-habits" as const, total: state.praise.habitsDone }]
      : []),
    ...(state.praise?.goals ?? []).map(
      (goal): Target => ({ kind: "praise-goal", goal })
    ),
    ...state.goals.map((goal): Target => ({ kind: "goal", goal })),
    ...(state.habits
      ? [{ kind: "habits" as const, left: state.habits.left, total: state.habits.total }]
      : []),
  ];

  const hasPraise = targets.some(isPraiseTarget);

  function send(chosen: Target, preset: NudgePresetKey | PraisePresetKey) {
    startTransition(async () => {
      const result = await sendNudge({
        recipientId,
        kind: sendKind(chosen),
        goalId:
          chosen.kind === "goal" || chosen.kind === "praise-goal"
            ? chosen.goal.goalId
            : null,
        preset,
      });

      if ("error" in result) {
        // Re-render the action's name-free copy with the friend's actual name
        // and the exact wait — the action only knows ids.
        toast.error(nudgeRefusalMessage(result, name, Date.now()));
        track("nudge_rejected", { reason: result.reason });
        onOpenChange(false);
        return;
      }

      toast.success(
        isPraiseTarget(chosen) ? `Cheered ${name} on` : `Nudged ${name}`
      );
      track("nudge_sent", {
        kind: chosen.kind,
        preset,
        pushed: result.pushed,
      });
      // No router.refresh(): the action's revalidation delivers the cooldown
      // state in the same POST.
      onOpenChange(false);
    });
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setTarget(null);
      }}
    >
      <BottomSheetContent
        title={
          target === null
            ? hasPraise && targets.every(isPraiseTarget)
              ? `Cheer ${name} on`
              : `Nudge ${name}`
            : "Say what?"
        }
        meta={
          target === null
            ? undefined
            : target.kind === "goal" || target.kind === "praise-goal"
              ? target.goal.title
              : "Habits"
        }
      >
        <div className="flex flex-col pb-1">
          {target === null
            ? targets.map((entry) => {
                switch (entry.kind) {
                  case "praise-habits":
                    return (
                      <MenuRow
                        key="praise-habits"
                        label="Habits"
                        meta={`all ${entry.total} done today`}
                        onClick={() => setTarget(entry)}
                      />
                    );
                  case "praise-goal":
                    return (
                      <MenuRow
                        key={`praise-${entry.goal.goalId}`}
                        label={`Goal · ${entry.goal.title}`}
                        meta={
                          entry.goal.band === "hit"
                            ? "quota hit this week"
                            : "nearly at quota"
                        }
                        marker={<CategoryMarker isGoal color={entry.goal.color} />}
                        onClick={() => setTarget(entry)}
                      />
                    );
                  case "goal":
                    return (
                      <MenuRow
                        key={entry.goal.goalId}
                        label={`Goal · ${entry.goal.title}`}
                        marker={<CategoryMarker isGoal color={entry.goal.color} />}
                        onClick={() => setTarget(entry)}
                      />
                    );
                  case "habits":
                    return (
                      <MenuRow
                        key="habits"
                        label="Habits"
                        meta={`${entry.left} of ${entry.total} left today`}
                        onClick={() => setTarget(entry)}
                      />
                    );
                }
              })
            : isPraiseTarget(target)
              ? PRAISE_PRESET_KEYS.map((key) => (
                  <MenuRow
                    key={key}
                    label={PRAISE_PRESETS[key]}
                    disabled={pending}
                    onClick={() => send(target, key)}
                  />
                ))
              : NUDGE_PRESET_KEYS.map((key) => (
                  <MenuRow
                    key={key}
                    label={NUDGE_PRESETS[key]}
                    disabled={pending}
                    onClick={() => send(target, key)}
                  />
                ))}
        </div>
      </BottomSheetContent>
    </BottomSheet>
  );
}
