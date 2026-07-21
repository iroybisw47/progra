"use client";

import Link from "next/link";

import { AvatarInitials } from "@/components/avatar-initials";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          Clocked in now
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {items.map((item) => {
          const paused = isPaused({
            endedAt: null,
            pausedSince: item.pausedSince,
          });
          return (
            <div key={item.sessionId} className="flex items-center gap-3">
              <Link href={`/profile/${item.author.username}`}>
                <AvatarInitials
                  name={item.author.displayName}
                  username={item.author.username}
                  className="size-9 text-xs"
                />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <Link
                  href={`/profile/${item.author.username}`}
                  className="truncate text-sm font-medium hover:underline"
                >
                  {item.author.displayName || `@${item.author.username}`}
                </Link>
                <span className="text-muted-foreground truncate text-xs">
                  {item.isGoal ? "Goal: " : ""}
                  {item.label}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span
                  aria-hidden
                  className={
                    "size-2 rounded-full " +
                    (paused ? "bg-amber-500" : "bg-emerald-500")
                  }
                />
                <span className="font-mono text-sm tabular-nums">
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
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
