"use client";

import { useState } from "react";

import { OnboardingClientV4 } from "@/app/onboarding/onboarding-client-v4";
import {
  PREVIEW_LATENCY_MS,
  createPreviewServices,
  previewProfile,
  previewUwCohort,
  type PreviewFixture,
} from "@/lib/onboarding-v3-preview";
import { V4_SCREEN } from "@/lib/onboarding-v4";

// The client half of the v4 preview: v3's fixtures and fake services, made
// once per mount. The hand-off starts the wizard over on the welcome instead
// of opening the real Clock tab, which needs an account.
export function OnboardingV4Client({
  screen,
  howStep,
  fixture,
  uw,
  posted,
  notify,
  query,
}: {
  screen: number;
  howStep: number;
  fixture: PreviewFixture;
  uw: boolean;
  posted: boolean;
  notify: boolean;
  query?: string;
}) {
  const { uwSheet, uwSelected, uwPage, weekSegments: _week, ...profile } = previewProfile(fixture);
  void _week;
  const [restarts, setRestarts] = useState(0);
  const [services] = useState(() =>
    createPreviewServices(PREVIEW_LATENCY_MS, {
      saved: profile.savedUw,
      cohort: previewUwCohort(fixture),
    })
  );
  return (
    <OnboardingClientV4
      key={`${fixture}:${screen}:${howStep}:${uw}:${posted}:${notify}:${query ?? ""}:${restarts}`}
      {...profile}
      uw={uw}
      initialUwSheet={uwSheet}
      initialUwSelected={uwSelected}
      initialUwPage={uwPage}
      initialPosted={posted}
      searchDraft={query ?? profile.searchDraft}
      services={services}
      initialScreen={restarts > 0 ? V4_SCREEN.welcome : screen}
      initialHowStep={howStep}
      onHandoff={() => setRestarts((n) => n + 1)}
      // A browser reads "unavailable"; the preview shows a device never asked,
      // or one that already answered with notify=0.
      notifyPermission={notify ? "prompt" : "granted"}
    />
  );
}
