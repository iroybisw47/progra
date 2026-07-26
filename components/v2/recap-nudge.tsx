"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ChevronRightIcon, SparklesIcon } from "lucide-react";

import { markRecapOpened } from "@/app/actions/recap";

// The "your week is ready" banner at the top of Progress. Shown only when the
// most recent week's recap has unlocked (Sunday 6pm local) and hasn't been
// opened yet — see loadProgressData. Tapping marks the week opened (so the nudge
// won't reappear on any device) and opens the recap. Marking is best-effort: on
// failure we still navigate, and the nudge simply returns next load.
export function RecapNudge({ weekStart }: { weekStart: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function open() {
    startTransition(async () => {
      await markRecapOpened(weekStart);
      router.push(`/recap/${weekStart}`);
    });
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={pending}
      className="bg-brand text-primary-foreground flex w-full items-center gap-3 rounded-[18px] px-4 py-4 text-left shadow-[0_10px_24px_rgba(28,58,94,.3)] transition-transform active:scale-[.98] disabled:opacity-60"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15">
        <SparklesIcon className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] font-bold">Your week is ready</span>
        <span className="text-primary-foreground/70 text-xs">
          Tap to see how it came together
        </span>
      </span>
      <ChevronRightIcon className="text-primary-foreground/70 size-5 shrink-0" />
    </button>
  );
}
