"use client";

import { UwFields } from "@/components/uw-fields";

import { StepTemplate } from "../onboarding-ui";

// The UW step. Only in the run for a student who ticked "I'm a UW student" on
// welcome (lib/onboarding.ts activeSteps), and the only step whose answers are
// read by anyone other than the student themselves — which is why the
// goal-sharing switch sits on this screen and not in Settings alone.
//
// Every control lives in <UwFields/>, shared with Settings → Edit profile.
export function UwStep({
  eyebrow,
  major,
  onMajor,
  clubs,
  onClubs,
  shareGoals,
  onShareGoals,
}: {
  eyebrow: string | null;
  major: string;
  onMajor: (v: string) => void;
  clubs: readonly string[];
  onClubs: (next: string[]) => void;
  shareGoals: boolean;
  onShareGoals: (v: boolean) => void;
}) {
  return (
    <StepTemplate
      eyebrow={eyebrow}
      title={"Find your\npeople at UW."}
      body="Your major and your clubs are how other Huskies find you — and how you find the ones already putting in the hours."
    >
      <UwFields
        major={major}
        onMajor={onMajor}
        clubs={clubs}
        onClubs={onClubs}
        shareGoals={shareGoals}
        onShareGoals={onShareGoals}
      />
    </StepTemplate>
  );
}
