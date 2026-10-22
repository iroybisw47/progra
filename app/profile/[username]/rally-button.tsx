"use client";

import dynamic from "next/dynamic";
import { LockIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { track } from "@/lib/analytics";
import { useNowMinute } from "@/lib/hooks";
import { formatCooldownLeft } from "@/lib/social/nudges";
import {
  rallyRefusalMessage,
  rallyStateRefusal,
  type RallyState,
} from "@/lib/social/rally";

import type { RallySend } from "./rally-sheet";

// Lazy, per the repo's dialog rule: most profile visits never open it.
const RallySheet = dynamic(() =>
  import("./rally-sheet").then((m) => m.RallySheet)
);

// NudgeButton's chip, renamed: same size, same navy when it can act.
const CHIP =
  "h-8 shrink-0 rounded-[11px] border-[1.5px] px-3.5 text-xs font-semibold whitespace-nowrap transition-transform active:scale-95";

// The Rally chip in a friend's profile identity row (RALLY). Every friend gets
// one. When they can't be rallied right now it's dimmed (locked, or
// "Rallied · 4h" on the cooldown) and a tap says why. Only `hidden` (not a
// friend) renders nothing.
export function RallyButton({
  state,
  recipientId,
  name,
  initialOpen = false,
  onSend,
}: {
  state: RallyState;
  recipientId: string;
  name: string;
  // Dev preview only: render with the sheet up, and don't really send.
  initialOpen?: boolean;
  onSend?: RallySend;
}) {
  const [open, setOpen] = useState(initialOpen);
  // Minute granularity; 0 until hydrated, when the chip omits the duration.
  const nowMs = useNowMinute();

  if (state.status === "hidden") return null;

  const refusal = rallyStateRefusal(state);
  if (refusal) {
    const left =
      state.status === "cooldown" && nowMs !== 0
        ? formatCooldownLeft(state.cooldownUntil, nowMs)
        : null;
    return (
      <button
        type="button"
        aria-label={`Can't rally ${name} right now — tap for why`}
        className={`${CHIP} border-hairline text-faint inline-flex items-center gap-1.5 opacity-60`}
        onClick={() => {
          track("rally_locked_tapped", { reason: refusal.reason });
          toast(rallyRefusalMessage(refusal, name, Date.now()));
        }}
      >
        {state.status === "cooldown" ? (
          left === null ? "Rallied" : `Rallied · ${left}`
        ) : (
          <>
            <LockIcon className="size-3" strokeWidth={2.4} aria-hidden />
            Rally
          </>
        )}
      </button>
    );
  }

  if (state.status !== "ok") return null;

  return (
    <>
      <button
        type="button"
        className={`${CHIP} border-brand bg-brand text-primary-foreground`}
        onClick={() => {
          track("rally_sheet_opened");
          setOpen(true);
        }}
      >
        Rally
      </button>
      {open && (
        <RallySheet
          open={open}
          onOpenChange={setOpen}
          state={state}
          recipientId={recipientId}
          name={name}
          onSend={onSend}
        />
      )}
    </>
  );
}
