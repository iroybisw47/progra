"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CategoryPicker } from "@/components/category-picker";

import { type Category, type Session } from "@/lib/storage";
import {
  createSession,
  deleteSession,
  updateSession,
} from "@/app/actions/sessions";
import { formatLocalDate, formatTime, parseLocalDate } from "@/lib/dates";

export type SessionDialogMode = "edit-completed" | "edit-active" | "create";

type SessionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: SessionDialogMode;
  session?: Session;
  categories: Category[];
  now: Date;
};

function roundToNearest5(d: Date): Date {
  const out = new Date(d);
  out.setSeconds(0, 0);
  out.setMinutes(Math.round(out.getMinutes() / 5) * 5);
  return out;
}

function combine(dateStr: string, timeStr: string): number | null {
  if (!dateStr || !timeStr) return null;
  const parts = timeStr.split(":");
  if (parts.length < 2) return null;
  const hh = Number(parts[0]);
  const mm = Number(parts[1]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  const d = parseLocalDate(dateStr);
  d.setHours(hh, mm, 0, 0);
  return d.getTime();
}

export function SessionDialog(props: SessionDialogProps) {
  const { open, onOpenChange, mode, session } = props;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <SessionForm
          key={`${session?.id ?? "new"}-${open ? "1" : "0"}-${mode}`}
          {...props}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function SessionForm({
  mode,
  session,
  categories,
  now,
  onClose,
}: SessionDialogProps & { onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isCreate = mode === "create";
  const isActive = mode === "edit-active";

  const defaultStart = isCreate
    ? roundToNearest5(new Date(now.getTime() - 60 * 60 * 1000))
    : new Date(session!.startedAt);
  const defaultEnd =
    mode === "edit-completed"
      ? new Date(session!.endedAt!)
      : isCreate
        ? roundToNearest5(new Date(now))
        : null;

  const [taskName, setTaskName] = useState(isCreate ? "" : session!.taskName);
  const [description, setDescription] = useState(
    isCreate ? "" : session!.description ?? ""
  );
  const [categoryId, setCategoryId] = useState<string | null>(
    isCreate ? null : session!.categoryId
  );
  const [startDate, setStartDate] = useState(formatLocalDate(defaultStart));
  const [startTime, setStartTime] = useState(formatTime(defaultStart));
  const [endDate, setEndDate] = useState(
    defaultEnd ? formatLocalDate(defaultEnd) : ""
  );
  const [endTime, setEndTime] = useState(
    defaultEnd ? formatTime(defaultEnd) : ""
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  const startTs = combine(startDate, startTime);
  const endTs = !isActive ? combine(endDate, endTime) : null;
  const endBeforeStart =
    !isActive && startTs !== null && endTs !== null && endTs <= startTs;
  const startInFuture =
    isActive && startTs !== null && startTs > now.getTime();
  const canSave =
    !pending &&
    taskName.trim().length > 0 &&
    categoryId !== null &&
    startTs !== null &&
    (isActive ? !startInFuture : endTs !== null && !endBeforeStart);

  const title = isCreate
    ? "New past session"
    : isActive
      ? "Edit active session"
      : "Edit session";

  function handleSave() {
    const trimmed = taskName.trim();
    if (!trimmed || !categoryId || startTs === null) return;

    if (isActive) {
      if (startInFuture) {
        toast.error("Start time can't be in the future");
        return;
      }
      startTransition(async () => {
        const r = await updateSession(session!.id, {
          taskName: trimmed,
          description,
          categoryId,
          startedAt: startTs,
        });
        if ("error" in r) {
          toast.error(r.error);
          return;
        }
        toast.success("Saved");
        router.refresh();
        onClose();
      });
      return;
    }

    if (endTs === null || endTs <= startTs) {
      toast.error("End time must be after start time");
      return;
    }

    if (isCreate) {
      startTransition(async () => {
        const r = await createSession({
          taskName: trimmed,
          description,
          categoryId,
          startedAt: startTs,
          endedAt: endTs,
        });
        if ("error" in r) {
          toast.error(r.error);
          return;
        }
        toast.success("Added");
        router.refresh();
        onClose();
      });
    } else {
      startTransition(async () => {
        const r = await updateSession(session!.id, {
          taskName: trimmed,
          description,
          categoryId,
          startedAt: startTs,
          endedAt: endTs,
        });
        if ("error" in r) {
          toast.error(r.error);
          return;
        }
        toast.success("Saved");
        router.refresh();
        onClose();
      });
    }
  }

  function handleDelete() {
    if (!session) return;
    startTransition(async () => {
      const r = await deleteSession(session.id);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success("Deleted");
      setConfirmDelete(false);
      router.refresh();
      onClose();
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="sess-task">Task</label>
          <Input
            id="sess-task"
            autoFocus
            className="h-10"
            placeholder="What were you working on?"
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="sess-desc">
            Description <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <Input
            id="sess-desc"
            className="h-10"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Category</span>
          <CategoryPicker
            categories={categories}
            selectedId={categoryId}
            onSelect={setCategoryId}
            emptyHint="Add a category on the main screen first."
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Start</span>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              aria-label="Start date"
              className="h-10 font-mono"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              type="time"
              aria-label="Start time"
              className="h-10 font-mono"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
        </div>
        {!isActive && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">End</span>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                aria-label="End date"
                className="h-10 font-mono"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
              <Input
                type="time"
                aria-label="End time"
                className="h-10 font-mono"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
        )}
        {endBeforeStart && (
          <p className="text-destructive text-xs">End must be after start.</p>
        )}
        {startInFuture && (
          <p className="text-destructive text-xs">Start can&apos;t be in the future.</p>
        )}
      </div>
      <DialogFooter>
        {mode === "edit-completed" && (
          <Button
            variant="destructive"
            className="sm:mr-auto"
            onClick={() => setConfirmDelete(true)}
            disabled={pending}
          >
            Delete
          </Button>
        )}
        <DialogClose render={<Button variant="outline" disabled={pending} />}>Cancel</DialogClose>
        <Button onClick={handleSave} disabled={!canSave}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this session?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDelete} disabled={pending}>Delete</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
