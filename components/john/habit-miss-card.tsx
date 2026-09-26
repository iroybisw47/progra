"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { recordHabitMiss, toggleHabitCompletion } from "@/app/actions/habits";
import {
  MISS_REASONS,
  MISS_REASON_LABELS,
  type MissReason,
} from "@/lib/john/instrumentation";
import { cn } from "@/lib/utils";

// John: why yesterday's habits didn't happen.
//
// YESTERDAY, not today, and deliberately. Asking at 3pm why you "missed"
// something you intend to do at 9pm produces garbage and reads as an
// accusation. Yesterday is settled.
//
// It lives on Progress because there is no cron in this repo and notifications
// are a separate flagged subsystem, so the only trigger available is the next
// app open — and Progress is Home. Zero new plumbing.
//
// No backlog queue on purpose: someone who doesn't open the app for two days
// loses a day. A backlog is a chore, and a chore in a one-week test gets
// ignored, which is worse data than an honest gap.

type Props = {
  habits: { id: string; name: string; color: string | null }[];
  // The local day being asked about, YYYY-MM-DD.
  date: string;
};

const PILL =
  "h-9 rounded-[12px] border-[1.5px] px-3 text-[13px] font-bold transition-transform active:scale-[.97] disabled:opacity-50";

export function HabitMissCard({ habits, date }: Props) {
  const [pending, startTransition] = useTransition();
  // Rows disappear as they're answered. Local rather than waiting on the
  // revalidate, so the card doesn't sit there looking unresponsive.
  const [answered, setAnswered] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState(false);

  const rows = habits.filter((h) => !answered.has(h.id));
  if (dismissed || rows.length === 0) return null;

  function answer(habitId: string, reason: MissReason) {
    setAnswered((s) => new Set(s).add(habitId));
    startTransition(async () => {
      const r = await recordHabitMiss(habitId, date, reason);
      if ("error" in r) {
        // Put the row back — silently swallowing this would leave the user
        // believing they'd answered.
        setAnswered((s) => {
          const next = new Set(s);
          next.delete(habitId);
          return next;
        });
        toast.error(r.error);
      }
    });
  }

  // The escape hatch: they did it, they just never checked it off. Routes
  // through the ORDINARY completion action, which also clears any miss row.
  function didItActually(habitId: string) {
    setAnswered((s) => new Set(s).add(habitId));
    startTransition(async () => {
      const r = await toggleHabitCompletion(habitId, date);
      if ("error" in r) {
        setAnswered((s) => {
          const next = new Set(s);
          next.delete(habitId);
          return next;
        });
        toast.error(r.error);
      }
    });
  }

  return (
    <section className="border-hairline mx-5 mt-4 flex flex-col gap-4 rounded-[22px] border p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-bold">Yesterday</h2>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-caption text-[13px] font-medium"
        >
          Skip
        </button>
      </div>

      {rows.map((h) => (
        <div key={h.id} className="flex flex-col gap-2">
          <div className="text-[15px]">
            <span className="font-bold">{h.name}</span>
            <span className="text-caption"> — what got in the way?</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {MISS_REASONS.map((reason) => (
              <button
                key={reason}
                type="button"
                disabled={pending}
                onClick={() => answer(h.id, reason)}
                className={cn(PILL, "border-control-border text-caption")}
              >
                {MISS_REASON_LABELS[reason]}
              </button>
            ))}
            <button
              type="button"
              disabled={pending}
              onClick={() => didItActually(h.id)}
              className={cn(PILL, "border-brand/40 text-brand")}
            >
              Did it actually
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
