import Link from "next/link";

import { AvatarInitials } from "@/components/avatar-initials";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration } from "@/lib/duration";
import type { FriendsLeaderboardRow } from "@/lib/leaderboard";
import { cn } from "@/lib/utils";

// This week's ranking of you + your friends by clocked time.
//
// Ranked on the OVERALL total (goals and categories alike); the breakdown
// beneath is goals only. Anything not itemised — category work, private goals,
// goals past the cap — lands in "Other", which is computed as the remainder so
// the numbers always reconcile and it can never read as a bug.
export function FriendsLeaderboard({
  rows,
}: {
  rows: FriendsLeaderboardRow[];
}) {
  // Only the viewer is ever kept at zero, so a lone row means nobody has
  // started yet — an invitation rather than an empty table.
  const nobodyTracked = rows.every((r) => r.totalMs === 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>This week</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {nobodyTracked ? (
          <p className="text-caption text-sm text-pretty">
            Nobody&rsquo;s clocked in yet this week. Start a session and
            you&rsquo;ll be first.
          </p>
        ) : (
          rows.map((row) => (
            <div key={row.user.userId} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "w-5 shrink-0 text-center text-sm font-bold tabular-nums",
                    row.rank === 1 ? "text-brand" : "text-faint"
                  )}
                >
                  {row.rank}
                </span>

                {/* Your own row isn't a link — /profile/[username] bounces you
                    to /me anyway, so it would be a dead tap. */}
                {row.isMe ? (
                  <Identity row={row} />
                ) : (
                  <Link
                    href={`/profile/${row.user.username}`}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <Identity row={row} />
                  </Link>
                )}

                <span className="shrink-0 text-sm font-bold tabular-nums">
                  {formatDuration(row.totalMs)}
                </span>
              </div>

              {/* Breakdown, indented under the name. Hidden entirely at zero —
                  an all-zero row is only ever the viewer's. */}
              {row.totalMs > 0 && (
                <div className="text-caption flex flex-col gap-0.5 pl-8 text-xs">
                  {row.goals.map((g) => (
                    <div key={g.title} className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate">{g.title}</span>
                      <span className="shrink-0 tabular-nums">
                        {formatDuration(g.ms)}
                      </span>
                    </div>
                  ))}
                  {row.otherMs > 0 && (
                    <div className="text-faint flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate">Other</span>
                      <span className="shrink-0 tabular-nums">
                        {formatDuration(row.otherMs)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function Identity({ row }: { row: FriendsLeaderboardRow }) {
  return (
    <>
      <AvatarInitials
        name={row.user.displayName}
        username={row.user.username}
        avatarUrl={row.user.avatarUrl}
        className="size-8 shrink-0 text-xs"
      />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {row.isMe
          ? "You"
          : row.user.displayName || `@${row.user.username}`}
      </span>
    </>
  );
}
