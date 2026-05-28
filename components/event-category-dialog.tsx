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
import { excludeEvent, restoreEvent } from "@/app/actions/event-exclusions";

type Props = {
  event: DayEvent | null;
  categories: Category[];
  onOpenChange: (open: boolean) => void;
  // Optional: parent provides this to optimistically remove the event from
  // its list as soon as the user clicks "Hide event" — must be called
  // inside a transition by the dialog.
  onHide?: (eventId: string) => void;
};

export function EventCategoryDialog({
  event,
  categories,
  onOpenChange,
  onHide,
}: Props) {
  return (
    <Dialog open={event !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        {event && (
          <EventCategoryForm
            key={event.id}
            event={event}
            categories={categories}
            onClose={() => onOpenChange(false)}
            onHide={onHide}
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
  onHide,
}: {
  event: DayEvent;
  categories: Category[];
  onClose: () => void;
  onHide?: (eventId: string) => void;
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

  function handleHide() {
    const eventId = event.id;
    startTransition(async () => {
      // Optimistic: tell the parent to drop this event from its rendered
      // list immediately. Stays visually hidden until refresh confirms.
      onHide?.(eventId);
      onClose();
      const r = await excludeEvent(eventId);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      router.refresh();
      toast.success("Event hidden", {
        action: {
          label: "Undo",
          onClick: async () => {
            const undo = await restoreEvent(eventId);
            if ("error" in undo) {
              toast.error(undo.error);
              return;
            }
            router.refresh();
          },
        },
      });
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
        <Button
          variant="destructive"
          className="sm:mr-auto"
          onClick={handleHide}
          disabled={pending}
        >
          Hide event
        </Button>
        {event.source === "manual" && (
          <Button
            variant="outline"
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
