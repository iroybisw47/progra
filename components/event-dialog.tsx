"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { type CalendarEvent } from "@/lib/storage";
import { updateEvents, useEvents } from "@/lib/hooks";

type EventDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate: string;
  event?: CalendarEvent;
};

export function EventDialog({ open, onOpenChange, defaultDate, event }: EventDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <EventForm
          key={`${event?.id ?? "new"}-${open ? "1" : "0"}`}
          event={event}
          defaultDate={defaultDate}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function EventForm({
  event,
  defaultDate,
  onClose,
}: {
  event?: CalendarEvent;
  defaultDate: string;
  onClose: () => void;
}) {
  const events = useEvents();
  const isEdit = event !== undefined;
  const [title, setTitle] = useState(event?.title ?? "");
  const [date, setDate] = useState(event?.date ?? defaultDate);
  const [startTime, setStartTime] = useState(event?.startTime ?? "09:00");
  const [endTime, setEndTime] = useState(event?.endTime ?? "10:00");
  const [location, setLocation] = useState(event?.location ?? "");
  const [notes, setNotes] = useState(event?.notes ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const timesValid = endTime > startTime;
  const canSave = title.trim().length > 0 && timesValid;

  function handleSave() {
    const trimmed = title.trim();
    if (!trimmed || !timesValid) return;
    if (isEdit) {
      updateEvents(
        events.map((e) =>
          e.id === event.id
            ? {
                ...e,
                title: trimmed,
                date,
                startTime,
                endTime,
                location: location.trim() || undefined,
                notes: notes.trim() || undefined,
              }
            : e
        )
      );
      toast.success("Saved");
    } else {
      const next: CalendarEvent = {
        id: crypto.randomUUID(),
        title: trimmed,
        date,
        startTime,
        endTime,
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
        createdAt: Date.now(),
      };
      updateEvents([...events, next]);
      toast.success("Added");
    }
    onClose();
  }

  function handleDelete() {
    if (!event) return;
    updateEvents(events.filter((e) => e.id !== event.id));
    toast.success("Deleted");
    setConfirmDelete(false);
    onClose();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit event" : "New event"}</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="event-title">Title</label>
          <Input
            id="event-title"
            autoFocus
            className="h-10"
            placeholder="What is it?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="event-date">Date</label>
          <Input
            id="event-date"
            type="date"
            className="h-10 font-mono"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="event-start">Start</label>
            <Input
              id="event-start"
              type="time"
              className="h-10 font-mono"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="event-end">End</label>
            <Input
              id="event-end"
              type="time"
              className="h-10 font-mono"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        </div>
        {!timesValid && (
          <p className="text-destructive text-xs">End must be after start.</p>
        )}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="event-location">
            Location <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <Input
            id="event-location"
            className="h-10"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="event-notes">
            Notes <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <Textarea
            id="event-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>
      <DialogFooter>
        {isEdit && (
          <Button
            variant="destructive"
            className="sm:mr-auto"
            onClick={() => setConfirmDelete(true)}
          >
            Delete
          </Button>
        )}
        <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
        <Button onClick={handleSave} disabled={!canSave}>
          Save
        </Button>
      </DialogFooter>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this event?</AlertDialogTitle>
            <AlertDialogDescription>
              {event ? `"${event.title}" will be removed.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
