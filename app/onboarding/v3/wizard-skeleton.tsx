import { cn } from "@/lib/utils";

import { CLOSE_SLOT, CTA_REST_BOTTOM, V3_COLUMN, V3_FRAME, V3_TOP_ROW, aboveCta } from "./frame";

// Shimmer fill, as components/page-skeleton.tsx draws it.
const PULSE = "bg-track animate-pulse motion-reduce:animate-none";

function Bar({ w, h, className }: { w: string; h: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(PULSE, "block shrink-0 rounded-full", className)}
      style={{ width: w, height: h }}
    />
  );
}

// /onboarding's loading state while ONBOARDING_V3 is on: Screen 1's frame, so
// Settings → Replay doesn't flash the v2 wizard's layout before v3 paints
// (plan P3). Built from the same frame constants as the shell (frame.ts).
// A server component: no state, nothing to hydrate.
//
// Screen 1 is the welcome since OWNER-FIX-3, so these are its shapes, as the
// v2 skeleton draws them (components/page-skeleton.tsx, OnboardingBody): the
// 58px icon, the two-line headline, the tagline, the two fields and the
// avatar, centred above the CTA in v2's 24px gutters. The top row is empty on
// the welcome apart from the replay ✕ (CLOSE_SLOT), kept because /onboarding
// under v3 is Replay's route; its room is kept too, so nothing moves as the
// wizard paints.
export function WizardSkeleton() {
  return (
    <div className={V3_FRAME} role="status" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className={V3_COLUMN}>
        <div className={V3_TOP_ROW}>
          <span className="size-8 shrink-0" />
          <span className="min-w-0 flex-1" />
          <span className="size-7 shrink-0" />
          <span className={CLOSE_SLOT} />
        </div>
        <div className="relative min-h-0 flex-1">
          <div
            className="absolute inset-x-0 top-0 flex flex-col px-6"
            style={{ bottom: aboveCta(14) }}
          >
            <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center gap-[22px] pb-10">
              <span aria-hidden className={cn(PULSE, "block size-[58px] shrink-0 rounded-[13px]")} />
              <div className="flex flex-col gap-2.5">
                <Bar w="68%" h={32} className="rounded-[10px]" />
                <Bar w="44%" h={32} className="rounded-[10px]" />
              </div>
              <Bar w="84%" h={13} />
              <div className="flex flex-col gap-[18px] pt-1">
                <Bar w="30%" h={9} />
                <span aria-hidden className="border-hairline block h-[38px] border-b-2" />
                <Bar w="34%" h={9} />
                <span aria-hidden className="border-hairline block h-[38px] border-b-2" />
                <span aria-hidden className={cn(PULSE, "block size-14 shrink-0 rounded-full")} />
              </div>
            </div>
          </div>
        </div>
        <span
          aria-hidden
          className="bg-brand absolute inset-x-5 h-[52px] rounded-[15px] opacity-50"
          style={{ bottom: CTA_REST_BOTTOM }}
        />
      </div>
    </div>
  );
}
