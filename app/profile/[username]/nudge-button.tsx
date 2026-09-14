"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import {
  formatCooldownLeft,
  type NudgeState,
} from "@/lib/social/nudges";
import { track } from "@/lib/analytics";
import { useNowMinute } from "@/lib/hooks";

// Lazy, per the repo's dialog rule: most profile visits never open it, and it
// pulls in the sheet primitive and the send action.
const NudgeSheet = dynamic(() =>
  import("./nudge-sheet").then((m) => m.NudgeSheet)
);

// The Nudge chip in the profile identity row. Styled like the self "Edit" chip
// so the two read as the same class of control.
//
// It renders only for an eligible friend or an active cooldown — every other
// state arrives as `hidden` and renders nothing at all. That's deliberate:
// a disabled or greyed button would still be a signal about someone's day
// (they're mid-session, they turned nudges off, they're already done), and a
// "you can't nag them" affordance is worse than no affordance.
export function NudgeButton({
  state,
  recipientId,
  name,
}: {
  state: NudgeState;
  recipientId: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  // Minute granularity, from the shared store — the wait is hours long, so a
  // per-second tick would re-render this for nothing. 0 means "not hydrated
  // yet" (its SSR snapshot), and the chip simply omits the duration until then
  // rather than rendering a number computed from epoch zero.
  const nowMs = useNowMinute();

  if (state.status === "hidden") return null;

  if (state.status === "cooldown") {
    const left = nowMs === 0 ? null : formatCooldownLeft(state.cooldownUntil, nowMs);
    return (
      <span
        aria-label={
          left === null ? `Already nudged ${name}` : `You can nudge ${name} again in ${left}`
        }
        className="border-hairline text-faint inline-flex h-8 shrink-0 items-center rounded-[11px] border-[1.5px] px-3.5 text-xs font-semibold whitespace-nowrap opacity-60"
      >
        {left === null ? "Nudged" : `Nudged · ${left}`}
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        className="border-hairline text-caption h-8 shrink-0 rounded-[11px] border-[1.5px] px-3.5 text-xs font-semibold whitespace-nowrap transition-transform active:scale-95"
        onClick={() => {
          track("nudge_sheet_opened");
          setOpen(true);
        }}
      >
        Nudge
      </button>
      {open && (
        <NudgeSheet
          open={open}
          onOpenChange={setOpen}
          state={state}
          recipientId={recipientId}
          name={name}
        />
      )}
    </>
  );
}
