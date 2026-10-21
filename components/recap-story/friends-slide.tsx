import { HeartIcon } from "lucide-react";

import { AvatarInitials } from "@/components/avatar-initials";
import { InviteShare } from "@/components/v2/invite-share";
import { anim } from "@/lib/recap-story-nav";
import type { FriendsView, LikeRow } from "@/lib/recap-story";
import { cn } from "@/lib/utils";

import { CountUp } from "./count-up";
import { SlideFrame, SlideTitle, stopStory } from "./slide-frame";

// 05 · Friends: the circle's hours together, who you liked most and who liked
// you most, then either the top-three callout or — under three active friends,
// when there's no leaderboard yet — the invite.
export function FriendsSlide({ friends, still }: { friends: FriendsView; still: boolean }) {
  const likes = [friends.likedByYou, friends.likedYou].filter((r): r is LikeRow => r !== null);
  return (
    <SlideFrame label="Friends">
      <SlideTitle title="Friends" sub={friends.meta} />
      <div className="flex flex-1 flex-col justify-center gap-[26px] pb-4">
        {friends.groupHours !== null && (
          <p
            className="text-ink m-0 font-serif text-[29px] leading-[1.18] font-medium tracking-[-0.02em] text-pretty"
            style={{ animation: anim("rise", 0.55, 0.2) }}
          >
            Your group logged{" "}
            <span className="tabular-nums">
              <CountUp to={friends.groupHours} durationMs={1100} delayMs={350} still={still} />
            </span>{" "}
            {friends.groupUnit} together this week.
          </p>
        )}

        {likes.length > 0 && (
          <div className="border-divider flex flex-col border-b">
            {likes.map((row, i) => (
              <div
                key={row.text}
                className={cn(
                  "flex items-center gap-3 border-t py-3",
                  i === 0 ? "border-hairline" : "border-divider"
                )}
                style={{ animation: anim("slide", 0.5, i === 0 ? 0.95 : 1.12) }}
              >
                <AvatarInitials
                  name={row.person.displayName}
                  username={row.person.username}
                  avatarUrl={row.person.avatarUrl}
                  className="size-10 shrink-0 text-[13px]"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <span className="text-body text-sm leading-[1.25] font-semibold">{row.text}</span>
                  {row.countLabel && (
                    <span className="text-brand flex items-center gap-1 text-xs font-medium tabular-nums">
                      <HeartIcon size={13} fill="currentColor" strokeWidth={2} aria-hidden />
                      {row.countLabel}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {friends.top3 && (
          <div
            className="flex items-center gap-3.5 rounded-[25.92px] px-[18px] py-3.5"
            style={{ background: "color-mix(in srgb, var(--brand) 5%, transparent)", animation: anim("rise", 0.5, 1.45) }}
          >
            <span
              className="text-brand font-serif text-[30px] leading-none font-medium tracking-[-0.03em] tabular-nums"
              style={{ animation: anim("check", 0.4, 1.7, "ease") }}
            >
              #{friends.top3.rank}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-body text-sm leading-[1.25] font-semibold">
                You were in the top three this week.
              </span>
              <span className="text-faint text-[11px] leading-[1.3]">{friends.top3.of}</span>
            </div>
          </div>
        )}

        {friends.invite && (
          <div className="flex flex-col gap-3.5" style={{ animation: anim("rise", 0.5, 1.45) }}>
            <p className="text-secondary-ink m-0 text-[13.5px] leading-[1.45] text-pretty">{friends.invite}</p>
            {/* Its taps share or copy; they must never also turn the page. */}
            <div onPointerDown={stopStory} onPointerUp={stopStory}>
              <InviteShare />
            </div>
          </div>
        )}
      </div>
    </SlideFrame>
  );
}
