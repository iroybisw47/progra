import type { CSSProperties } from "react";

import { AvatarInitials } from "@/components/avatar-initials";
import { anim } from "@/lib/recap-story-nav";
import type { RankView } from "@/lib/recap-story";

import { SlideFrame, SlideTitle } from "./slide-frame";

function badgeStyle(rank: number): CSSProperties {
  if (rank === 1) return { background: "var(--brand)", color: "#ffffff" };
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
