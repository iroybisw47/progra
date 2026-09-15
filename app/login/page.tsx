import { redirect } from "next/navigation";
import type { CSSProperties } from "react";

import { getCurrentUser } from "@/lib/auth/require-user";
import { safeNextPath } from "@/lib/auth/safe-next";
import { AddToHomeHint } from "@/components/add-to-home-hint";
import { PrograMark } from "@/components/progra-mark";
import { TypedHeadline } from "@/components/v2/typed-headline";
import { WeekPulse } from "@/components/v2/week-pulse";

import { SignInButtons } from "./sign-in-buttons";

export const metadata = {
  title: "Sign in - Progra",
};

const rise = (delay: string) => ({ "--rise-delay": delay }) as CSSProperties;

// The sign-in screen (2026-09-15 redesign): the brand mark with drifting
// hands, the title typing itself in, one line on what Progra is, a week of
// pulsing bars, then the terms gate and the buttons — each rising in turn.
// `data-login` scopes the reduced-motion CSS rule that stills all of it.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; deleted?: string }>;
}) {
  const user = await getCurrentUser();

  const params = await searchParams;
  if (user) {
    // Default to home, not /clock, so the onboarding gate on `/` still fires
    // for an authenticated-but-not-yet-onboarded visitor (e.g. a stale bookmark).
    // safeNextPath rejects off-site redirect targets.
    redirect(safeNextPath(params.next));
  }

  return (
    <div
      data-login
      className="flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-12"
    >
      <main className="flex w-full max-w-[384px] flex-col gap-[22px]">
        <PrograMark
          size={58}
          motion="drift"
          className="self-start shadow-[0_14px_30px_-12px_rgba(28,58,94,.55)]"
          style={{ animation: "pop-in 0.55s cubic-bezier(.34,1.56,.64,1) both" }}
        />
        <TypedHeadline
          text="Progra"
          delayMs={300}
          charMs={55}
          className="text-ink rise font-serif text-[40px] leading-[1.08] font-medium tracking-[-0.02em]"
          style={rise(".1s")}
        />
        <p
          className="rise text-[15px] leading-[1.6] text-pretty text-secondary-ink"
          style={rise(".22s")}
        >
          Log self improvement sessions, track your habits, and share your
          progress with friends.
        </p>
        <WeekPulse className="rise" style={rise(".34s")} />

        {params.deleted != null && (
          <p className="border-hairline text-caption rounded-xl border px-4 py-3 text-center text-sm">
            Your account was deleted. Sign in again any time to start fresh.
          </p>
        )}

        <SignInButtons next={params.next} entrance />

        {params.error && (
          <p className="text-destructive text-center text-sm">{params.error}</p>
        )}

        <AddToHomeHint />
      </main>
    </div>
  );
}
