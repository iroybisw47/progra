"use client";

import dynamic from "next/dynamic";
import { FlameIcon } from "lucide-react";
import { useState } from "react";

import { track } from "@/lib/analytics";
import { PALETTE } from "@/lib/palette";
import type { BadgeView } from "@/lib/streaks-view";
import { cn } from "@/lib/utils";

import type { StreakSheetData } from "./streak-sheet";

// Lazy, per the repo's dialog rule: most profile visits never open it.
const StreakSheet = dynamic(() =>
  import("./streak-sheet").then((m) => m.StreakSheet)
);

// The palette's orange: `fill` for the wash and the ring, `ink` for the
// number, which sits on white (lib/palette.ts).
const FIRE = PALETTE[2];

// The fire-and-days pill next to a name (.claude/plans/streaks.md). Inline and
// shrink-0, so in a row with a truncating name the name gives way first and
// even a four-digit count fits. A tap opens the details sheet.
//
// `dim` is "today hasn't counted yet": faded, never red. At a milestone (7, 30,
// 100) it gains a quiet ring; there's no celebration beyond that.
export function StreakBadge({
  badge,
  sheet,
  initialOpen = false,
}: {
  badge: BadgeView;
  sheet: StreakSheetData;
  // Dev preview only: render with the sheet already up.
  initialOpen?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  // Mounted from the first tap on, so closing animates out.
  const [opened, setOpened] = useState(initialOpen);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpened(true);
          setOpen(true);
          track("streak_sheet_opened", { own: sheet.variant === "own" });
        }}
        aria-label={`${badge.count}-day streak${badge.dim ? ", not counted yet today" : ""}. Show details`}
        className={cn(
          "inline-flex h-[22px] shrink-0 items-center gap-[3px] rounded-full pr-2 pl-1.5 text-[12px] leading-none font-semibold tabular-nums transition-transform active:scale-95",
          badge.dim && "opacity-55"
        )}
        style={{
          backgroundColor: `color-mix(in srgb, ${FIRE.fill} 13%, transparent)`,
          color: FIRE.ink,
          boxShadow: badge.milestone
            ? `inset 0 0 0 1.5px color-mix(in srgb, ${FIRE.fill} 60%, transparent)`
            : undefined,
        }}
      >
        <FlameIcon
          aria-hidden
          className="size-[13px]"
          strokeWidth={2.2}
          fill="currentColor"
          fillOpacity={badge.dim ? 0 : 0.22}
        />
        {badge.count}
      </button>
      {opened && (
        <StreakSheet open={open} onOpenChange={setOpen} data={sheet} />
      )}
    </>
  );
}
