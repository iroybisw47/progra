"use client";

import { BellIcon, CheckIcon } from "lucide-react";

import { itemStyle, type ItemPhase } from "@/lib/motion";

import { aboveCta } from "./frame";

// "Not now" sits this far above the CTA, as the intro's "Skip intro" does.
const SKIP_TO_CTA_PX = 28;

// The notifications screen, "Turn on notifications": after finding friends, before the ready
// screen. The header in the habits screen's layout (section label, serif
// question, one line under it), then a card listing what notifications are
// for in this build (notifyReasons, lib/onboarding-v3.ts), so it never
// promises a reminder that's switched off.
//
// iOS shows its permission dialog once, ever, so the dialog only comes from
// the CTA's "Turn on notifications" (the shell's askNotifications), right
// after this has said what it's for. "Not now" goes on without asking, and
// Settings can ask later. The shell only brings this screen up while the ask
// can still do something (notifyScreenShown): in the app, unanswered.
export function NotifyScreen({
  phase,
  reduced,
  reasons,
  busy,
  onSkip,
}: {
  phase: ItemPhase;
  reduced: boolean;
  reasons: readonly string[];
  // The dialog is up: "Not now" waits for it.
  busy: boolean;
  onSkip: () => void;
}) {
  return (
    <div className="flex h-full flex-col px-5 pt-4" style={{ paddingBottom: aboveCta(SKIP_TO_CTA_PX) }}>
      <div className="section-label" style={itemStyle(phase, 0, reduced)}>
        Notifications
      </div>
      <h2
        className="text-ink mt-2.5 font-serif text-[25px] leading-[1.18] font-medium tracking-[-0.015em] text-pretty"
        style={itemStyle(phase, 1, reduced)}
      >
        Stay in the loop
      </h2>
      <p
        className="text-secondary-ink mt-[9px] text-[13px] leading-[1.45] text-pretty"
        style={itemStyle(phase, 2, reduced)}
      >
        Turn on notifications and Progra will let you know:
      </p>

      <ul
        className="border-control-border mt-5 flex flex-col gap-3 rounded-[18px] border-[1.5px] bg-white p-4"
        style={itemStyle(phase, 3, reduced)}
      >
        {reasons.map((reason) => (
          <li key={reason} className="flex items-start gap-2.5">
            <span
              aria-hidden
              className="bg-brand mt-px flex size-[18px] shrink-0 items-center justify-center rounded-[6px] text-white"
            >
              <CheckIcon className="size-[11px]" strokeWidth={3.5} />
            </span>
            <span className="text-body text-[14px] leading-[1.35]">{reason}</span>
          </li>
        ))}
      </ul>

      <p
        className="text-caption mt-3 flex items-center gap-1.5 text-[12px] leading-[1.45]"
        style={itemStyle(phase, 4, reduced)}
      >
        <BellIcon aria-hidden className="size-3.5 shrink-0" strokeWidth={2} />
        You can change this any time in Settings.
      </p>

      <div className="mt-auto flex shrink-0 justify-center" style={itemStyle(phase, 5, reduced)}>
        <button
          type="button"
          onClick={onSkip}
          disabled={busy}
          className="text-caption hover:text-brand h-11 px-3.5 text-[12px] font-medium whitespace-nowrap transition-colors disabled:opacity-40"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
