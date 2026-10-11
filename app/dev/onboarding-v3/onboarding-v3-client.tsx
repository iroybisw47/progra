"use client";

import { useState } from "react";

import { OnboardingClientV3 } from "@/app/onboarding/onboarding-client-v3";
import { SCREEN } from "@/lib/onboarding-v3";
import {
  PREVIEW_LATENCY_MS,
  createPreviewServices,
  previewProfile,
  previewUwCohort,
  type PreviewFixture,
} from "@/lib/onboarding-v3-preview";

// The client half of the dev preview (page.tsx says what it's for). The fake
// services are made once per mount, so they're a stable object and the
// wizard's effects don't re-run on every render. The key remounts the wizard
// when the URL asks for a different screen, fixture, beat, search or UW
// variant, rather than carrying one fixture's typing into the next. The page
// keys this component by fixture, so the services start over with each one
// too: they hold the fixture's UW answer and cohort, which Screen 5's groups
// are built from (uw-groups, uw-early).
//
// Screen 6's "Start session" plays the whole exit, then starts the wizard
// over on Screen 1, the welcome (a remount, with the fixture's profile)
// instead of opening the real Clock tab, which needs an account. So the preview never navigates
// anywhere, and the link's address shows the goal the real one would open on.
export function OnboardingV3Client({
  screen,
  fixture,
  beat,
  query,
  uw,
}: {
  screen: number;
  fixture: PreviewFixture;
  beat: number;
  // Typed into Screen 5's search in place of the fixture's own.
  query?: string;
  // The UW variant (P9c): the welcome's Continue raises the UW sheet.
  uw: boolean;
}) {
  const { uwSheet, uwSelected, uwPage, ...profile } = previewProfile(fixture);
  // Bumped by each "Start session", which remounts the wizard on Screen 1.
  const [restarts, setRestarts] = useState(0);
  const [services] = useState(() =>
    createPreviewServices(PREVIEW_LATENCY_MS, {
      saved: profile.savedUw,
      cohort: previewUwCohort(fixture),
    })
  );
  return (
    <OnboardingClientV3
      key={`${fixture}:${screen}:${beat}:${query ?? ""}:${uw}:${restarts}`}
      {...profile}
      uw={uw}
      initialUwSheet={uwSheet}
      initialUwSelected={uwSelected}
      initialUwPage={uwPage}
      searchDraft={query ?? profile.searchDraft}
      services={services}
      initialScreen={restarts > 0 ? SCREEN.identity : screen}
      initialBeat={beat}
      onHandoff={() => setRestarts((n) => n + 1)}
    />
  );
}
