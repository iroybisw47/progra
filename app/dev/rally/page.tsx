import { notFound } from "next/navigation";

import { parseRallyPreviewParams } from "@/lib/rally-preview";

import { RallyPreviewClient } from "./rally-preview-client";

// DEV ONLY: the Rally chip and its sheet with no sign-in and no database, for
// screenshots.
//
//   /dev/rally?fixture=cheer|nudge|both|nudge-streak|cooldown|disabled|too-early|
//                      in-session|done[&sheet=1]
//
// It renders the real chip and sheet from made-up states (lib/rally-preview.ts)
// in /profile/[username]'s identity row. Sending only toasts; nothing is
// written.
//
// It can never serve in production: `next build` runs with NODE_ENV
// "production", so the route 404s there before reading anything.
export default async function RallyPreviewPage({
  searchParams,
}: {
  // Next 16: searchParams is a Promise and must be awaited.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { fixture, sheet } = parseRallyPreviewParams(await searchParams);
  return <RallyPreviewClient key={`${fixture}-${sheet}`} fixture={fixture} sheet={sheet} />;
}
