"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { AtSignIcon, CalendarIcon, CheckIcon, ClockIcon } from "lucide-react";

import { AvatarPicker } from "@/components/avatar-picker";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createGoal } from "@/app/actions/goals";
import {
  completeOnboarding,
  setProfileIdentity,
  setUsername,
} from "@/app/actions/profile";
import { checkUsername } from "@/lib/social/username";

type Step = "welcome" | "goal" | "categories" | "habits" | "calendar";
const SEQUENCE: Step[] = ["welcome", "goal", "categories", "habits", "calendar"];

// Flipped to "0" once Google's app verification clears (build-time inlined —
// changing it requires a redeploy).
const SHOW_UNVERIFIED_WARNING =
  process.env.NEXT_PUBLIC_SHOW_UNVERIFIED_WARNING === "1";

type Props = {
  initialUsername: string;
  initialDisplayName: string | null;
  // Current profile photo URL (null = initials) — the welcome step's optional
  // picker; revalidation refreshes it after an upload.
  avatarUrl: string | null;
  // Server-derived (refresh token + calendar scope present) — drives step 5's
  // connected/disconnected state, incl. replays by already-connected users.
  calendarConnected: boolean;
  // Deep-link from the connect flow's callback (?step=calendar).
  initialStep?: Step;
  status?: "connected" | "error" | null;
};

// The redesign onboarding: five compact steps (welcome + handle → first goal →
// categories explainer → habits intro → optional Google Calendar connect),
// dropping the pre-redesign spotlight tour. Creating the goal is the only
// write here (via createGoal) — no practice session; a new member surfaces on
// friends' feeds as a "just joined" item. The calendar step navigates to
// /auth/google-calendar (which stamps onboarded_at first, so bailing at
// Google still leaves the user onboarded).
export function OnboardingClientV2({
  initialUsername,
  initialDisplayName,
  avatarUrl,
  calendarConnected,
  initialStep,
  status = null,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>(initialStep ?? "welcome");

  // One-shot toast for the connect flow's return status (toast only — no
  // state, so this doesn't add to the set-state-in-effect lint debt).
  const statusToastFired = useRef(false);
  useEffect(() => {
    if (statusToastFired.current || !status) return;
    statusToastFired.current = true;
    if (status === "error") {
      toast.error("Couldn't connect Google Calendar — you can try again or skip.");
    } else {
      toast.success("Google Calendar connected");
    }
  }, [status]);

  // Welcome: name + handle.
  const [displayName, setDisplayName] = useState(initialDisplayName ?? "");
  const [username, setUsernameInput] = useState(initialUsername);
  const usernameCheck = username.trim() ? checkUsername(username) : null;
  const usernameError =
    usernameCheck && !usernameCheck.ok ? usernameCheck.error : null;

  // Goal.
  const [goalTitle, setGoalTitle] = useState("");
  const [quota, setQuota] = useState(5);

  function handleClaimUsername() {
    const check = checkUsername(username);
    if (!check.ok) {
      toast.error(check.error);
      return;
    }
    startTransition(async () => {
      // Handle first (it has the availability check); then the display name —
      // same ordering the Settings identity save uses.
      const r = await setUsername(check.username);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      const identity = await setProfileIdentity({ displayName });
      if ("error" in identity) {
        toast.error(identity.error);
        return;
      }
      setStep("goal");
    });
  }

  function handleCreateGoal() {
    const title = goalTitle.trim();
    if (!title) return;
    startTransition(async () => {
      const r = await createGoal({ title, weeklyQuotaHours: quota });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setStep("categories");
    });
  }

  function handleFinish() {
    startTransition(async () => {
      const r = await completeOnboarding();
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      router.push("/");
    });
  }

  // Skip the rest of the wizard once the username step is done. Same completion
  // path as handleFinish; only reachable past the welcome step, so the handle is
  // always claimed by the time this can fire.
  function handleSkip() {
    startTransition(async () => {
      const r = await completeOnboarding();
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success("You're all set");
      router.push("/");
    });
  }

  return (
    <div key={step} className="flex flex-1 animate-[fade-up_.35s_ease] flex-col">
      <div className="relative flex h-11 items-center justify-center gap-1.5">
        {SEQUENCE.map((s, i) => (
          <span
            key={s}
            className={
              "h-1 rounded-full transition-all " +
              (i <= SEQUENCE.indexOf(step)
                ? "bg-brand w-6"
                : "bg-track w-3")
            }
          />
        ))}
        {step !== "welcome" && step !== "calendar" && (
          <button
            type="button"
            onClick={handleSkip}
            disabled={pending}
            className="text-caption hover:text-ink absolute right-5 text-[13px] font-medium disabled:opacity-50"
          >
            Skip
          </button>
        )}
      </div>

      <main className="mx-auto flex w-full max-w-[420px] flex-1 flex-col px-5 pb-10">
        <div className="flex flex-1 flex-col justify-center gap-6">
          {step === "welcome" && (
            <>
              <span className="bg-brand flex size-14 items-center justify-center rounded-full">
                <ClockIcon
                  className="text-primary-foreground size-6"
                  strokeWidth={1.9}
                />
              </span>
              <header className="flex flex-col gap-2">
                <h1 className="text-ink text-4xl leading-[1.12] tracking-[-0.01em]">
                  Welcome to Progra
                </h1>
                <p className="text-body text-base leading-relaxed text-pretty">
                  Track deep work, see where your time goes, and share progress
                  with friends. First, tell us who you are.
                </p>
              </header>
              <div className="flex flex-col gap-2">
                <Label htmlFor="ob-name">Name</Label>
                <Input
                  id="ob-name"
                  className="h-12 rounded-xl text-base"
                  placeholder="Your name"
                  maxLength={50}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
                <p className="text-caption text-[13px]">
                  Shown to friends alongside your handle.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="ob-username">
                  <AtSignIcon className="text-caption size-3.5" />
                  Username
                </Label>
                <Input
                  id="ob-username"
                  className="h-12 rounded-xl text-base"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="yourhandle"
                  value={username}
                  onChange={(e) => setUsernameInput(e.target.value)}
                />
                {usernameError && (
                  <p className="text-destructive text-[13px]">{usernameError}</p>
                )}
                <p className="text-caption text-[13px]">
                  Lowercase letters, numbers, and underscores. You can change it
                  later.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Profile photo (optional)</Label>
                <AvatarPicker
                  name={displayName.trim() || initialDisplayName}
                  username={username.trim() || initialUsername || "?"}
                  avatarUrl={avatarUrl}
                  sizeClassName="size-14 text-lg"
                />
              </div>
            </>
          )}

          {step === "goal" && (
            <>
              <header className="flex flex-col gap-2">
                <h1 className="text-ink text-[32px] leading-[1.15]">
                  Set your first goal
                </h1>
                <p className="text-body text-[15px] leading-normal">
                  Something you want to put real hours into each week.
                </p>
              </header>
              <div className="flex flex-col gap-2">
                <Label htmlFor="ob-goal">Goal</Label>
                <Input
                  id="ob-goal"
                  className="h-12 rounded-xl text-base"
                  placeholder="e.g. Learn Spanish"
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Weekly quota</Label>
                <div className="border-hairline bg-card flex items-center gap-3 rounded-xl border p-2">
                  <button
                    type="button"
                    aria-label="Decrease quota"
                    onClick={() => setQuota((q) => Math.max(1, q - 1))}
                    className="border-hairline bg-track hover:bg-track/70 size-11 rounded-[10px] border text-xl"
                  >
                    −
                  </button>
                  <div className="flex flex-1 flex-col items-center">
                    <span className="text-ink text-2xl font-bold tabular-nums">
                      {quota}h
                    </span>
                    <span className="text-caption text-[11px]">per week</span>
                  </div>
                  <button
                    type="button"
                    aria-label="Increase quota"
                    onClick={() => setQuota((q) => Math.min(40, q + 1))}
                    className="border-hairline bg-track hover:bg-track/70 size-11 rounded-[10px] border text-xl"
                  >
                    +
                  </button>
                </div>
              </div>
            </>
          )}

          {step === "categories" && (
            <>
              <header className="flex flex-col gap-2">
                <h1 className="text-ink text-[32px] leading-[1.15]">
                  Goals aren&rsquo;t everything
                </h1>
                <p className="text-body text-[15px] leading-normal text-pretty">
                  You can clock in to plain categories too — and merged calendar
                  events get filed into them automatically, so meetings count
                  without any clocking.
                </p>
              </header>
              <div className="border-hairline bg-card flex flex-col rounded-[18px] border px-4 py-1.5">
                <ExampleCategoryRow color="var(--chart-3)" name="Exercise" hours="2.5h" divider />
                <ExampleCategoryRow color="var(--chart-2)" name="Reading" hours="1.2h" divider />
                <ExampleCategoryRow color="var(--chart-4)" name="Admin" hours="0.8h" />
              </div>
              <p className="text-caption text-[13px]">
                Manage categories any time from Settings → Categories.
              </p>
            </>
          )}

          {step === "habits" && (
            <>
              <header className="flex flex-col gap-2">
                <h1 className="text-ink text-[32px] leading-[1.15]">
                  Habits, too
                </h1>
                <p className="text-body text-[15px] leading-normal text-pretty">
                  Track daily habits alongside your timed goals — a compact
                  weekly grid on your profile shows your streak at a glance.
                </p>
              </header>
              <ul className="flex flex-col gap-3">
                <ReadyRow title="Progress" body="Today, this week, and your history in one place." />
                <ReadyRow title="Feed" body="See what friends are working on." />
                <ReadyRow title="Clock" body="Tap the center button any time to start a session." />
              </ul>
            </>
          )}

          {step === "calendar" && (
            <>
              <span className="bg-brand flex size-14 items-center justify-center rounded-full">
                <CalendarIcon
                  className="text-primary-foreground size-6"
                  strokeWidth={1.9}
                />
              </span>
              <header className="flex flex-col gap-2">
                <h1 className="text-ink text-[32px] leading-[1.15]">
                  See your whole week
                </h1>
                <p className="text-body text-[15px] leading-normal text-pretty">
                  Progra can count your classes and meetings automatically.
                  Connect Google Calendar to see your whole week in one place.
                  Access is read-only — Progra never creates or edits events.
                </p>
              </header>
              {calendarConnected ? (
                <div className="border-hairline bg-card flex items-center gap-3 rounded-[18px] border px-4 py-3.5">
                  <span className="bg-brand text-primary-foreground flex size-6.5 shrink-0 items-center justify-center rounded-full">
                    <CheckIcon className="size-3.5" strokeWidth={3} />
                  </span>
                  <span className="text-ink text-[15px] font-bold">
                    Google Calendar connected
                  </span>
                </div>
              ) : (
                SHOW_UNVERIFIED_WARNING && (
                  <div className="border-hairline bg-card rounded-[18px] border px-4 py-3.5">
                    <p className="text-body text-[13px] leading-relaxed text-pretty">
                      Google&rsquo;s verification of Progra is still in review,
                      so you&rsquo;ll see a &ldquo;Google hasn&rsquo;t verified
                      this app&rdquo; screen. To continue, tap{" "}
                      <strong>Advanced</strong>, then{" "}
                      <strong>Go to progra.world (unsafe)</strong>. Your
                      calendar access is read-only.
                    </p>
                  </div>
                )
              )}
            </>
          )}
        </div>

        {step === "welcome" && (
          <WizardCta
            onClick={handleClaimUsername}
            disabled={!usernameCheck?.ok || pending}
          >
            Get started
          </WizardCta>
        )}
        {step === "goal" && (
          <WizardCta
            onClick={handleCreateGoal}
            disabled={!goalTitle.trim() || pending}
          >
            Create goal
          </WizardCta>
        )}
        {step === "categories" && (
          <WizardCta onClick={() => setStep("habits")}>Next</WizardCta>
        )}
        {step === "habits" && (
          <WizardCta onClick={() => setStep("calendar")}>Next</WizardCta>
        )}
        {step === "calendar" &&
          (calendarConnected ? (
            <WizardCta onClick={handleFinish} disabled={pending}>
              Finish
            </WizardCta>
          ) : (
            <div className="flex flex-col gap-2">
              {/* Plain navigation, not an action — the route handler stamps
                  onboarded_at before redirecting to Google. */}
              <a
                href="/auth/google-calendar?from=onboarding"
                className={buttonVariants({
                  className: "h-12 w-full rounded-xl text-base font-bold",
                })}
              >
                Connect Google Calendar
              </a>
              <Button
                variant="ghost"
                onClick={handleFinish}
                disabled={pending}
                className="h-12 w-full rounded-xl text-base"
              >
                Skip for now
              </Button>
            </div>
          ))}
      </main>
    </div>
  );
}

function WizardCta({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      className="h-12 w-full rounded-xl text-base font-bold"
    >
      {children}
    </Button>
  );
}

function ExampleCategoryRow({
  color,
  name,
  hours,
  divider,
}: {
  color: string;
  name: string;
  hours: string;
  divider?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2.5 py-3 ${divider ? "border-divider border-b" : ""}`}
    >
      <span
        aria-hidden
        className="size-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-ink flex-1 text-[15px]">{name}</span>
      <span className="text-caption text-[13px] tabular-nums">
        {hours} this week
      </span>
    </div>
  );
}

function ReadyRow({ title, body }: { title: string; body: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="bg-brand mt-1.5 size-2 shrink-0 rounded-full" />
      <div className="flex flex-col gap-0.5">
        <span className="text-ink text-[15px] font-bold">{title}</span>
        <span className="text-body text-sm leading-normal">{body}</span>
      </div>
    </li>
  );
}
