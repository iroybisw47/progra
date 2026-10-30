"use client";

import Image from "next/image";
import { BellIcon } from "lucide-react";
import type { ReactNode } from "react";

import { themedColor } from "@/lib/colors";
import { EASING, itemStyle, type ItemPhase } from "@/lib/motion";
import type { FirstGoal } from "@/lib/onboarding-v4";

// Screen 08, "Allow notifications?" (R:136-147): the last step, shown only
// while iOS can still ask (the shell's notifyScreenShown). Two lock-screen
// banners say what they'd be for, a like on your post and a reminder to clock
// in, both naming goal 1. The CTA ("Turn on notifications") and the skip link
// ("Not now") are the shell's: either way the run then ends.

// The banners drop in this long after the screen arrives (R:145).
const BANNER_DELAYS_MS = [420, 640] as const;

function Banner({
  title,
  time,
  shown,
  delayMs,
  reduced,
  children,
}: {
  title: string;
  time: string;
  shown: boolean;
  delayMs: number;
  reduced: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className="border-hairline relative z-[1] flex gap-[11px] rounded-[18px] border bg-card px-3.5 pt-3 pb-[13px]"
      style={{
        opacity: shown ? 1 : 0,
        transform: shown || reduced ? "none" : "translateY(-12px) scale(0.97)",
        transition: shown
          ? reduced
            ? `opacity 200ms linear ${delayMs}ms`
            : `opacity 260ms linear ${delayMs}ms, transform 560ms ${EASING.SPRING} ${delayMs}ms`
          : "opacity 160ms linear",
      }}
    >
      <Image
        src="/progra-logo.png"
        alt=""
        width={34}
        height={34}
        className="size-[34px] shrink-0 rounded-[8px]"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-baseline gap-2">
          <span className="text-body min-w-0 flex-1 truncate text-[13px] font-semibold">{title}</span>
          <span className="text-faint shrink-0 text-[11px]">{time}</span>
        </div>
        <span className="text-secondary-ink text-[12.5px] leading-[1.4]">{children}</span>
      </div>
    </div>
  );
}

function Goal({ goal }: { goal: FirstGoal }) {
  return (
    <>
      <span
        aria-hidden
        className="inline-block size-[7px] rounded-[2px] align-middle"
        style={{ background: themedColor(goal.color) }}
      />{" "}
      <span className="text-body font-medium">{goal.title}</span>
    </>
  );
}

export function NotifyScreen({
  phase,
  reduced,
  goal,
}: {
  phase: ItemPhase;
  reduced: boolean;
  goal: FirstGoal;
}) {
  const active = phase === "active";
  return (
    <div className="absolute inset-x-0 top-0 bottom-[108px] overflow-y-auto overscroll-contain px-6">
      <div className="mx-auto flex max-w-[420px] flex-col pt-[18px] pb-6">
        <span className="section-label" style={itemStyle(phase, 0, reduced)}>
          Last step
        </span>
        <h2
          className="text-ink mt-3 font-serif text-[32px] leading-[1.1] font-medium tracking-[-0.02em]"
          style={itemStyle(phase, 1, reduced)}
        >
          Allow notifications?
        </h2>

        <div
          className="bg-inset mt-[22px] flex flex-col rounded-[22px] px-3.5 pt-4 pb-5"
          style={itemStyle(phase, 2, reduced)}
        >
          <span className="text-secondary-ink px-1 text-[12px] leading-[1.3] font-semibold">
            When your friends like your posts
          </span>
          <div className="mt-2">
            <Banner
              title="Priya liked your post"
              time="now"
              shown={active}
              delayMs={BANNER_DELAYS_MS[0]}
              reduced={reduced}
            >
              1h 20m on <Goal goal={goal} />
            </Banner>
          </div>

          <span className="text-secondary-ink mt-[18px] px-1 text-[12px] leading-[1.3] font-semibold">
            To remind you to clock in
          </span>
          <div className="relative mt-2">
            {/* A second notification peeking out under it. */}
            <span
              aria-hidden
              className="border-hairline absolute inset-x-3 -bottom-[7px] h-6 rounded-[16px] border bg-white"
              style={{
                opacity: active ? 0.7 : 0,
                transition: active
                  ? `opacity 260ms linear ${BANNER_DELAYS_MS[1]}ms`
                  : "opacity 160ms linear",
              }}
            />
            <Banner
              title="Time to clock in"
              time="5:30 PM"
              shown={active}
              delayMs={BANNER_DELAYS_MS[1]}
              reduced={reduced}
            >
              Still time for <Goal goal={goal} /> today.
            </Banner>
          </div>
        </div>

        <p
          className="text-caption mt-4 flex items-center justify-center gap-1.5 text-[12.5px]"
          style={itemStyle(phase, 3, reduced)}
        >
          <BellIcon aria-hidden className="size-3.5 shrink-0" strokeWidth={2} />
          You can always turn them off.
        </p>
      </div>
    </div>
  );
}
