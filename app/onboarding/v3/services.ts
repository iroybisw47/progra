import { removeAvatar, uploadAvatar } from "@/app/actions/avatar";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  searchUsers,
  sendFriendRequest,
} from "@/app/actions/friends";
import { archiveGoal, createGoal, updateGoal } from "@/app/actions/goals";
import { archiveHabit, createHabit } from "@/app/actions/habits";
import { setProfileIdentity, setUsername } from "@/app/actions/profile";
import { setOnboardingStep } from "@/app/actions/telemetry";
import { fetchMoreUwPeers, fetchUwPeerGroups, setUwProfile } from "@/app/actions/uw";
import { track } from "@/lib/analytics";
import { shareInvite } from "@/lib/invite-share";
import { requestNotificationPermission } from "@/lib/notification-permission";
import type { OnboardingV3Services } from "@/lib/onboarding-v3-services";

// The services onboarding v3 runs on in production: the real server actions
// and the real analytics client, unchanged. lib/onboarding-v3-services.ts has
// why the wizard takes them as an object at all (the dev preview passes fakes).
//
// No "use client" or "use server" here. Only client components import it, so
// it lands in the client bundle, where the action imports are the usual
// action references.
export const REAL_SERVICES: OnboardingV3Services = {
  setUsername,
  setProfileIdentity,
  setUwProfile,
  uploadAvatar,
  removeAvatar,
  createGoal,
  updateGoal,
  archiveGoal,
  createHabit,
  archiveHabit,
  searchUsers,
  sendFriendRequest,
  cancelFriendRequest,
  acceptFriendRequest,
  fetchUwPeerGroups,
  fetchMoreUwPeers,
  shareInvite,
  askNotifications: requestNotificationPermission,
  recordStep: (step) => {
    void setOnboardingStep(step);
  },
  track,
};
