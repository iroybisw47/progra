import Link from "next/link";

import { AvatarInitials } from "@/components/avatar-initials";
import { RecapComments } from "@/components/v2/recap-comments";
import { RecapKudosButton } from "@/components/v2/recap-kudos-button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDuration } from "@/lib/duration";
import { formatRelativeTime } from "@/lib/dates";
import type { RecapFeedItem } from "@/lib/db/feed";
import type { RecapComment, RecapKudos } from "@/lib/db/recap-social";

const CHART_FALLBACK = "var(--chart-5)";
const HOUR_MS = 60 * 60 * 1000;
const fmtH = (ms: number) => `${(ms / HOUR_MS).toFixed(1)}h`;

// "Jul 13 – 19" for the Mon-start week.
function weekRange(startMs: number): string {
  const start = new Date(startMs);
  const end = new Date(startMs + 6 * 24 * HOUR_MS);
  const startLabel = start.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const endLabel = end.toLocaleDateString(undefined, { day: "numeric" });
  return `${startLabel} – ${endLabel}`;
}

// A friend's posted weekly recap in the feed. Deliberately distinct from session
// cards: a "{name} uploaded their weekly recap!" header over a navy-tinted
// summary panel (hours, rank, top categories) + optional caption. Renders purely
// from the denormalized RecapFeedItem — no recompute. (Reactions/comments footer
// arrives in Phase 6b.)
export function RecapFeedCard({
  entry,
  now,
  kudos,
  comments,
}: {
  entry: RecapFeedItem;
  now: number;
  kudos: RecapKudos;
  comments: RecapComment[];
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col gap-4 py-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href={`/profile/${entry.author.username}`}>
            <AvatarInitials
              name={entry.author.displayName}
              username={entry.author.username}
              avatarUrl={entry.author.avatarUrl}
              className="size-10 text-sm"
            />
          </Link>
          <div className="flex min-w-0 flex-col">
            <span className="text-sm">
              <Link
                href={`/profile/${entry.author.username}`}
                className="font-bold hover:underline"
              >
                {entry.author.displayName || `@${entry.author.username}`}
              </Link>{" "}
              <span className="text-caption">uploaded their weekly recap!</span>
            </span>
            <span className="text-faint text-xs">
              {formatRelativeTime(entry.postedAt, now)}
            </span>
          </div>
        </div>

        {/* Summary panel — navy tint sets it apart from session cards */}
        <div className="bg-brand/5 border-hairline flex flex-col gap-3 rounded-2xl border p-4">
          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-caption text-xs">
                Week of {weekRange(entry.weekStartMs)}
              </span>
              <span className="text-ink text-3xl font-bold leading-tight tabular-nums">
                {formatDuration(entry.totalTrackedMs)}
              </span>
              <span className="text-caption text-xs">tracked</span>
            </div>
            {entry.rank != null && (
              <div className="flex shrink-0 flex-col items-end">
                <span className="text-brand text-2xl font-bold tabular-nums">
                  #{entry.rank}
                </span>
                <span className="text-caption text-xs">
                  of {entry.circleSize}
                </span>
              </div>
            )}
          </div>
          {entry.categories.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {entry.categories.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: c.color ?? CHART_FALLBACK }}
                  />
                  <span className="text-body min-w-0 flex-1 truncate">
                    {c.name}
                  </span>
                  <span className="text-caption shrink-0 font-mono tabular-nums">
                    {fmtH(c.ms)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {entry.caption && (
          <p className="text-body text-sm text-pretty">{entry.caption}</p>
        )}

        {/* Social footer — kudos + comments (Phase 6b) */}
        <div className="border-divider flex flex-col gap-3 border-t pt-3">
          <RecapKudosButton
            recapId={entry.id}
            count={kudos.count}
            likedByMe={kudos.mine}
          />
          <RecapComments recapId={entry.id} comments={comments} />
        </div>
      </CardContent>
    </Card>
  );
}
