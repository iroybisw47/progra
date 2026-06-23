"use client";

import Link from "next/link";
import { toast } from "sonner";
import { ChevronLeftIcon, ChevronRightIcon, Share2Icon } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { RecapCard } from "@/components/recap-card";
import type { WeekRecap } from "@/lib/db/recap";

const HOUR_MS = 60 * 60 * 1000;

function formatHours(ms: number): string {
  return `${(ms / HOUR_MS).toFixed(1)}h`;
}

function formatWeekRange(startMs: number, endMs: number): string {
  const s = new Date(startMs);
  const e = new Date(endMs);
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(s)} – ${fmt(e)}`;
}

type Props = {
  recap: WeekRecap;
  isCurrentWeek: boolean;
  isFutureWeek: boolean;
  prevWeekParam: string;
  nextWeekParam: string;
};

// Web Share API type — not on every navigator at TS lib level.
type ShareCapableNavigator = Navigator & {
  share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
};

export function RecapClient({
  recap,
  isCurrentWeek,
  isFutureWeek,
  prevWeekParam,
  nextWeekParam,
}: Props) {
  function buildShareText(): string {
    const range = formatWeekRange(recap.weekStartMs, recap.weekEndMs);
    const lines: string[] = [];
    lines.push(`Week of ${range}`);
    lines.push(
      `${formatHours(recap.totalFocusedMs)} focused${
        recap.goalRows.length > 0
          ? recap.goalRows.length === 1
            ? " on 1 goal"
            : ` across ${recap.goalRows.length} goals`
          : ""
      }`
    );
    if (recap.goalRows.length > 0) {
      lines.push("");
      for (const g of recap.goalRows) {
        const actual = formatHours(g.actualMs);
        const quota = g.quotaHours.toFixed(1);
        const mark = g.status === "hit" ? " ✓" : "";
        lines.push(`${g.title}: ${actual} / ${quota}h${mark}`);
      }
    }
    const tail: string[] = [];
    if (recap.sessionsCompleted > 0) {
      tail.push(
        `${recap.sessionsCompleted} ${recap.sessionsCompleted === 1 ? "session" : "sessions"}`
      );
    }
    if (recap.habitChecks > 0) {
      tail.push(
        `${recap.habitChecks} habit ${recap.habitChecks === 1 ? "check" : "checks"}`
      );
    }
    if (tail.length > 0) {
      lines.push("");
      lines.push(tail.join(" · "));
    }
    return lines.join("\n");
  }

  async function handleShare() {
    const text = buildShareText();
    const nav = navigator as ShareCapableNavigator;

    if (typeof nav.share === "function") {
      try {
        await nav.share({ title: "Progra week", text });
        return;
      } catch (e) {
        // User cancelled the share sheet — quietly do nothing.
        if ((e as Error).name === "AbortError") return;
        // Other failures fall through to clipboard.
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Couldn't share. Try a screenshot.");
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center px-5 pt-8 pb-24 sm:pt-12">
      <main className="flex w-full max-w-md flex-col gap-6">
        {/* Navigation — lives outside the screenshot-able card */}
        <div className="flex items-center justify-between">
          <Link
            href={`/recap?w=${prevWeekParam}`}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
            aria-label="Previous week"
          >
            <ChevronLeftIcon /> Previous
          </Link>
          {isCurrentWeek || isFutureWeek ? (
            <span
              className="text-muted-foreground text-xs"
              aria-hidden
            >
              {isCurrentWeek ? "This week" : ""}
            </span>
          ) : (
            <Link
              href={`/recap?w=${nextWeekParam}`}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
              aria-label="Next week"
            >
              Next <ChevronRightIcon />
            </Link>
          )}
        </div>

        <RecapCard recap={recap} />

        <Button
          variant="outline"
          className="h-11 w-full"
          onClick={handleShare}
        >
          <Share2Icon /> Share this week
        </Button>
      </main>
    </div>
  );
}
