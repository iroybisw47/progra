import { Card, CardContent } from "@/components/ui/card";
import { ReportButton } from "@/components/report-button";
import { formatDuration } from "@/lib/duration";
import { formatRelativeDay, formatTime } from "@/lib/dates";
import type { ProfileSessionItem } from "@/lib/db/profile-sessions";

// One finished session on a profile. Server component (no interactivity except
// the report control); the signed URL comes from listProfileSessions.
// `canReport` is false on your own profile.
//
// The report target type stays "story" — it's a report_target_type enum value
// persisted on existing `reports` rows and read by admin_take_down_story, so
// it's a wire format, not a label.
export function ProfileSessionCard({
  session,
  now,
  canReport = false,
}: {
  session: ProfileSessionItem;
  now: number;
  canReport?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="min-w-0 truncate text-sm font-medium">
            {session.isGoal ? (
              <span className="text-muted-foreground">Goal: </span>
            ) : null}
            {session.label}
          </span>
          <span className="flex shrink-0 items-center gap-3">
            <span className="text-muted-foreground font-mono text-sm tabular-nums">
              {formatDuration(session.workedMs)}
            </span>
            {canReport && (
              <ReportButton targetType="story" targetId={session.sessionId} />
            )}
          </span>
        </div>

        {session.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={session.photoUrl}
            alt=""
            className="aspect-square w-full rounded-md object-cover"
          />
        )}

        <span className="text-muted-foreground text-xs">
          {formatRelativeDay(new Date(session.endedAt), new Date(now))}
          {" · "}
          {formatTime(new Date(session.endedAt))}
        </span>
      </CardContent>
    </Card>
  );
}
