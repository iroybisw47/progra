"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  CalendarIcon,
  CheckSquareIcon,
  ChevronRightIcon,
  ClockIcon,
  FlagIcon,
  ListIcon,
  ShieldIcon,
  TagIcon,
} from "lucide-react";
import { toast } from "sonner";

import { AvatarInitials } from "@/components/avatar-initials";
import { AvatarPicker } from "@/components/avatar-picker";
import { HoldToDelete } from "@/components/v2/hold-to-delete";
import { ReplayOnboardingButton } from "@/components/replay-onboarding-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  disconnectGoogleCalendar,
  setProfileIdentity,
  setProfileTimezone,
  setUsername,
} from "@/app/actions/profile";
import { avatarPublicUrl } from "@/lib/images/avatar-url";
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

const SECTION = "text-caption text-[11px] font-bold uppercase tracking-[0.08em]";

export function SettingsClient({
  email,
  username,
  displayName,
  bio,
  timezone,
  avatarPath,
  calendarConnected,
  calendarStatus,
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
    <div className="flex flex-1 flex-col items-center px-5 pt-8 pb-28">
      <main className="flex w-full max-w-md flex-col gap-6">
        <h1 className="text-[26px] font-bold tracking-tight">Settings</h1>

        {/* Account */}
        <section className="flex flex-col gap-2">
          <p className={SECTION}>Account</p>
          <Card>
            <CardContent className="flex flex-col gap-3 py-4">
              <div className="flex items-center gap-3">
                <AvatarInitials
                  name={displayName}
                  username={username ?? "?"}
                  avatarUrl={avatarPublicUrl(avatarPath)}
                  className="size-12 text-base"
                />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-bold">
                    {displayName || (username ? `@${username}` : "You")}
                  </span>
                  <span className="text-caption truncate text-xs">
                    {username ? `@${username}` : email}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto"
                  onClick={() => {
                    setDnDraft(displayName ?? "");
                    setUnDraft(username ?? "");
                    setBioDraft(bio ?? "");
                    setEditing(true);
                  }}
                >
                  Edit
                </Button>
              </div>

              <SettingsRow
                icon={ClockIcon}
                label="Time zone"
                value={timezone ?? "Not set"}
                onClick={() => {
                  setTzDraft(timezone ?? "UTC");
                  setTzOpen(true);
                }}
              />
              <SettingsRow
                icon={CalendarIcon}
                label="Google Calendar"
                value={calendarConnected ? "Connected" : "Not connected"}
              />
              {calendarConnected ? (
                <div className="flex items-center justify-between gap-3 pl-[26px]">
                  <span className="text-caption text-xs">
                    Synced events count toward your time.
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      run(() => disconnectGoogleCalendar(), {
                        okMsg: "Google Calendar disconnected",
                      })
                    }
                  >
                    Disconnect
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2 pl-[26px]">
                  {SHOW_UNVERIFIED_WARNING && (
                    <p className="text-caption text-xs leading-relaxed text-pretty">
                      Google&rsquo;s verification of Progra is still in review —
                      you&rsquo;ll see a &ldquo;Google hasn&rsquo;t verified this
                      app&rdquo; screen. Tap <strong>Advanced</strong>, then{" "}
                      <strong>Go to progra.world (unsafe)</strong> to continue.
                      Access is read-only.
                    </p>
                  )}
                  <a
                    href="/auth/google-calendar?from=settings"
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                      className: "self-start",
                    })}
                  >
                    Connect
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Your data */}
        <section className="flex flex-col gap-2">
          <p className={SECTION}>Your data</p>
          <Card>
            <CardContent className="flex flex-col py-1">
              <LinkRow href="/goals" icon={FlagIcon} label="Goals" />
              <LinkRow href="/categories" icon={TagIcon} label="Categories & rules" />
              <LinkRow href="/habits" icon={CheckSquareIcon} label="Habits" />
              <LinkRow href="/sessions" icon={ListIcon} label="Past sessions" />
            </CardContent>
          </Card>
        </section>

        {/* Sharing */}
        <section className="flex flex-col gap-2">
          <p className={SECTION}>Sharing</p>
          <Card>
            <CardContent className="flex flex-col gap-3 py-4">
              <p className="text-body text-sm">
                New goals, habits, and sessions are shareable with friends by
                default. Mark any item private to keep it off your profile and the
                feed. Photos only ever appear as complete before/after pairs.
              </p>
              <ReplayOnboardingButton />
            </CardContent>
          </Card>
        </section>

        {/* Moderator */}
        {isAdmin && (
          <section className="flex flex-col gap-2">
            <p className={SECTION}>Moderation</p>
            <Card>
              <CardContent className="flex flex-col py-1">
                <LinkRow
                  href="/admin"
                  icon={ShieldIcon}
                  label="Report queue"
                  badge={openReports > 0 ? String(openReports) : undefined}
                />
              </CardContent>
            </Card>
          </section>
        )}

        {/* Account actions */}
        <section className="flex flex-col gap-3">
          <form action="/auth/signout" method="post" className="w-full">
            <Button type="submit" variant="outline" className="h-11 w-full">
              Sign out
            </Button>
          </form>
          <HoldToDelete />
        </section>
      </main>

      {/* Edit identity */}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {/* Uploads apply immediately, independent of the dialog's Save. */}
            <AvatarPicker
              name={displayName}
              username={username ?? "?"}
              avatarUrl={avatarPublicUrl(avatarPath)}
              sizeClassName="size-16 text-lg"
            />
            <Field label="Display name">
              <Input
                className="h-10"
                placeholder="Your name"
                maxLength={50}
                value={dnDraft}
                onChange={(e) => setDnDraft(e.target.value)}
              />
            </Field>
            <Field label="Username">
              <Input
                className="h-10"
                placeholder="username"
                autoCapitalize="none"
                autoCorrect="off"
                value={unDraft}
                onChange={(e) => setUnDraft(e.target.value)}
              />
            </Field>
            <Field label="Bio">
              <Textarea
                placeholder="A line about you"
                maxLength={300}
                rows={3}
                value={bioDraft}
                onChange={(e) => setBioDraft(e.target.value)}
              />
            </Field>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button disabled={pending} onClick={saveIdentity}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Time zone */}
      <Dialog open={tzOpen} onOpenChange={setTzOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Time zone</DialogTitle>
          </DialogHeader>
          <select
            value={tzDraft}
            onChange={(e) => setTzDraft(e.target.value)}
            className="border-input bg-background h-10 w-full rounded-[14px] border px-3 text-sm"
          >
            {getTimezones().map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button
              disabled={pending}
              onClick={() =>
                run(() => setProfileTimezone(tzDraft), {
                  okMsg: "Time zone saved",
                  then: () => setTzOpen(false),
                })
              }
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </div>
  );
}

function SettingsRow({
  icon: Icon,
  label,
  value,
  onClick,
}: {
  icon: typeof ClockIcon;
  label: string;
  value: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <Icon className="text-caption size-4 shrink-0" />
      <span className="text-sm font-medium">{label}</span>
      <span className="text-caption ml-auto truncate text-sm">{value}</span>
      {onClick && <ChevronRightIcon className="text-faint size-4 shrink-0" />}
    </>
  );
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className="border-divider flex items-center gap-2.5 border-t pt-3 text-left"
    >
      {inner}
    </button>
  ) : (
    <div className="border-divider flex items-center gap-2.5 border-t pt-3">{inner}</div>
  );
}

function LinkRow({
  href,
  icon: Icon,
  label,
  badge,
}: {
  href: string;
  icon: typeof ClockIcon;
  label: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 py-3",
        "[&:not(:first-child)]:border-divider [&:not(:first-child)]:border-t"
      )}
    >
      <Icon className="text-caption size-4 shrink-0" />
      <span className="text-sm font-medium">{label}</span>
      {badge && (
        <span className="bg-brand text-primary-foreground ml-auto rounded-full px-2 py-0.5 text-xs font-bold">
          {badge}
        </span>
      )}
      <ChevronRightIcon
        className={cn("text-faint size-4 shrink-0", !badge && "ml-auto")}
      />
    </Link>
  );
}
