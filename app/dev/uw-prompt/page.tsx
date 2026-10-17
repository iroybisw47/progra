import { notFound } from "next/navigation";

import { UwPromptPreviewClient } from "./uw-prompt-client";

// DEV ONLY: the UW info prompt (lib/uw-prompt.ts) with no sign-in and no
// database, for screenshots.
//
//   /dev/uw-prompt?fail=1
//
// The sheet opens at load as it does on Progress, for a member outside the
// cohort (the only people it's for); the Friends card under it reopens it.
// Every write goes to a fake that answers after 150ms and is logged on the
// page; `fail=1` makes them all fail. The UW flag isn't consulted.
//
// It can never serve in production: `next build` runs with NODE_ENV
// "production", so the route 404s there before reading anything.
export default async function UwPromptPreviewPage({
  searchParams,
}: {
  // Next 16: searchParams is a Promise and must be awaited.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const fail = (await searchParams).fail === "1";
  return <UwPromptPreviewClient key={String(fail)} fail={fail} />;
}
