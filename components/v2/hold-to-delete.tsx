"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteAccount } from "@/app/actions/account";
import { cn } from "@/lib/utils";

const HOLD_MS = 1600;

// Press-and-hold to permanently delete the account (V2). Releasing before the
// bar fills cancels; a full hold runs the (irreversible) deleteAccount action.
// Replaces the type-to-confirm dialog. The fill is a CSS width transition that
// only runs while held; a matching timeout fires the action at completion.
export function HoldToDelete() {
  const router = useRouter();
  const [holding, setHolding] = useState(false);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancel() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setHolding(false);
  }

  function start() {
    if (pending) return;
    setHolding(true);
    timer.current = setTimeout(() => {
      setHolding(false);
      startTransition(async () => {
        const r = await deleteAccount();
        if ("error" in r) {
          toast.error(r.error);
          return;
        }
        router.replace("/login?deleted=1");
        router.refresh();
      });
    }, HOLD_MS);
  }

  return (
    <button
      type="button"
      disabled={pending}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      className={cn(
        "relative h-11 w-full touch-none overflow-hidden rounded-full border border-destructive/40 text-sm font-bold text-destructive select-none",
        "disabled:opacity-60"
      )}
      aria-label="Hold to delete account"
    >
      {/* Fill: 0→100% over HOLD_MS while held, snaps back on release. */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 bg-destructive/12"
        style={{
          width: holding ? "100%" : "0%",
          transitionProperty: "width",
          transitionDuration: holding ? `${HOLD_MS}ms` : "150ms",
          transitionTimingFunction: "linear",
        }}
      />
      <span className="relative">
        {pending ? "Deleting…" : "Hold to delete account"}
      </span>
    </button>
  );
}
