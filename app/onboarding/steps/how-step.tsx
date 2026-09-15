"use client";

import { CheckIcon } from "lucide-react";

import { Donut } from "@/components/v2/donut";
import { cn } from "@/lib/utils";

import { CARD, StepTemplate } from "../onboarding-ui";

// Step 1. The one idea Progra is built on, shown rather than explained: your
// week and a friend's, side by side, the way the Progress tab draws them.
export function HowStep({ eyebrow }: { eyebrow: string | null }) {
  return (
    <StepTemplate
      eyebrow={eyebrow}
      title="Most productivity apps are singleplayer, but Progra is multiplayer."
      titleClassName="text-[28px] leading-[1.14]"
      body="On Progra, you track hours put towards your goals, and your habits, but your friends are able to see your progress to hold you accountable."
    >
      <div className={`${CARD} overflow-hidden`}>
        <div className="flex items-center gap-[7px] px-3.5 pt-3 pb-2.5">
          <span className="section-label">This week</span>
        </div>
        <div className="grid grid-cols-2">
          <FriendColumn
            initials="Y"
            name="You"
            avatarBg="rgba(28,58,94,.12)"
            avatarColor="var(--brand)"
            tracked="4.2h"
            segments={[
              { color: "var(--cat-blue)", value: 2.6, name: "Study math", hours: "2.6h" },
              { color: "var(--cat-teal)", value: 1.0, name: "Reading", hours: "1.0h" },
              { color: "var(--cat-mustard)", value: 0.6, name: "Gym", hours: "0.6h" },
            ]}
            barPct={70}
            barColor="var(--cat-blue)"
            caption="of 6h goal · on track"
            habits={[
              { name: "Journaling", color: "var(--cat-indigo)", done: true },
              { name: "Stretching", color: null, done: false },
            ]}
          />
          <FriendColumn
            initials="MP"
            name="Maya"
            avatarBg="rgba(145,96,127,.14)"
            avatarColor="var(--cat-plum)"
            tracked="7.5h"
            segments={[
              { color: "var(--cat-plum)", value: 4.0, name: "Thesis", hours: "4.0h" },
              { color: "var(--cat-forest)", value: 2.1, name: "Yoga", hours: "2.1h" },
              { color: "var(--cat-burnt)", value: 1.4, name: "Piano", hours: "1.4h" },
            ]}
            barPct={94}
            barColor="var(--cat-plum)"
            caption="of 8h goal · almost ✓"
            captionDone
            habits={[
              { name: "Meditation", color: "var(--cat-teal)", done: true },
              { name: "Drinking water", color: "var(--cat-blue)", done: true },
            ]}
            right
          />
        </div>
      </div>
    </StepTemplate>
  );
}

function FriendColumn({
  initials,
  name,
  avatarBg,
  avatarColor,
  tracked,
  segments,
  barPct,
  barColor,
  caption,
  captionDone = false,
  habits,
  right = false,
}: {
  initials: string;
  name: string;
  avatarBg: string;
  avatarColor: string;
  tracked: string;
  segments: { color: string; value: number; name: string; hours: string }[];
  barPct: number;
  barColor: string;
  caption: string;
  captionDone?: boolean;
  habits: { name: string; color: string | null; done: boolean }[];
  right?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 px-3.5 pt-1 pb-3.5",
        right && "border-divider border-l"
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className="flex size-[26px] shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
          style={{ backgroundColor: avatarBg, color: avatarColor }}
        >
          {initials}
        </span>
        <span className="text-body text-[12.5px] font-semibold">{name}</span>
      </div>
      <div className="self-center">
        <Donut
          segments={segments}
          size={92}
          stroke={12}
          label={tracked}
          labelClassName="text-[15px]"
          sub="Tracked"
          subClassName="text-[7px]"
        />
      </div>
      <div className="flex flex-col gap-1">
        {segments.map((s) => (
          <div key={s.name} className="flex items-center gap-1.5 text-[10.5px]">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-body min-w-0 flex-1 truncate font-medium">{s.name}</span>
            <span className="text-caption tabular-nums">{s.hours}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <div className="bg-track h-[7px] overflow-hidden rounded-full">
          <div
            className="h-full rounded-full"
            style={{ width: `${barPct}%`, backgroundColor: barColor }}
          />
        </div>
        <span
          className={cn(
            "text-[10.5px]",
            captionDone ? "font-semibold text-success" : "text-caption"
          )}
        >
          {caption}
        </span>
      </div>
      <div className="border-divider flex flex-col gap-[5px] border-t pt-2">
        <span className="text-faint text-[9px] font-semibold tracking-[0.12em] uppercase">
          Habits
        </span>
        {habits.map((h) => (
          <div key={h.name} className="flex items-center gap-1.5 text-[10.5px]">
            {h.done ? (
              <span
                className="flex size-3.5 shrink-0 items-center justify-center rounded-[5px] text-white"
                style={{ backgroundColor: h.color ?? undefined }}
              >
                <CheckIcon className="size-[9px]" strokeWidth={3.4} />
              </span>
            ) : (
              <span className="border-disabled size-3.5 shrink-0 rounded-[5px] border-[1.5px] bg-white" />
            )}
            <span className={cn("font-medium", h.done ? "text-body" : "text-caption")}>
              {h.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
