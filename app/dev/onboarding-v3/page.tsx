import { notFound } from "next/navigation";

import { UW } from "@/lib/flags";
import { parsePreviewParams } from "@/lib/onboarding-v3-preview";

import { OnboardingV3Client } from "./onboarding-v3-client";

// DEV ONLY: onboarding v3 with no sign-in and no database, for screenshots.
//
//   /dev/onboarding-v3?screen=1..7&fixture=welcome|welcome-filled|taken|replay
//                                                          (Screen 1, the welcome; taken shows
//                                                          the 23505 path on Continue)
//   /dev/onboarding-v3?fixture=goals|goals-full|habits|habit-custom
//                                                          (Screens 2 and 3; goals-full is
//                                                          Screen 2 at the cap, every hours box)
//   /dev/onboarding-v3?screen=4&fixture=habits&beat=1..3   (the intro, a first run)
//   /dev/onboarding-v3?fixture=tracked&beat=1..3           (the intro, a real week)
//   /dev/onboarding-v3?fixture=friends-search|friends-added|friends-known|friends-nohits
//                                                          (Screen 5 searching)
//   /dev/onboarding-v3?screen=5&fixture=habits             (Screen 5, not searching)
//   /dev/onboarding-v3?screen=5&q=zz                       (Screen 5, any search)
//   /dev/onboarding-v3?fixture=ready|ready-added           (the ready screen, nobody or one added)
//   /dev/onboarding-v3?screen=7                            (the notifications screen, last)
//   /dev/onboarding-v3?fixture=uw-sheet|uw-sheet-no|uw-page
//                                                          (the UW sheet up over the welcome:
//                                                          the tiles, Yes open, No selected)
//   /dev/onboarding-v3?fixture=uw-groups|uw-early          (Screen 5 for a UW student: the
//                                                          three groups, or "You're early")
//   /dev/onboarding-v3?...&uw=1                            (any fixture with UW on; uw=0, off)
//
// It renders the real wizard (app/onboarding/onboarding-client-v3.tsx) inside
// the normal root layout, on fake services (lib/onboarding-v3-preview.ts):
// setUsername refuses handles containing "taken" as taken, other writes
// answer { ok: true } after 150ms (a created goal, habit or friend request
// with a fake id), search finds a handful of made-up people, a share "goes
// through" with no sheet, the photo's upload and Remove send nothing, and
// analytics go nowhere. "Start session"
// plays its exit and then starts the preview over on Screen 1, rather than
// open the real Clock tab, which needs an account. The flag isn't
// consulted, so a screen can be looked at before ONBOARDING_V3 flips. UW's
// is, unless the URL says otherwise: the uw-* fixtures and `uw=1` show the
// UW sheet the welcome's Continue raises before NEXT_PUBLIC_UW flips, and the
// UW save answers as setUwProfile would. It's remembered by the fakes only:
// Screen 5's groups come from a fake list_uw_peers over a made-up cohort
// (lib/uw-peers-preview.ts), built from the fixture's answer or the one the
// sheet last saved, so a Yes with different majors shows different groups.
//
// It can never serve in production: `next build` runs with NODE_ENV
// "production", so the route 404s there before reading anything. Unlike
// /onboarding's `?step=` there is no user to skip writes for, but a page
// that renders the wizard to anyone signed out still doesn't belong on
// progra.world.
export default async function OnboardingV3PreviewPage({
  searchParams,
}: {
  // Next 16: searchParams is a Promise and must be awaited.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { screen, fixture, beat, query, uw } = parsePreviewParams(await searchParams);
  return (
    <OnboardingV3Client
      key={fixture}
      screen={screen}
      fixture={fixture}
      beat={beat}
      query={query}
      uw={uw ?? UW}
    />
  );
}
