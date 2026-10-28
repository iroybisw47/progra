"use client";

import { BellIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useState, useSyncExternalStore } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PrimaryButton } from "@/components/v2/primary-button";
import { track } from "@/lib/analytics";
import {
  CLOCK_REMINDERS,
  NUDGES,
  RALLY,
  SOCIAL_PUSH,
  STREAKS,
} from "@/lib/flags";
import {
  openNotificationSettings,
  requestNotificationPermission,
} from "@/lib/notification-permission";
import {
  notifyPromptBody,
  notifyPromptDueNow,
  recordNotifyPromptShown,
  subscribeNotifyPrompt,
} from "@/lib/notify-prompt";
import { useTakeoverActive } from "@/lib/takeover";
import { useNotificationPermission } from "@/lib/use-notification-permission";

// Inlined at build time, like the flags it reads.
const BODY = notifyPromptBody({
  clockReminders: CLOCK_REMINDERS,
  streaks: STREAKS,
  socialPush: SOCIAL_PUSH,
  nudges: NUDGES,
  rally: RALLY,
});

// "Turn on notifications?" — mounted by the root layout behind NOTIFY_PROMPT,
// last in line after the plan-complete modal, the survey, the release note and
// the UW prompt (one dialog at a time), and only for a member whose phone
// hasn't reported a grant. Everything else is decided here, on the device:
//
// · the permission itself (useNotificationPermission): `prompt` gets the
//   one-tap ask, `denied` gets Open Settings, and anything else, including the
//   website's `unavailable`, renders nothing;
// · whether it's due (lib/notify-prompt.ts): three times at most, a week
//   apart, never on the first day.
//
// Progress only and never over the weekly review, for WhatsNewModal's reasons.
// Every close path records a showing, so "Not now" can't reopen it next load.
export function NotifyPromptOnLoad({ onboardedAt }: { onboardedAt: string }) {
  const pathname = usePathname();
  const takenOver = useTakeoverActive();
  const permission = useNotificationPermission();
  const getDue = useCallback(
    () => notifyPromptDueNow(onboardedAt),
    [onboardedAt]
  );
  const due = useSyncExternalStore(subscribeNotifyPrompt, getDue, () => false);
  const [open, setOpen] = useState(true);

  // After the hooks: this survives navigation away from "/".
  if (pathname !== "/" || takenOver || !due || BODY === null) return null;
  if (permission !== "prompt" && permission !== "denied") return null;

  const denied = permission === "denied";

  const close = () => {
    setOpen(false);
    recordNotifyPromptShown();
  };

  const dismiss = () => {
    track("notification_permission_skipped", {
      source: "prompt_sheet",
      state: permission,
    });
    close();
  };

  // Legal caller #5 of the gesture-only ask (lib/notification-permission.ts).
  const turnOn = () => {
    close();
    void requestNotificationPermission().then((result) => {
      track("notification_permission_asked", {
        source: "prompt_sheet",
        result,
      });
    });
  };

  const openSettings = () => {
    track("notification_settings_opened", {
      source: "prompt_sheet",
      state: "denied",
    });
    close();
    openNotificationSettings();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss();
      }}
    >
      <DialogContent
        className="bg-card text-ink gap-4 rounded-[22px] p-5 sm:max-w-sm"
        showCloseButton={false}
      >
        <DialogHeader className="gap-2">
          <div className="bg-brand/10 text-brand mb-0.5 flex size-11 items-center justify-center rounded-full">
            <BellIcon className="size-5" aria-hidden />
          </div>
          <DialogTitle className="text-ink text-[19px] leading-snug">
            {denied ? "Notifications are off" : "Turn on notifications?"}
          </DialogTitle>
          <DialogDescription className="text-ink text-[13.5px] leading-[1.55] text-pretty">
            {BODY}
            {denied &&
              " iOS only asks once, so they have to be turned on for Progra in Settings."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <PrimaryButton onClick={denied ? openSettings : turnOn}>
            {denied ? "Open Settings" : "Turn on notifications"}
          </PrimaryButton>
          <button
            type="button"
            onClick={dismiss}
            className="text-caption hover:text-ink h-11 w-full text-sm font-medium"
          >
            Not now
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
