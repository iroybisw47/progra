"use client";

import { CheckIcon, SettingsIcon } from "lucide-react";

import { NUDGE_PRESETS, NUDGE_PRESET_KEYS } from "@/lib/social/nudges";
import { cn } from "@/lib/utils";

import { CARD, StepTemplate, rise } from "../onboarding-ui";

// Step 7. Try a nudge on a practice profile, laid out like the real one (the
// Nudge pill sits left of the settings gear, as on /profile/[username]), then
// the pinned CTA offers the share sheet. Nothing here sends anything.
export function FriendsStep({
  eyebrow,
  nudgeOpen,
  onOpenNudge,
  nudged,
  onNudge,
}: {
  eyebrow: string | null;
  nudgeOpen: boolean;
  onOpenNudge: () => void;
  // The chosen preset's copy, once one has been picked.
  nudged: string | null;
  onNudge: (message: string) => void;
}) {
  return (
    <StepTemplate
      eyebrow={eyebrow}
      title="Hold your friends accountable."
      body="Your friends hold you accountable, and you hold them accountable. When a friend is falling behind, send them a nudge. Try it below."
    >
      <div className={`${CARD} flex flex-col gap-3 p-4`}>
        <span className="section-label">Practice on a profile</span>
        <div className="flex items-center gap-2.5">
          <span
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
            style={{ backgroundColor: "rgba(145,96,127,.14)", color: "var(--cat-plum)" }}
          >
            MP
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-body text-[14.5px] font-semibold">Maya</span>
            <span className="text-faint text-[11.5px]">@maya</span>
          </div>
          <button
            type="button"
            onClick={onOpenNudge}
            aria-disabled={nudged !== null || undefined}
            className={cn(
              "bg-brand text-primary-foreground h-8 shrink-0 rounded-full px-4 text-[12.5px] font-semibold transition-[transform,opacity] duration-200 active:scale-95",
              nudged !== null && "opacity-50"
            )}
          >
            {nudged !== null ? "Nudged" : "Nudge"}
          </button>
          <span
            aria-hidden
            className="border-hairline text-caption flex size-8 shrink-0 items-center justify-center rounded-full border-[1.5px]"
          >
            <SettingsIcon className="size-[15px]" strokeWidth={2} />
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-faint min-w-0 flex-1 truncate text-[11px]">
              Thesis writing · 2.5h of 8h this week
            </span>
            <span className="text-destructive text-[9.5px] font-bold tracking-[0.08em] whitespace-nowrap uppercase">
              Behind pace
            </span>
          </div>
          <div className="bg-track h-[7px] overflow-hidden rounded-full">
            <div className="h-full w-[31%] rounded-full" style={{ backgroundColor: "var(--cat-plum)" }} />
          </div>
        </div>

        {nudgeOpen && nudged === null && (
          <div
            className="flex flex-col gap-[7px]"
            style={{ animation: "rise .3s cubic-bezier(.22,1,.36,1) both", ...rise("0s") }}
          >
            <span className="section-label">Pick a message</span>
            {NUDGE_PRESET_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => onNudge(NUDGE_PRESETS[key])}
                className="border-control-border text-body hover:border-brand w-full rounded-[12px] border-[1.5px] bg-white px-3 py-2.5 text-left text-[13px] font-semibold transition-[transform,border-color] duration-150 active:scale-[.98]"
              >
                {NUDGE_PRESETS[key]}
              </button>
            ))}
          </div>
        )}

        {nudged !== null && (
          <div className="check-pop flex flex-col gap-[7px]">
            <span className="bg-brand text-primary-foreground max-w-[85%] self-end rounded-[16px_16px_4px_16px] px-3.5 py-2.5 text-[13.5px] leading-[1.4] font-medium">
              {nudged}
            </span>
            <span className="flex items-center gap-1.5 self-end">
              <CheckIcon className="size-[13px] text-success" strokeWidth={2.6} />
              <span className="text-xs font-semibold text-success">Nudge sent to Maya</span>
            </span>
          </div>
        )}
      </div>
    </StepTemplate>
  );
}
