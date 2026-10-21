import { notFound } from "next/navigation";

import { parseStreakPreviewParams } from "@/lib/streaks-preview";

import { StreaksPreviewClient } from "./streaks-preview-client";

// DEV ONLY: the streak badge, its sheet and the announcement card (plan
// streaks P3/P4) with no sign-in and no database, for screenshots.
//
//   /dev/streaks?fixture=prelaunch|prelaunch-undated|zero|at-risk|12|
//                        milestone-30|400|freeze-used|launched-card|
//                        friend-5|friend-1|friend-prelaunch[&sheet=1]
//
// It renders the real components from made-up states (lib/streaks-preview.ts)
// in the same identity rows as /me and /profile/[username]. The flags aren't
// consulted, and the placeholder announcement copy shows here (never in a
// production build). A dismiss only hides the card.
//
// It can never serve in production: `next build` runs with NODE_ENV
// "production", so the route 404s there before reading anything.
export default async function StreaksPreviewPage({
  searchParams,
}: {
  // Next 16: searchParams is a Promise and must be awaited.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { fixture, sheet } = parseStreakPreviewParams(await searchParams);
  return <StreaksPreviewClient key={`${fixture}-${sheet}`} fixture={fixture} sheet={sheet} />;
}
