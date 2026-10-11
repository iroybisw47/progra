import { notFound } from "next/navigation";

import { parseUwSettingsParams } from "@/lib/uw-settings-preview";

import { UwSettingsPreviewClient } from "./uw-settings-client";

// DEV ONLY: the Settings UW block (plan P9b) with no sign-in and no database,
// for screenshots.
//
//   /dev/uw-settings?fixture=member|unlisted|new&save=fail
//
// It renders the real block (components/uw-fields.tsx) where Edit profile
// does, under a hairline and over the sheet's Save, from a made-up saved
// profile (lib/uw-settings-preview.ts). Save runs the real saveUwBlock on a
// fake setUwProfile that answers after 150ms: the input goes through the real
// payload builder and the preview then holds what that would store, shown
// under the button, so a leave, a join or an opt-in can be watched landing.
// `save=fail` makes every Save fail the way the action does. The UW flag
// isn't consulted, so the block can be looked at before it flips.
//
// It can never serve in production: `next build` runs with NODE_ENV
// "production", so the route 404s there before reading anything.
export default async function UwSettingsPreviewPage({
  searchParams,
}: {
  // Next 16: searchParams is a Promise and must be awaited.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { fixture, fail } = parseUwSettingsParams(await searchParams);
  return <UwSettingsPreviewClient key={`${fixture}:${fail}`} fixture={fixture} fail={fail} />;
}
