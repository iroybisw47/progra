import Link from "next/link";
import { LockIcon, MessageCircleIcon } from "lucide-react";

import { AvatarInitials } from "@/components/avatar-initials";
import { CategoryMarker } from "@/components/category-marker";
import { KudosButton } from "@/components/kudos-button";
import { ReportButton } from "@/components/report-button";
import { entityColor, tint } from "@/lib/colors";
import type { CommentItem } from "@/lib/db/comments";
import type { SessionCardItem } from "@/lib/db/feed";
import type { PublicUser } from "@/lib/db/friends";
import { formatDuration } from "@/lib/duration";
import { formatRelativeTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

// One finished session, rendered identically on the Feed, the You tab, and
// profile pages. Extracted from FeedV2's inline card: the profile surface used
// to hand-roll its own and had drifted into showing only a label + duration,
// losing the title, description, category and the whole social row.
//
// Two surface differences, both opt-in so the feed keeps its exact appearance:
//
// - `author` omitted → no avatar/name row. The profile surfaces already show
//   whose page it is in the header, so repeating it on every card is noise. The
//   "clocked into ◈ x for 2h" sub-line and the timestamp still render.
// - `canReport` → shows the story report control. The feed deliberately has
//   none (reporting a story lives on /session/[id]), but profiles do, so this
//   preserves that moderation affordance rather than silently dropping it.
export function SessionCard({
  item,
  now,
  comments,
  kudos,
  author,
  canReport = false,
}: {
  item: SessionCardItem;
  now: number;
  comments: CommentItem[];
  kudos: { count: number; mine: boolean };
  author?: PublicUser;
  canReport?: boolean;
}) {
  const preview = comments[0];
  const a = item.attribution;
  const durationLabel = formatDuration(item.workedMs);

  // Timestamp, plus the report control when the surface allows it. Sits hard
  // right on whichever row it shares.
  const meta = canReport ? (
    <span className="flex shrink-0 items-center gap-2">
      <span className="text-faint text-xs">
        {formatRelativeTime(item.endedAt, now)}
      </span>
      <ReportButton targetType="story" targetId={item.sessionId} />
    </span>
  ) : (
    // Without a report control this is the feed's original single span — no
    // extra wrapper, so feed markup stays byte-identical.
    <span className="text-faint shrink-0 text-xs">
      {formatRelativeTime(item.endedAt, now)}
    </span>
  );

  // "clocked into ⟨marker⟩ {target} for {dur}" — a full sentence that wraps
  // rather than truncating.
  const subLine = (extra?: string) => (
    <span
      className={cn(
        "text-caption flex flex-wrap items-center gap-x-1 text-xs",
        extra
      )}
    >
      {a ? (
        <>
          clocked into
          <CategoryMarker isGoal={a.isGoal} color={a.color} />
          <span className="text-body font-medium break-words">{a.text}</span>
        </>
      ) : (
        <>clocked in</>
      )}
      <span>
        for{" "}
        <span className="text-body font-medium tabular-nums">
          {durationLabel}
        </span>
      </span>
    </span>
  );

  // The post's accent: whatever it was clocked into. Uncategorized falls back
  // to the neutral grey entityColor already returns.
  const accent = entityColor(a?.color ?? null);

  return (
    <article className="border-hairline flex flex-col gap-[9px] border-b px-5 py-4">
      {/* Header: who, what it counts towards, when */}
      <div className="flex items-center gap-[11px]">
        {author && (
          <Link href={`/profile/${author.username}`}>
            <AvatarInitials
              name={author.displayName}
              username={author.username}
              avatarUrl={author.avatarUrl}
              className="size-[34px] text-xs"
            />
          </Link>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          {author && (
            <Link
              href={`/profile/${author.username}`}
              className="text-body truncate text-[13px] leading-[1.25] font-semibold"
            >
              {author.displayName || `@${author.username}`}
            </Link>
          )}
          {subLine("leading-[1.3]")}
        </div>
        {meta}
      </div>

      {/* Body: title + description, taps through to the detail. */}
      <Link
        href={`/session/${item.sessionId}`}
        className="flex flex-col gap-[3px]"
      >
        <span className="text-ink font-serif text-[17px] font-medium tracking-[-0.01em]">
          {item.title}
        </span>
        {item.description ? (
          <p className="line-clamp-3 text-[13px] leading-[1.5] text-secondary-ink">
            {item.description}
          </p>
        ) : null}
      </Link>

      {/* Photo, whole. The design's fixed 180px band cropped every tall shot
          to a letterbox, so this is constrained by width alone and free in
          height — the image lands at its own aspect ratio, nothing cut off. No
          max-height either: capping it would letterbox a tall photo inside its
          own box, which is the thing we're removing.

          Raw <img>: the src is a short-lived signed URL into a private bucket
          that next/image can neither cache sanely nor reach without a
          remotePatterns allowlist. */}
      {item.photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.photoUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-auto w-full rounded-[14px]"
        />
      )}

      {/* Footer — duration pill in the session's own color + kudos/comments. A
          private session shows a Private chip instead: nobody else can see the
          post, so there is nothing to like and an "Add a comment" prompt would
          be a lie. */}
      <div className="flex items-center gap-3.5">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11px] font-semibold whitespace-nowrap tabular-nums"
          style={{ backgroundColor: tint(accent), color: accent }}
        >
          <span
            aria-hidden
            className="size-1.5 rounded-[2px]"
            style={{ backgroundColor: accent }}
          />
          {durationLabel}
        </span>
        <span className="flex-1" />
        {item.isPrivate ? (
          <span className="text-caption flex items-center gap-1.5 text-[11px] font-semibold">
            <LockIcon className="size-3.5" />
            Private
          </span>
        ) : (
          <div className="border-hairline flex items-center gap-0.5 rounded-full border p-0.5">
            <Link
              href={`/session/${item.sessionId}`}
              className="text-disabled hover:text-brand flex items-center gap-1 rounded-full px-2 py-[3px] text-[11px] font-semibold tabular-nums"
              aria-label={`${comments.length} comments`}
            >
              <MessageCircleIcon className="size-[13px]" />
              {comments.length > 0 && comments.length}
            </Link>
            <span aria-hidden className="bg-hairline h-3 w-px" />
            <KudosButton
              sessionId={item.sessionId}
              count={kudos.count}
              likedByMe={kudos.mine}
            />
          </div>
        )}
      </div>

      {/* Comment preview → session detail (kept alongside the count). Omitted
          on private sessions, which can never have comments. */}
      {!item.isPrivate && preview && (
        <Link
          href={`/session/${item.sessionId}`}
          className="border-divider flex flex-col gap-1.5 border-t pt-2.5"
        >
          <span className="text-xs leading-[1.4]">
            <span className="text-body font-semibold">
              {preview.author.displayName || `@${preview.author.username}`}
            </span>{" "}
            <span className="break-words text-secondary-ink">
              {preview.body}
            </span>
          </span>
          {comments.length > 1 && (
            <span className="text-caption text-[11px]">
              View all {comments.length} comments
            </span>
          )}
        </Link>
      )}
    </article>
  );
}
