"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import {
  CalendarIcon,
  CalendarDaysIcon,
  CalendarRangeIcon,
  CheckIcon,
  ChevronRightIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { toast } from "sonner";

import { CategoryDonut } from "@/components/v2/category-donut";
import { HabitWeekGrid } from "@/components/v2/habit-week-grid";
import { AutoEndNudge } from "@/components/v2/auto-end-nudge";
import { RecapNudge } from "@/components/v2/recap-nudge";
import { ReferFriendButton } from "@/components/v2/refer-friend-button";
import { WeekSummary } from "@/components/v2/week-summary";

// The manage-habits editor (485 lines) only matters after tapping "Manage" —
// load it as a lazy chunk after hydration instead of shipping it in the
// Progress tab's critical bundle. It stays always-mounted (its own state
// survives open/close); only the chunk fetch is deferred.
const ManageHabits = dynamic(
  () => import("@/components/v2/manage-habits").then((m) => m.ManageHabits),
  { ssr: false }
);
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toggleHabitCompletion } from "@/app/actions/habits";
import type { Habit, HabitCompletion } from "@/lib/db/habits";
import { formatDuration } from "@/lib/duration";
import { formatTime12 } from "@/lib/dates";
import { REFER_ENABLED } from "@/lib/flags";
import { cn } from "@/lib/utils";

const HOUR_MS = 60 * 60 * 1000;
const fmtH = (ms: number) => `${(ms / HOUR_MS).toFixed(1)}h`;

export type Seg = { name: string; color: string; ms: number };
export type GoalRow = {
  id: string;
  title: string;
  quotaHours: number;
  actualMs: number;
  status: "hit" | "close" | "under";
};
export type SessionToday = {
  // "session" = clocked in Progra; "event" = imported Google Calendar event
  // (shown with its start–end range, never live).
  kind: "session" | "event";
  id: string;
  label: string;
  catName: string | null;
  catColor: string | null;
  isGoal: boolean;
  // The goal's title when goal-tracked (drives the "Goal: {name}" label); null
  // for category sessions and imported events.
  goalName: string | null;
  startedAt: number;
  endedAt: number | null;
  workedMs: number;
  active: boolean;
};
export type HabitToday = { id: string; name: string; color: string | null; done: boolean };

type Tab = "today" | "week" | "history";

export function ProgressClient(props: {
  dateLabel: string;
  todayTotalMs: number;
  todayTracked: number;
  todayImported: number;
  todaySegs: Seg[];
  sessionsToday: SessionToday[];
  goals: GoalRow[];
  habitsToday: HabitToday[];
  weekTotalMs: number;
  weekSegs: Seg[];
  weekRangeLabel: string;
  weekTracked: number;
  weekImported: number;
  habits: Habit[];
  completions: HabitCompletion[];
  weekStart: string;
  today: string;
  minWeekStart: string;
  recapNudge: { weekStart: string } | null;
  autoEndNudge: { sessionId: string } | null;
  // When set (via `/?tab=history`), opens on that sub-tab instead of "today".
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(props.initialTab ?? "today");
  const [manageOpen, setManageOpen] = useState(false);
  const onManage = () => setManageOpen(true);

  return (
    <div className="flex flex-1 flex-col items-center px-5 pt-6 pb-28">
      <main className="flex w-full max-w-md flex-col gap-5">
        {/* Segmented control */}
        <div className="bg-track flex rounded-full p-1">
          {(
            [
              ["today", "Today"],
              ["week", "This week"],
              ["history", "History"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "flex-1 rounded-full py-2 text-sm font-bold transition-colors",
                tab === key ? "bg-card text-ink shadow-sm" : "text-caption"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "today" && <TodayView {...props} onManage={onManage} />}
        {tab === "week" && <WeekView {...props} onManage={onManage} />}
        {tab === "history" && <HistoryView />}
      </main>

      <ManageHabits
        open={manageOpen}
        onOpenChange={setManageOpen}
        habits={props.habits}
        completions={props.completions}
        weekStart={props.weekStart}
        today={props.today}
        minWeekStart={props.minWeekStart}
      />
    </div>
  );
}

// Goals are managed on the /goals page (add / edit / recolor / delete), so the
// Progress widget links out rather than opening a dialog like habits do.
function ManageGoalsLink() {
  return (
    <Link
      href="/goals?from=progress"
      className="text-caption hover:text-ink flex items-center gap-1 text-xs font-medium"
    >
      <SlidersHorizontalIcon className="size-3.5" />
      Manage
    </Link>
  );
}

function TodayView({
  dateLabel,
  todayTotalMs,
  todayTracked,
  todayImported,
  todaySegs,
  sessionsToday,
  goals,
  habitsToday,
  today,
  recapNudge,
  autoEndNudge,
  onManage,
}: {
  dateLabel: string;
  todayTotalMs: number;
  todayTracked: number;
  todayImported: number;
  todaySegs: Seg[];
  sessionsToday: SessionToday[];
  goals: GoalRow[];
  habitsToday: HabitToday[];
  today: string;
  recapNudge: { weekStart: string } | null;
  autoEndNudge: { sessionId: string } | null;
  onManage: () => void;
}) {
  const [, startTransition] = useTransition();

  // Optimistic today-toggle: flip instantly, reconcile on refresh.
  const [optimisticHabits, toggleOptimistic] = useOptimistic(
    habitsToday,
    (state: HabitToday[], habitId: string): HabitToday[] =>
      state.map((h) => (h.id === habitId ? { ...h, done: !h.done } : h))
  );

  function toggleHabit(habitId: string) {
    startTransition(async () => {
      toggleOptimistic(habitId);
      const r = await toggleHabitCompletion(habitId, today);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Weekly recap nudge — navy CTA at the top of Today when a week has
          unlocked and hasn't been opened; disappears once opened (any device). */}
      {recapNudge && <RecapNudge weekStart={recapNudge.weekStart} />}

      {/* 10-hour cap nudge — a session we ended for the user, saved private and
          awaiting review. Muted so it doesn't compete with the recap CTA above
          when both are present. */}
      {autoEndNudge && <AutoEndNudge sessionId={autoEndNudge.sessionId} />}

      {/* Hero: centered category donut + per-category bars underneath. */}
      <Card>
        <CardContent className="flex flex-col gap-4 py-5">
          <div className="flex items-baseline justify-between">
            <span className="text-caption text-[11px] font-bold uppercase tracking-wide">
              Today · {dateLabel}
            </span>
            <span className="text-caption text-xs">
              {todayTracked} tracked · {todayImported} imported
            </span>
          </div>
          <CategoryDonut segs={todaySegs} totalMs={todayTotalMs} />
        </CardContent>
      </Card>

      {/* Refer a friend — below the hero so it never sits adjacent to the
          recap nudge (same navy fill). Flag-gated; NEXT_PUBLIC_ is inlined at
          build time, so this branch disappears entirely when off. */}
      {REFER_ENABLED && <ReferFriendButton />}

      {/* Sessions today */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold">Sessions today</h2>
        <Card>
          <CardContent className="flex flex-col py-1">
            {sessionsToday.length === 0 ? (
              <p className="text-caption py-3 text-sm">Nothing tracked yet today.</p>
            ) : (
              sessionsToday.map((s, i) => (
                <div
                  key={s.id}
                  className={cn(
                    "flex items-center gap-3 py-3",
                    i > 0 && "border-divider border-t"
                  )}
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-bold">
                      {s.label}
                      {s.active && (
                        <span className="bg-brand ml-2 inline-block size-1.5 animate-pulse rounded-full align-middle" />
                      )}
                    </span>
                    <span className="text-caption truncate text-xs">
                      {s.kind === "event" && (
                        <CalendarIcon
                          aria-label="From Google Calendar"
                          className="mr-1 inline size-3 align-[-2px]"
                        />
                      )}
                      <span style={{ color: s.catColor ?? undefined }}>
                        {s.isGoal
                          ? s.goalName
                            ? `Goal: ${s.goalName}`
                            : "Goal"
                          : s.catName ?? "Uncategorized"}
                      </span>{" "}
                      ·{" "}
                      {s.endedAt !== null
                        ? `${formatTime12(new Date(s.startedAt))} – ${formatTime12(new Date(s.endedAt))}`
                        : formatTime12(new Date(s.startedAt))}
                    </span>
                  </div>
                  <span className="text-body ml-auto shrink-0 font-mono text-sm tabular-nums">
                    {formatDuration(s.workedMs)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      {/* Goals today (week-to-date) */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">Goals today</h2>
          <ManageGoalsLink />
        </div>
        {goals.length === 0 ? (
          <Card>
            <CardContent className="py-1">
              <Link
                href="/goals?from=progress"
                className="text-caption hover:text-ink block py-3 text-sm"
              >
                No goals yet — tap to add one.
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {goals.map((g) => {
              const quotaMs = g.quotaHours * HOUR_MS;
              const pct = quotaMs > 0 ? Math.min(100, (g.actualMs / quotaMs) * 100) : 0;
              const leftMs = Math.max(0, quotaMs - g.actualMs);
              return (
                // Tap to clock in against this goal — lands on /clock with the
                // goal picker pre-selected.
                <Link
                  key={g.id}
                  href={`/clock?goal=${g.id}`}
                  aria-label={`Clock in to ${g.title}`}
                  className="block"
                >
                  <Card className="hover:bg-muted/30 h-full transition-colors active:scale-[.99]">
                    <CardContent className="flex flex-col gap-2 py-3">
                      <span className="truncate text-sm font-bold">{g.title}</span>
                      <span className="text-caption font-mono text-xs tabular-nums">
                        {fmtH(g.actualMs)} / {g.quotaHours.toFixed(0)}h
                      </span>
                      <div className="bg-track h-1.5 w-full overflow-hidden rounded-full">
                        <div
                          className="bg-brand h-full"
                          style={{ width: g.actualMs > 0 ? `${Math.max(3, pct)}%` : "0%" }}
                        />
                      </div>
                      <span className="text-faint text-[11px]">
                        {g.status === "hit"
                          ? "Complete"
                          : `${Math.round(pct)}% · ${fmtH(leftMs)} left`}
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Habits today — tap to check off */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">Habits today</h2>
          <button
            type="button"
            onClick={onManage}
            className="text-caption hover:text-ink flex items-center gap-1 text-xs font-medium"
          >
            <SlidersHorizontalIcon className="size-3.5" />
            Manage
          </button>
        </div>
        <Card>
          <CardContent className="flex flex-col py-1">
            {optimisticHabits.length === 0 ? (
              <button
                type="button"
                onClick={onManage}
                className="text-caption hover:text-ink py-3 text-left text-sm"
              >
                No habits yet — tap to add one.
              </button>
            ) : (
              optimisticHabits.map((h, i) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => toggleHabit(h.id)}
                  aria-pressed={h.done}
                  aria-label={
                    h.done ? `Mark ${h.name} not done` : `Mark ${h.name} done`
                  }
                  className={cn(
                    "flex items-center gap-2.5 py-3 text-left",
                    i > 0 && "border-divider border-t"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                      h.done
                        ? "border-brand bg-brand text-primary-foreground"
                        : "border-hairline"
                    )}
                  >
                    {h.done && <CheckIcon className="size-3.5" strokeWidth={3} />}
                  </span>
                  {h.color && (
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: h.color }}
                    />
                  )}
                  <span className={cn("text-sm", h.done && "text-caption")}>
                    {h.name}
                  </span>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function WeekView({
  weekTotalMs,
  weekSegs,
  weekRangeLabel,
  weekTracked,
  weekImported,
  goals,
  habits,
  completions,
  weekStart,
  today,
  onManage,
}: {
  weekTotalMs: number;
  weekSegs: Seg[];
  weekRangeLabel: string;
  weekTracked: number;
  weekImported: number;
  goals: GoalRow[];
  habits: Habit[];
  completions: HabitCompletion[];
  weekStart: string;
  today: string;
  onManage: () => void;
}) {
  function share() {
    const lines = [
      `This week: ${formatDuration(weekTotalMs)} tracked`,
      ...weekSegs.slice(0, 6).map((s) => `• ${s.name} — ${fmtH(s.ms)}`),
    ];
    navigator.clipboard
      ?.writeText(lines.join("\n"))
      .then(() => toast.success("Copied week summary"))
      .catch(() => toast.error("Couldn't copy"));
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Shared with /history's week view — edits to the weekly presentation
          belong in week-summary.tsx so both surfaces stay identical. */}
      <WeekSummary
        totalMs={weekTotalMs}
        segs={weekSegs}
        goals={goals}
        goalsHeaderExtra={<ManageGoalsLink />}
        rangeLabel={weekRangeLabel}
        tracked={weekTracked}
        imported={weekImported}
      />

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">Habits this week</h2>
          <button
            type="button"
            onClick={onManage}
            className="text-caption hover:text-ink flex items-center gap-1 text-xs font-medium"
          >
            <SlidersHorizontalIcon className="size-3.5" />
            Manage
          </button>
        </div>
        <Card>
          <CardContent className="py-4">
            <HabitWeekGrid
              habits={habits}
              completions={completions}
              weekStart={weekStart}
              today={today}
            />
          </CardContent>
        </Card>
      </section>

      <Button variant="outline" className="h-10" onClick={share}>
        Share week as text
      </Button>
    </div>
  );
}

// Three entry points into the /history browser (which owns the Previous/Next
// scrubber + week/month/year switch). Each period type renders the same donut
// breakdown there.
function HistoryView() {
  const rows = [
    {
      href: "/history?view=week",
      icon: CalendarRangeIcon,
      label: "Past weeks",
      sub: "Previous weeks, by category.",
    },
    {
      href: "/history?view=month",
      icon: CalendarIcon,
      label: "Past months",
      sub: "Each month's time, by category.",
    },
    {
      href: "/history?view=year",
      icon: CalendarDaysIcon,
      label: "Past year",
      sub: "The whole year at a glance.",
    },
  ];
  return (
    <div className="flex flex-col gap-3">
      {rows.map((r) => {
        const Icon = r.icon;
        return (
          <Link
            key={r.href}
            href={r.href}
            className="border-hairline hover:bg-muted/30 flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition-transform active:scale-[.99]"
          >
            <Icon className="text-brand size-5 shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-medium">{r.label}</span>
              <span className="text-caption text-xs">{r.sub}</span>
            </div>
            <ChevronRightIcon className="text-faint size-4 shrink-0" />
          </Link>
        );
      })}
    </div>
  );
}
