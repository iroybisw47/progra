import type { CSSProperties } from "react";
import Link from "next/link";

import { AvatarInitials } from "@/components/avatar-initials";
import { anim } from "@/lib/recap-story-nav";
import type { GroupRankView, RankView } from "@/lib/recap-story";

import { SlideFrame, SlideTitle, stopStory } from "./slide-frame";

function badgeStyle(rank: number): CSSProperties {
  if (rank === 1) return { background: "var(--brand)", color: "var(--primary-foreground)" };
  if (rank <= 3) return { background: "var(--track)", color: "var(--body)" };
  return { background: "transparent", color: "var(--faint)" };
}

// 06 · Your rank (kept from today's story, denser): where you placed in your
// circle by clocked time, and the whole circle, edge to edge.
export function RankSlide({ rank }: { rank: RankView }) {
  return (
    <SlideFrame label="Your rank" gutter={false}>
      <SlideTitle title="Your rank" sub="By clocked time" className="px-6" />
      <div className="flex items-baseline gap-2.5 px-6 pt-[18px] pb-4">
        <span
          className="text-brand font-serif text-[68px] leading-[.9] font-medium tracking-[-0.035em] tabular-nums"
          style={{ transformOrigin: "left bottom", animation: anim("pop", 0.5, 0.25, "ease") }}
        >
          {rank.hero}
        </span>
        <span className="text-caption text-sm" style={{ animation: anim("fade", 0.4, 0.55, "ease") }}>
          {rank.of}
        </span>
      </div>
      <ol className="m-0 flex list-none flex-col p-0">
        {rank.rows.map((r, i) => (
          <li
            key={r.userId}
            className="border-divider flex items-center gap-2.5 border-t px-6 py-[9px]"
            style={{
              background: r.isMe ? "var(--tint-you)" : undefined,
              animation: anim("rise", 0.45, 0.55 + i * 0.07),
            }}
          >
            <span
              className="flex size-[22px] shrink-0 items-center justify-center rounded-full font-serif text-xs font-semibold tabular-nums"
              style={badgeStyle(r.rank)}
            >
              {r.rank}
            </span>
            <AvatarInitials
              name={r.person.displayName}
              username={r.person.username}
              avatarUrl={r.person.avatarUrl}
              className="size-[30px] shrink-0 text-[11px]"
            />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-body truncate text-[13px] leading-[1.25] font-semibold">{r.label}</span>
              <span className="text-faint text-[10.5px] leading-[1.3]">{r.sub}</span>
            </div>
            <span className="text-ink w-14 shrink-0 text-right text-[12.5px] font-semibold tabular-nums">
              {r.duration}
            </span>
          </li>
        ))}
      </ol>
    </SlideFrame>
  );
}

// 06 · Your rank, under GROUPS: the group is the one ranking now, so a row per
// group you're in — "#2", "of 14 in your group" — or "Invite your group" for
// one with nobody else in it yet. In no group at all, the line that sends you
// to the Groups tab instead.
export function GroupRankSlide({ rank }: { rank: GroupRankView }) {
  if (rank.kind === "none") {
    return (
      <SlideFrame label="Your rank">
        <SlideTitle title="Your rank" sub="By clocked time" />
        <div className="flex flex-col gap-4 pt-6" style={{ animation: anim("rise", 0.5, 0.35) }}>
          <p className="text-ink m-0 font-serif text-[24px] leading-[1.25] font-medium text-balance">{rank.text}</p>
          {/* Its tap navigates; it must never also turn the page. */}
          <div onPointerDown={stopStory} onPointerUp={stopStory}>
            <Link
              href={rank.href}
              className="bg-brand text-primary-foreground flex h-12 w-full items-center justify-center rounded-[15px] text-sm font-semibold"
            >
              Find a group
            </Link>
          </div>
        </div>
      </SlideFrame>
    );
  }
  return (
    <SlideFrame label="Your rank" gutter={false}>
      <SlideTitle title="Your rank" sub="By clocked time" className="px-6" />
      <ol className="m-0 flex list-none flex-col p-0 pt-4">
        {rank.rows.map((r, i) => (
          <li
            key={r.groupId}
            className="border-divider flex items-baseline gap-3 border-t px-6 py-3"
            style={{ animation: anim("rise", 0.45, 0.35 + i * 0.08) }}
          >
            {r.hero && (
              <span className="text-brand font-serif text-[40px] leading-none font-medium tracking-[-0.03em] tabular-nums">
                {r.hero}
              </span>
            )}
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-body truncate text-[14px] leading-[1.3] font-semibold">{r.name}</span>
              <span className="text-caption text-[12.5px]">{r.of}</span>
            </div>
          </li>
        ))}
      </ol>
    </SlideFrame>
  );
}
