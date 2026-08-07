import Link from "next/link";

import { AvatarInitials } from "@/components/avatar-initials";
import { HabitKudosButton } from "@/components/v2/habit-kudos-button";
import { Card, CardContent } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/dates";
import type { HabitCheckoffItem } from "@/lib/db/feed";
import type { HabitKudos } from "@/lib/db/habit-social";

// One habit check-off in the feed.
//
// Deliberately the lightest card in the feed: every check-off posts its own
// card, so someone working through a morning routine can put several in a row
// in front of their friends. It sits a step below the `join` card (which uses
// py-4 and a size-10 avatar) and roughly a third the height of a session card,
// which stacks avatar + title + attribution + description + photo + a social
// row. One line, a size-8 avatar, and a single inline heart — no comment
// thread, which would defeat the point.
export function HabitCheckoffCard({
  entry,
  now,
  kudos,
}: {
  entry: HabitCheckoffItem;
  now: number;
  kudos: HabitKudos;
}) {
  const name = entry.author.displayName || `@${entry.author.username}`;

  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-3">
        <Link href={`/profile/${entry.author.username}`} className="shrink-0">
          <AvatarInitials
            name={entry.author.displayName}
            username={entry.author.username}
            avatarUrl={entry.author.avatarUrl}
            className="size-8 text-xs"
          />
        </Link>

        <p className="min-w-0 flex-1 text-sm leading-snug">
          <Link
            href={`/profile/${entry.author.username}`}
            className="font-bold hover:underline"
          >
            {name}
          </Link>{" "}
          <span className="text-caption">checked off</span>{" "}
          <span className="inline-flex items-baseline gap-1.5 font-medium">
            {/* The habit's palette colour, falling back to a neutral dot when
                the habit has none. aria-hidden: the name carries the meaning. */}
            <span
              aria-hidden="true"
              className="inline-block size-2 shrink-0 self-center rounded-full"
              style={{ backgroundColor: entry.habitColor ?? "var(--caption)" }}
            />
            {entry.habitName}
          </span>
        </p>

        <span className="text-faint shrink-0 text-xs">
          {formatRelativeTime(entry.postedAt, now)}
        </span>

        <HabitKudosButton
          completionId={entry.id}
          count={kudos.count}
          likedByMe={kudos.mine}
        />
      </CardContent>
    </Card>
  );
}
