"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { CheckIcon, ChevronRightIcon } from "lucide-react";
import { toast } from "sonner";

import { AvatarInitials } from "@/components/avatar-initials";
import { AvatarPicker } from "@/components/avatar-picker";
import { BackButton } from "@/components/v2/back-button";
import {
  BottomSheet,
  BottomSheetContent,
} from "@/components/v2/bottom-sheet";
import { HoldToDelete } from "@/components/v2/hold-to-delete";
import { ReplayOnboardingButton } from "@/components/replay-onboarding-button";
import { ToggleSwitch } from "@/components/v2/toggle-switch";
import {
  disconnectGoogleCalendar,
  setProfileIdentity,
  setProfileTimezone,
  setSocialPushesEnabled,
  setUsername,
} from "@/app/actions/profile";
import { avatarPublicUrl } from "@/lib/images/avatar-url";
import { track } from "@/lib/analytics";
import { CLOCK_REMINDERS, HABIT_REMINDERS, SOCIAL_PUSH } from "@/lib/flags";
import {
  habitReminderPref,
  setHabitReminderPref,
} from "@/lib/habit-reminder-prefs";
import { useHabitReminderPref } from "@/lib/use-habit-reminder-pref";
import {
  openNotificationSettings,
  requestNotificationPermission,
} from "@/lib/notification-permission";
import { useNotificationPermission } from "@/lib/use-notification-permission";
import { cn } from "@/lib/utils";

// Flipped to "0" once Google's app verification clears (build-time inlined).
const SHOW_UNVERIFIED_WARNING =
  process.env.NEXT_PUBLIC_SHOW_UNVERIFIED_WARNING === "1";

type Result = { ok: true } | { ok: true; username: string } | { error: string };

const FALLBACK_ZONES = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

function getTimezones(): string[] {
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] })
      .supportedValuesOf;
    if (typeof fn === "function") return fn("timeZone");
  } catch {
    /* older browsers → fallback */
  }
  return FALLBACK_ZONES;
}

// Settings, in the editorial language: hairline rows on white, 10px uppercase
// eyebrows, track bands between groups, bottom sheets instead of centre-screen
// dialogs. It opens from the You tab's header, which is why the two now share a
// shell — same pt-7/pb-28 frame, same max-w-md column, padding applied per
// section so the dividers run full-bleed.
//
// Nothing about what this screen DOES changed in the rebuild: same actions,
// same flag gates, same permission branches, same analytics.
export function SettingsClient({
  email,
  username,
  displayName,
  bio,
  timezone,
  avatarPath,
  calendarConnected,
  calendarStatus,
  socialPushesEnabled,
  isAdmin,
  openReports,
}: {
  email: string;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  timezone: string | null;
  avatarPath: string | null;
  calendarConnected: boolean;
  // One-shot return status from the connect flow (?calendar=connected|error).
  calendarStatus: "connected" | "error" | null;
  // Account-level social-push opt-out; null = on (column default).
  socialPushesEnabled: boolean | null;
  isAdmin: boolean;
  openReports: number;
}) {
  const [pending, startTransition] = useTransition();

  // Toast-only effect (no state) — doesn't add to the set-state-in-effect debt.
  const calendarToastFired = useRef(false);
  useEffect(() => {
    if (calendarToastFired.current || !calendarStatus) return;
    calendarToastFired.current = true;
    if (calendarStatus === "error") {
      toast.error("Couldn't connect Google Calendar — you can try again.");
    } else {
      toast.success("Google Calendar connected");
    }
  }, [calendarStatus]);

  const [editing, setEditing] = useState(false);
  const [dnDraft, setDnDraft] = useState(displayName ?? "");
  const [unDraft, setUnDraft] = useState(username ?? "");
  const [bioDraft, setBioDraft] = useState(bio ?? "");

  const [tzOpen, setTzOpen] = useState(false);
  const [tzDraft, setTzDraft] = useState(timezone ?? "UTC");

  function run(action: () => Promise<Result>, opts?: { okMsg?: string; then?: () => void }) {
    startTransition(async () => {
      const r = await action();
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      if (opts?.okMsg) toast.success(opts.okMsg);
      if (opts?.then) opts.then();
    });
  }

  function openIdentity() {
    setDnDraft(displayName ?? "");
    setUnDraft(username ?? "");
    setBioDraft(bio ?? "");
    setEditing(true);
  }

  function saveIdentity() {
    startTransition(async () => {
      // Username first (has its own availability check); only if it changed.
      if (unDraft.trim() && unDraft.trim() !== (username ?? "")) {
        const u = await setUsername(unDraft.trim());
        if ("error" in u) {
          toast.error(u.error);
          return;
        }
      }
      const r = await setProfileIdentity({ displayName: dnDraft, bio: bioDraft });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success("Saved");
      setEditing(false);
    });
  }

  return (
    <div className="flex flex-1 flex-col items-center pt-7 pb-28">
      <main className="flex w-full max-w-md flex-col">
        <header className="flex items-center gap-2.5 px-5">
          <BackButton />
          <span className="section-label">Settings</span>
        </header>

        {/* Identity — the whole block is the affordance, like the You tab's. */}
        <button
          type="button"
          onClick={openIdentity}
          className="flex items-center gap-3.5 px-5 pt-4 text-left"
        >
          <AvatarInitials
            name={displayName}
            username={username ?? "?"}
            avatarUrl={avatarPublicUrl(avatarPath)}
            className="size-[58px] text-xl"
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-ink truncate font-serif text-[22px] font-medium tracking-[-0.015em]">
              {displayName || (username ? `@${username}` : "You")}
            </span>
            <span className="text-faint truncate text-[13px]">
              {username ? `@${username}` : email}
            </span>
            <span className="text-brand pt-1 text-[12px] font-semibold">
              Edit profile
            </span>
          </div>
          <ChevronRightIcon
            aria-hidden
            className="text-disabled size-[15px] shrink-0"
            strokeWidth={2.4}
          />
        </button>

        <Band className="mt-5" />

        {/* Account */}
        <SectionLabel>Account</SectionLabel>
        <Row
          label="Time zone"
          value={timezone ?? "Not set"}
          onClick={() => {
            setTzDraft(timezone ?? "UTC");
            setTzOpen(true);
          }}
        />
        <Row label="Signed in as" value={email} />
        <Row
          label="Google Calendar"
          value={calendarConnected ? "Connected" : "Not connected"}
        />
        {calendarConnected ? (
          <Inset>
            <p className="text-caption text-xs leading-relaxed">
              Synced events count toward your time.
            </p>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() => disconnectGoogleCalendar(), {
                  okMsg: "Google Calendar disconnected",
                })
              }
              className={cn(CHIP, "self-start")}
            >
              Disconnect
            </button>
          </Inset>
        ) : (
          <Inset>
            {SHOW_UNVERIFIED_WARNING && (
              <p className="text-caption text-xs leading-relaxed text-pretty">
                Google&rsquo;s verification of Progra is still in review —
                you&rsquo;ll see a &ldquo;Google hasn&rsquo;t verified this
                app&rdquo; screen. Tap <strong>Advanced</strong>, then{" "}
                <strong>Go to progra.world (unsafe)</strong> to continue. Access
                is read-only.
              </p>
            )}
            <a
              href="/auth/google-calendar?from=settings"
              className={cn(CHIP, "self-start")}
            >
              Connect
            </a>
          </Inset>
        )}

        <Band />

        {/* Your data */}
        <SectionLabel>Your data</SectionLabel>
        <Row href="/goals" label="Goals" />
        <Row href="/categories" label="Categories & rules" />
        <Row href="/habits" label="Habits" />
        <Row href="/sessions" label="Past sessions" />

        {/* Notifications — native app only, so it simply doesn't exist on the
            website. `null` (not read yet) and "unavailable" (no plugin) both
            land here, which is also what keeps SSR and the first client render
            in agreement. */}
        <NotificationsSection socialPushesEnabled={socialPushesEnabled} />

        <Band />

        {/* Sharing */}
        <SectionLabel>Sharing</SectionLabel>
        <div className="border-divider flex flex-col gap-3 border-t px-5 py-3.5">
          <p className="text-caption text-[13px] leading-[1.55] text-pretty">
            New goals, habits, and sessions are shareable with friends by
            default. Mark any item private to keep it off your profile and the
            feed. Photos only ever appear as complete before/after pairs.
          </p>
          <ReplayOnboardingButton />
        </div>

        {/* Moderator */}
        {isAdmin && (
          <>
            <Band />
            <SectionLabel>Moderation</SectionLabel>
            <Row
              href="/admin"
              label="Report queue"
              badge={openReports > 0 ? String(openReports) : undefined}
            />
          </>
        )}

        {/* Account actions */}
        <div className="flex flex-col gap-2.5 px-5 pt-7">
          <form action="/auth/signout" method="post" className="w-full">
            <button
              type="submit"
              className="border-control-border text-body h-12 w-full rounded-[15px] border-[1.5px] text-sm font-semibold transition-transform active:scale-[.98]"
            >
              Sign out
            </button>
          </form>
          <HoldToDelete />
        </div>
      </main>

      {/* Edit profile */}
      <BottomSheet open={editing} onOpenChange={setEditing}>
        <BottomSheetContent title="Edit profile" meta="Visible to friends">
          <div className="flex flex-col gap-5 pb-1">
            {/* Uploads apply immediately, independent of the sheet's Save. */}
            <AvatarPicker
              name={displayName}
              username={username ?? "?"}
              avatarUrl={avatarPublicUrl(avatarPath)}
              sizeClassName="size-16 text-lg"
            />
            <Field label="Display name">
              <SheetInput
                placeholder="Your name"
                maxLength={50}
                value={dnDraft}
                onChange={(e) => setDnDraft(e.target.value)}
              />
            </Field>
            <Field label="Username">
              <SheetInput
                placeholder="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={unDraft}
                onChange={(e) => setUnDraft(e.target.value)}
              />
            </Field>
            <Field label="Bio">
              <textarea
                className="text-ink border-control-border w-full rounded-[13px] border-[1.5px] px-3.5 py-2.5 text-[15px] leading-[1.5] outline-none placeholder:text-[var(--disabled)]"
                placeholder="A line about you"
                maxLength={300}
                rows={3}
                value={bioDraft}
                onChange={(e) => setBioDraft(e.target.value)}
              />
            </Field>
            <button
              type="button"
              disabled={pending}
              onClick={saveIdentity}
              className={SHEET_CTA}
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </BottomSheetContent>
      </BottomSheet>

      {/* Time zone */}
      <BottomSheet open={tzOpen} onOpenChange={setTzOpen}>
        <BottomSheetContent title="Time zone" meta="Sets your day and week">
          <TimezonePicker
            value={tzDraft}
            onChange={setTzDraft}
            pending={pending}
            onSave={() =>
              run(() => setProfileTimezone(tzDraft), {
                okMsg: "Time zone saved",
                then: () => setTzOpen(false),
              })
            }
          />
        </BottomSheetContent>
      </BottomSheet>
    </div>
  );
}

// ── Pieces ─────────────────────────────────────────────────────────────────

// The outline chip the Friends screen uses for its per-row actions.
const CHIP =
  "border-control-border text-caption inline-flex h-8 items-center rounded-[11px] border-[1.5px] px-3.5 text-xs font-semibold transition-transform active:scale-[.97] disabled:opacity-50";

const SHEET_CTA =
  "bg-brand text-primary-foreground h-[46px] w-full rounded-[15px] text-sm font-semibold transition-transform active:scale-[.98] disabled:opacity-50";

// The 1.5px track band that separates one group of rows from the next — the
// same rhythm /me uses between its stats, quotas and sessions.
function Band({ className }: { className?: string }) {
  return (
    <div
      className={cn("bg-track border-hairline h-1.5 border-t", className)}
      aria-hidden
    />
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-5 pt-[18px] pb-2">
      <span className="section-label">{children}</span>
    </div>
  );
}

// The indented continuation of the row above it: an explanation, an action
// chip, or both. Sits inside the same divider run, so it reads as belonging to
// the row rather than as its own entry.
function Inset({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-divider flex flex-col gap-2 border-t px-5 py-3">
      {children}
    </div>
  );
}

// One settings line. Navigates (href), acts (onClick), or just states a value —
// the three shapes the old SettingsRow/LinkRow pair covered between them.
function Row({
  label,
  value,
  href,
  onClick,
  badge,
}: {
  label: string;
  value?: string;
  href?: string;
  onClick?: () => void;
  badge?: string;
}) {
  const inner = (
    <>
      <span className="text-body min-w-0 flex-1 text-[13.5px] font-medium">
        {label}
      </span>
      {value && (
        <span className="text-caption max-w-[52%] truncate text-[13px]">
          {value}
        </span>
      )}
      {badge && (
        <span className="bg-brand text-primary-foreground rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums">
          {badge}
        </span>
      )}
      {(href || onClick) && (
        <ChevronRightIcon
          aria-hidden
          className="text-disabled size-[13px] shrink-0"
          strokeWidth={2.4}
        />
      )}
    </>
  );

  const shared = "border-divider flex items-center gap-3 border-t px-5 py-3";

  if (href) {
    return (
      <Link href={href} className={shared}>
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(shared, "text-left")}>
        {inner}
      </button>
    );
  }
  return <div className={shared}>{inner}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-[7px]">
      <span className="section-label">{label}</span>
      {children}
    </div>
  );
}

function SheetInput(props: React.ComponentProps<"input">) {
  return (
    <input
      {...props}
      className="text-ink border-control-border h-[46px] w-full rounded-[13px] border-[1.5px] px-3.5 text-[15px] font-medium outline-none placeholder:text-[var(--disabled)]"
    />
  );
}

// Search + list, rather than the 400-option <select> this replaces: picking
// Asia/Kolkata meant scrolling a native wheel past everything before it.
function TimezonePicker({
  value,
  onChange,
  pending,
  onSave,
}: {
  value: string;
  onChange: (zone: string) => void;
  pending: boolean;
  onSave: () => void;
}) {
  const [query, setQuery] = useState("");
  const zones = useMemo(() => getTimezones(), []);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return zones;
    return zones.filter((z) => z.toLowerCase().includes(q));
  }, [zones, query]);

  // The zone you're already in sits first, then everything else in the order
  // Intl gives it. Ordering beats scrolling here: the sheet is still sliding up
  // when a mount effect would fire, so measuring the list to scroll it lands
  // nowhere — and a picker that opens on Africa/Abidjan makes people hunt for
  // a setting they never changed. While searching, results stand alone.
  const ordered = useMemo(
    () => (query.trim() ? shown : [value, ...shown.filter((z) => z !== value)]),
    [shown, query, value]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 pb-1">
      <input
        aria-label="Search time zones"
        className="border-control-border text-ink focus:border-brand h-[42px] w-full shrink-0 rounded-[13px] border-[1.5px] px-3.5 text-sm outline-none placeholder:text-[var(--disabled)]"
        placeholder="Search time zones"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {/* The one scrolling region in the sheet, so the Save button stays put. */}
      <div className="-mx-5 min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {shown.length === 0 && (
          <p className="text-caption px-5 py-3 text-[13px]">
            No time zone matches &ldquo;{query.trim()}&rdquo;.
          </p>
        )}
        {ordered.map((z) => (
          <button
            key={z}
            type="button"
            onClick={() => onChange(z)}
            className="border-divider flex w-full items-center gap-3 border-t px-5 py-2.5 text-left"
          >
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-[13.5px]",
                z === value ? "text-ink font-semibold" : "text-body"
              )}
            >
              {z}
            </span>
            {z === value && (
              <CheckIcon
                aria-hidden
                className="text-brand size-4 shrink-0"
                strokeWidth={2.4}
              />
            )}
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={pending}
        onClick={onSave}
        className={cn(SHEET_CTA, "shrink-0")}
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

// Notifications — the only place in the app where permission can be inspected
// and, if it has never been asked, granted.
//
// Exists because iOS asks ONCE, EVER. Two consequences that shape every branch
// below: a `denied` user cannot be re-asked and needs a route to iOS Settings,
// which is otherwise unreachable from anywhere in the app; and the onboarding
// step promises "you can always turn them off later", which has to be true.
//
// Renders nothing off-native. `null` means "not read yet" and is also the
// server snapshot, so SSR and the first client render agree — the section
// simply does not exist on progra.world.
function NotificationsSection({
  socialPushesEnabled,
}: {
  socialPushesEnabled: boolean | null;
}) {
  const permission = useNotificationPermission();

  if (!CLOCK_REMINDERS && !HABIT_REMINDERS && !SOCIAL_PUSH) return null;
  if (permission === null || permission === "unavailable") return null;

  const value =
    permission === "granted"
      ? "On"
      : permission === "denied"
        ? "Blocked"
        : "Turn on";

  // Legal caller #2 of requestNotificationPermission() — a real tap, on a row
  // that says what it does. See lib/notification-permission.ts.
  const onClick =
    permission === "granted"
      ? undefined
      : permission === "denied"
        ? () => {
            track("notification_settings_opened", {
              source: "settings",
              state: permission,
            });
            openNotificationSettings();
          }
        : () => {
            void requestNotificationPermission().then((result) => {
              track("notification_permission_asked", {
                source: "settings",
                result,
              });
            });
          };

  return (
    <>
      <Band />
      <SectionLabel>Notifications</SectionLabel>
      {CLOCK_REMINDERS && (
        <Row label="Clock reminders" value={value} onClick={onClick} />
      )}
      {/* Not gated on CLOCK_REMINDERS — the permission plumbing above is
          shared, but the habit reminder is its own feature. Only shown once
          granted: until then the ask/denied rows above govern everything,
          and a time picker for notifications that can't arrive is noise. */}
      {HABIT_REMINDERS && permission === "granted" && <HabitReminderRow />}
      {/* Account-level (the server sends these, and servers know accounts,
          not phones) — but only shown once granted, like the rows above: a
          toggle for notifications that can't arrive here is noise. */}
      {SOCIAL_PUSH && permission === "granted" && (
        <SocialPushRow initialEnabled={socialPushesEnabled !== false} />
      )}

      {CLOCK_REMINDERS && permission === "granted" && (
        <Inset>
          <p className="text-caption text-xs leading-relaxed text-pretty">
            A nudge each hour you&rsquo;re still clocked in, and an alert when a
            timed session reaches its target.
          </p>
        </Inset>
      )}
      {permission === "denied" && (
        <Inset>
          <p className="text-caption text-xs leading-relaxed text-pretty">
            iOS only asks once. Turn notifications on for Progra in Settings to
            get them back.
          </p>
        </Inset>
      )}
    </>
  );
}

// A row whose right-hand control is a switch rather than a value + chevron.
function ToggleRow({
  label,
  ariaLabel,
  checked,
  onCheckedChange,
}: {
  label: string;
  ariaLabel: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
}) {
  return (
    <div className="border-divider flex items-center gap-3 border-t px-5 py-2.5">
      <span className="text-body min-w-0 flex-1 text-[13.5px] font-medium">
        {label}
      </span>
      <ToggleSwitch
        ariaLabel={ariaLabel}
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

// The daily habit reminder: on/off and the fire time, both per-device
// (lib/habit-reminder-prefs.ts — scheduled on the device, so the preference is
// a statement about this phone). Defaults to on at 18:00, which makes this row
// the way out for anyone who never chose in onboarding.
function HabitReminderRow() {
  const pref = useHabitReminderPref();

  return (
    <>
      <ToggleRow
        label="Daily habit reminder"
        ariaLabel="Daily habit reminder"
        checked={pref.enabled}
        onCheckedChange={(next) => {
          // habitReminderPref() re-read rather than closing over `pref`, so
          // a toggle right after a time change can't resurrect a stale time.
          setHabitReminderPref({ ...habitReminderPref(), enabled: next });
          track("habit_reminder_toggled", { enabled: next });
        }}
      />
      {pref.enabled && (
        <Inset>
          <div className="flex items-center gap-3">
            <span className="text-caption flex-1 text-xs leading-relaxed text-pretty">
              On days you haven&rsquo;t checked off all your habits, at
            </span>
            <input
              type="time"
              aria-label="Habit reminder time"
              value={pref.time}
              onChange={(e) => {
                // <input type="time"> can emit "" mid-edit (a cleared field);
                // keep the previous time rather than storing garbage.
                if (!e.target.value) return;
                setHabitReminderPref({
                  ...habitReminderPref(),
                  time: e.target.value,
                });
                track("habit_reminder_time_changed", { time: e.target.value });
              }}
              className="border-control-border text-ink shrink-0 rounded-[11px] border-[1.5px] px-2.5 py-1.5 text-[13px] font-medium tabular-nums"
            />
          </div>
        </Inset>
      )}
    </>
  );
}

// Server-sent likes/comments pushes, account-level. Optimistic: flip locally,
// revert on a failed save — the pattern the identity sheet uses, minus the
// sheet.
function SocialPushRow({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);

  return (
    <>
      <ToggleRow
        label="Likes & comments"
        ariaLabel="Like and comment notifications"
        checked={enabled}
        onCheckedChange={(next) => {
          setEnabled(next);
          track("social_pushes_toggled", { enabled: next });
          void setSocialPushesEnabled(next).then((r) => {
            if ("error" in r) {
              setEnabled(!next);
              toast.error("Couldn't save — try again.");
            }
          });
        }}
      />
      <Inset>
        <p className="text-caption text-xs leading-relaxed text-pretty">
          When a friend likes or comments on your session. Applies to all your
          devices.
        </p>
      </Inset>
    </>
  );
}
