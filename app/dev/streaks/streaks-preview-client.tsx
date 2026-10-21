"use client";

import { AvatarInitials } from "@/components/avatar-initials";
import { StreakAnnouncement } from "@/components/v2/streak-announcement";
import { StreakBadge } from "@/components/v2/streak-badge";
import { STREAK_ANNOUNCEMENT_COPY } from "@/lib/streaks-config";
import { streakPreview, type StreakPreviewFixture } from "@/lib/streaks-preview";
import {
  announcementFor,
  freezesLine,
  friendBadge,
  myBadge,
} from "@/lib/streaks-view";

// The preview's body: /me's identity row (own fixtures) or
// /profile/[username]'s (friend fixtures), then /me's announcement slot.
// Markup and classes copied from those pages so the screenshot is honest.
export function StreaksPreviewClient({
  fixture,
  sheet,
}: {
  fixture: StreakPreviewFixture;
  sheet: boolean;
}) {
  const p = streakPreview(fixture);
  const own = p.own;
  const ownBadge = myBadge(own);
  const theirBadge = friendBadge(p.friend);
  const announcement = announcementFor({
    streak: own,
    seenDay: p.seenDay,
    copy: `${STREAK_ANNOUNCEMENT_COPY.title} ${STREAK_ANNOUNCEMENT_COPY.body}`,
    production: false,
  });

  return (
    <div className="flex flex-1 flex-col items-center pt-7 pb-28">
      <main className="flex w-full max-w-md flex-col">
        <header className="flex items-center justify-between px-5">
          <span className="section-label">{p.friend ? "Profile" : "You"}</span>
          <span className="text-faint text-[11px]">preview · {fixture}</span>
        </header>

        {p.friend ? (
          <div className="flex items-start gap-3.5 px-5 pt-4">
            <AvatarInitials name={p.name} username={p.handle} className="size-[58px] text-xl" />
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex flex-wrap items-center gap-x-1.5">
                <h1 className="text-ink font-serif text-[22px] font-medium tracking-[-0.015em]">{p.name}</h1>
                {theirBadge && p.friend.state === "live" && (
                  <StreakBadge
                    badge={theirBadge}
                    initialOpen={sheet}
                    sheet={{
                      variant: "friend",
                      name: p.name.split(" ")[0],
                      current: p.friend.current,
                      longest: p.friend.longest,
                    }}
                  />
                )}
              </div>
              <span className="text-faint text-[13px]">@{p.handle}</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3.5 px-5 pt-4">
            <AvatarInitials name={p.name} username={p.handle} className="size-[58px] text-xl" />
            <div className="flex min-w-0 flex-1 flex-col">
              {ownBadge && own?.state === "live" ? (
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="text-ink min-w-0 truncate font-serif text-[22px] font-medium tracking-[-0.015em]">
                    {p.name}
                  </span>
                  <StreakBadge
                    badge={ownBadge}
                    initialOpen={sheet}
                    sheet={{
                      variant: "own",
                      current: own.current,
                      longest: own.longest,
                      atRisk: own.atRisk,
                      freezesLine: freezesLine(own.freezesLeft, own.today),
                    }}
                  />
                </div>
              ) : (
                <span className="text-ink truncate font-serif text-[22px] font-medium tracking-[-0.015em]">
                  {p.name}
                </span>
              )}
              <span className="text-faint truncate text-[13px]">@{p.handle}</span>
            </div>
          </div>
        )}

        <div className="flex px-5 pt-[18px]">
          {["Hours", "Sessions", "Friends"].map((label, i) => (
            <div key={label} className="flex flex-1 flex-col gap-0.5">
              <span className="stat-num text-[21px]">{["48.5h", "61", "9"][i]}</span>
              <span className="text-disabled text-[9px] font-semibold uppercase tracking-[0.12em]">
                {label}
              </span>
            </div>
          ))}
        </div>

        {announcement && (
          <div className="px-5 pt-4">
            <StreakAnnouncement
              view={announcement}
              copy={STREAK_ANNOUNCEMENT_COPY}
              onDismiss={() => Promise.resolve()}
            />
          </div>
        )}

        <div className="bg-track border-hairline mt-5 h-1.5 border-t" />
      </main>
    </div>
  );
}
