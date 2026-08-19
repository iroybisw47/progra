"use client";

import { useRouter } from "next/navigation";

// Re-test switch: re-enters the onboarding wizard. It just navigates to
// /onboarding (which renders for any user) — it does NOT touch
// profiles.onboarded_at, which is write-once, so replaying never changes the
// user's original join date. Each replay still runs the real flow (creates a
// goal, etc.).
export function ReplayOnboardingButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push("/onboarding")}
      className="border-control-border text-body h-11 w-full rounded-[13px] border-[1.5px] text-sm font-semibold transition-transform active:scale-[.98]"
    >
      Replay onboarding
    </button>
  );
}
