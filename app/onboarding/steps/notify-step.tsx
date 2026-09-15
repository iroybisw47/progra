"use client";

import { CheckIcon } from "lucide-react";

import { track } from "@/lib/analytics";
import {
  openNotificationSettings,
  type NotifyPermission,
} from "@/lib/notification-permission";

import { CARD, CheckLine, StepTemplate } from "../onboarding-ui";

// Step 5 (shell only). Straight after the practice clock-in, which is what
// makes the point: they've just seen a session run away on fast-forward.
// The pinned CTA does the asking; this card says exactly what will and won't
// arrive, because iOS asks once and never again.
export function NotifyStep({
  eyebrow,
  permission,
}: {
  eyebrow: string | null;
  permission: NotifyPermission | null;
}) {
  return (
    <StepTemplate
      eyebrow={eyebrow}
      title="Don't lose track of time."
      body="We'll nudge you each hour you're still clocked in."
    >
      {permission === "granted" ? (
        <div className="flex items-center gap-2 pt-0.5">
          <CheckIcon className="size-4 text-success" strokeWidth={2.4} />
          <span className="text-[13px] font-semibold text-success">
            Notifications are on — we&rsquo;ll remind you.
          </span>
        </div>
      ) : permission === "denied" ? (
        // Terminal. iOS asks once and never again, so the only way back is
        // Settings — and saying so is better than an Enable button that would
        // silently do nothing.
        <div className={`${CARD} flex flex-col gap-3 p-4`}>
          <p className="text-caption text-[13px] leading-[1.55] text-pretty">
            Notifications are turned off for Progra, and iOS only asks once. You
            can switch them back on in Settings.
          </p>
          <button
            type="button"
            onClick={() => {
              track("notification_settings_opened", {
                source: "onboarding",
                state: permission,
              });
              openNotificationSettings();
            }}
            className="border-control-border h-[46px] w-full rounded-[13px] border-[1.5px] text-sm font-semibold transition-transform active:scale-[.98]"
          >
            Open Settings
          </button>
        </div>
      ) : (
        // `prompt`, and also null/unavailable — which on this step can only be
        // a brief pre-read flicker, since it doesn't render at all off-native.
        <div className={`${CARD} flex flex-col gap-3 p-4`}>
          <CheckLine>A nudge each hour you&rsquo;re still clocked in</CheckLine>
          <CheckLine>An alert when a session hits its target</CheckLine>
          <CheckLine>Nothing else — no streaks, no marketing</CheckLine>
        </div>
      )}
    </StepTemplate>
  );
}
