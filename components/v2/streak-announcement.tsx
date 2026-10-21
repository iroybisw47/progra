"use client";

import { FlameIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { dismissStreakAnnouncement } from "@/app/actions/streaks";
import { track } from "@/lib/analytics";
import type { AnnouncementView } from "@/lib/streaks-view";

// Orange (palette 2), as the theme draws it.
const FIRE = { fill: "var(--palette-2)", ink: "var(--palette-2-ink)" };

// The streak announcement (.claude/plans/streaks.md §8a): a dismissible card
// on /me and /feed, never a takeover. Before Day One it says when counting
// starts; on or after it, it shows once more and then stays dismissed
// (announcementFor decides). The words are the owner's
// (STREAK_ANNOUNCEMENT_COPY).
export function StreakAnnouncement({
  view,
  copy,
  onDismiss,
}: {
  view: AnnouncementView;
  copy: { title: string; body: string };
  // Dev preview only; the real action otherwise.
  onDismiss?: () => Promise<unknown>;
}) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  function dismiss() {
    setHidden(true);
    track("streak_announcement_dismissed", { phase: view.phase });
    void (onDismiss ?? dismissStreakAnnouncement)();
  }

  return (
    <div className="border-hairline bg-card flex items-start gap-1 rounded-[18px] border py-1 pr-1 pl-3.5">
      <div className="flex min-w-0 flex-1 items-start gap-3 py-2.5">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full"
          style={{
            backgroundColor: `color-mix(in srgb, ${FIRE.fill} 13%, transparent)`,
            color: FIRE.ink,
          }}
        >
          <FlameIcon aria-hidden className="size-[18px]" strokeWidth={2.2} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-ink text-[14px] leading-tight font-semibold">
            {copy.title}
          </span>
          <span className="text-caption text-xs leading-snug text-pretty">
            {copy.body}
          </span>
          {view.phase === "prelaunch" && (
            <span className="text-secondary-ink pt-1 text-xs font-semibold">
              {view.when ? `Starts ${view.when}, from 4am` : "Coming soon"}
            </span>
          )}
        </span>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismiss}
        className="text-faint flex size-11 shrink-0 items-center justify-center rounded-full"
      >
        <XIcon className="size-4" />
      </button>
    </div>
  );
}
