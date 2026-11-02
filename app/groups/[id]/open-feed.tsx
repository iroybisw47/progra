"use client";

import Link from "next/link";

import { AvatarInitials } from "@/components/avatar-initials";
import { CategoryMarker } from "@/components/category-marker";
import type { GroupMemberRelation, OpenFeedItem } from "@/lib/db/groups";
import { formatDuration } from "@/lib/duration";
import { formatRelativeTime } from "@/lib/dates";
import { GROUP_COPY } from "@/lib/groups";
import { cn } from "@/lib/utils";

import { useGroupRelations } from "./use-group-relations";

// An open group's feed (auto_friend off): every member's shared sessions of
// the last week as view-only cards — who, what, what it counted towards, how
// long, when — each with what you are to them. There's no like or comment
// row: those stay friends-only. A friend's card opens the session page, where
// they live; anyone else's doesn't, and offers Add friend instead, which is
// how a big open group turns into friendships one person at a time.
//
// `relations` is the member list's read (listGroupMembers), by user id: every
// author here is a member, so the two always agree, and a tap here shows on
// both once the page revalidates.

// The 30px outlined button PersonRow uses, at the card's top right.
const SMALL_BUTTON =
  "relative flex h-[30px] shrink-0 items-center rounded-[10px] border-[1.5px] px-3 text-[12px] font-semibold transition-transform active:scale-[.94] before:absolute before:inset-x-0 before:-inset-y-[7px] before:content-['']";

export function OpenFeed({
  items,
  relations: read,
  now,
}: {
  items: OpenFeedItem[];
  relations: Record<string, GroupMemberRelation>;
  now: number;
}) {
  const relations = useGroupRelations();

  if (items.length === 0) {
    return (
      <p className="text-caption border-divider border-t px-5 py-4 text-[13px] text-pretty">
        {GROUP_COPY.openFeedEmpty}
      </p>
    );
  }

  return (
    <div className="flex flex-col">
      {items.map((item) => {
        const relation = relations.relationOf(
          item.author.userId,
          read[item.author.userId] ?? { kind: "none" },
        );
        const isFriend = relation.kind === "friends";
        const a = item.attribution;
        const name = item.author.displayName || `@${item.author.username}`;
        const body = (
          <span className="text-ink font-serif text-[17px] font-medium tracking-[-0.01em]">
            {item.title}
          </span>
        );
        return (
          <article
            key={item.sessionId}
            className="border-hairline flex flex-col gap-[9px] border-b px-5 py-4"
          >
            <div className="flex items-center gap-[11px]">
              <Link href={`/profile/${item.author.username}`}>
                <AvatarInitials
                  name={item.author.displayName}
                  username={item.author.username}
                  avatarUrl={item.author.avatarUrl}
                  className="size-[34px] text-xs"
                />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <Link
                  href={`/profile/${item.author.username}`}
                  className="text-body truncate text-[13px] leading-[1.25] font-semibold"
                >
                  {name}
                </Link>
                <span className="text-caption flex flex-wrap items-center gap-x-1 text-xs leading-[1.3]">
                  {a ? (
                    <>
                      clocked into
                      <CategoryMarker isGoal={a.isGoal} color={a.color} />
                      <span className="text-body font-medium break-words">
                        {a.text}
                      </span>
                    </>
                  ) : (
                    <>clocked in</>
                  )}
                  <span>
                    for{" "}
                    <span className="text-body font-medium tabular-nums">
                      {formatDuration(item.workedMs)}
                    </span>
                  </span>
                  <span className="text-faint">
                    · {formatRelativeTime(item.endedAt, now)}
                  </span>
                </span>
              </div>
              {relation.kind === "none" && (
                <button
                  type="button"
                  onClick={() => relations.add(item.author)}
                  className={cn(
                    SMALL_BUTTON,
                    "border-control-border text-caption bg-card",
                  )}
                >
                  {GROUP_COPY.addFriend}
                  <span className="sr-only"> {name}</span>
                </button>
              )}
              {relation.kind === "incoming" && (
                <button
                  type="button"
                  onClick={() =>
                    relations.accept(item.author, relation.requestId)
                  }
                  className={cn(
                    SMALL_BUTTON,
                    "border-brand bg-brand text-primary-foreground",
                  )}
                >
                  Accept<span className="sr-only"> {name}</span>
                </button>
              )}
              {relation.kind === "outgoing" && (
                <span className="text-caption shrink-0 text-[13px] font-semibold">
                  Requested
                </span>
              )}
              {isFriend && (
                <span className="text-body shrink-0 text-[13px] font-semibold">
                  Friends
                </span>
              )}
            </div>
            {isFriend ? (
              <Link
                href={`/session/${item.sessionId}`}
                className="flex flex-col"
              >
                {body}
              </Link>
            ) : (
              body
            )}
          </article>
        );
      })}
    </div>
  );
}
