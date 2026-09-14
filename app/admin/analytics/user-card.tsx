import { Card, CardContent } from "@/components/ui/card";
import {
  daysBetweenISO,
  formatDaysAgo,
  isOpeningNotDoing,
  type AnalyticsUser,
} from "@/lib/admin-analytics";
import { goalColorOf } from "@/lib/colors";
import { formatRelativeTime } from "@/lib/dates";

import { Sparkline } from "./charts";

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="border-hairline text-caption rounded-full border px-1.5 py-px text-[10px] font-semibold tracking-[0.04em] uppercase">
      {children}
    </span>
  );
}

// One person. "Opened" and "Did something" sit side by side on purpose — the
// gap between them is the signal (see isOpeningNotDoing).
export function UserCard({
  user,
  sparkline,
  nowMs,
}: {
  user: AnalyticsUser;
  sparkline: { day: string; trackedMin: number; habitTicks: number }[];
  nowMs: number;
}) {
  const name = user.displayName ?? user.username ?? user.email ?? "no name set";
  const opened =
    user.lastSeenAt === null
      ? "—"
      : formatRelativeTime(Date.parse(user.lastSeenAt), nowMs);
  const didSomething =
    user.lastActiveOn === null
      ? "never"
      : formatDaysAgo(daysBetweenISO(user.lastActiveOn, user.localToday));
  const publicGoals = user.goals.filter((g) => !g.isPrivate);
  const privateCount = user.goals.length - publicGoals.length;

  return (
    <Card>
      <CardContent className="flex flex-col gap-2.5 py-3.5">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{name}</span>
            {user.seatNo != null && (
              <span className="text-caption shrink-0 text-xs tabular-nums">
                seat {user.seatNo}
              </span>
            )}
          </div>
          <p className="text-caption truncate text-xs">
            {user.username ? `@${user.username}` : "no username"}
            {user.email ? ` · ${user.email}` : ""}
          </p>
        </div>

        {(user.excluded ||
          user.seatNo === null ||
          user.onboardedOn === null ||
          isOpeningNotDoing(user, nowMs)) && (
          <div className="flex flex-wrap gap-1">
            {user.excluded && <Tag>excluded</Tag>}
            {user.seatNo === null && <Tag>waitlisted</Tag>}
            {user.onboardedOn === null && <Tag>not onboarded</Tag>}
            {isOpeningNotDoing(user, nowMs) && <Tag>opening, not doing</Tag>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex flex-col">
            <span className="text-caption">Opened</span>
            <span className="font-semibold">{opened}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-caption">Did something</span>
            <span className="font-semibold">{didSomething}</span>
          </div>
        </div>

        <Sparkline days={sparkline} />

        {user.goals.length === 0 ? (
          <p className="text-caption text-xs">No active goals.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {publicGoals.map((goal) => (
              <div key={goal.id} className="flex items-center gap-2">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: goalColorOf(goal) }}
                />
                <span className="min-w-0 flex-1 truncate text-[13px]">{goal.title}</span>
                <span className="text-caption shrink-0 text-xs tabular-nums">
                  {goal.weeklyQuotaHours}h/wk
                </span>
              </div>
            ))}
            {privateCount > 0 && (
              <p className="text-caption text-xs">+{privateCount} private</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
