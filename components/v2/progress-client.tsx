"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { CheckIcon, ChevronRightIcon, SlidersHorizontalIcon } from "lucide-react";
import { toast } from "sonner";

import { Donut } from "@/components/v2/donut";
import { HabitWeekGrid } from "@/components/v2/habit-week-grid";
import { ManageHabits } from "@/components/v2/manage-habits";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toggleHabitCompletion } from "@/app/actions/habits";
import type { Habit, HabitCompletion } from "@/lib/db/habits";
import { formatDuration } from "@/lib/duration";
import { formatTime } from "@/lib/dates";
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
  id: string;
  label: string;
  catName: string | null;
  catColor: string | null;
  isGoal: boolean;
  startedAt: number;
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
  sessionsToday: SessionToday[];
  goals: GoalRow[];
  habitsToday: HabitToday[];
  weekTotalMs: number;
  weekSegs: Seg[];
  habits: Habit[];
  completions: HabitCompletion[];
  weekStart: string;
  today: string;
  minWeekStart: string;
  monthLabel: string;
  monthTotalMs: number;
  monthSegs: Seg[];
}) {
  const [tab, setTab] = useState<Tab>("today");
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
        {tab === "history" && <HistoryView {...props} />}
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

function Legend({ segs, total }: { segs: Seg[]; total: number }) {
  return (
    <ul className="flex flex-1 flex-col gap-2">
      {segs.slice(0, 6).map((s, i) => (
        <li key={i} className="flex items-center gap-2 text-sm">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: s.color }}
          />
          <span className="min-w-0 flex-1 truncate">{s.name}</span>
          <span className="text-caption font-mono text-xs tabular-nums">
            {fmtH(s.ms)}
          </span>
          <span className="text-faint w-9 text-right font-mono text-xs tabular-nums">
            {total > 0 ? Math.round((s.ms / total) * 100) : 0}%
          </span>
        </li>
      ))}
    </ul>
  );
}

function TodayView({
  dateLabel,
  todayTotalMs,
  todayTracked,
  todayImported,
  sessionsToday,
  goals,
  habitsToday,
  today,
  onManage,
}: {
  dateLabel: string;
  todayTotalMs: number;
  todayTracked: number;
  todayImported: number;
  sessionsToday: SessionToday[];
  goals: GoalRow[];
  habitsToday: HabitToday[];
  today: string;
  onManage: () => void;
}) {
  const router = useRouter();
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
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Hero total */}
      <Card>
        <CardContent className="flex flex-col gap-1 py-4">
          <div className="flex items-baseline justify-between">
            <span className="text-caption text-[11px] font-bold uppercase tracking-wide">
              Today · {dateLabel}
            </span>
            <span className="text-caption text-xs">
              {todayTracked} tracked · {todayImported} imported
            </span>
          </div>
          <span className="font-mono text-[33px] font-bold tabular-nums">
            {formatDuration(todayTotalMs)}
          </span>
        </CardContent>
      </Card>

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
                      <span style={{ color: s.catColor ?? undefined }}>
                        {s.isGoal ? "Goal" : s.catName ?? "Uncategorized"}
                      </span>{" "}
                      · {formatTime(new Date(s.startedAt))}
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
                <Card key={g.id}>
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
  goals,
  habits,
  completions,
  weekStart,
  today,
  onManage,
}: {
  weekTotalMs: number;
  weekSegs: Seg[];
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
      <Card>
        <CardContent className="flex items-center gap-5 py-5">
          <Donut
            segments={weekSegs.map((s) => ({ color: s.color, value: s.ms }))}
            size={128}
            stroke={13}
            label={formatDuration(weekTotalMs)}
            sub="Tracked"
          />
          <Legend segs={weekSegs} total={weekTotalMs} />
        </CardContent>
      </Card>

      {goals.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold">Goal quotas</h2>
            <ManageGoalsLink />
          </div>
          <Card>
            <CardContent className="flex flex-col gap-4 py-4">
              {goals.map((g) => {
                const quotaMs = g.quotaHours * HOUR_MS;
                const pct = quotaMs > 0 ? Math.min(100, (g.actualMs / quotaMs) * 100) : 0;
                return (
                  <div key={g.id} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate">{g.title}</span>
                      <span className="text-caption shrink-0 font-mono text-xs tabular-nums">
                        {fmtH(g.actualMs)} / {g.quotaHours.toFixed(0)}h
                      </span>
                    </div>
                    <div className="bg-track h-1.5 w-full overflow-hidden rounded-full">
                      <div
                        className="bg-brand h-full"
                        style={{ width: g.actualMs > 0 ? `${Math.max(2, pct)}%` : "0%" }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </section>
      )}

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

function HistoryView({
  monthLabel,
  monthTotalMs,
  monthSegs,
}: {
  monthLabel: string;
  monthTotalMs: number;
  monthSegs: Seg[];
}) {
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardContent className="flex items-center gap-5 py-5">
          <Donut
            segments={monthSegs.map((s) => ({ color: s.color, value: s.ms }))}
            size={120}
            stroke={26}
            label={fmtH(monthTotalMs)}
          />
          <div className="flex flex-1 flex-col gap-2">
            <span className="text-sm font-bold">{monthLabel}</span>
            <Legend segs={monthSegs} total={monthTotalMs} />
          </div>
        </CardContent>
      </Card>

      <Link
        href="/history"
        className="border-hairline flex items-center justify-between rounded-2xl border px-4 py-3.5"
      >
        <div className="flex flex-col">
          <span className="text-sm font-medium">Full history</span>
          <span className="text-caption text-xs">
            Browse by month and year, expand any category.
          </span>
        </div>
        <ChevronRightIcon className="text-faint size-4 shrink-0" />
      </Link>
    </div>
  );
}
