"use client";

import { WeekPulse } from "@/components/v2/week-pulse";

import { rise } from "./onboarding-ui";

// The last thing onboarding shows: Ready / Set / GO!, a breathing week, and
// the week they just set up, in one line. Covers the shell (header and footer
// hide behind it) while completeOnboarding runs and home is prefetched.
export function DoneSplash({ summary }: { summary: string }) {
  return (
    <div className="bg-screen absolute inset-0 z-[5] flex flex-col items-center justify-center gap-7 p-6">
      <h1 className="text-ink text-center font-serif text-[52px] leading-[1.02] font-medium tracking-[-0.03em]">
        <span className="rise inline-block">Ready.</span>
        <br />
        <span className="rise inline-block" style={rise(".45s")}>
          Set.
        </span>
        <br />
        <span className="text-brand rise inline-block" style={rise(".95s")}>
          GO!
        </span>
      </h1>
      <WeekPulse className="rise w-[200px]" style={rise("1.4s")} />
      <p
        className="rise max-w-[300px] text-center text-sm leading-[1.6] text-pretty text-secondary-ink"
        style={rise("1.7s")}
      >
        {summary}
      </p>
    </div>
  );
}
