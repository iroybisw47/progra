"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

// Re-test switch: re-enters the onboarding wizard. It just navigates to
// /onboarding (which renders for any user) — it does NOT touch
// profiles.onboarded_at, which is write-once, so replaying never changes the
// user's original join date. Each replay still runs the real flow (creates a
// goal, etc.).
export function ReplayOnboardingButton() {
  const router = useRouter();

  return (
    <Button
      variant="outline"
      className="h-10 w-full"
      onClick={() => router.push("/onboarding")}
    >
      Replay onboarding
    </Button>
  );
}
