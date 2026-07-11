"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { replayOnboarding } from "@/app/actions/profile";

// Re-test switch: clears profiles.onboarded_at and re-enters the wizard.
// Each replay runs the real flow (creates a real goal + practice session).
export function ReplayOnboardingButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      className="h-10 w-full"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const r = await replayOnboarding();
          if ("error" in r) {
            toast.error(r.error);
            return;
          }
          router.push("/onboarding");
        });
      }}
    >
      Replay onboarding
    </Button>
  );
}
