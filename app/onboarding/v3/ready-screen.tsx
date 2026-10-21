"use client";

import { WeekPulse } from "@/components/v2/week-pulse";
import { themedColor } from "@/lib/colors";
import { itemStyle, type ItemPhase } from "@/lib/motion";
import { readyNote } from "@/lib/onboarding-v3";

// Screen 6, "Start your first session" (R:146-152): the week strip breathing,
// "Ready?", and a pill naming the goal the Clock tab will open on, over a
// line about who'll see it. The goal is the first one Screen 2 listed, in the
// color it was drawn in there (readyGoal in lib/onboarding-v3-goals-habits.ts),
// in place of R's "Schoolwork" (R:150): the owner's call on 2026-10-09
// (OWNER-FIX-1), since the handoff now opens the normal Clock tab with that
// goal preselected rather than a generated Schoolwork category. It writes
// nothing and holds no state. The shell owns the "Start session" link and the
// exit (onboarding-client-v3.tsx, lib/clock-handoff.ts).
//
// Laid out in flow at the handoff's offsets rather than its absolute
// coordinates, so a short phone keeps everything above the CTA: the strip's
// top is y=178 in the 852 frame and the screens start at y=96 (under the top
// row), so 82px, then the gaps between R's y values. Five items on the shared
// item motion, in the prototype's order (P:353-365). Under reduced motion the
// v3 root's CSS rule stills the strip's bars.
//
// A goal's title can run to GOAL_TITLE_MAX (60) characters where R's
// "Schoolwork" is one word, so the pill's title wraps, long words included,
// rather than overflowing, and sits left-aligned beside its square, not
// centered like the rest of the screen. A single line fills the pill
// exactly either way. `goal` is null only with no goals at all, which
// Screen 2 makes unreachable (the dev preview can open a goal-less fixture
// here). The pill is left out then, rather than naming something that
// doesn't exist.
//
// `added` is how many people Screen 5 sent a request to, and `pending` how
// many of those are still waiting, which for requests sent minutes ago is all
// of them (D13: "added" is a pending request).
export function ReadyScreen({
  phase,
  reduced,
  goal,
  added,
  pending,
}: {
  phase: ItemPhase;
  reduced: boolean;
  goal: { title: string; color: string } | null;
  added: number;
  pending: number;
}) {
  return (
    <div className="flex flex-col items-center px-5 pt-[82px] text-center">
      <div className="w-[140px]" style={itemStyle(phase, 0, reduced)}>
        <WeekPulse />
      </div>
      <h2
        className="text-ink mt-7 font-serif text-[64px] leading-none font-medium tracking-[-0.03em]"
        style={itemStyle(phase, 1, reduced)}
      >
        Ready?
      </h2>
      <p
        className="text-caption mt-[22px] font-serif text-[24px] leading-[1.2] font-medium tracking-[-0.015em]"
        style={itemStyle(phase, 2, reduced)}
      >
        Start your first session on
      </p>
      {goal && (
        <div className="mt-[17px] flex max-w-full justify-center" style={itemStyle(phase, 3, reduced)}>
          <div className="border-control-border flex w-max max-w-full items-center gap-3 rounded-[18px] border-[1.5px] bg-card px-5 py-3.5">
            <span
              aria-hidden
              className="size-3 shrink-0 rounded-[3px]"
              style={{ backgroundColor: themedColor(goal.color) }}
            />
            <span className="text-ink min-w-0 text-left font-serif text-[24px] leading-[1.2] font-medium tracking-[-0.015em] break-words">
              {goal.title}
            </span>
          </div>
        </div>
      )}
      <p
        className="text-secondary-ink mx-5 mt-[25px] text-[13px] leading-[1.45] text-pretty"
        style={itemStyle(phase, 4, reduced)}
      >
        {readyNote(added, pending)}
      </p>
    </div>
  );
}
