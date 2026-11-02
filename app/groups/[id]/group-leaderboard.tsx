import Link from "next/link";

import { AvatarInitials } from "@/components/avatar-initials";
import { formatDuration } from "@/lib/duration";
import { GROUP_COPY, type GroupLeaderRow } from "@/lib/groups";
import { cn } from "@/lib/utils";

// A group's week: every member you can see, ranked by clocked time, zero
// hours included (lib/groups.ts rankGroupRows), with "#N of M in your group"
// over it. Totals only — the definer returns nothing else of anyone's — so a
// row links to the profile and stops there. The row styling is the old
// friends leaderboard's (components/v2/friends-leaderboard.tsx), without its
// goal breakdown, which a non-friend's total can't have.
export function GroupLeaderboard({ rows, line }: { rows: GroupLeaderRow[]; line: string | null }) {
  return (
    <section aria-label={GROUP_COPY.leaderboard} className="flex flex-col">
      <div className="flex items-center gap-[7px] px-5 pt-4 pb-2">
        <span className="section-label">{GROUP_COPY.thisWeek}</span>
        <span className="flex-1" />
        {line && (
          <span className="text-caption text-[10px] font-semibold tracking-[0.06em] tabular-nums">{line}</span>
        )}
      </div>
      <ol role="list">
        {rows.map((row) => {
          const name = row.isMe ? GROUP_COPY.you : row.user.displayName || `@${row.user.username}`;
          return (
            <li
              key={row.user.userId}
              className="border-divider border-t"
              style={row.isMe ? { backgroundColor: "var(--tint-you)" } : undefined}
            >
              <Link
                href={`/profile/${row.user.username}`}
                className="flex items-center gap-2.5 px-5 py-[9px]"
              >
                <RankBadge rank={row.rank} />
                <AvatarInitials
                  name={row.user.displayName}
                  username={row.user.username}
                  avatarUrl={row.user.avatarUrl}
                  className="size-[30px] shrink-0 text-[11px]"
                />
                <span className="text-body min-w-0 flex-1 truncate text-[13px] leading-[1.25] font-semibold">
                  {name}
                </span>
                <span className="text-ink shrink-0 text-right text-[12.5px] font-semibold tabular-nums">
                  {row.totalMs < 60_000 ? "0m" : formatDuration(row.totalMs)}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// 1st is navy-filled, 2nd and 3rd grey-filled, everyone else just a numeral —
// the friends leaderboard's badge. A tie shares its badge.
function RankBadge({ rank }: { rank: number }) {
  return (
    <span
      className={cn(
        "flex size-[22px] shrink-0 items-center justify-center rounded-full font-serif text-xs font-semibold tabular-nums",
        rank === 1 ? "bg-brand text-primary-foreground" : rank <= 3 ? "bg-track text-body" : "text-faint"
      )}
    >
      {rank}
    </span>
  );
}
