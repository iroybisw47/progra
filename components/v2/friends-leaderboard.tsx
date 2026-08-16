"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";

import { AvatarInitials } from "@/components/avatar-initials";
import { goalColorOf } from "@/lib/colors";
import { endOfWeek } from "@/lib/dates";
import { formatDuration } from "@/lib/duration";
import { useNowMinute } from "@/lib/hooks";
import type { FriendsLeaderboardRow } from "@/lib/leaderboard";
import { cn } from "@/lib/utils";

// This week's ranking of you + your friends by clocked time.
//
// Ranked on the OVERALL total (goals and categories alike); the breakdown a row
// expands into is goals only. Anything not itemised — category work, private
// goals, goals past the cap — lands in "Other", which is computed as the
// remainder so the numbers always reconcile and it can never read as a bug.
export function FriendsLeaderboard({
  rows,
}: {
  rows: FriendsLeaderboardRow[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const now = useNowMinute();

  // Only the viewer is ever kept at zero, so a lone row means nobody has
  // started yet — an invitation rather than an empty table.
  const nobodyTracked = rows.every((r) => r.totalMs === 0);
  // The bars in an expanded row are relative to the week's leader, so a row's
  // goals read against the board rather than only against themselves.
  const topMs = rows.reduce((m, r) => Math.max(m, r.totalMs), 0);

  return (
    <section className="flex flex-col">
      <div className="flex items-center gap-[7px] px-5 pt-[18px] pb-2">
        <span className="section-label">This week&rsquo;s leaderboard</span>
        <span className="flex-1" />
        <span className="text-caption text-[10px] font-semibold tracking-[0.06em] tabular-nums">
          {resetLabel(now)}
        </span>
      </div>

      {nobodyTracked ? (
        <p className="text-caption border-divider border-t px-5 py-3 text-[13px] text-pretty">
          Nobody&rsquo;s clocked in yet this week. Start a session and
          you&rsquo;ll be first.
        </p>
      ) : (
        rows.map((row) => {
          const open = openId === row.user.userId;
          return (
            <div
              key={row.user.userId}
              className="border-divider border-t"
              style={
                row.isMe
                  ? { backgroundColor: "var(--tint-you)" }
                  : undefined
              }
            >
              <button
                type="button"
                aria-expanded={open}
                onClick={() =>
                  setOpenId(open ? null : row.user.userId)
                }
                className="flex w-full items-center gap-2.5 px-5 py-[9px] text-left"
              >
                <RankBadge rank={row.rank} />
                <AvatarInitials
                  name={row.user.displayName}
                  username={row.user.username}
                  avatarUrl={row.user.avatarUrl}
                  className="size-[30px] shrink-0 text-[11px]"
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-body truncate text-[13px] leading-[1.25] font-semibold">
                    {row.isMe
                      ? "You"
                      : row.user.displayName || `@${row.user.username}`}
                  </span>
                  <span className="text-faint text-[10.5px] leading-[1.3] tabular-nums">
                    {row.goals.length > 0
                      ? `${row.goals.length} goal${row.goals.length === 1 ? "" : "s"} this week`
                      : row.totalMs > 0
                        ? "Tracked outside goals"
                        : "Nothing yet"}
                  </span>
                </div>
                <span className="text-ink w-[50px] shrink-0 text-right text-[12.5px] font-semibold tabular-nums">
                  {formatDuration(row.totalMs)}
                </span>
                <ChevronDownIcon
                  aria-hidden
                  className={cn(
                    "text-disabled size-3 shrink-0 transition-transform",
                    open && "rotate-180"
                  )}
                  strokeWidth={2.4}
                />
              </button>

              {open && (
                <div className="flex flex-col gap-[9px] pt-0.5 pr-5 pb-3 pl-[52px]">
                  {row.goals.map((g) => {
                    const color = goalColorOf(g);
                    return (
                      <div key={g.id} className="flex flex-col gap-1">
                        <div className="flex items-center gap-[7px]">
                          <span
                            aria-hidden
                            className="size-2 shrink-0 rounded-[2px]"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-body min-w-0 flex-1 truncate text-xs font-semibold">
                            {g.title}
                          </span>
                          <span className="shrink-0 text-[11.5px] font-semibold tabular-nums text-[var(--secondary-ink)]">
                            {formatDuration(g.ms)}
                          </span>
                        </div>
                        <div className="bg-track h-[5px] overflow-hidden rounded-full">
                          <div
                            className="h-full rounded-full transition-[width] duration-1000 ease-linear"
                            style={{
                              width: `${topMs > 0 ? Math.max(2, (g.ms / topMs) * 100) : 0}%`,
                              backgroundColor: color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {row.otherMs > 0 && (
                    <div className="flex items-center gap-[7px]">
                      <span
                        aria-hidden
                        className="bg-disabled size-2 shrink-0 rounded-[2px]"
                      />
                      <span className="text-caption min-w-0 flex-1 truncate text-xs">
                        Other
                      </span>
                      <span className="text-caption shrink-0 text-[11.5px] tabular-nums">
                        {formatDuration(row.otherMs)}
                      </span>
                    </div>
                  )}
                  {!row.isMe && (
                    <Link
                      href={`/profile/${row.user.username}`}
                      className="text-brand self-start pt-0.5 text-[11.5px] font-semibold"
                    >
                      View profile →
                    </Link>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
      <div className="bg-track border-hairline mt-3 h-1.5 border-t" />
    </section>
  );
}

// 1st is navy-filled, 2nd and 3rd grey-filled, everyone else just a numeral.
function RankBadge({ rank }: { rank: number }) {
  return (
    <span
      className={cn(
        "flex size-[22px] shrink-0 items-center justify-center rounded-full font-serif text-xs font-semibold tabular-nums",
        rank === 1
          ? "bg-brand text-primary-foreground"
          : rank <= 3
            ? "bg-track text-body"
            : "text-faint"
      )}
    >
      {rank}
    </span>
  );
}

// "resets in 2d 4h" — the board is a week, so say when the week turns over.
// Empty until hydration (useNowMinute is 0 on the server), which keeps the
// first paint identical on both sides.
function resetLabel(now: number): string {
  if (now === 0) return "";
  const left = endOfWeek(new Date(now)).getTime() - now;
  if (left <= 0) return "resets now";
  const hours = Math.floor(left / 3_600_000);
  const d = Math.floor(hours / 24);
  const h = hours % 24;
  return d > 0 ? `resets in ${d}d ${h}h` : `resets in ${h}h`;
}
