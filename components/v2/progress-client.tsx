"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { CalendarIcon, CheckIcon } from "lucide-react";
import { toast } from "sonner";

import { Donut } from "@/components/v2/donut";
import { HabitWeekGrid } from "@/components/v2/habit-week-grid";
import { GoalQuotaRows } from "@/components/v2/goal-quota-rows";
import { SectionHeader } from "@/components/v2/section-header";
import { AutoEndNudge } from "@/components/v2/auto-end-nudge";
import { RecapNudge } from "@/components/v2/recap-nudge";
import { ReferFriendButton } from "@/components/v2/refer-friend-button";

// The manage-habits editor (485 lines) only matters after tapping the Habits
// header — load it as a lazy chunk after hydration instead of shipping it in
// the Progress tab's critical bundle. It stays always-mounted (its own state
// survives open/close); only the chunk fetch is deferred.
const ManageHabits = dynamic(
  () => import("@/components/v2/manage-habits").then((m) => m.ManageHabits),
  { ssr: false }
);
import { toggleHabitCompletion } from "@/app/actions/habits";
import type { Habit, HabitCompletion } from "@/lib/db/habits";
import { entityColor, tint } from "@/lib/colors";
import { formatDuration } from "@/lib/duration";
import { formatTime12 } from "@/lib/dates";
import { REFER_ENABLED } from "@/lib/flags";
import { cn } from "@/lib/utils";

const HOUR_MS = 60 * 60 * 1000;
const fmtH = (ms: number) => `${(ms / HOUR_MS).toFixed(1)}h`;

// How many session rows the flat screen shows before the "all" chevron takes
// over. The full list lives on /history.
const SESSIONS_SHOWN = 4;
// Legend rows beside the donut. The donut itself still reflects everything.
const LEGEND_SHOWN = 4;

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

type Tab = "today" | "week";

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
  // When set (via `/?tab=week`), opens on that sub-tab instead of "today".
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(props.initialTab ?? "today");
  const [manageOpen, setManageOpen] = useState(false);
  const onManage = () => setManageOpen(true);

  const isToday = tab === "today";
  const totalMs = isToday ? props.todayTotalMs : props.weekTotalMs;
  const segs = isToday ? props.todaySegs : props.weekSegs;
  const periodLabel = isToday ? props.dateLabel : props.weekRangeLabel;

  const [, startTransition] = useTransition();

  // Optimistic today-toggle: flip instantly, reconcile on refresh.
  const [optimisticHabits, toggleOptimistic] = useOptimistic(
    props.habitsToday,
    (state: HabitToday[], habitId: string): HabitToday[] =>
      state.map((h) => (h.id === habitId ? { ...h, done: !h.done } : h))
  );
  const doneToday = optimisticHabits.filter((h) => h.done).length;

  function toggleHabit(habitId: string) {
    startTransition(async () => {
      toggleOptimistic(habitId);
      const r = await toggleHabitCompletion(habitId, props.today);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
    });
  }

  return (
    <div className="flex flex-1 flex-col items-center px-5 pt-7 pb-28">
      <main className="flex w-full max-w-md flex-col">
        {/* Period label + Today/Week chips */}
        <div className="flex items-center justify-between">
          <span className="section-label whitespace-nowrap">{periodLabel}</span>
          <div className="bg-track flex gap-0.5 rounded-full p-[3px]">
            {(
              [
                ["today", "Today"],
                ["week", "Week"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                aria-pressed={tab === key}
                className={cn(
                  "rounded-full px-[13px] py-[5px] text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors",
                  tab === key
                    ? "bg-brand text-primary-foreground"
                    : "text-faint"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Hero: donut + the period total in serif + the top categories. */}
        <div className="flex items-stretch gap-4 pt-3.5">
          <Donut
            segments={segs.map((s) => ({ color: s.color, value: s.ms }))}
            size={128}
            stroke={15}
            label={String(isToday ? props.sessionsToday.length : props.weekTracked)}
            labelClassName="text-xl"
            sub="Sessions"
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="stat-num pt-3 text-[36px] leading-[0.9]">
              {formatDuration(totalMs)}
            </span>
            <span className="min-h-2 flex-1" />
            <div className="flex flex-col pl-2.5">
              {segs.slice(0, LEGEND_SHOWN).map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-[2px]"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="text-body min-w-0 flex-1 truncate text-xs leading-[1.62]">
                    {s.name}
                  </span>
                  <span className="text-ink shrink-0 text-xs font-semibold tabular-nums">
                    {fmtH(s.ms)}
                  </span>
                </div>
              ))}
              {segs.length === 0 && (
                <span className="text-caption text-xs">
                  Nothing tracked {isToday ? "yet today" : "this week"}.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Weekly recap nudge — navy CTA when a week has unlocked and hasn't
            been opened; disappears once opened (any device). */}
        {props.recapNudge && (
          <div className="pt-4">
            <RecapNudge weekStart={props.recapNudge.weekStart} />
          </div>
        )}
        {/* 10-hour cap nudge — a session we ended for the user, saved private
            and awaiting review. */}
        {props.autoEndNudge && (
          <div className="pt-3">
            <AutoEndNudge sessionId={props.autoEndNudge.sessionId} />
          </div>
        )}
        {/* Flag-gated; NEXT_PUBLIC_ is inlined at build time, so this branch
            disappears entirely when off. */}
        {REFER_ENABLED && (
          <div className="pt-3">
            <ReferFriendButton />
          </div>
        )}

        <Hairline className="mt-4" />

        {/* Sessions — today's rows; the chevron opens the full history. */}
        <section className="flex flex-col pt-3">
          <SectionHeader
            label="Sessions"
            meta={
              isToday
                ? `${props.sessionsToday.length} logged`
                : `${props.weekTracked} tracked · ${props.weekImported} imported`
            }
            href="/history"
            ariaLabel="All sessions"
            className="pb-2"
          />
          {isToday ? (
            props.sessionsToday.length === 0 ? (
              <Link
                href="/clock"
                className="text-caption border-divider border-t py-2.5 text-[13px]"
              >
                Nothing tracked yet today — tap to clock in.
              </Link>
            ) : (
              props.sessionsToday.slice(0, SESSIONS_SHOWN).map((s) => (
                <Link
                  key={s.id}
                  href={s.kind === "session" ? `/session/${s.id}` : "/history"}
                  className="border-divider flex items-center gap-2.5 border-t py-[7px] transition-transform active:scale-[.99]"
                >
                  <span
                    aria-hidden
                    className="h-5 w-[3px] shrink-0 rounded-[2px]"
                    style={{ backgroundColor: entityColor(s.catColor) }}
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-body truncate text-[13px] font-semibold leading-[1.25]">
                      {s.label}
                      {s.active && (
                        <span
                          aria-label="Running"
                          className="bg-brand ml-1.5 inline-block size-1.5 animate-[pulse-dot_1.6s_infinite] rounded-full align-middle"
                        />
                      )}
                    </span>
                    <span className="text-faint truncate text-[11px] leading-[1.3]">
                      {s.kind === "event" && (
                        <CalendarIcon
                          aria-label="From Google Calendar"
                          className="mr-1 inline size-3 align-[-2px]"
                        />
                      )}
                      {s.isGoal
                        ? s.goalName
                          ? `Goal: ${s.goalName}`
                          : "Goal"
                        : s.catName ?? "Uncategorized"}
                      {" · "}
                      {s.endedAt !== null
                        ? `${formatTime12(new Date(s.startedAt))} – ${formatTime12(new Date(s.endedAt))}`
                        : formatTime12(new Date(s.startedAt))}
                    </span>
                  </div>
                  <span className="text-body shrink-0 text-[13px] font-semibold tabular-nums">
                    {formatDuration(s.workedMs)}
                  </span>
                </Link>
              ))
            )
          ) : (
            /* Week: one segmented bar, a slice per category in its own color. */
            <div className="border-divider flex flex-col gap-2 border-t pt-3">
              <div className="bg-track flex h-2 w-full overflow-hidden rounded-full">
                {segs.map((s, i) => (
                  <span
                    key={i}
                    className="h-full"
                    style={{
                      width: `${totalMs > 0 ? (s.ms / totalMs) * 100 : 0}%`,
                      backgroundColor: s.color,
                    }}
                  />
                ))}
              </div>
              <span className="text-faint text-[11px]">
                {props.weekRangeLabel}
              </span>
            </div>
          )}
        </section>

        <Hairline className="mt-4" />

        {/* Habits — one-tap pills today, the week grid on Week. */}
        <section className="flex flex-col pt-3">
          <SectionHeader
            label="Habits"
            meta={
              isToday
                ? `${doneToday} of ${optimisticHabits.length}`
                : "Manage"
            }
            onClick={onManage}
            ariaLabel="Manage habits"
            className="pb-2.5"
          />
          {isToday ? (
            optimisticHabits.length === 0 ? (
              <button
                type="button"
                onClick={onManage}
                className="text-caption py-1 text-left text-[13px]"
              >
                No habits yet — tap to add one.
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-x-[9px] gap-y-1.5">
                {optimisticHabits.map((h) => {
                  const color = entityColor(h.color);
                  return (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => toggleHabit(h.id)}
                      aria-pressed={h.done}
                      aria-label={
                        h.done ? `Mark ${h.name} not done` : `Mark ${h.name} done`
                      }
                      className={cn(
                        "flex min-w-0 items-center gap-[7px] rounded-[12px] border-[1.5px] py-[5px] pr-[9px] pl-[7px] text-left transition-[background-color,border-color,transform] duration-200 active:scale-[.96]",
                        !h.done && "border-hairline"
                      )}
                      style={
                        h.done
                          ? { borderColor: color, backgroundColor: tint(color) }
                          : undefined
                      }
                    >
                      <span
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-[7px] border-[1.5px] text-white",
                          !h.done && "border-[#dfe3e8]"
                        )}
                        style={
                          h.done
                            ? { backgroundColor: color, borderColor: color }
                            : undefined
                        }
                      >
                        {h.done && (
                          <CheckIcon className="size-3" strokeWidth={3.4} />
                        )}
                      </span>
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-xs font-medium",
                          !h.done && "text-caption"
                        )}
                        style={h.done ? { color } : undefined}
                      >
                        {h.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )
          ) : (
            <HabitWeekGrid
              habits={props.habits}
              completions={props.completions}
              weekStart={props.weekStart}
              today={props.today}
            />
          )}
        </section>

        <Hairline className="mt-4" />

        {/* Goals — week-to-date against the weekly quota, either tab. */}
        <section className="flex flex-col pt-3">
          <SectionHeader
            label="Goals"
            meta={`${props.goals.length} active`}
            href="/goals?from=progress"
            ariaLabel="Manage goals"
            className="pb-2.5"
          />
          {props.goals.length === 0 ? (
            <Link
              href="/goals?from=progress"
              className="text-caption text-[13px]"
            >
              No goals yet — tap to add one.
            </Link>
          ) : (
            <GoalQuotaRows goals={props.goals} href="/clock?goal=" />
          )}
        </section>
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

// The section rule: a full-bleed hairline, not a card edge.
function Hairline({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`bg-hairline h-px w-full ${className}`} />;
}
