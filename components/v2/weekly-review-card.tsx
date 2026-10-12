import Link from "next/link";
import { HeartIcon, MessageCircleIcon } from "lucide-react";

import { AvatarInitials } from "@/components/avatar-initials";
import { RecapKudosButton } from "@/components/v2/recap-kudos-button";
import { ReviewStats } from "@/components/v2/review-stats";
import { formatRelativeTime } from "@/lib/dates";
import type { RecapFeedItem } from "@/lib/db/feed";
import type { RecapKudos } from "@/lib/db/recap-social";
import { weekSpanLabel } from "@/lib/recap-story";
import { reviewStats, reviewStatsLine, reviewWeekISO } from "@/lib/weekly-review";

// A posted weekly review (RECAP_V2): hours tracked, % towards goals, % of
// habits done, and the caption. The post's own page is /review/[id], where the
// likes and the whole comment thread live; everything here links there.
//
// The week label is built from the stored week_start_ms (reviewWeekISO), never
// toLocaleDateString — the old card's labelled India's weeks a day early.
function weekLabel(item: RecapFeedItem): string {
  return weekSpanLabel(reviewWeekISO(item.weekStartMs));
}

// In the feed: a friend's post.
export function WeeklyReviewCard({
  entry,
  now,
  kudos,
  commentCount,
}: {
  entry: RecapFeedItem;
  now: number;
  kudos: RecapKudos;
  commentCount: number;
}) {
  const href = `/review/${entry.id}`;
  return (
    <article className="border-hairline flex flex-col gap-3.5 border-b px-5 py-4">
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
          <span className="text-faint text-[11px] leading-[1.3]">posted their weekly review</span>
        </div>
        <span className="text-disabled shrink-0 text-[11px]">{formatRelativeTime(entry.postedAt, now)}</span>
      </div>

      <Link
        href={href}
        className="flex flex-col gap-4 rounded-[25.92px] bg-[rgba(28,58,94,.05)] px-5 pt-4 pb-5"
      >
        <span className="text-faint text-[10px] leading-none font-semibold tracking-[.14em] whitespace-nowrap uppercase">
          {weekLabel(entry)}
        </span>
        <ReviewStats stats={reviewStats(entry)} />
      </Link>

      {entry.caption && (
        <p className="text-secondary-ink text-[13px] leading-[1.5] text-pretty">{entry.caption}</p>
      )}

      <div className="border-divider flex items-center gap-5 border-t pt-3">
        <RecapKudosButton recapId={entry.id} count={kudos.count} likedByMe={kudos.mine} />
        <Link
          href={href}
          className="text-caption hover:text-body flex items-center gap-1.5 text-xs font-medium"
          aria-label={commentCount ? `${commentCount} comments` : "Comment"}
        >
          <MessageCircleIcon className="size-4" />
          {commentCount > 0 ? <span className="tabular-nums">{commentCount}</span> : "Comment"}
        </Link>
      </div>
    </article>
  );
}

// On You and on a profile: one compact row per posted week, like the session
// rows below it.
export function WeeklyReviewRow({
  entry,
  likeCount,
  commentCount,
}: {
  entry: RecapFeedItem;
  likeCount: number;
  commentCount: number;
}) {
  return (
    <Link
      href={`/review/${entry.id}`}
      className="border-divider flex items-center gap-[11px] border-t px-5 py-[9px]"
    >
      <span aria-hidden className="bg-brand h-[26px] w-[3px] shrink-0 rounded-[2px]" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-body truncate text-[13px] leading-[1.25] font-semibold">{weekLabel(entry)}</span>
        <span className="text-faint truncate text-[11px] leading-[1.3]">
          {reviewStatsLine(reviewStats(entry))}
          {entry.caption && ` · ${entry.caption}`}
        </span>
      </div>
      {likeCount > 0 && (
        <span className="text-disabled flex shrink-0 items-center gap-1 text-[11px] font-semibold tabular-nums">
          <HeartIcon className="size-3" />
          {likeCount}
        </span>
      )}
      {commentCount > 0 && (
        <span className="text-disabled flex shrink-0 items-center gap-1 text-[11px] font-semibold tabular-nums">
          <MessageCircleIcon className="size-3" />
          {commentCount}
        </span>
      )}
    </Link>
  );
}

// The "Weekly reviews" section on You and on a profile. Nothing when empty.
export function WeeklyReviewsSection({
  title,
  items,
  kudos,
  commentCounts,
}: {
  title: string;
  items: RecapFeedItem[];
  kudos: Map<string, RecapKudos>;
  commentCounts: Map<string, number>;
}) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col">
      <div className="flex items-center gap-[7px] px-5 pt-4 pb-1.5">
        <span className="section-label">{title}</span>
        <span className="flex-1" />
        <span className="text-caption text-[10px] font-semibold tracking-[0.06em]">{items.length}</span>
      </div>
      {items.map((entry) => (
        <WeeklyReviewRow
          key={entry.id}
          entry={entry}
          likeCount={kudos.get(entry.id)?.count ?? 0}
          commentCount={commentCounts.get(entry.id) ?? 0}
        />
      ))}
    </section>
  );
}
