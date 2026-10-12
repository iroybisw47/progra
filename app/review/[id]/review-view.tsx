import Link from "next/link";

import { AvatarInitials } from "@/components/avatar-initials";
import { ReportButton } from "@/components/report-button";
import { BackButton } from "@/components/v2/back-button";
import { RecapKudosButton } from "@/components/v2/recap-kudos-button";
import { RecapCommentComposer, RecapThread } from "@/components/v2/recap-thread";
import { ReviewStats } from "@/components/v2/review-stats";
import { formatRelativeTime } from "@/lib/dates";
import type { RecapFeedItem } from "@/lib/db/feed";
import type { RecapComment, RecapKudos } from "@/lib/db/recap-social";
import { weekSpanLabel } from "@/lib/recap-story";
import { reviewStats, reviewWeekISO } from "@/lib/weekly-review";

// A posted weekly review, in full — the session page's layout (back, author,
// the post in serif, the like pill, then Comments), with the week's three
// numbers where a session has its duration. Presentational: page.tsx loads.
export function ReviewView({
  post,
  kudos,
  comments,
  now,
}: {
  post: RecapFeedItem & { isOwn: boolean };
  kudos: RecapKudos;
  comments: RecapComment[];
  now: number;
}) {
  return (
    <div className="flex flex-1 flex-col items-center pt-7 pb-28">
      <main className="flex w-full max-w-md flex-col">
        <header className="flex items-center gap-2.5 px-5">
          <BackButton />
          <span className="section-label">Weekly review</span>
          <span className="flex-1" />
          {!post.isOwn && <ReportButton targetType="recap" targetId={post.id} label="Report" />}
        </header>

        <div className="flex items-center gap-[11px] px-5 pt-4">
          <Link href={`/profile/${post.author.username}`}>
            <AvatarInitials
              name={post.author.displayName}
              username={post.author.username}
              avatarUrl={post.author.avatarUrl}
              className="size-[38px] text-sm"
            />
          </Link>
          <Link
            href={`/profile/${post.author.username}`}
            className="text-body min-w-0 flex-1 truncate text-sm font-semibold"
          >
            {post.isOwn ? "You" : post.author.displayName || `@${post.author.username}`}
          </Link>
          <span className="text-faint shrink-0 text-xs">{formatRelativeTime(post.postedAt, now)}</span>
        </div>

        <h1 className="text-ink px-5 pt-3 font-serif text-[26px] leading-[1.15] font-medium tracking-[-0.015em] text-pretty">
          {weekSpanLabel(reviewWeekISO(post.weekStartMs))}
        </h1>

        <div className="px-5 pt-4">
          <div className="rounded-[25.92px] bg-[rgba(28,58,94,.05)] px-5 py-5">
            <ReviewStats stats={reviewStats(post)} size="lg" />
          </div>
        </div>

        {post.caption && (
          <p className="text-secondary-ink px-5 pt-3.5 text-[14.5px] leading-[1.6] text-pretty">{post.caption}</p>
        )}

        <div className="flex items-center px-5 pt-4">
          <span className="flex-1" />
          <div className="border-hairline flex items-center rounded-full border px-3 py-1.5">
            <RecapKudosButton recapId={post.id} count={kudos.count} likedByMe={kudos.mine} />
          </div>
        </div>

        <div className="bg-track border-hairline mt-6 h-1.5 border-t" aria-hidden />

        <div className="flex items-center gap-[7px] px-5 pt-[18px] pb-2">
          <span className="section-label">Comments</span>
          <span className="flex-1" />
          {comments.length > 0 && (
            <span className="text-caption text-[10px] font-semibold tracking-[0.06em] tabular-nums">
              {comments.length}
            </span>
          )}
        </div>
        <RecapThread comments={comments} now={now} />

        <div className="border-divider border-t px-5 pt-3.5">
          <RecapCommentComposer recapId={post.id} />
        </div>
      </main>
    </div>
  );
}
