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
      router.push(`/recap?w=${weekStart}`);
    });
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={pending}
      className="border-hairline bg-brand/5 hover:bg-brand/10 flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors active:scale-[.99] disabled:opacity-60"
    >
      <span className="bg-brand/15 text-brand flex size-9 shrink-0 items-center justify-center rounded-full">
        <SparklesIcon className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-ink text-sm font-bold">Your week is ready</span>
        <span className="text-caption text-xs">
          Tap to see how it came together
        </span>
      </span>
      <ChevronRightIcon className="text-faint size-5 shrink-0" />
    </button>
  );
}
