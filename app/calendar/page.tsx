"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PlusIcon, XIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { TaskDialog } from "@/components/task-dialog";
import { EventDialog } from "@/components/event-dialog";
import { WeekStrip } from "@/components/week-strip";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { type CalendarEvent, type Task } from "@/lib/storage";
import {
  updateEvents,
  updateTasks,
  useEvents,
  useNow,
  useTasks,
} from "@/lib/hooks";
import { formatLocalDate, formatLongDate } from "@/lib/dates";

type PendingDelete =
  | { kind: "task"; task: Task }
  | { kind: "event"; event: CalendarEvent }
  | null;

export default function CalendarPage() {
  const now = useNow();
  const tasks = useTasks();
  const events = useEvents();

  const hydrated = now !== 0;
  const today = new Date(hydrated ? now : 0);
  const [selectedTs, setSelectedTs] = useState<number | null>(null);
  const selectedDate = selectedTs !== null ? new Date(selectedTs) : today;
  const selectedKey = hydrated || selectedTs !== null ? formatLocalDate(selectedDate) : "";
  const todayKey = hydrated ? formatLocalDate(today) : "";

  const [taskDialog, setTaskDialog] = useState<{ open: boolean; task?: Task }>({
    open: false,
  });
  const [eventDialog, setEventDialog] = useState<{ open: boolean; event?: CalendarEvent }>({
    open: false,
  });
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);

  const dayTasks = tasks
    .filter((t) => t.dueDate === selectedKey)
    .sort((a, b) => {
      const ac = a.completedAt === null ? 0 : 1;
      const bc = b.completedAt === null ? 0 : 1;
      if (ac !== bc) return ac - bc;
      return a.createdAt - b.createdAt;
    });
  const taskDoneCount = dayTasks.filter((t) => t.completedAt !== null).length;

  const dayEvents = events
    .filter((e) => e.date === selectedKey)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const markedDates = new Set<string>([
    ...tasks.map((t) => t.dueDate),
    ...events.map((e) => e.date),
  ]);

  function toggleTask(task: Task) {
    const completing = task.completedAt === null;
    updateTasks(
      tasks.map((t) =>
        t.id === task.id
          ? { ...t, completedAt: completing ? Date.now() : null }
          : t
      )
    );
    toast.success(completing ? "Done" : "Reopened");
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    if (pendingDelete.kind === "task") {
      updateTasks(tasks.filter((t) => t.id !== pendingDelete.task.id));
      toast.success("Deleted");
    } else {
      updateEvents(events.filter((e) => e.id !== pendingDelete.event.id));
      toast.success("Deleted");
    }
    setPendingDelete(null);
  }

  return (
    <div className="flex flex-1 flex-col items-center px-5 pt-8 pb-24 sm:pt-12">
      <main className="flex w-full max-w-md flex-col gap-5">
        <header className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">Calendar</h1>
          {hydrated ? (
            <WeekStrip
              selectedDate={selectedDate}
              today={today}
              onSelect={(d) => setSelectedTs(d.getTime())}
              markedDates={markedDates}
            />
          ) : (
            <div className="h-14" />
          )}
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>{hydrated ? formatLongDate(selectedDate) : " "}</span>
              {hydrated && selectedKey === todayKey && (
                <Badge variant="secondary">Today</Badge>
              )}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-baseline justify-between">
              <span>Tasks</span>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {dayTasks.length} {dayTasks.length === 1 ? "task" : "tasks"} ·{" "}
                {taskDoneCount} done
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {dayTasks.length === 0 ? (
              <p className="text-muted-foreground text-sm">No tasks for this day.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {dayTasks.map((task) => {
                  const done = task.completedAt !== null;
                  return (
                    <li
                      key={task.id}
                      className="flex min-h-11 items-center gap-3 py-1"
                    >
                      <Checkbox
                        checked={done}
                        onCheckedChange={() => toggleTask(task)}
                        aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
                      />
                      <button
                        type="button"
                        className={
                          "flex-1 text-left text-sm " +
                          (done ? "line-through text-muted-foreground" : "")
                        }
                        onClick={() => setTaskDialog({ open: true, task })}
                      >
                        {task.title}
                      </button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Delete ${task.title}`}
                        onClick={() => setPendingDelete({ kind: "task", task })}
                      >
                        <XIcon />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
            <Button
              variant="ghost"
              className="mt-2 h-10 self-start"
              onClick={() => setTaskDialog({ open: true })}
              disabled={!hydrated}
            >
              <PlusIcon /> Add task
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-baseline justify-between">
              <span>Events</span>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {dayEvents.length} {dayEvents.length === 1 ? "event" : "events"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {dayEvents.length === 0 ? (
              <p className="text-muted-foreground text-sm">No events for this day.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {dayEvents.map((event) => (
                  <li
                    key={event.id}
                    className="flex min-h-11 items-center gap-3 py-1"
                  >
                    <button
                      type="button"
                      className="flex flex-1 items-center gap-3 text-left"
                      onClick={() => setEventDialog({ open: true, event })}
                    >
                      <span className="w-[90px] shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                        {event.startTime}–{event.endTime}
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="text-sm font-medium leading-tight">
                          {event.title}
                        </span>
                        {event.location && (
                          <span className="text-xs text-muted-foreground">
                            {event.location}
                          </span>
                        )}
                      </span>
                    </button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Delete ${event.title}`}
                      onClick={() => setPendingDelete({ kind: "event", event })}
                    >
                      <XIcon />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <Button
              variant="ghost"
              className="mt-2 h-10 self-start"
              onClick={() => setEventDialog({ open: true })}
              disabled={!hydrated}
            >
              <PlusIcon /> Add event
            </Button>
          </CardContent>
        </Card>
      </main>

      {hydrated && (
        <>
          <TaskDialog
            open={taskDialog.open}
            onOpenChange={(o) => setTaskDialog({ open: o, task: o ? taskDialog.task : undefined })}
            defaultDate={selectedKey}
            task={taskDialog.task}
          />
          <EventDialog
            open={eventDialog.open}
            onOpenChange={(o) => setEventDialog({ open: o, event: o ? eventDialog.event : undefined })}
            defaultDate={selectedKey}
            event={eventDialog.event}
          />
        </>
      )}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => {
          if (!o) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete this {pendingDelete?.kind ?? "item"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? pendingDelete.kind === "task"
                  ? `"${pendingDelete.task.title}" will be removed.`
                  : `"${pendingDelete.event.title}" will be removed.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
