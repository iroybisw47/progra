"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState, useTransition } from "react";
import { BellIcon, FlagIcon } from "lucide-react";

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
import { NUDGES } from "@/lib/flags";
import { commentAnchorId } from "@/lib/social/comment-threads";
import { NUDGE_PRESETS, isNudgePreset } from "@/lib/social/nudges";
import { cn } from "@/lib/utils";
import type {
  NotificationItem,
  LikeNotification,
} from "@/lib/db/notifications-activity";

// Lazy: most panel opens never report anything, and this pulls in the whole
// report dialog.
const ReportButton = dynamic(() =>
  import("@/components/report-button").then((m) => m.ReportButton)
);

// Bell entry point in the Friends header. Opens a slide-over listing who liked
// (👍, collapsed per session), commented (individual), and nudged me
// (individual — a nudge is a person, not a tap). Opening marks everything seen:
// one `notifications_seen_at` covers all three, because they share this panel.
export function NotificationsBell({ initialUnseen }: { initialUnseen: boolean }) {
  const [open, setOpen] = useState(false);
  const [unseen, setUnseen] = useState(initialUnseen);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [now, setNow] = useState(0);
  const [loading, startTransition] = useTransition();
  // Which nudge the report dialog is open for, if any.
  const [reporting, setReporting] = useState<string | null>(null);

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
            className="bg-brand absolute right-1.5 top-1.5 size-2 rounded-full ring-2 ring-screen"
          />
        )}
      </Button>

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Notifications</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto overscroll-contain">
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
                  {NUDGES
                    ? "Likes, comments and nudges will show up here."
                    : "Likes and comments on your sessions will show up here."}
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
                      onReport={setReporting}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {reporting !== null && (
        <ReportButton
          targetType="nudge"
          targetId={reporting}
          open
          onOpenChange={(next: boolean) => {
            if (!next) setReporting(null);
          }}
        />
      )}
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

// Where a row navigates. Likes go to the session they're about; comments and
// replies land ON the comment (#c-{id}, which expands a collapsed thread); a
// nudge goes where its push would have — the clock picker with that goal
// preselected, or home for habits — so acting on it is one tap either way.
function hrefFor(item: NotificationItem): string {
  if (item.kind === "nudge") {
    if (item.targetKind === "habits") return "/";
    return item.goalId === null ? "/clock" : `/clock?goal=${item.goalId}`;
  }
  if (item.kind === "comment" || item.kind === "reply") {
    return `/session/${item.sessionId}#${commentAnchorId(item.commentId)}`;
  }
  return `/session/${item.sessionId}`;
}

function NotificationRow({
  item,
  now,
  onNavigate,
  onReport,
}: {
  item: NotificationItem;
  now: number;
  onNavigate: () => void;
  onReport: (nudgeId: string) => void;
}) {
  const actor =
    item.kind === "like"
      ? item.actors[0]
      : item.kind === "nudge"
        ? item.sender
        : item.author;
  const time = formatRelativeTime(item.latestAt, now);

  return (
    // The row is a link with a sibling Report button, not a button nested
    // inside an anchor — that nesting is invalid and makes the flag
    // unreachable by keyboard.
    <div
      className={cn(
        "flex items-start transition-colors hover:bg-muted/50",
        item.unread && "bg-brand/5"
      )}
    >
      <Link
        href={hrefFor(item)}
        onClick={onNavigate}
        className="flex min-w-0 flex-1 gap-3 px-5 py-3"
      >
        <AvatarInitials
          name={actor ? nameOf(actor) : null}
          username={actor?.username ?? "?"}
          avatarUrl={actor?.avatarUrl ?? null}
          className="size-9 shrink-0 text-xs"
        />
        <div className="flex min-w-0 flex-1 flex-col">
          {item.kind === "like" && (
            <p className="text-sm leading-snug">
              <span className="font-semibold">{likeSummary(item)}</span>{" "}
              liked your session
            </p>
          )}
          {(item.kind === "comment" || item.kind === "reply") && (
            <>
              <p className="text-sm leading-snug">
                <span className="font-semibold">{nameOf(item.author)}</span>{" "}
                {item.kind === "reply" ? "replied to you" : "commented"}
              </p>
              <p className="text-ink/80 mt-0.5 line-clamp-2 text-sm leading-snug">
                {item.body}
              </p>
            </>
          )}
          {item.kind === "nudge" && (
            <>
              <p className="text-sm leading-snug">
                <span className="font-semibold">{nameOf(item.sender)}</span>{" "}
                nudged you
              </p>
              {/* The preset copy lives in the app, never on the lock screen. */}
              <p className="text-ink/80 mt-0.5 text-sm leading-snug">
                {isNudgePreset(item.presetKey)
                  ? NUDGE_PRESETS[item.presetKey]
                  : item.presetKey}
              </p>
            </>
          )}
          <p className="text-caption mt-0.5 truncate text-xs">
            {item.kind === "nudge"
              ? item.targetKind === "habits"
                ? "Habits"
                : `Goal · ${item.targetLabel}`
              : item.sessionLabel}{" "}
            · {time}
          </p>
        </div>
      </Link>
      {item.kind === "nudge" && (
        <button
          type="button"
          aria-label="Report this nudge"
          onClick={() => onReport(item.nudgeId)}
          className="text-faint shrink-0 px-3 py-4 transition-transform active:scale-95"
        >
          <FlagIcon className="size-3.5" strokeWidth={1.9} />
        </button>
      )}
    </div>
  );
}
