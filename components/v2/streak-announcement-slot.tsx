import { EnsureStreakSettled } from "@/components/ensure-streak-settled";
import { StreakAnnouncement } from "@/components/v2/streak-announcement";
import { getProfile } from "@/lib/auth/profile";
import { getMyStreak } from "@/lib/db/streaks";
import { streakDayOf } from "@/lib/streaks";
import { STREAK_ANNOUNCEMENT_COPY } from "@/lib/streaks-config";
import { announcementFor } from "@/lib/streaks-view";

// The streak announcement card plus the settle leaf, for /me and /feed. Both
// reads are cache()'d, so on /me (which reads them for the badge too) this
// costs nothing extra. With the flag off getMyStreak is null and this renders
// nothing at all.
export async function StreakAnnouncementSlot({ className }: { className?: string }) {
  const [streak, profile] = await Promise.all([getMyStreak(), getProfile()]);
  if (!streak) return null;

  const seenAt = profile?.streak_announcement_seen_at;
  const seenDay = seenAt ? streakDayOf(Date.parse(seenAt), profile?.timezone ?? "UTC") : null;
  const view = announcementFor({
    streak,
    seenDay,
    copy: `${STREAK_ANNOUNCEMENT_COPY.title} ${STREAK_ANNOUNCEMENT_COPY.body}`,
    production: process.env.NODE_ENV === "production",
  });

  return (
    <>
      {view && (
        <div className={className}>
          <StreakAnnouncement view={view} copy={STREAK_ANNOUNCEMENT_COPY} />
        </div>
      )}
      {streak.state === "live" && (
        <EnsureStreakSettled unsettled={streak.unsettled} today={streak.today} />
      )}
    </>
  );
}
