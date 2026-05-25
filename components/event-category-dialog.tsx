"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

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
import type { DayEvent } from "@/lib/db/calendar-events";

import { setEventCategory } from "@/app/actions/event-categorizations";

type Props = {
  event: DayEvent | null;
  categories: Category[];
  onOpenChange: (open: boolean) => void;
};

export function EventCategoryDialog({ event, categories, onOpenChange }: Props) {
  return (
    <Dialog open={event !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        {event && (
          <EventCategoryForm
            key={event.id}
            event={event}
            categories={categories}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EventCategoryForm({
  event,
  categories,
  onClose,
}: {
  event: DayEvent;
  categories: Category[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(
    event.category?.id ?? null
  );

  const sourceLabel =
    event.source === "manual"
      ? "Currently set manually"
      : event.source === "rule"
        ? "Currently matched by rule"
        : "Currently uncategorized";

  function handleSave() {
    if (selectedId === null) return;
    startTransition(async () => {
      const r = await setEventCategory(event.id, selectedId);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success("Saved");
      router.refresh();
      onClose();
    });
  }

  function handleRevert() {
    startTransition(async () => {
      const r = await setEventCategory(event.id, null);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success("Reverted to auto");
      router.refresh();
      onClose();
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Categorize event</DialogTitle>
        <DialogDescription>
          {event.title ?? "(no title)"} · {sourceLabel}
        </DialogDescription>
      </DialogHeader>
      <div className="py-2">
        <CategoryPicker
          categories={categories}
          selectedId={selectedId}
          onSelect={setSelectedId}
          emptyHint="Add categories on the clock screen first."
        />
      </div>
      <DialogFooter>
        {event.source === "manual" && (
          <Button
            variant="outline"
            className="sm:mr-auto"
            onClick={handleRevert}
            disabled={pending}
          >
            Revert to auto
          </Button>
        )}
        <DialogClose render={<Button variant="outline" disabled={pending} />}>
          Cancel
        </DialogClose>
        <Button onClick={handleSave} disabled={pending || selectedId === null}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </>
  );
}
