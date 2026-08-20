"use client";

import { useEffect } from "react";

import { cancelClockReminders } from "@/lib/clock-notifications";
import { cancelHabitReminders } from "@/lib/habit-notifications";

// Clears every scheduled local notification when the signed-in user goes away.
//
// THE BUG THIS FIXES: clock and habit reminders are wall-clock scheduled on the
// device and nothing expires them on its own. SyncClockReminders/
// SyncHabitReminders keep them in step while someone is signed in — but both
// are gated on `user`, so signing out or deleting an account simply UNMOUNTS
// them. Nothing cancels. The phone then goes on firing "Still going?" and
// "3 habits left today" for an account that no longer exists, for up to a week
// in the habit family's case.
//
// It also covers the shared-device case: user A signs out, user B signs in, and
// without this B receives A's reminders.
//
// Mounted UNGATED (inside Shell, so the beta-full wall gets it too) — a leaf
// gated on `user` could never observe user becoming null, which is the whole
// event of interest. Same one-leaf-not-N-call-sites argument SyncClockReminders
// makes: this catches sign-out, account deletion and user-switch without any of
// those three paths having to remember.
export function NotificationLifecycle({ userId }: { userId: string | null }) {
  useEffect(() => {
    if (lastUserId === userId) return;
    const previous = lastUserId;
    lastUserId = userId;

    // Only on an actual end-or-switch. A first sign-in has nothing to clear,
    // and cancelling on every signed-out page load would be pure noise (it is
    // a native bridge call; off-native it's a no-op, but still).
    if (previous === null) return;

    void cancelClockReminders();
    void cancelHabitReminders();
  }, [userId]);

  return null;
}

// Module scope, not state, and for the same reason as posthog-init's
// `lastIdentified`: this must survive the remounts a client-side navigation
// causes, or every navigation would look like a user change.
let lastUserId: string | null = null;
