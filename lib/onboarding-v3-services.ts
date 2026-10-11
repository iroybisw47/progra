// Everything onboarding v3 asks of the outside world, as one object
// (.claude/plans/onboarding-v3.md, P3). The wizard never imports a server
// action or the analytics client directly. It calls these instead.
//
// Why the indirection: the dev-only screenshot harness
// (app/dev/onboarding-v3) has to render every screen with no sign-in and no
// database. A wizard wired straight to the actions would 401 on the first
// save, would change a signed-in developer's real handle or photo, and, with
// ANALYTICS on, would post its step events into the real app_events table. So the harness passes fakes
// (lib/onboarding-v3-preview.ts), and production passes the real actions
// (app/onboarding/v3/services.ts), which is the default. The real path calls
// exactly what it would have called inline.
//
// Types only, so this file is free to import from anywhere, the server
// included. The shapes are the actions' own return types, written out rather
// than inferred, because inferring them would mean importing "use server"
// modules into lib/.

import type { ShareOutcome } from "@/lib/invite-share";
import type { V3Step } from "@/lib/onboarding";
import type { AnalyticsEvent, TrackProps } from "@/lib/telemetry/events";
import type { UwProfileInput } from "@/lib/uw";
import type { UwBucket, UwPeerCursor, UwPeerGroups, UwPeerPage } from "@/lib/uw-peers";

export type ActionResult = { ok: true } | { error: string };

// createGoal and createHabit (app/actions/goals.ts, habits.ts) hand back the
// new row's id, which is what lets Screens 2 and 3 update or archive it after
// Back instead of creating it again.
export type CreatedResult = { ok: true; id: string } | { error: string };

// searchUsers (app/actions/friends.ts): its UserSearchResult rows, at most
// five, "@" already ignored.
export type SearchedUser = {
  userId: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
};
export type SearchUsersResult = { results: SearchedUser[] } | { error: string };

// sendFriendRequest hands back the pending row's id, which is what an undo
// (cancelFriendRequest) takes back.
export type FriendRequestResult = { ok: true; requestId: string } | { error: string };

// fetchUwPeerGroups and fetchMoreUwPeers (app/actions/uw.ts): the viewer's
// three UW groups, first page of each, and one group's next page. Their
// errors are already generic. With UW off both answer empty.
export type UwPeerGroupsResult = { groups: UwPeerGroups } | { error: string };
export type UwPeerPageResult = { page: UwPeerPage } | { error: string };

export type OnboardingV3Services = {
  // Identity writes, made when the welcome's Continue is pressed (Screen 1,
  // OWNER-FIX-3), and only what changed. setUsername's unique index is the
  // availability check: its "taken" error goes under the Username field.
  setUsername(
    username: string
  ): Promise<{ ok: true; username: string } | { error: string }>;
  setProfileIdentity(input: { displayName: string | null }): Promise<ActionResult>;
  // The UW sheet's answer (P9c), with UW on: setUwProfile (app/actions/uw.ts),
  // the cohort's only writer. Made on each way on from the sheet, after the
  // welcome saved the identity: { isUw: false } from the No tile, which leaves
  // the cohort and clears its fields, and the Yes path's lists and listing
  // from the sheet's Skip or Continue (lib/onboarding-v3-uw.ts, uwExitInput).
  // Its errors are already generic.
  setUwProfile(input: UwProfileInput): Promise<ActionResult>;
  // The welcome's photo, through its own AvatarPicker (the crop dialog, then
  // a 512px square JPEG under the "photo" key, as uploadAvatar expects), and
  // the picker's Remove.
  uploadAvatar(formData: FormData): Promise<ActionResult>;
  removeAvatar(): Promise<ActionResult>;
  // Screen 2's writes, made on Continue (lib/onboarding-v3-goals-habits.ts
  // decides which). Only the fields the wizard sets are named here. The
  // quota is a goal's hours box (OWNER-FIX-2), and the only field ever
  // written to a goal the account already had.
  createGoal(input: {
    title: string;
    weeklyQuotaHours: number;
    color?: string | null;
  }): Promise<CreatedResult>;
  updateGoal(
    id: string,
    patch: { title?: string; color?: string | null; weeklyQuotaHours?: number }
  ): Promise<ActionResult>;
  archiveGoal(id: string): Promise<ActionResult>;
  // Screen 3's, likewise. No color: createHabit assigns one.
  createHabit(name: string): Promise<CreatedResult>;
  archiveHabit(id: string): Promise<ActionResult>;
  // Screen 5's (P6). Search, requests and accepting are the Friends tab's
  // own actions. A request is sent the moment Add is tapped and taken back
  // when "✓ Added" is tapped (lib/find-friends.ts): cancelFriendRequest only
  // ever deletes the viewer's own pending row, so an undo can't unfriend
  // someone who accepted meanwhile. A request waiting on the viewer is
  // accepted from its row.
  searchUsers(query: string): Promise<SearchUsersResult>;
  sendFriendRequest(targetUserId: string): Promise<FriendRequestResult>;
  cancelFriendRequest(requestId: string): Promise<ActionResult>;
  acceptFriendRequest(requestId: string): Promise<ActionResult>;
  // Screen 5's UW groups (P9d), for a UW student with UW on: fetched when
  // the screen comes into view rather than read by the page, because Screen
  // 1 saved the answer they're built from moments earlier
  // (lib/uw-groups.ts, uwFetchKey), and "More at UW"'s further pages.
  fetchUwPeerGroups(): Promise<UwPeerGroupsResult>;
  fetchMoreUwPeers(bucket: UwBucket, cursor: UwPeerCursor): Promise<UwPeerPageResult>;
  // lib/invite-share.ts' shareInvite: the native share sheet, or the
  // clipboard where there's none. It tracks invite_sent itself.
  shareInvite(text: string): Promise<ShareOutcome>;
  // (Screen 6 has no service: it writes nothing, OWNER-FIX-1. Nor does the
  // wizard stamp onboarded_at. The Clock tab it hands off to does, once `/`
  // has been left: app/clock/finish-onboarding.tsx.)

  // The per-user "last step reached" column (setOnboardingStep). Fire and
  // forget, like v2's: a failed analytics write must never surface.
  recordStep(step: V3Step): void;
  // lib/analytics' track().
  track(name: AnalyticsEvent, props?: TrackProps): void;
};
