"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ChevronRightIcon, TimerOffIcon } from "lucide-react";

import { markAutoEndReviewed } from "@/app/actions/sessions";

// The "we clocked you out" banner on Progress. Shown only when a session was
// ended by the 10-hour cap and hasn't been reviewed yet — see loadProgressData.
// Tapping marks it reviewed (so it won't reappear on any device) and opens the
// finish screen, where the session can be checked, edited and posted. Marking is
// best-effort, matching RecapNudge: on failure we still navigate and the nudge
// simply returns next load.
//
// Deliberately muted rather than the brand fill RecapNudge uses — this is a
// correction to deal with, not a reward to celebrate, and the two can appear
// stacked.
export function AutoEndNudge({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function open() {
    startTransition(async () => {
      await markAutoEndReviewed(sessionId);
      router.push(`/clock/finish?sid=${sessionId}`);
    });
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={pending}
      className="border-border bg-card flex w-full items-center gap-3 rounded-[18px] border px-4 py-4 text-left transition-transform active:scale-[.98] disabled:opacity-60"
    >
      <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-full">
        <TimerOffIcon className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] font-bold">
          A session was clocked out at 10 hours
        </span>
        <span className="text-muted-foreground text-xs">
          Saved privately — tap to review and post it
        </span>
      </span>
      <ChevronRightIcon className="text-muted-foreground size-5 shrink-0" />
    </button>
  );
}
