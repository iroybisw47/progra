"use client";

import { FlameIcon, SnowflakeIcon } from "lucide-react";

import { BottomSheet, BottomSheetContent } from "@/components/v2/bottom-sheet";
import { STREAK_MILESTONES } from "@/lib/streaks-config";

// Orange (palette 2), as the theme draws it.
const FIRE = { fill: "var(--palette-2)", ink: "var(--palette-2-ink)" };

// What the sheet shows. Your own has the freezes and the at-risk line; a
// friend's has only what get_friend_streak returns (their shared count).
export type StreakSheetData =
  | {
      variant: "own";
      current: number;
      longest: number;
      atRisk: boolean;
      freezesLine: string;
    }
  | {
      variant: "friend";
      name: string;
      current: number;
      longest: number;
    };

export function StreakSheet({
  open,
  onOpenChange,
  data,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: StreakSheetData;
}) {
  const title = data.variant === "own" ? "Your streak" : `${data.name}’s streak`;
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent title={title}>
        <div className="flex pb-1">
          <Stat value={data.current} label="Current" />
          <Stat value={data.longest} label="Longest" />
        </div>

        {/* Quiet marks at 7, 30 and 100: reached ones in orange. */}
        <div className="flex gap-2 pt-4" aria-label="Milestones">
          {STREAK_MILESTONES.map((m) => {
            const reached = data.longest >= m;
            return (
              <span
                key={m}
                className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold tabular-nums"
                style={
                  reached
                    ? { backgroundColor: `color-mix(in srgb, ${FIRE.fill} 13%, transparent)`, color: FIRE.ink }
                    : undefined
                }
              >
                <FlameIcon
                  aria-hidden
                  className={reached ? "size-3" : "text-disabled size-3"}
                  strokeWidth={2.2}
                />
                <span className={reached ? undefined : "text-disabled"}>{m} days</span>
              </span>
            );
          })}
        </div>

        <div className="border-divider mt-4 flex flex-col gap-2.5 border-t pt-4 pb-1">
          {data.variant === "own" ? (
            <>
              {data.atRisk && (
                <p className="text-body text-[13px] leading-snug text-pretty">
                  Today hasn’t counted yet. A session or a habit before 4am keeps it going.
                </p>
              )}
              <p className="text-secondary-ink flex items-center gap-2 text-[13px]">
                <SnowflakeIcon aria-hidden className="text-faint size-4 shrink-0" />
                {data.freezesLine}
              </p>
              <p className="text-caption text-xs leading-snug text-pretty">
                A day counts when you clock in for 5 minutes or check off a habit.
                Days run until 4am. A freeze covers a missed day on its own.
              </p>
            </>
          ) : (
            <p className="text-caption text-xs leading-snug text-pretty">
              Counts shared sessions and habits.
            </p>
          )}
        </div>
      </BottomSheetContent>
    </BottomSheet>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-1 flex-col gap-0.5">
      <span className="stat-num text-[28px] tabular-nums">{value}</span>
      <span className="text-disabled text-[9px] font-semibold uppercase tracking-[0.12em]">
        {label}
      </span>
    </div>
  );
}
