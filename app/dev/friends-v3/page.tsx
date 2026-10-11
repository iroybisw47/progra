import { notFound } from "next/navigation";

import { BottomNav } from "@/components/bottom-nav";
import { getProfile } from "@/lib/auth/profile";
import { getOptionalUser } from "@/lib/auth/require-user";
import { parseFriendsPreviewParams } from "@/lib/friends-v3-preview";

import { FriendsV3PreviewClient } from "./friends-v3-client";

// DEV ONLY: the v3 Friends tab (plan P8) with no sign-in and no database, for
// screenshots.
//
//   /dev/friends-v3?fixture=default|empty|search|sheet|uw
//
// It renders the real tab (app/friends/friends-client-v3.tsx) from made-up
// reads (lib/friends-v3-preview.ts), on fake services: every write answers
// { ok: true } after 150ms and changes only the preview's own copy of the
// reads, as revalidation would the page's, so Accept, Decline, Add, Cancel
// and Unblock can all be watched landing. Search finds a handful of made-up
// people, and a share "goes through" with no sheet. The flags aren't
// consulted, so the tab can be looked at before FRIENDS_V3 flips, and `uw`
// shows a UW student's groups (from a made-up cohort, lib/uw-peers-preview.ts)
// before NEXT_PUBLIC_UW does: an Add takes the person out of their group, and
// "More at UW" loads its second page from "Show more".
//
// The notifications bell is a stand-in: the real one would read and stamp
// the signed-in developer's own notifications. FeedLivePoll is the real one:
// its refresh re-renders this page with the same fixture, which changes
// nothing.
//
// The root layout mounts the real BottomNav only for a signed-in, onboarded
// viewer. Anyone else gets one here, so the list can be seen clearing it.
// getProfile is the layout's own cached read, so asking costs nothing.
//
// It can never serve in production: `next build` runs with NODE_ENV
// "production", so the route 404s there before reading anything.
export default async function FriendsV3PreviewPage({
  searchParams,
}: {
  // Next 16: searchParams is a Promise and must be awaited.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { fixture } = parseFriendsPreviewParams(await searchParams);
  const user = await getOptionalUser();
  const layoutHasNav = user !== null && (await getProfile())?.onboarded_at != null;
  return (
    <>
      <FriendsV3PreviewClient key={fixture} fixture={fixture} />
      {!layoutHasNav && <BottomNav activePath="/friends" />}
    </>
  );
}
