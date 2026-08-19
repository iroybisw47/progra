import Link from "next/link";

import { AvatarInitials } from "@/components/avatar-initials";
import { ReportButton } from "@/components/report-button";
import { RecapComments } from "@/components/v2/recap-comments";
import { RecapKudosButton } from "@/components/v2/recap-kudos-button";
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
    <article className="border-hairline flex flex-col gap-3.5 border-b px-5 py-4">
      {/* Header */}
      <div className="flex items-center gap-[11px]">
        <Link href={`/profile/${entry.author.username}`}>
          <AvatarInitials
            name={entry.author.displayName}
            username={entry.author.username}
            avatarUrl={entry.author.avatarUrl}
            className="size-[34px] text-xs"
          />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col">
          <Link
            href={`/profile/${entry.author.username}`}
            className="text-body truncate text-[13px] leading-[1.25] font-semibold"
          >
            {entry.author.displayName || `@${entry.author.username}`}
          </Link>
          <span className="text-faint text-[11px] leading-[1.3]">
            posted their weekly recap
          </span>
        </div>
        <span className="text-disabled shrink-0 text-[11px]">
          {formatRelativeTime(entry.postedAt, now)}
        </span>
      </div>

      {/* Summary panel — a navy wash sets the week apart from a session post */}
      <div className="flex flex-col gap-3 rounded-2xl bg-[rgba(28,58,94,.05)] p-4">
        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-faint text-[11px]">
              Week of {weekRange(entry.weekStartMs)}
            </span>
            <span className="stat-num text-3xl leading-tight">
              {formatDuration(entry.totalTrackedMs)}
            </span>
            <span className="text-caption text-[11px]">tracked</span>
          </div>
          {entry.rank != null && (
            <div className="flex shrink-0 flex-col items-end">
              <span className="stat-num text-brand text-2xl">
                #{entry.rank}
              </span>
              <span className="text-caption text-[11px]">
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
                  className="size-2 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: c.color ?? CHART_FALLBACK }}
                />
                <span className="text-body min-w-0 flex-1 truncate">
                  {c.name}
                </span>
                <span className="text-ink shrink-0 font-semibold tabular-nums">
                  {fmtH(c.ms)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {entry.caption && (
        <p className="text-[13px] leading-[1.5] text-pretty text-secondary-ink">
          {entry.caption}
        </p>
      )}

      {/* Social footer — kudos + comments, report */}
      <div className="border-divider flex flex-col gap-3 border-t pt-3">
        <div className="flex items-center justify-between gap-3">
          <RecapKudosButton
            recapId={entry.id}
            count={kudos.count}
            likedByMe={kudos.mine}
          />
          <ReportButton targetType="recap" targetId={entry.id} label="Report" />
        </div>
        <RecapComments recapId={entry.id} comments={comments} />
      </div>
    </article>
  );
}
