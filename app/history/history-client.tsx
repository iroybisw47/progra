"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  WeekSummary,
  type WeekSummaryGoal,
  type WeekSummarySeg,
} from "@/components/v2/week-summary";
import type { CategoryItem } from "@/lib/aggregate";
// Types come from the pure module, not the server-only loader — a client
// component must not reach for `lib/db/*` even for a type.
import type { GoalCompletion, HabitCompletion } from "@/lib/history-stats";
import type { Rollup } from "@/lib/db/rollups";

const CHART_FALLBACK = "var(--chart-5)";
const HOUR_MS = 3_600_000;

type View = "week" | "month" | "year";

type CommonProps = {
  isCurrentPeriod: boolean;
  isFuturePeriod: boolean;
  // At the floor of the app's history (see MIN_YEAR in page.tsx) — nothing
  // exists before it, so the back control stops here rather than walking into
  // empty periods forever.
  isEarliestPeriod: boolean;
  prevParam: string;
  nextParam: string;
};

// The month/year scopes carry the same extra payload: the completion sections
// under the time breakdown, plus the hrefs the Year/Month toggle points at
// (built server-side, which is the only place that knows the live month).
type RollupProps = {
  rollup: Rollup;
  goalCompletion: GoalCompletion;
  habitCompletion: HabitCompletion;
  // "Jan – Sep" (year) or "Jul" (month) — the caption beside the session count.
  rangeLabel: string;
  scopeYearHref: string;
  scopeMonthHref: string;
};

// Discriminated on `view`: the week branch carries This-week-format data
// (rendered via the shared WeekSummary), month/year carry the rollup plus the
// completion sections. TS enforces the fork.
type Props = CommonProps &
  (
    | {
        view: "week";
        weekStartMs: number;
        weekEndMs: number;
        // Monday anchor (YYYY-MM-DD) — links this week to /recap.
        monday: string;
        totalMs: number;
        segs: WeekSummarySeg[];
        goals: WeekSummaryGoal[];
        items: Record<string, CategoryItem[]>;
      }
    // year/month carry the period as NUMBERS (not a timestamp): the label is
    // built + formatted entirely client-side, so it can't roll back a day when a
    // server-UTC-midnight instant is reinterpreted in a browser west of UTC.
    | ({ view: "year"; year: number } & RollupProps)
    | ({ view: "month"; year: number; monthIndex: number } & RollupProps)
  );

// "Jul 21 – Jul 27" — the week's Mon–Sun span.
function weekLabel(startMs: number, endMs: number): string {
  const fmt = (ms: number) =>
    new Date(ms).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  return `${fmt(startMs)} – ${fmt(endMs)}`;
}

function navHref(view: View, param: string): string {
  if (view === "year") return `/history?view=year&y=${param}`;
  if (view === "week") return `/history?view=week&w=${param}`;
  return `/history?view=month&m=${param}`;
}

// Hours as the design writes them: "292h", "18.5h" — one decimal only when it
// carries information.
function hoursLabel(ms: number): string {
  const h = Math.round((ms / HOUR_MS) * 10) / 10;
  return `${h % 1 === 0 ? h : h.toFixed(1)}h`;
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

type RollupViewProps = Extract<Props, { view: "year" } | { view: "month" }>;
type WeekViewProps = Extract<Props, { view: "week" }>;

// Thin dispatcher: whichever scope was asked for. The two share no chrome, so
// they're separate components.
export function HistoryClient(props: Props) {
  return props.view === "week" ? (
    <WeekView {...props} />
  ) : (
    <RollupView {...props} />
  );
}

// The week scope keeps its original chrome and layout: it's the deep link the
// Progress Sessions header opens and the way into /recap, and it renders the
// shared WeekSummary that Progress itself uses — restyling it here would change
// Progress too.
function WeekView(props: WeekViewProps) {
  const { isCurrentPeriod, isFuturePeriod, isEarliestPeriod, prevParam, nextParam } =
    props;
  const label = weekLabel(props.weekStartMs, props.weekEndMs);
  return (
      <div className="flex flex-1 flex-col items-center px-5 pt-8 pb-24 sm:pt-12">
        <main className="flex w-full max-w-md flex-col gap-6">
          <BackLink />
          <div className="flex items-center justify-between">
            {isEarliestPeriod ? (
              <span
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "text-disabled pointer-events-none"
                )}
                aria-disabled="true"
              >
                <ChevronLeftIcon /> Previous
              </span>
            ) : (
              <Link
                href={navHref("week", prevParam)}
                className={buttonVariants({ variant: "ghost", size: "sm" })}
                aria-label="Previous week"
              >
                <ChevronLeftIcon /> Previous
              </Link>
            )}
            {isCurrentPeriod || isFuturePeriod ? (
              <span className="text-muted-foreground text-xs">
                {isCurrentPeriod ? "This week" : ""}
              </span>
            ) : (
              <Link
                href={navHref("week", nextParam)}
                className={buttonVariants({ variant: "ghost", size: "sm" })}
                aria-label="Next week"
              >
                Next <ChevronRightIcon />
              </Link>
            )}
          </div>
          <div className="text-center text-sm font-medium">{label}</div>
          {/* Same presentation as the Progress tab's This-week section — the
              shared WeekSummary IS that section, so formats can't drift. */}
          <WeekSummary
            totalMs={props.totalMs}
            segs={props.segs}
            goals={props.goals}
            items={props.items}
          />
          <Link
            href={`/recap?w=${props.monday}`}
            className="text-muted-foreground self-center text-sm hover:underline"
          >
            Weekly recap →
          </Link>
        </main>
      </div>
  );
}

// Month and year: the 2026-09-17 design. Same sections in both scopes; the
// habit section is the only one that changes shape (rows vs. calendar).
function RollupView(props: RollupViewProps) {
  const { isCurrentPeriod, isFuturePeriod, isEarliestPeriod, prevParam, nextParam } =
    props;

  const label =
    props.view === "year"
      ? String(props.year)
      : new Date(props.year, props.monthIndex, 1).toLocaleDateString(undefined, {
          month: "long",
          year: "numeric",
        });

  const monthName =
    props.view === "month"
      ? new Date(props.year, props.monthIndex, 1).toLocaleDateString(undefined, {
          month: "long",
        })
      : null;

  return (
    <div className="flex flex-1 flex-col items-center px-5 pt-8 pb-24 sm:pt-12">
      <main className="flex w-full max-w-md flex-col">
        <BackLink />

        {/* Scope toggle + period stepper */}
        <div className="flex items-center pt-4">
          <div className="bg-track flex gap-0.5 rounded-full p-[3px]">
            <ScopeChip
              href={props.scopeYearHref}
              label="Year"
              active={props.view === "year"}
            />
            <ScopeChip
              href={props.scopeMonthHref}
              label="Month"
              active={props.view === "month"}
            />
          </div>
          <span className="flex-1" />
          {/* The mock has no stepper in Year scope; both scopes get one here so
              the period in view is always steppable and labelled. Back stops at
              the app's first year, forward at the live period. */}
          <div className="flex items-center gap-0.5">
            <StepperButton
              href={navHref(props.view, prevParam)}
              direction="prev"
              label={props.view === "year" ? "Previous year" : "Previous month"}
              disabled={isEarliestPeriod}
            />
            <span className="text-ink min-w-[78px] text-center text-[13px] font-semibold">
              {props.view === "year" ? props.year : monthName}
            </span>
            <StepperButton
              href={navHref(props.view, nextParam)}
              direction="next"
              label={props.view === "year" ? "Next year" : "Next month"}
              disabled={isCurrentPeriod || isFuturePeriod}
            />
          </div>
        </div>

        {/* Title block */}
        <div className="pt-4">
          <h1 className="text-ink font-serif text-[34px] leading-none font-semibold tracking-[-0.02em] tabular-nums">
            {label}
          </h1>
          <div className="flex items-baseline gap-2 pt-2">
            <span className="text-ink text-[19px] font-semibold tabular-nums">
              {hoursLabel(props.rollup.totalTrackedMs)}
            </span>
            <span className="text-faint text-xs">
              {props.rollup.sessionsCompleted}{" "}
              {props.rollup.sessionsCompleted === 1 ? "session" : "sessions"}
              {isCurrentPeriod ? " so far" : ` · ${props.rangeLabel}`}
            </span>
          </div>
        </div>

        <TimeSection rollup={props.rollup} label={label} />

        <GoalCompletionSection completion={props.goalCompletion} />

        <HabitCompletionSection
          completion={props.habitCompletion}
          monthName={monthName}
          daysInMonth={
            props.view === "month"
              ? new Date(props.year, props.monthIndex + 1, 0).getDate()
              : 0
          }
        />

        {/* History is a reading surface now. The auto-categorize button, the
            Sync button and the Connect entry point all used to live here; the
            calendar's remaining controls (status, Disconnect) are in Settings. */}
      </main>
    </div>
  );
}

function BackLink() {
  return (
    // Back to Progress, which is where this view is entered from (the Sessions
    // section header). The period type is switched below.
    <Link
      href="/"
      className="text-muted-foreground hover:text-foreground -ml-1 flex items-center gap-1 self-start text-sm"
    >
      <ChevronLeftIcon className="size-4" /> Back to progress
    </Link>
  );
}

function ScopeChip({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        "rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.06em] uppercase transition-colors " +
        (active ? "bg-brand text-primary-foreground" : "text-faint")
      }
    >
      {label}
    </Link>
  );
}

// 26px square nav button. Disabled renders as a span so it isn't focusable and
// carries no href — the chevron just greys out, matching the mock.
function StepperButton({
  href,
  direction,
  label,
  disabled = false,
}: {
  href: string;
  direction: "prev" | "next";
  label: string;
  disabled?: boolean;
}) {
  const Icon = direction === "prev" ? ChevronLeftIcon : ChevronRightIcon;
  const shape =
    "border-hairline bg-screen flex size-[26px] items-center justify-center rounded-[9px] border-[1.5px]";
  if (disabled) {
    return (
      <span className={`${shape} text-disabled`} aria-disabled="true">
        <Icon className="size-[13px]" />
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={label}
      className={`${shape} text-secondary-ink active:scale-90`}
    >
      <Icon className="size-[13px]" />
    </Link>
  );
}

function SectionHead({ title, note }: { title: string; note?: string }) {
  return (
    <div className="flex items-center gap-[7px] pb-1.5">
      <span className="section-label">{title}</span>
      <span className="flex-1" />
      {note && (
        <span className="text-caption text-[10px] font-semibold tracking-[0.06em]">
          {note}
        </span>
      )}
    </div>
  );
}

// One list row: dot, label, bar scaled to the largest row, and up to two
// right-aligned figures. Shared by all three sections so they can't drift.
//
// Which figure carries the weight flips by section: Time leads with the hours
// and trails a muted share, while Goal completion leads with muted "21/27 wks"
// and lands on the bold percentage. `metaStrong` swaps the pair.
function StatRow({
  color,
  square = false,
  prefix,
  name,
  barPct,
  meta,
  metaStrong = false,
  value,
  expandable = false,
  expanded = false,
  onToggle,
}: {
  color: string;
  square?: boolean;
  prefix?: string;
  name: string;
  barPct: number;
  meta?: string;
  metaStrong?: boolean;
  value: string;
  expandable?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const strong = "text-ink text-xs font-semibold tabular-nums";
  const muted = "text-caption text-[11px] tabular-nums";
  const body = (
    <>
      <span
        className={`size-2 shrink-0 ${square ? "rounded-[2px]" : "rounded-full"}`}
        style={{ background: color }}
      />
      <span className="text-body min-w-0 truncate text-[12.5px]">
        {prefix && <span className="text-faint">{prefix} </span>}
        {name}
      </span>
      {expandable && (
        <ChevronDownIcon
          className={`text-faint size-3 shrink-0 transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        />
      )}
      <span className="flex-1" />
      <span className="bg-track block h-1 w-24 shrink-0 overflow-hidden rounded-full">
        <span
          className="block h-full rounded-full"
          style={{ width: `${Math.max(0, Math.min(100, barPct))}%`, background: color }}
        />
      </span>
      {/* The slot is wide enough for Goal completion's longest realistic
          string — a year of a big quota, e.g. "520/1040h" — since Time's
          "118.5h" shares it and both sections should line up. */}
      {meta && (
        <span
          className={`w-14 shrink-0 text-right whitespace-nowrap ${
            metaStrong ? strong : muted
          }`}
        >
          {meta}
        </span>
      )}
      <span className={`w-[30px] text-right ${metaStrong ? muted : strong}`}>
        {value}
      </span>
    </>
  );

  if (!expandable) {
    return <div className="flex items-center gap-2 py-[5px]">{body}</div>;
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className="flex w-full items-center gap-2 py-[5px] text-left"
    >
      {body}
    </button>
  );
}

// The sessions and calendar events behind one Time row — the audit the donut
// this section replaced used to carry. Read-only, same item format.
function AuditList({ items }: { items: CategoryItem[] }) {
  return (
    <ul className="mb-1 flex max-h-64 flex-col gap-1.5 overflow-y-auto overscroll-contain py-1 pl-4">
      {items.map((it) => (
        <li
          key={it.id}
          className="flex items-baseline justify-between gap-2 text-[11px]"
        >
          <span className="text-secondary-ink min-w-0 truncate">{it.title}</span>
          <span className="text-caption flex shrink-0 items-baseline gap-1.5 tabular-nums">
            <span>
              {new Date(it.startMs).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </span>
            <span>{hoursLabel(it.ms)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Hairline() {
  return <div className="bg-hairline mt-3.5 h-px" />;
}

// Where the time went. `categoryRows` is already the right list: goal-attributed
// time arrives as a synthetic `goal:<id>` row named "Goal: {title}" in the goal's
// own hue, category time as the category. A session belongs to exactly one of
// the two axes, so — unlike the mock, which drew goals and categories as two
// separate 100% breakdowns — these shares sum to a single 100%.
function TimeSection({ rollup, label }: { rollup: Rollup; label: string }) {
  // Which row is expanded to its audit list. The donut this section replaced
  // could be tapped to see which sessions and calendar events made up a
  // category; that's the only way to find a mis-imported event, so the rows
  // keep it.
  const [openKey, setOpenKey] = useState<string | null>(null);
  const rows = rollup.categoryRows;
  if (rows.length === 0) {
    return (
      <div className="pt-3.5">
        <SectionHead title="Time" />
        <p className="text-faint py-2 text-[12.5px]">Nothing logged in {label}.</p>
      </div>
    );
  }

  // Goals first, each group already sorted by time from buildCategoryBreakdown.
  const ordered = [...rows].sort((a, b) => {
    if (a.isGoal !== b.isGoal) return a.isGoal ? -1 : 1;
    return b.ms - a.ms;
  });
  // Bars are relative to the biggest row, not to the total — otherwise a long
  // tail of small rows renders as a row of empty tracks.
  const maxMs = Math.max(...ordered.map((r) => r.ms), 1);

  return (
    <div className="flex flex-col pt-3.5">
      <SectionHead title="Time" />
      {ordered.map((r) => {
        const key = r.id ?? "uncategorized";
        const items = rollup.categoryItems[key] ?? [];
        const isOpen = openKey === key;
        return (
          <div key={key} className="flex flex-col">
            <StatRow
              color={r.color ?? CHART_FALLBACK}
              square={!r.isGoal}
              prefix={r.isGoal ? "Goal:" : "Category:"}
              // buildCategoryBreakdown already prefixes goal rows with
              // "Goal: "; the row renders its own prefix, so strip the copy.
              name={r.isGoal ? r.name.replace(/^Goal:\s*/, "") : r.name}
              barPct={(r.ms / maxMs) * 100}
              meta={hoursLabel(r.ms)}
              metaStrong
              value={pct(
                rollup.totalTrackedMs > 0 ? r.ms / rollup.totalTrackedMs : 0
              )}
              expandable={items.length > 0}
              expanded={isOpen}
              onToggle={() => setOpenKey(isOpen ? null : key)}
            />
            {isOpen && <AuditList items={items} />}
          </div>
        );
      })}
    </div>
  );
}

function GoalCompletionSection({ completion }: { completion: GoalCompletion }) {
  if (completion.perGoal.length === 0) return null;
  return (
    <>
      <Hairline />
      <div className="flex flex-col pt-3">
        {/* "met" would be wrong now that a week can score partially — this is
            a mean, not a count of weeks hit. */}
        <SectionHead
          title="Goal completion"
          note={`averaging ${pct(completion.overallRate)} of quota`}
        />
        {completion.perGoal.map((g) => (
          <StatRow
            key={g.id}
            color={g.color}
            name={g.title}
            barPct={g.rate * 100}
            // Counted hours against quota × weeks — whole hours, so the string
            // stays inside the slot. Both figures are capped the same way, so
            // this ratio always agrees with the percentage beside it.
            meta={`${Math.round(g.countedMs / HOUR_MS)}/${Math.round(
              g.targetMs / HOUR_MS
            )}h`}
            value={pct(g.rate)}
          />
        ))}
      </div>
    </>
  );
}

function HabitCompletionSection({
  completion,
  monthName,
  daysInMonth,
}: {
  completion: HabitCompletion;
  monthName: string | null;
  daysInMonth: number;
}) {
  if (completion.perHabit.length === 0) return null;
  const note = `${pct(completion.overallRate)}${
    monthName ? ` in ${monthName}` : " overall"
  }`;

  return (
    <>
      <Hairline />
      <div className="flex flex-col pt-3">
        <SectionHead title="Habit completion" note={note} />
        {monthName ? (
          <HabitCalendar
            days={completion.calendar}
            daysInMonth={daysInMonth}
            habitCount={completion.perHabit.length}
          />
        ) : (
          completion.perHabit.map((h) => (
            <StatRow
              key={h.id}
              color={h.color}
              name={h.name}
              barPct={h.rate * 100}
              value={pct(h.rate)}
            />
          ))
        )}
      </div>
    </>
  );
}

const WEEKDAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"];

// Mon-first weekday index of a YYYY-MM-DD string. UTC arithmetic so the
// viewer's timezone can't shift the grid by a day.
function weekdayMonFirst(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

// A month of day cells, each showing how many habits were checked off that day.
// Darker navy = more done. Days after today aren't in `days` at all (the server
// stops at today) and render as empty outlined cells.
function HabitCalendar({
  days,
  daysInMonth,
  habitCount,
}: {
  days: HabitCalendarDayProp[];
  daysInMonth: number;
  habitCount: number;
}) {
  if (days.length === 0) return null;
  const pad = weekdayMonFirst(days[0].date);
  // The server stops at today, so in a month still running the remaining days
  // have no data. They still get a cell — an outlined blank — so the grid reads
  // as a whole month rather than ending abruptly on today.
  const future = Math.max(0, daysInMonth - days.length);
  // Whatever's left of the final row, so the grid ends on a clean week.
  const trailing = (7 - ((pad + days.length + future) % 7)) % 7;

  return (
    <>
      <div className="grid grid-cols-7 gap-1 pt-1">
        {WEEKDAY_INITIALS.map((w, i) => (
          <span
            key={i}
            className="text-disabled text-center text-[9px] font-semibold tracking-[0.08em]"
          >
            {w}
          </span>
        ))}
        {Array.from({ length: pad }, (_, i) => (
          <span key={`pad-${i}`} className="h-[30px]" />
        ))}
        {days.map((d) => (
          <DayCell key={d.date} done={d.done} total={d.total} />
        ))}
        {Array.from({ length: future }, (_, i) => (
          <span
            key={`future-${i}`}
            className="border-track bg-screen h-[30px] rounded-lg border"
          />
        ))}
        {Array.from({ length: trailing }, (_, i) => (
          <span key={`trail-${i}`} className="h-[30px]" />
        ))}
      </div>
      <p className="text-faint pt-2 text-[11px]">
        Habits completed each day, of {habitCount}
      </p>
    </>
  );
}

type HabitCalendarDayProp = { date: string; done: number; total: number };

function DayCell({ done, total }: { done: number; total: number }) {
  const share = total > 0 ? done / total : 0;
  const base =
    "flex h-[30px] items-center justify-center rounded-lg text-[10px] font-semibold tabular-nums";
  if (done === 0) {
    return <span className={`${base} bg-divider text-disabled`}>0</span>;
  }
  return (
    <span
      className={base}
      style={{
        background: `rgba(28, 58, 94, ${(0.08 + share * 0.82).toFixed(2)})`,
        color: share >= 0.5 ? "#fff" : "var(--brand)",
      }}
    >
      {done}
    </span>
  );
}
