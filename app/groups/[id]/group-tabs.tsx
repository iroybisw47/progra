"use client";

import { useState, type ReactNode } from "react";

import { CHIP, CHIP_OFF, CHIP_ON, ChipRail } from "@/components/v2/period-chips";
import { GROUP_COPY } from "@/lib/groups";
import { cn } from "@/lib/utils";

type Tab = "leaderboard" | "feed" | "members";

// The group page's three views under one switcher — the Progress tab's
// Today/Week chips (components/v2/period-chips.tsx) — so up to fifty member
// rows don't push the feed off the bottom. Each view is rendered on the server
// and handed in; this only picks which one shows.
export function GroupTabs({
  leaderboard,
  feed,
  members,
  memberCount,
}: {
  leaderboard: ReactNode;
  feed: ReactNode;
  members: ReactNode;
  memberCount: number;
}) {
  const [tab, setTab] = useState<Tab>("leaderboard");
  const tabs: { key: Tab; label: string }[] = [
    { key: "leaderboard", label: GROUP_COPY.leaderboard },
    { key: "feed", label: GROUP_COPY.feed },
    { key: "members", label: `${GROUP_COPY.members} · ${memberCount}` },
  ];
  return (
    <>
      <div className="px-5 pt-5">
        <ChipRail>
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              aria-pressed={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(CHIP, "flex-1", tab === t.key ? CHIP_ON : CHIP_OFF)}
            >
              {t.label}
            </button>
          ))}
        </ChipRail>
      </div>
      {/* All three stay mounted, so a member row's pending tap survives a
          switch away and back. */}
      <div hidden={tab !== "leaderboard"}>{leaderboard}</div>
      <div hidden={tab !== "feed"} className="pt-3">
        {feed}
      </div>
      <div hidden={tab !== "members"}>{members}</div>
    </>
  );
}
