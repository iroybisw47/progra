"use client";

import dynamic from "next/dynamic";
import { LockIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  formatCooldownLeft,
  nudgeRefusalMessage,
  nudgeStateRefusal,
  type NudgeState,
} from "@/lib/social/nudges";
import { track } from "@/lib/analytics";
import { useNowMinute } from "@/lib/hooks";

// Lazy, per the repo's dialog rule: most profile visits never open it, and it
// pulls in the sheet primitive and the send action.
const NudgeSheet = dynamic(() =>
  import("./nudge-sheet").then((m) => m.NudgeSheet)
);

const CHIP =
  "h-8 shrink-0 rounded-[11px] border-[1.5px] px-3.5 text-xs font-semibold whitespace-nowrap transition-transform active:scale-95";

// The Nudge chip in the profile identity row. When you can nudge, it's filled
// in the clock button's navy (bg-brand) — the same "go do it" colour.
//
// Every friend gets a chip. When they can't be nudged right now it renders
// dimmed — locked, or "Nudged · 4h" on a cooldown — and a tap says why in a
// toast. The reasons are the RPC's, computed from what a friend may see anyway;
// see NudgeLockReason. Only `hidden` (not a friend) renders nothing.
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

  const refusal = nudgeStateRefusal(state);
  if (refusal) {
    const left =
      state.status === "cooldown" && nowMs !== 0
        ? formatCooldownLeft(state.cooldownUntil, nowMs)
        : null;
    return (
      <button
        type="button"
        aria-label={`Can't nudge ${name} right now — tap for why`}
        className={`${CHIP} border-hairline text-faint inline-flex items-center gap-1.5 opacity-60`}
        onClick={() => {
          track("nudge_locked_tapped", { reason: refusal.reason });
          toast(nudgeRefusalMessage(refusal, name, Date.now()));
        }}
      >
        {state.status === "cooldown" ? (
          left === null ? "Nudged" : `Nudged · ${left}`
        ) : (
          <>
            <LockIcon className="size-3" strokeWidth={2.4} aria-hidden />
            Nudge
          </>
        )}
      </button>
    );
  }

  if (state.status !== "ok") return null;

  // When the only thing on offer is congratulations, "Nudge" is the wrong word
  // — you'd be pressing a prod button to say well done. The sheet's own title
  // follows the same rule.
  const praiseOnly =
    state.praise !== null && state.goals.length === 0 && state.habits === null;

  return (
    <>
      <button
        type="button"
        className={`${CHIP} border-brand bg-brand text-primary-foreground`}
        onClick={() => {
          track("nudge_sheet_opened");
          setOpen(true);
        }}
      >
        {praiseOnly ? "Cheer" : "Nudge"}
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
