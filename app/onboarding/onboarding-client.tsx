"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  ChevronRightIcon,
  ClockIcon,
  FlagIcon,
  PlayIcon,
  SparklesIcon,
} from "lucide-react";

import { BottomNav } from "@/components/bottom-nav";
import { GoalProgressBar } from "@/components/goal-progress";
import { SyncCalendarButton } from "@/components/sync-calendar-button";
import { WeekBreakdown } from "@/components/week-breakdown";
import { WeeklyHabits } from "@/components/weekly-habits";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createGoal } from "@/app/actions/goals";
import { completeOnboarding } from "@/app/actions/profile";
import { clockIn, clockOut } from "@/app/actions/sessions";
import type { CategoryBreakdownRow } from "@/lib/aggregate";
import type { Goal } from "@/lib/db/goals";
import type { Habit, HabitCompletion } from "@/lib/db/habits";

const HOUR_MS = 60 * 60 * 1000;

// Login is step 1 of 9 (the real /login page); the wizard starts at 2.
type Step =
  | "welcome"
  | "how"
  | "goal"
  | "practice"
  | "categories"
  | "tour-home"
  | "tour-history"
  | "tour-habits";

const STEP_NUM: Record<Step, number> = {
  welcome: 2,
  how: 3,
  goal: 4,
  practice: 5,
  categories: 6,
  "tour-home": 7,
  "tour-history": 8,
  "tour-habits": 9,
};

function formatHours(ms: number): string {
  return `${(ms / HOUR_MS).toFixed(1)}h`;
}

// m:ss under an hour, h:mm:ss past it.
function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// "42s" / "3m 12s" / "1.4h" for the success banner.
function formatLogged(ms: number): string {
  const totalSec = Math.max(1, Math.round(ms / 1000));
  if (totalSec < 60) return `${totalSec}s`;
  if (ms < HOUR_MS) return `${Math.floor(totalSec / 60)}m ${totalSec % 60}s`;
  return `${(ms / HOUR_MS).toFixed(1)}h`;
}

type Props = {
  goals: Goal[];
  weeklyTotalMs: number;
  categoryBreakdown: CategoryBreakdownRow[];
  goalBreakdown: {
    id: string;
    title: string;
    quotaHours: number;
    actualMs: number;
  }[];
  habits: Habit[];
  completions: HabitCompletion[];
  weekStart: string;
  today: string;
  weekRangeLabel: string;
  monthStartMs: number;
  monthTotalMs: number;
  monthCategoryRows: CategoryBreakdownRow[];
  monthUncategorizedCount: number;
  activeSession: { taskName: string; startedAt: number } | null;
};

export function OnboardingClient({
  goals,
  weeklyTotalMs,
  categoryBreakdown,
  goalBreakdown,
  habits,
  completions,
  weekStart,
  today,
  weekRangeLabel,
  monthStartMs,
  monthTotalMs,
  monthCategoryRows,
  monthUncategorizedCount,
  activeSession,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [step, setStep] = useState<Step>("welcome");
  const [homeTour, setHomeTour] = useState<"recap" | "history">("recap");

  // Goal step.
  const [goalTitle, setGoalTitle] = useState("");
  const [quota, setQuota] = useState(5);
  const [createdGoalTitle, setCreatedGoalTitle] = useState<string | null>(null);

  // Practice step.
  const [practicePhase, setPracticePhase] = useState<
    "idle" | "running" | "done"
  >("idle");
  const [taskName, setTaskName] = useState("First practice session");
  const [clockAtMs, setClockAtMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [loggedMs, setLoggedMs] = useState(0);

  // A replay may start while a real session is running — adopt it so clockIn
  // doesn't trip the one-active-session constraint.
  useEffect(() => {
    if (step === "practice" && practicePhase === "idle" && activeSession) {
      setTaskName(activeSession.taskName);
      setClockAtMs(activeSession.startedAt);
      setPracticePhase("running");
    }
  }, [step, practicePhase, activeSession]);

  // 1s ticker while the practice session runs.
  useEffect(() => {
    if (practicePhase !== "running") return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [practicePhase]);

  const practiceGoalTitle =
    createdGoalTitle ?? goals[0]?.title ?? "your goal";

  function handleCreateGoal() {
    const title = goalTitle.trim();
    if (!title) return;
    startTransition(async () => {
      const r = await createGoal({ title, weeklyQuotaHours: quota });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setCreatedGoalTitle(title);
      router.refresh();
      setStep("practice");
    });
  }

  function handleClockIn() {
    const goal =
      goals.find((g) => g.title === createdGoalTitle) ?? goals[0] ?? null;
    if (!goal) {
      toast.error("Your goal is still saving — try again in a second.");
      router.refresh();
      return;
    }
    const name = taskName.trim() || "First practice session";
    startTransition(async () => {
      const r = await clockIn({ goalId: goal.id, taskName: name });
      if ("error" in r) {
        toast.error(r.error);
        router.refresh();
        return;
      }
      setClockAtMs(Date.now());
      setNowMs(Date.now());
      setPracticePhase("running");
    });
  }

  function handleClockOut() {
    startTransition(async () => {
      const r = await clockOut();
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setLoggedMs(Date.now() - (clockAtMs ?? Date.now()));
      setPracticePhase("done");
      // Pull the fresh week snapshot so the tour shows this session's time.
      router.refresh();
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

  if (step === "tour-home") {
    return (
      <TourHome
        homeTour={homeTour}
        onRecapNext={() => setHomeTour("history")}
        onHistoryNext={() => setStep("tour-history")}
        weeklyTotalMs={weeklyTotalMs}
        categoryBreakdown={categoryBreakdown}
        goalBreakdown={goalBreakdown}
        habits={habits}
        completions={completions}
        weekStart={weekStart}
        today={today}
        weekRangeLabel={weekRangeLabel}
      />
    );
  }

  if (step === "tour-history") {
    return (
      <TourHistory
        monthStartMs={monthStartMs}
        monthTotalMs={monthTotalMs}
        monthCategoryRows={monthCategoryRows}
        monthUncategorizedCount={monthUncategorizedCount}
        onNext={() => setStep("tour-habits")}
      />
    );
  }

  if (step === "tour-habits") {
    return (
      <TourHabits
        habits={habits}
        completions={completions}
        weekStart={weekStart}
        today={today}
        onFinish={handleFinish}
        pending={pending}
      />
    );
  }

  return (
    <div key={step} className="flex flex-1 animate-[fade-up_.35s_ease] flex-col">
      <div className="flex h-11 items-center justify-center">
        <span className="text-caption text-xs tracking-[.05em] tabular-nums">
          {STEP_NUM[step]} of 9
        </span>
      </div>

      <main className="mx-auto flex w-full max-w-[420px] flex-1 flex-col px-5 pb-10">
        <div className="flex flex-1 flex-col justify-center gap-6">
          {step === "welcome" && (
            <>
              <span className="bg-brand flex size-14 items-center justify-center rounded-full">
                <ClockIcon className="size-6 text-[#fcf6ef]" strokeWidth={1.9} />
              </span>
              <h1 className="text-ink text-4xl leading-[1.15] tracking-[-0.01em]">
                Welcome to Progra
              </h1>
              <p className="text-base leading-relaxed text-muted-foreground text-pretty">
                Plan your week. Track deep work. See where your time goes — one
                calm place for all of it.
              </p>
            </>
          )}

          {step === "how" && (
            <>
              <h1 className="text-ink text-[32px] leading-[1.15]">
                How it works
              </h1>
              <div className="flex flex-col gap-5">
                <HowRow
                  n={1}
                  title="Clock in"
                  body="Start a timer when you begin. Stop it when you're done — the session is logged."
                />
                <HowRow
                  n={2}
                  title="Merge your calendar"
                  body="Pull in Google Calendar events so meetings and plans count toward your week too."
                />
                <HowRow
                  n={3}
                  title="See where it goes"
                  body="Weekly totals by goal and category show exactly how you spend your time."
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
                <p className="text-[15px] leading-normal text-muted-foreground">
                  Something you want to put real hours into each week.
                </p>
              </header>
              <div className="flex flex-col gap-2">
                <Label htmlFor="onboarding-goal">Goal</Label>
                <Input
                  id="onboarding-goal"
                  className="h-12 rounded-xl text-base"
                  placeholder="e.g. Learn Spanish"
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Weekly quota</Label>
                <div className="border-warm-border flex items-center gap-3 rounded-xl border bg-card p-2">
                  <button
                    type="button"
                    aria-label="Decrease quota"
                    onClick={() => setQuota((q) => Math.max(1, q - 1))}
                    className="border-warm-border bg-inset hover:bg-track size-11 rounded-[10px] border text-xl"
                  >
                    −
                  </button>
                  <div className="flex flex-1 flex-col items-center">
                    <span className="text-ink text-2xl font-semibold tabular-nums">
                      {quota}h
                    </span>
                    <span className="text-caption text-[11px]">per week</span>
                  </div>
                  <button
                    type="button"
                    aria-label="Increase quota"
                    onClick={() => setQuota((q) => Math.min(40, q + 1))}
                    className="border-warm-border bg-inset hover:bg-track size-11 rounded-[10px] border text-xl"
                  >
                    +
                  </button>
                </div>
              </div>
            </>
          )}

          {step === "practice" && (
            <>
              <header className="flex flex-col gap-2">
                <h1 className="text-ink text-[32px] leading-[1.15]">
                  Try clocking in
                </h1>
                <p className="text-[15px] leading-normal text-muted-foreground">
                  This is the whole loop — clock in when you start, out when you
                  stop. Give it a few seconds.
                </p>
              </header>
              <div className="flex flex-col gap-2">
                <span className="text-caption text-xs">Clocking in to</span>
                <span className="text-brand border-brand/25 bg-brand/10 inline-flex items-center gap-2 self-start rounded-full border px-3.5 py-2 text-sm font-semibold">
                  <FlagIcon className="size-3.5" strokeWidth={2} />
                  Goal: {practiceGoalTitle}
                </span>
              </div>

              {practicePhase === "idle" && (
                <>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="onboarding-task">
                      What are you working on?
                    </Label>
                    <Input
                      id="onboarding-task"
                      className="h-12 rounded-xl text-base"
                      value={taskName}
                      onChange={(e) => setTaskName(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={handleClockIn}
                    disabled={pending}
                    className="h-14 w-full gap-2.5 rounded-2xl text-[17px] font-semibold shadow-[0_8px_18px_-6px_rgba(53,90,82,.5)]"
                  >
                    <PlayIcon className="size-4.5 fill-current" />
                    Clock in
                  </Button>
                </>
              )}

              {practicePhase === "running" && (
                <>
                  <div className="border-warm-border flex flex-col items-center gap-2.5 rounded-[18px] border bg-card px-5 py-7">
                    <span className="text-caption flex items-center gap-2 text-xs">
                      <span className="bg-brand size-[9px] animate-[pulse-dot_1.6s_ease_infinite] rounded-full" />
                      {taskName.trim() || "First practice session"}
                    </span>
                    <span className="text-ink text-[54px] font-semibold tracking-[-0.01em] tabular-nums">
                      {formatElapsed(nowMs - (clockAtMs ?? nowMs))}
                    </span>
                  </div>
                  <Button
                    onClick={handleClockOut}
                    disabled={pending}
                    className="bg-ink hover:bg-ink/90 h-13 w-full rounded-[14px] text-base font-medium text-[#fcf6ef]"
                  >
                    Clock out
                  </Button>
                </>
              )}

              {practicePhase === "done" && (
                <div className="flex items-center gap-3 rounded-[14px] border border-[rgba(157,188,162,.55)] bg-[rgba(157,188,162,.16)] px-4 py-3.5">
                  <span className="bg-done text-brand-deep flex size-6.5 shrink-0 items-center justify-center rounded-full text-sm font-bold">
                    ✓
                  </span>
                  <p className="text-sm leading-snug">
                    Logged <strong>{formatLogged(loggedMs)}</strong> toward{" "}
                    <strong>{practiceGoalTitle}</strong>. That&rsquo;s it —
                    every session counts toward your weekly quota.
                  </p>
                </div>
              )}
            </>
          )}

          {step === "categories" && (
            <>
              <header className="flex flex-col gap-2">
                <h1 className="text-ink text-[32px] leading-[1.15]">
                  Goals aren&rsquo;t everything
                </h1>
                <p className="text-[15px] leading-normal text-muted-foreground text-pretty">
                  You can clock in to plain categories too — and merged calendar
                  events get filed into them automatically, so meetings count
                  without any clocking.
                </p>
              </header>
              <div className="border-warm-border flex flex-col rounded-[18px] border bg-card px-4 py-1.5">
                <ExampleCategoryRow color="#6e9277" name="Exercise" hours="2.5h" divider />
                <ExampleCategoryRow color="#6e84a8" name="Reading" hours="1.2h" divider />
                <ExampleCategoryRow color="#c2a24e" name="Admin" hours="0.8h" />
              </div>
              <p className="text-caption text-[13px] leading-normal">
                Add your own categories any time from the Clock screen.
              </p>
            </>
          )}
        </div>

        {step === "welcome" && (
          <WizardCta onClick={() => setStep("how")}>Get started</WizardCta>
        )}
        {step === "how" && (
          <WizardCta onClick={() => setStep("goal")}>Next</WizardCta>
        )}
        {step === "goal" && (
          <WizardCta
            onClick={handleCreateGoal}
            disabled={!goalTitle.trim() || pending}
          >
            Create goal
          </WizardCta>
        )}
        {step === "practice" && practicePhase === "done" && (
          <WizardCta onClick={() => setStep("categories")}>Continue</WizardCta>
        )}
        {step === "categories" && (
          <WizardCta onClick={() => setStep("tour-home")}>
            Show me around
          </WizardCta>
        )}
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
      className="h-12 w-full rounded-xl text-base font-medium"
    >
      {children}
    </Button>
  );
}

function HowRow({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3.5">
      <span className="text-brand bg-brand/10 flex size-[30px] shrink-0 items-center justify-center rounded-full text-sm font-semibold">
        {n}
      </span>
      <div className="flex flex-col gap-0.5">
        <p className="text-ink text-base font-semibold">{title}</p>
        <p className="text-sm leading-normal text-muted-foreground">{body}</p>
      </div>
    </div>
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
      <span className="text-[13px] text-muted-foreground tabular-nums">
        {hours} this week
      </span>
    </div>
  );
}

// Dimmed-overlay spotlight: the wrapped card floats above the scrim with a
// brand ring, and a coach-mark card with the advance button sits below it.
function Spotlight({
  active,
  title,
  body,
  buttonLabel,
  onNext,
  pending,
  children,
}: {
  active: boolean;
  title: string;
  body: string;
  buttonLabel: string;
  onNext: () => void;
  pending?: boolean;
  children: React.ReactNode;
}) {
  if (!active) return <>{children}</>;
  return (
    <div className="relative z-[70] flex flex-col gap-3">
      <div className="rounded-xl shadow-[0_0_0_3px_rgba(53,90,82,.85),0_18px_50px_rgba(0,0,0,.35)]">
        {children}
      </div>
      <div className="bg-brand-deep flex flex-col gap-2 rounded-2xl p-4">
        <p className="text-[15px] font-semibold text-[#fcf6ef]">{title}</p>
        <p className="text-[13px] leading-normal text-[rgba(252,246,239,.78)]">
          {body}
        </p>
        <button
          type="button"
          onClick={onNext}
          disabled={pending}
          className="text-brand-deep h-[38px] self-end rounded-[10px] bg-[#fcf6ef] px-4 text-sm font-medium active:scale-[.97]"
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}

// Step 7: the real Home layout with the tour scrim; spotlights recap → history.
function TourHome({
  homeTour,
  onRecapNext,
  onHistoryNext,
  weeklyTotalMs,
  categoryBreakdown,
  goalBreakdown,
  habits,
  completions,
  weekStart,
  today,
  weekRangeLabel,
}: {
  homeTour: "recap" | "history";
  onRecapNext: () => void;
  onHistoryNext: () => void;
  weeklyTotalMs: number;
  categoryBreakdown: CategoryBreakdownRow[];
  goalBreakdown: Props["goalBreakdown"];
  habits: Habit[];
  completions: HabitCompletion[];
  weekStart: string;
  today: string;
  weekRangeLabel: string;
}) {
  return (
    <div className="flex flex-1 animate-[fade-up_.35s_ease] flex-col items-center px-5 pt-8 pb-24">
      <div className="fixed inset-0 z-[60] bg-[rgba(24,21,16,.5)]" />
      <main className="flex w-full max-w-md flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">Progra</h1>
          <p className="text-muted-foreground text-sm">
            Where your week is going.
          </p>
        </header>

        <Spotlight
          active={homeTour === "recap"}
          title="Your weekly recap"
          body="Every Sunday this becomes a calm summary of the week — time per goal, habits kept, and how it compares."
          buttonLabel="Next"
          onNext={onRecapNext}
        >
          <Card>
            <CardContent className="flex items-center justify-between gap-3 px-5 py-4">
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium">This week&rsquo;s recap</p>
                <p className="text-muted-foreground text-xs">
                  A calm look at how the week is shaping up.
                </p>
              </div>
              <ChevronRightIcon className="text-muted-foreground size-4 shrink-0" />
            </CardContent>
          </Card>
        </Spotlight>

        <Spotlight
          active={homeTour === "history"}
          title="Your yearly history"
          body="Months and years of logged time, by goal and category — the long view of where your hours go."
          buttonLabel="See History"
          onNext={onHistoryNext}
        >
          <Card>
            <CardContent className="flex items-center justify-between gap-3 px-5 py-4">
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium">History</p>
                <p className="text-muted-foreground text-xs">
                  Time per goal across months and years.
                </p>
              </div>
              <ChevronRightIcon className="text-muted-foreground size-4 shrink-0" />
            </CardContent>
          </Card>
        </Spotlight>

        <Card>
          <CardHeader>
            <CardTitle>Time this week</CardTitle>
            <CardDescription>{weekRangeLabel}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="font-mono text-3xl tabular-nums">
              {formatHours(weeklyTotalMs)}
            </div>
            {categoryBreakdown.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Nothing logged yet this week.
              </p>
            ) : (
              <WeekBreakdown rows={categoryBreakdown} />
            )}
          </CardContent>
        </Card>

        {goalBreakdown.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Goals this week</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {goalBreakdown.map((row) => (
                <GoalProgressBar
                  key={row.id}
                  title={row.title}
                  quotaHours={row.quotaHours}
                  actualMs={row.actualMs}
                />
              ))}
            </CardContent>
          </Card>
        )}

        <WeeklyHabits
          habits={habits}
          completions={completions}
          weekStart={weekStart}
          today={today}
        />
      </main>
      <BottomNav activePath="/" />
    </div>
  );
}

// Step 8: a History-page replica. Spotlights the two calendar actions in
// sequence: a LIVE Sync Google Calendar button (real sync — its
// router.refresh() pulls the fresh month rollup into these props), then a
// static replica of the Auto-categorize button that lives on /history.
function TourHistory({
  monthStartMs,
  monthTotalMs,
  monthCategoryRows,
  monthUncategorizedCount,
  onNext,
}: {
  monthStartMs: number;
  monthTotalMs: number;
  monthCategoryRows: CategoryBreakdownRow[];
  monthUncategorizedCount: number;
  onNext: () => void;
}) {
  const [historyTour, setHistoryTour] = useState<"sync" | "categorize">("sync");

  // Client-side formatting like history-client's periodLabel, so the label
  // follows the viewer's locale rather than the server's.
  const monthLabel = new Date(monthStartMs).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex flex-1 animate-[fade-up_.35s_ease] flex-col items-center px-5 pt-8 pb-24">
      <div className="fixed inset-0 z-[60] bg-[rgba(24,21,16,.5)]" />
      <main className="flex w-full max-w-md flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">History</h1>
          <p className="text-muted-foreground text-sm">
            Where your time went, over a longer stretch.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>{monthLabel}</CardTitle>
            <CardDescription>Total tracked time this month.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="font-mono text-3xl tabular-nums">
              {formatHours(monthTotalMs)}
            </div>
            {monthCategoryRows.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Nothing logged in {monthLabel} yet — syncing your calendar is
                the fastest way to fill this in.
              </p>
            ) : (
              <WeekBreakdown rows={monthCategoryRows.slice(0, 4)} />
            )}
          </CardContent>
        </Card>

        <Spotlight
          active={historyTour === "sync"}
          title="Merge your Google Calendar"
          body="One tap pulls your events into Progra so meetings and plans count toward your time — no clocking needed. This button is live: try it now if you like."
          buttonLabel="Next"
          onNext={() => setHistoryTour("categorize")}
        >
          <div className="rounded-md bg-card">
            <SyncCalendarButton />
          </div>
        </Spotlight>

        <Spotlight
          active={historyTour === "categorize"}
          title="AI files events for you"
          body="Synced events get sorted into your categories automatically — your manual picks and keyword rules always win, and a review popup lets you correct anything. You'll find this button right here on the History page."
          buttonLabel="Go to Habits"
          onNext={onNext}
        >
          <div className="rounded-md bg-card">
            <Button variant="outline" className="h-11 w-full text-base" disabled>
              <SparklesIcon />{" "}
              {monthUncategorizedCount > 0
                ? `Auto-categorize ${monthUncategorizedCount} uncategorized event${monthUncategorizedCount === 1 ? "" : "s"}`
                : "Auto-categorize events"}
            </Button>
          </div>
        </Spotlight>
      </main>
      <BottomNav activePath="/" />
    </div>
  );
}

// Step 9: the Habits page with the weekly grid spotlighted; finishing stamps
// onboarded_at and lands on the real Home.
function TourHabits({
  habits,
  completions,
  weekStart,
  today,
  onFinish,
  pending,
}: {
  habits: Habit[];
  completions: HabitCompletion[];
  weekStart: string;
  today: string;
  onFinish: () => void;
  pending: boolean;
}) {
  return (
    <div className="flex flex-1 animate-[fade-up_.35s_ease] flex-col items-center px-5 pt-8 pb-24">
      <div className="fixed inset-0 z-[60] bg-[rgba(24,21,16,.5)]" />
      <main className="flex w-full max-w-md flex-col gap-4">
        <header className="flex flex-col gap-0.5">
          <h1 className="text-3xl font-semibold tracking-tight">Habits</h1>
          <p className="text-muted-foreground text-[13px]">
            Small daily check-ins, alongside your timed goals.
          </p>
        </header>

        <Spotlight
          active
          title="Habits live here"
          body="Tap a day to check a habit off. They sit alongside your timed goals in the weekly recap."
          buttonLabel="Finish tour"
          onNext={onFinish}
          pending={pending}
        >
          <WeeklyHabits
            habits={habits}
            completions={completions}
            weekStart={weekStart}
            today={today}
          />
        </Spotlight>

        <Card>
          <CardHeader>
            <CardTitle>Add habit</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Input
              className="h-10"
              placeholder="Drink water, read 30m, …"
              readOnly
            />
            <Button className="h-10" variant="secondary" disabled>
              Add
            </Button>
          </CardContent>
        </Card>
      </main>
      <BottomNav activePath="/habits" />
    </div>
  );
}
