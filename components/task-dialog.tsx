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

import { type Task } from "@/lib/storage";
import { updateTasks, useTasks } from "@/lib/hooks";

type TaskDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate: string;
  task?: Task;
};

export function TaskDialog({ open, onOpenChange, defaultDate, task }: TaskDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <TaskForm
          key={`${task?.id ?? "new"}-${open ? "1" : "0"}`}
          task={task}
          defaultDate={defaultDate}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function TaskForm({
  task,
  defaultDate,
  onClose,
}: {
  task?: Task;
  defaultDate: string;
  onClose: () => void;
}) {
  const tasks = useTasks();
  const isEdit = task !== undefined;
  const [title, setTitle] = useState(task?.title ?? "");
  const [dueDate, setDueDate] = useState(task?.dueDate ?? defaultDate);
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleSave() {
    const trimmed = title.trim();
    if (!trimmed) return;
    if (isEdit) {
      updateTasks(
        tasks.map((t) =>
          t.id === task.id
            ? { ...t, title: trimmed, dueDate, notes: notes.trim() || undefined }
            : t
        )
      );
      toast.success("Saved");
    } else {
      const next: Task = {
        id: crypto.randomUUID(),
        title: trimmed,
        dueDate,
        notes: notes.trim() || undefined,
        completedAt: null,
        createdAt: Date.now(),
      };
      updateTasks([...tasks, next]);
      toast.success("Added");
    }
    onClose();
  }

  function handleDelete() {
    if (!task) return;
    updateTasks(tasks.filter((t) => t.id !== task.id));
    toast.success("Deleted");
    setConfirmDelete(false);
    onClose();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit task" : "New task"}</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="task-title">Title</label>
          <Input
            id="task-title"
            autoFocus
            className="h-10"
            placeholder="What needs doing?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="task-due">Due date</label>
          <Input
            id="task-due"
            type="date"
            className="h-10 font-mono"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="task-notes">
            Notes <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <Textarea
            id="task-notes"
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
        <Button onClick={handleSave} disabled={!title.trim()}>
          Save
        </Button>
      </DialogFooter>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              {task ? `"${task.title}" will be removed.` : ""}
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
