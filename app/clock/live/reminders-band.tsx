"use client";

import { ToggleSwitch } from "@/components/v2/toggle-switch";
import { track } from "@/lib/analytics";
import { CLOCK_REMINDERS } from "@/lib/flags";
import {
  openNotificationSettings,
  requestNotificationPermission,
} from "@/lib/notification-permission";
import { setRemindersEnabled } from "@/lib/reminder-prefs";
import { useNotificationPermission } from "@/lib/use-notification-permission";
import { useRemindersEnabled } from "@/lib/use-reminders-enabled";

// Everything the live timer says about reminders, in one leaf.
//
// A LEAF, not JSX inlined into LiveTimerClient, and that is load-bearing rather
// than tidiness: that component deliberately never re-renders while the clock
// runs — every ticking value is isolated in its own <Ticking> child. Flipping
// this toggle re-renders these thirty lines instead of five hundred.
export function RemindersBand({
  sessionId,
  timed,
}: {
  sessionId: string;
  // Hourly nudges only exist for open-ended sessions; a timed one gets a single
  // "Time's up" alert instead. So "Reminders every 1h" would be a lie here, and
  // the alert itself isn't optional — it's the reason you set a duration.
  timed: boolean;
}) {
  const permission = useNotificationPermission();
  const enabled = useRemindersEnabled(sessionId);

  if (!CLOCK_REMINDERS) return null;
  // null = not read yet, "unavailable" = no plugin. Both mean the website or
  // SSR, where none of this applies.
  if (permission === null || permission === "unavailable") return null;

  if (permission === "denied") {
    return (
      <div className="mx-6 mb-2 flex flex-col items-center gap-1.5">
        <p className="text-faint text-center text-xs text-pretty">
          Reminders are off — iOS only asks once, so they have to be turned back
          on in Settings.
        </p>
        <button
          type="button"
          onClick={() => {
            track("notification_settings_opened", {
              source: "live_timer",
              state: permission,
            });
            openNotificationSettings();
          }}
          className="border-hairline text-caption hover:text-ink rounded-full border px-3 py-[7px] text-xs font-medium active:scale-95"
        >
          Open Settings
        </button>
      </div>
    );
  }

  // Never been asked. Offering here rather than pointing at Settings, because
  // this is the moment of maximum relevance — they are clocked in right now.
  // Legal caller #3 of the gesture-only ask.
  if (permission === "prompt") {
    return (
      <button
        type="button"
        onClick={() => {
          void requestNotificationPermission().then((result) => {
            track("notification_permission_asked", {
              source: "live_timer",
              result,
            });
          });
        }}
        className="border-hairline text-caption hover:text-ink mx-6 mb-2 self-center rounded-full border px-3 py-[7px] text-xs font-medium active:scale-95"
      >
        Turn on reminders
      </button>
    );
  }

  // Granted, timed session: nothing to offer. "Time's up" always fires.
  if (timed) return null;

  return (
    <div className="border-hairline mx-6 mb-2 flex items-center gap-3 rounded-[18px] border px-4 py-3.5">
      <div className="flex-1">
        <div className="text-[13.5px] font-bold">Reminders every 1h</div>
        <div className="text-faint mt-0.5 text-[11.5px]">
          A nudge so you don&rsquo;t forget to clock out
        </div>
      </div>
      <ToggleSwitch
        ariaLabel="Hourly reminders"
        checked={enabled}
        onCheckedChange={(next) => {
          setRemindersEnabled(sessionId, next);
          track("clock_reminders_toggled", { enabled: next });
        }}
      />
    </div>
  );
}
