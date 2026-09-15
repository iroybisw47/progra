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
  nudgeRefusalMessage,
  type NudgeGoalTarget,
  type NudgePresetKey,
  type NudgeState,
} from "@/lib/social/nudges";

type Target =
  | { kind: "goal"; goal: NudgeGoalTarget }
  | { kind: "habits"; left: number; total: number };

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

  const targets: Target[] = [
    ...state.goals.map((goal): Target => ({ kind: "goal", goal })),
    ...(state.habits
      ? [{ kind: "habits" as const, left: state.habits.left, total: state.habits.total }]
      : []),
  ];

  function send(chosen: Target, preset: NudgePresetKey) {
    startTransition(async () => {
      const result = await sendNudge({
        recipientId,
        kind: chosen.kind,
        goalId: chosen.kind === "goal" ? chosen.goal.goalId : null,
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

      toast.success(`Nudged ${name}`);
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
        title={target === null ? `Nudge ${name}` : "Say what?"}
        meta={
          target === null
            ? undefined
            : target.kind === "goal"
              ? target.goal.title
              : "Habits"
        }
      >
        <div className="flex flex-col pb-1">
          {target === null
            ? targets.map((entry) =>
                entry.kind === "goal" ? (
                  <MenuRow
                    key={entry.goal.goalId}
                    label={`Goal · ${entry.goal.title}`}
                    marker={<CategoryMarker isGoal color={entry.goal.color} />}
                    onClick={() => setTarget(entry)}
                  />
                ) : (
                  <MenuRow
                    key="habits"
                    label="Habits"
                    meta={`${entry.left} of ${entry.total} left today`}
                    onClick={() => setTarget(entry)}
                  />
                )
              )
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
