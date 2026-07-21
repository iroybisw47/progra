"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { toast } from "sonner";
import { ListChecksIcon, SparklesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

// Lazy chunk — the review popup only appears after running/reopening the AI
// categorizer, so keep it out of /history's critical bundle.
const CategorizationReviewDialog = dynamic(
  () =>
    import("@/components/categorization-review-dialog").then(
      (m) => m.CategorizationReviewDialog
    ),
  { ssr: false }
);
import {
  categorizeEventsInRange,
  listAiCategorizedInRange,
  type AiAssignment,
} from "@/app/actions/categorize-events";

import type { Category } from "@/lib/storage";

type Props = {
  startMs: number;
  endMs: number;
  // Events still uncategorized in the period → the button runs the AI.
  uncategorizedCount: number;
  // Events the AI already labeled → the button re-opens the review popup.
  reviewCount: number;
  categories: Category[];
};

// On the History month/year views. When the period has uncategorized events it
// runs the AI and opens a review popup of the decisions. Once everything's
// sorted it flips to a "Review" state that re-opens the same popup from the
// already-stored AI decisions — no model call — so past choices stay editable.
export function CategorizePeriodButton({
  startMs,
  endMs,
  uncategorizedCount,
  reviewCount,
  categories,
}: Props) {
  const [pending, setPending] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [assignments, setAssignments] = useState<AiAssignment[]>([]);

  const hasNew = uncategorizedCount > 0;

  async function handleClick() {
    setPending(true);
    if (hasNew) {
      const result = await categorizeEventsInRange(startMs, endMs);
      setPending(false);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      if (result.categorized === 0) {
        toast.success("Nothing new to categorize");
        return;
      }
      if (result.remaining) {
        toast.success(
          `Categorized ${result.categorized} — ${result.remaining} more, tap again`
        );
      }
      setAssignments(result.assignments);
    } else {
      const existing = await listAiCategorizedInRange(startMs, endMs);
      setPending(false);
      if (existing.length === 0) {
        toast.success("No auto-categorized events to review");
        return;
      }
      setAssignments(existing);
    }
    // The popup refreshes the History bars when closed.
    setReviewOpen(true);
  }

  const label = pending
    ? hasNew
      ? "Categorizing…"
      : "Loading…"
    : hasNew
      ? `Auto-categorize ${uncategorizedCount} uncategorized event${uncategorizedCount === 1 ? "" : "s"}`
      : `Review ${reviewCount} auto-categorized event${reviewCount === 1 ? "" : "s"}`;

  return (
    <>
      <Button
        variant="outline"
        className="h-11 w-full text-base"
        onClick={handleClick}
        disabled={pending}
      >
        {hasNew ? <SparklesIcon /> : <ListChecksIcon />} {label}
      </Button>
      <CategorizationReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        assignments={assignments}
        categories={categories}
      />
    </>
  );
}
