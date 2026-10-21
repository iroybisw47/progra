"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { CheckIcon } from "lucide-react";

import { usePrefersReducedMotion } from "@/lib/hooks";
import { TOAST, transition } from "@/lib/motion";

// The redesign's success toast (handoff R:175): a navy pill near the top with
// a check, which drops in 10px as it fades and hides itself after 2.4s. One
// component for onboarding v3 and the v3 Friends tab (plan D15). Errors stay
// on sonner's default toast, which is where every other screen's go.
//
// Imperative on purpose: `ref.current.show("Invite shared")`. The text lives
// in this leaf, so showing a toast re-renders the pill and nothing else. A
// prop driven from the screen would re-render a whole wizard for it.
export type PillToastHandle = { show: (text: string) => void };

type Shown = { id: number; text: string; visible: boolean };

export function PillToast({ ref }: { ref?: Ref<PillToastHandle> }) {
  const reduced = usePrefersReducedMotion();
  // The text outlives `visible`, so the pill fades out with its words still
  // in it rather than emptying first.
  const [shown, setShown] = useState<Shown | null>(null);
  const counter = useRef(0);

  useImperativeHandle(
    ref,
    () => ({
      show(text: string) {
        counter.current += 1;
        setShown({ id: counter.current, text, visible: true });
      },
    }),
    []
  );

  // Each show restarts the clock, so a second toast gets its full time.
  const id = shown?.visible ? shown.id : null;
  useEffect(() => {
    if (id === null) return;
    const t = setTimeout(
      () => setShown((s) => (s && s.id === id ? { ...s, visible: false } : s)),
      TOAST.visibleMs
    );
    return () => clearTimeout(t);
  }, [id]);

  const visible = shown?.visible ?? false;
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-5"
      style={{ top: "max(12px, calc(env(safe-area-inset-top) + 4px))" }}
    >
      <div
        className="bg-brand flex max-w-full items-center gap-1.5 rounded-full px-3.5 py-2.5 text-[13px] leading-tight font-semibold text-primary-foreground shadow-[0_10px_22px_-10px_var(--glow)]"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible || reduced ? "none" : TOAST.from,
          transition: transition(reduced ? TOAST.reduced : TOAST.normal),
        }}
        aria-hidden={!visible}
      >
        <CheckIcon className="size-[13px] shrink-0" strokeWidth={3} />
        <span className="truncate">{shown?.text}</span>
      </div>
    </div>
  );
}
