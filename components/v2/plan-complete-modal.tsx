"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2Icon } from "lucide-react";

import { markPlanReviewed } from "@/app/actions/sessions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDuration } from "@/lib/duration";

// "Your session finished" — shown once, on the first load after a timed session
// reached its target while nobody was watching.
//
// A modal rather than the muted banner the 10-hour cap uses, and deliberately
// so: an auto-clock-out is a correction to deal with, while finishing what you
// set out to do is worth interrupting for.
//
// BOTH buttons stamp plan_reviewed_at. A dismiss path that didn't write would
// reopen this on every single page load — the one failure mode a modal really
// can't have.
export function PlanCompleteModal({
  sessionId,
  taskName,
  workedMs,
}: {
  sessionId: string;
  taskName: string;
  workedMs: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [pending, startTransition] = useTransition();

  function dismiss(then?: () => void) {
    setOpen(false);
    startTransition(async () => {
      // Best-effort, matching AutoEndNudge: on failure we still navigate and
      // the modal simply returns next load.
      await markPlanReviewed(sessionId);
      then?.();
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss();
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="bg-done/15 text-done mb-1 flex size-11 items-center justify-center rounded-full">
            <CheckCircle2Icon className="size-6" />
          </div>
          <DialogTitle>You finished your {formatDuration(workedMs)}</DialogTitle>
          <DialogDescription className="text-pretty">
            {taskName} wrapped up while you were away, and it&rsquo;s saved
            privately. Review it to add notes or post it to your friends.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-col-reverse">
          <Button
            variant="outline"
            className="h-11 w-full"
            disabled={pending}
            onClick={() => dismiss()}
          >
            Not now
          </Button>
          <Button
            className="h-11 w-full"
            disabled={pending}
            onClick={() => dismiss(() => router.push(`/clock/finish?sid=${sessionId}`))}
          >
            Review &amp; post
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
