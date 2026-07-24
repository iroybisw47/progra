"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { BellIcon } from "lucide-react";

import { AvatarInitials } from "@/components/avatar-initials";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  fetchMyNotifications,
  markNotificationsSeen,
} from "@/app/actions/notifications";
import { formatRelativeTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type {
  NotificationItem,
  LikeNotification,
} from "@/lib/db/notifications-activity";

// Bell entry point in the Friends header. Opens a slide-over listing who liked
// (👍, collapsed per session) and commented (individual) on my own sessions.
// Opening marks everything seen — the unseen dot is server-seeded for a correct
// first paint, then cleared here.
export function NotificationsBell({ initialUnseen }: { initialUnseen: boolean }) {
  const [open, setOpen] = useState(false);
  const [unseen, setUnseen] = useState(initialUnseen);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [now, setNow] = useState(0);
  const [loading, startTransition] = useTransition();

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      // Clear the dot immediately and stamp seen server-side (fire-and-forget).
      setUnseen(false);
      void markNotificationsSeen();
      startTransition(async () => {
        const list = await fetchMyNotifications();
        setItems(list);
        setNow(Date.now());
      });
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={unseen ? "Notifications (new)" : "Notifications"}
        onClick={() => onOpenChange(true)}
        className="relative shrink-0"
      >
        <BellIcon className="size-5" />
        {unseen && (
          <span
            aria-hidden
            className="bg-brand absolute right-1.5 top-1.5 size-2 rounded-full ring-2 ring-[var(--screen)]"
          />
        )}
      </Button>

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Notifications</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {items === null || loading ? (
              <ul className="flex flex-col">
                {[0, 1, 2, 3].map((i) => (
                  <li key={i} className="flex gap-3 px-5 py-3">
                    <span className="size-9 shrink-0 animate-pulse rounded-full bg-muted" />
                    <div className="flex min-w-0 flex-1 flex-col gap-2 py-1">
                      <span className="h-3 w-3/4 animate-pulse rounded bg-muted" />
                      <span className="h-2.5 w-1/2 animate-pulse rounded bg-muted" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-1 px-6 py-16 text-center">
                <p className="text-sm font-medium">No notifications yet</p>
                <p className="text-caption text-sm">
                  Likes and comments on your sessions will show up here.
                </p>
              </div>
            ) : (
              <ul className="flex flex-col">
                {items.map((item) => (
                  <li key={item.key}>
                    <NotificationRow
                      item={item}
                      now={now}
                      onNavigate={() => setOpen(false)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function nameOf(u: { displayName: string | null; username: string }): string {
  return u.displayName ?? u.username;
}

// "A", "A and B", "A, B and 3 others" — from the most-recent-first reactor list.
function likeSummary(item: LikeNotification): string {
  const names = item.actors.map(nameOf);
  const total = item.totalActors;
  if (total <= 1) return names[0] ?? "Someone";
  if (total === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]}, ${names[1]} and ${total - 2} ${
    total - 2 === 1 ? "other" : "others"
  }`;
}

function NotificationRow({
  item,
  now,
  onNavigate,
}: {
  item: NotificationItem;
  now: number;
  onNavigate: () => void;
}) {
  const actor = item.kind === "like" ? item.actors[0] : item.author;
  const time = formatRelativeTime(item.latestAt, now);

  return (
    <Link
      href={`/session/${item.sessionId}`}
      onClick={onNavigate}
      className={cn(
        "flex gap-3 px-5 py-3 transition-colors hover:bg-muted/50",
        item.unread && "bg-brand/5"
      )}
    >
      <AvatarInitials
        name={actor ? nameOf(actor) : null}
        username={actor?.username ?? "?"}
        avatarUrl={actor?.avatarUrl ?? null}
        className="size-9 shrink-0 text-xs"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {item.kind === "like" ? (
          <p className="text-sm leading-snug">
            <span className="font-semibold">{likeSummary(item)}</span>{" "}
            liked your session
          </p>
        ) : (
          <>
            <p className="text-sm leading-snug">
              <span className="font-semibold">{nameOf(item.author)}</span>{" "}
              commented
            </p>
            <p className="text-ink/80 mt-0.5 line-clamp-2 text-sm leading-snug">
              {item.body}
            </p>
          </>
        )}
        <p className="text-caption mt-0.5 truncate text-xs">
          {item.sessionLabel} · {time}
        </p>
      </div>
    </Link>
  );
}
