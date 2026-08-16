"use client";

import Link from "next/link";

import { AvatarInitials } from "@/components/avatar-initials";
import { Ticking } from "@/components/ticking";
import { isPaused, sessionWorkedMs } from "@/lib/session";
import { formatDuration } from "@/lib/duration";
import type { ClockedInItem } from "@/lib/db/feed";

// The live "Clocked in now" strip at the top of the feed: friends currently in a
// session. Each row's duration ticks every second inside its <Ticking> leaf;
// membership refreshes come from <FeedLivePoll/>. Renders nothing when no one
// is clocked in.
export function ClockedInStrip({
  items,
  serverNow,
}: {
  items: ClockedInItem[];
  serverNow: number;
}) {
  if (items.length === 0) return null;

  return (
    <section className="flex flex-col">
      <div className="flex items-center gap-[7px] px-5 pt-[18px] pb-2">
        <span
          aria-hidden
          className="bg-brand size-[7px] animate-[pulse-dot_1.6s_infinite] rounded-full"
        />
        <span className="text-brand text-[10px] font-semibold uppercase tracking-[0.14em]">
          Clocked in now
        </span>
        <span className="flex-1" />
        <span className="text-caption text-[10px] font-semibold tracking-[0.06em]">
          {items.length}
        </span>
      </div>
      {items.map((item) => {
        const paused = isPaused({
          endedAt: null,
          pausedSince: item.pausedSince,
        });
        return (
          <Link
            key={item.sessionId}
            href={`/profile/${item.author.username}`}
            className="border-divider flex items-center gap-[11px] border-t px-5 py-2"
          >
            <AvatarInitials
              name={item.author.displayName}
              username={item.author.username}
              avatarUrl={item.author.avatarUrl}
              className="size-8 text-xs"
            />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-body truncate text-[13px] leading-[1.25] font-semibold">
                {item.author.displayName || `@${item.author.username}`}
              </span>
              <span className="text-faint truncate text-[11px] leading-[1.3]">
                {item.isGoal ? "Goal: " : ""}
                {item.label}
                {paused && " · paused"}
              </span>
            </div>
            <span className="text-brand shrink-0 rounded-full bg-[rgba(28,58,94,.08)] px-2.5 py-[3px] text-xs font-semibold tabular-nums">
              {/* useNow returns 0 during SSR; fall back to the server
                  timestamp so the first paint shows a sensible duration. */}
              <Ticking>
                {(tick) =>
                  formatDuration(
                    sessionWorkedMs(
                      {
                        startedAt: item.startedAt,
                        endedAt: null,
                        pausedMs: item.pausedMs,
                        pausedSince: item.pausedSince,
                      },
                      tick === 0 ? serverNow : tick
                    )
                  )
                }
              </Ticking>
            </span>
          </Link>
        );
      })}
      <div className="bg-track border-hairline mt-3.5 h-1.5 border-t" />
    </section>
  );
}
