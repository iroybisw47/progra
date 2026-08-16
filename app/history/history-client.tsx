"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CategorizePeriodButton } from "@/components/categorize-period-button";
import { SyncCalendarButton } from "@/components/sync-calendar-button";
import { CategoryDonut } from "@/components/v2/category-donut";
import {
  WeekSummary,
  type WeekSummaryGoal,
  type WeekSummarySeg,
} from "@/components/v2/week-summary";
import type { CategoryItem } from "@/lib/aggregate";
import type { Rollup } from "@/lib/db/rollups";
import type { Category } from "@/lib/storage";

const CHART_FALLBACK = "var(--chart-5)";

type View = "week" | "month" | "year";

type CommonProps = {
  isCurrentPeriod: boolean;
  isFuturePeriod: boolean;
  prevParam: string;
  nextParam: string;
  categories: Category[];
  // History is the calendar surface: it shows Connect when disconnected and
  // Sync once connected, and receives the OAuth flow's one-shot return status.
  calendarConnected: boolean;
  calendarStatus: "connected" | "error" | null;
};

// Flipped to "0" once Google's app verification clears (build-time inlined).
const SHOW_UNVERIFIED_WARNING =
  process.env.NEXT_PUBLIC_SHOW_UNVERIFIED_WARNING === "1";

// Discriminated on `view`: the week branch carries This-week-format data
// (rendered via the shared WeekSummary), month/year carry the rollup for the
// donut breakdown. TS enforces the fork.
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
    | { view: "year"; rollup: Rollup; year: number }
    | { view: "month"; rollup: Rollup; year: number; monthIndex: number }
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

export function HistoryClient(props: Props) {
  const { isCurrentPeriod, isFuturePeriod, prevParam, nextParam } = props;

  // One-shot return toast from the connect flow (?calendar=connected|error) —
  // same pattern as settings-client.
  const calendarToastFired = useRef(false);
  const { calendarStatus } = props;
  useEffect(() => {
    if (calendarToastFired.current || !calendarStatus) return;
    calendarToastFired.current = true;
    if (calendarStatus === "error") {
      toast.error("Couldn't connect Google Calendar — you can try again.");
    } else {
      toast.success("Google Calendar connected");
    }
  }, [calendarStatus]);
  const label =
    props.view === "week"
      ? weekLabel(props.weekStartMs, props.weekEndMs)
      : props.view === "year"
        ? String(props.year)
        : new Date(props.year, props.monthIndex, 1).toLocaleDateString(undefined, {
            month: "long",
            year: "numeric",
          });

  const currentLabel =
    props.view === "year"
      ? "This year"
      : props.view === "month"
        ? "This month"
        : "This week";

  return (
    <div className="flex flex-1 flex-col items-center px-5 pt-8 pb-24 sm:pt-12">
      <main className="flex w-full max-w-md flex-col gap-6">
        {/* Back to Progress, which is where this view is entered from (the
            Sessions section header). The period type is switched below. */}
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground -ml-1 flex items-center gap-1 self-start text-sm"
        >
          <ChevronLeftIcon className="size-4" /> Back to progress
        </Link>

        {/* Period scrubber */}
        <div className="flex items-center justify-between">
          <Link
            href={navHref(props.view, prevParam)}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
            aria-label={`Previous ${props.view}`}
          >
            <ChevronLeftIcon /> Previous
          </Link>
          {isCurrentPeriod || isFuturePeriod ? (
            <span className="text-muted-foreground text-xs">
              {isCurrentPeriod ? currentLabel : ""}
            </span>
          ) : (
            <Link
              href={navHref(props.view, nextParam)}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
              aria-label={`Next ${props.view}`}
            >
              Next <ChevronRightIcon />
            </Link>
          )}
        </div>

        {/* Period label */}
        <div className="text-center text-sm font-medium">{label}</div>

        {props.view === "week" ? (
          <>
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
          </>
        ) : (
          <RollupBody
            rollup={props.rollup}
            categories={props.categories}
            label={label}
            isFuturePeriod={isFuturePeriod}
            calendarConnected={props.calendarConnected}
          />
        )}
      </main>
    </div>
  );
}

// Month/year presentation: the same donut + category legend format as the week,
// plus the period-scoped calendar actions (auto-categorize + sync). The heavier
// per-category audit / per-item delete / goal breakdown was intentionally
// dropped in favor of this clean donut view.
function RollupBody({
  rollup,
  categories,
  label,
  isFuturePeriod,
  calendarConnected,
}: {
  rollup: Rollup;
  categories: Category[];
  label: string;
  isFuturePeriod: boolean;
  calendarConnected: boolean;
}) {
  const segs: WeekSummarySeg[] = rollup.categoryRows.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color ?? CHART_FALLBACK,
    ms: r.ms,
  }));
  const hasTime = segs.length > 0;

  return (
    <>
      <Card>
        {hasTime ? (
          <CardContent className="py-5">
            <CategoryDonut
              segs={segs}
              totalMs={rollup.totalTrackedMs}
              items={rollup.categoryItems}
            />
          </CardContent>
        ) : (
          <CardContent className="py-10">
            <p className="text-muted-foreground text-center text-sm">
              Nothing logged in {label}.
            </p>
          </CardContent>
        )}
      </Card>

      {/* Calendar actions: period-scoped auto-categorize/review (only when there's
          something to sort or review) + the calendar entry point — History is
          the app's calendar surface (onboarding no longer offers connect):
          Connect when disconnected, Sync once connected. The OAuth flow returns
          here (?from=history). */}
      <div className="flex flex-col gap-3">
        {!isFuturePeriod &&
          (rollup.uncategorizedEventCount > 0 ||
            rollup.aiCategorizedEventCount > 0) && (
            <CategorizePeriodButton
              startMs={rollup.startMs}
              endMs={rollup.endMs}
              uncategorizedCount={rollup.uncategorizedEventCount}
              reviewCount={rollup.aiCategorizedEventCount}
              categories={categories}
            />
          )}
        {calendarConnected ? (
          <SyncCalendarButton />
        ) : (
          <div className="flex flex-col gap-2">
            {SHOW_UNVERIFIED_WARNING && (
              <p className="text-muted-foreground text-xs leading-relaxed text-pretty">
                Google&rsquo;s verification of Progra is still in review —
                you&rsquo;ll see a &ldquo;Google hasn&rsquo;t verified this
                app&rdquo; screen. Tap <strong>Advanced</strong>, then{" "}
                <strong>Go to progra.world (unsafe)</strong> to continue. Access
                is read-only.
              </p>
            )}
            <a
              href="/auth/google-calendar?from=history"
              className={buttonVariants({
                variant: "secondary",
                className: "h-11 w-full text-base",
              })}
            >
              Connect Google Calendar
            </a>
          </div>
        )}
      </div>
    </>
  );
}
