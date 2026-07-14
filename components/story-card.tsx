import { Card, CardContent } from "@/components/ui/card";
import { ReportButton } from "@/components/report-button";
import { formatDuration } from "@/lib/duration";
import { formatRelativeDay, formatTime } from "@/lib/dates";
import type { StoryItem } from "@/lib/db/stories";

// A profile story: the before/after pair for one complete session. Server
// component (no interactivity except the report control); signed URLs come from
// listProfileStories. `canReport` is false on your own profile.
export function StoryCard({
  story,
  now,
  canReport = false,
}: {
  story: StoryItem;
  now: number;
  canReport?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="min-w-0 truncate text-sm font-medium">
            {story.isGoal ? (
              <span className="text-muted-foreground">Goal: </span>
            ) : null}
            {story.label}
          </span>
          <span className="flex shrink-0 items-center gap-3">
            <span className="text-muted-foreground font-mono text-sm tabular-nums">
              {formatDuration(story.workedMs)}
            </span>
            {canReport && (
              <ReportButton targetType="story" targetId={story.sessionId} />
            )}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <figure className="flex flex-col gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={story.beforeUrl}
              alt="Before"
              className="aspect-square w-full rounded-md object-cover"
            />
            <figcaption className="text-muted-foreground text-center text-xs uppercase tracking-wider">
              Before
            </figcaption>
          </figure>
          <figure className="flex flex-col gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={story.afterUrl}
              alt="After"
              className="aspect-square w-full rounded-md object-cover"
            />
            <figcaption className="text-muted-foreground text-center text-xs uppercase tracking-wider">
              After
            </figcaption>
          </figure>
        </div>

        <span className="text-muted-foreground text-xs">
          {formatRelativeDay(new Date(story.endedAt), new Date(now))}
          {" · "}
          {formatTime(new Date(story.endedAt))}
        </span>
      </CardContent>
    </Card>
  );
}
