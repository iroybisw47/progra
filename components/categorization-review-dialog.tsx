"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CategoryPicker } from "@/components/category-picker";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { Category } from "@/lib/storage";
import type { AiAssignment } from "@/app/actions/categorize-events";

import { setEventCategory } from "@/app/actions/event-categorizations";
import { excludeEvent, restoreEvent } from "@/app/actions/event-exclusions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignments: AiAssignment[];
  categories: Category[];
};

type Row = { eventId: string; title: string; categoryId: string };

// Shows the AI's just-made categorization decisions grouped by category and
// lets the user correct (re-assign) or hide any of them inline. Reuses the same
// server actions the /clock event dialog uses, so a correction writes a manual
// override that supersedes the AI row.
export function CategorizationReviewDialog({
  open,
  onOpenChange,
  assignments,
  categories,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState<Row[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Re-seed local state whenever a fresh categorize run supplies new decisions.
  useEffect(() => {
    setRows(
      assignments.map((a) => ({
        eventId: a.eventId,
        title: a.title,
        categoryId: a.categoryId,
      }))
    );
    setEditingId(null);
  }, [assignments]);

  const categoryById = new Map(categories.map((c) => [c.id, c] as const));

  function handleOpenChange(next: boolean) {
    // No close-refresh needed: every action taken in here revalidates the
    // event surfaces, so the History bars already have the fresh payload.
    onOpenChange(next);
  }

  function handleReassign(eventId: string, categoryId: string) {
    setEditingId(null);
    startTransition(async () => {
      const r = await setEventCategory(eventId, categoryId);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setRows((prev) =>
        prev.map((row) =>
          row.eventId === eventId ? { ...row, categoryId } : row
        )
      );
      toast.success(`Moved to ${categoryById.get(categoryId)?.name ?? "category"}`);
    });
  }

  function handleHide(eventId: string) {
    startTransition(async () => {
      // Optimistically drop the row; restore on failure isn't needed because
      // the undo toast covers the success path and an error re-lists nothing.
      setRows((prev) => prev.filter((row) => row.eventId !== eventId));
      const r = await excludeEvent(eventId);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success("Event hidden", {
        action: {
          label: "Undo",
          onClick: async () => {
            const undo = await restoreEvent(eventId);
            if ("error" in undo) {
              toast.error(undo.error);
              return;
            }
          },
        },
      });
    });
  }

  // Group rows by assigned category, preserving the categories' own order.
  const groups = categories
    .map((cat) => ({ cat, items: rows.filter((r) => r.categoryId === cat.id) }))
    .filter((g) => g.items.length > 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Categorized {rows.length} {rows.length === 1 ? "event" : "events"}
          </DialogTitle>
          <DialogDescription>
            Here&apos;s how each event was sorted. Change or hide any that look
            wrong.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[60vh] flex-col gap-5 overflow-y-auto py-2">
          {groups.map(({ cat, items }) => (
            <div key={cat.id} className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                {cat.color && (
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                )}
                <span className="truncate">{cat.name}</span>
                <span className="text-muted-foreground">({items.length})</span>
              </div>
              {items.map((row) => (
                <div
                  key={row.eventId}
                  className="flex flex-col gap-2 border-b pb-2 last:border-b-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm">
                      {row.title || "(no title)"}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          setEditingId(
                            editingId === row.eventId ? null : row.eventId
                          )
                        }
                      >
                        Change
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Hide event"
                        disabled={pending}
                        onClick={() => handleHide(row.eventId)}
                      >
                        <XIcon />
                      </Button>
                    </div>
                  </div>
                  {editingId === row.eventId && (
                    <CategoryPicker
                      categories={categories}
                      selectedId={row.categoryId}
                      onSelect={(id) => handleReassign(row.eventId, id)}
                    />
                  )}
                </div>
              ))}
            </div>
          ))}
          {rows.length === 0 && (
            <p className="text-muted-foreground text-center text-sm">
              No events left to review.
            </p>
          )}
        </div>

        <DialogFooter>
          <DialogClose render={<Button />}>Done</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
