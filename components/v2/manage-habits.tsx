"use client";

import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";

import { ColorSwatches } from "@/components/color-swatches";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  archiveHabit,
  createHabit,
  toggleHabitCompletion,
  updateHabit,
} from "@/app/actions/habits";
import { addDaysISO } from "@/lib/dates";
import type { Habit, HabitCompletion } from "@/lib/db/habits";
import { cn } from "@/lib/utils";

const LETTERS = ["M", "T", "W", "T", "F", "S", "S"] as const;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  habits: Habit[];
  completions: HabitCompletion[];
  weekStart: string; // current week's Monday (YYYY-MM-DD)
  today: string; // YYYY-MM-DD (user tz)
  minWeekStart: string; // earliest Monday the editor may navigate to
};

// Full-screen habit manager (redesign): an editable week grid you can page back
// through to backfill missed days, plus add / rename / recolor / delete. Every
// mutation goes through the existing habit actions (toggleHabitCompletion allows
// past days) and refreshes, so the Progress tab reflects changes on close.
export function ManageHabits({
  open,
  onOpenChange,
  habits,
  completions,
  weekStart,
  today,
  minWeekStart,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Which week the grid is showing. The dialog is mounted for the lifetime of
  // the Progress tab, so snap back to the current week each time it opens (and
  // if the week rolls over underneath it) — otherwise a reopen could land
  // check-offs on weeks-old dates the user paged to earlier.
  const [viewWeek, setViewWeek] = useState(weekStart);
  useEffect(() => {
    if (open) setViewWeek(weekStart);
  }, [open, weekStart]);

  // Optimistic completion set keyed `habitId|date`, seeded from the loaded
  // window so toggles flip instantly before the refresh lands.
  const baseKeys = completions.map((c) => `${c.habitId}|${c.completedOn}`);
  const [optimisticKeys, addOptimistic] = useOptimistic(
    baseKeys,
    (state: string[], key: string): string[] =>
      state.includes(key)
        ? state.filter((k) => k !== key)
        : [...state, key]
  );
  const doneSet = new Set(optimisticKeys);

  // Add-habit + edit-habit dialog state.
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string | null>(null);
  const [editing, setEditing] = useState<Habit | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState<string | null>(null);

  const dayDates = Array.from({ length: 7 }, (_, i) => addDaysISO(viewWeek, i));
  const canPrev = viewWeek > minWeekStart;
  const canNext = viewWeek < weekStart;
  const weekLabel = formatWeekLabel(viewWeek);

  function toggleCell(habitId: string, date: string) {
    if (date > today) return; // future days aren't checkable
    const key = `${habitId}|${date}`;
    startTransition(async () => {
      addOptimistic(key);
      const r = await toggleHabitCompletion(habitId, date);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      router.refresh();
    });
  }

  function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const color = newColor ?? undefined;
    startTransition(async () => {
      const r = await createHabit(trimmed, color);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setNewName("");
      setNewColor(null);
      toast.success(`Added ${trimmed}`);
      router.refresh();
    });
  }

  function openEdit(habit: Habit) {
    setEditing(habit);
    setEditName(habit.name);
    setEditColor(habit.color);
  }

  function handleSaveEdit() {
    if (!editing) return;
    const trimmed = editName.trim();
    if (!trimmed) return;
    const id = editing.id;
    const color = editColor;
    startTransition(async () => {
      const r = await updateHabit(id, { name: trimmed, color });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setEditing(null);
      toast.success(`Saved ${trimmed}`);
      router.refresh();
    });
  }

  function handleDelete(habit: Habit) {
    startTransition(async () => {
      const r = await archiveHabit(habit.id);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(`Deleted ${habit.name}`);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="border-divider border-b px-5 py-4">
          <DialogTitle>Manage habits</DialogTitle>
          <DialogDescription>
            Tap any past or current day to check it off, and edit your habits.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6 overflow-y-auto px-5 py-5">
          {/* Editable week grid */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                aria-label="Previous week"
                disabled={!canPrev}
                onClick={() => setViewWeek((w) => addDaysISO(w, -7))}
                className="text-caption hover:text-ink border-hairline flex size-8 items-center justify-center rounded-full border disabled:opacity-30"
              >
                <ChevronLeftIcon className="size-4" />
              </button>
              <span className="text-sm font-bold tabular-nums">{weekLabel}</span>
              <button
                type="button"
                aria-label="Next week"
                disabled={!canNext}
                onClick={() => setViewWeek((w) => addDaysISO(w, 7))}
                className="text-caption hover:text-ink border-hairline flex size-8 items-center justify-center rounded-full border disabled:opacity-30"
              >
                <ChevronRightIcon className="size-4" />
              </button>
            </div>

            {habits.length === 0 ? (
              <p className="text-caption text-sm">Add a habit to start tracking.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="flex-1" />
                  <div className="flex gap-1">
                    {LETTERS.map((l, i) => (
                      <span
                        key={i}
                        className={cn(
                          "w-7 text-center text-[10px] font-bold uppercase",
                          dayDates[i] === today ? "text-brand" : "text-caption"
                        )}
                      >
                        {l}
                      </span>
                    ))}
                  </div>
                </div>

                {habits.map((h) => (
                  <div key={h.id} className="flex items-center gap-2">
                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                      {h.color && (
                        <span
                          aria-hidden
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: h.color }}
                        />
                      )}
                      <span className="truncate text-sm">{h.name}</span>
                    </div>
                    <div className="flex gap-1">
                      {dayDates.map((d, i) => {
                        const isDone = doneSet.has(`${h.id}|${d}`);
                        const isFuture = d > today;
                        return (
                          <button
                            key={i}
                            type="button"
                            disabled={isFuture}
                            onClick={() => toggleCell(h.id, d)}
                            aria-label={`${h.name} ${LETTERS[i]}${isDone ? " done" : ""}`}
                            aria-pressed={isDone}
                            className={cn(
                              "flex size-7 items-center justify-center rounded-full border transition-colors",
                              isDone
                                ? "border-brand bg-brand text-primary-foreground"
                                : isFuture
                                  ? "border-hairline opacity-40"
                                  : "border-hairline hover:border-brand/60 active:scale-95"
                            )}
                          >
                            {isDone && (
                              <CheckIcon className="size-3.5" strokeWidth={3} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Habit list — rename / recolor / delete */}
          {habits.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="text-caption text-xs font-bold uppercase tracking-wide">
                Your habits
              </h3>
              <ul className="border-hairline flex flex-col rounded-xl border">
                {habits.map((h, i) => (
                  <li
                    key={h.id}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2.5",
                      i > 0 && "border-divider border-t"
                    )}
                  >
                    <span
                      aria-hidden
                      className="size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: h.color ?? "var(--chart-5)" }}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {h.name}
                    </span>
                    <button
                      type="button"
                      aria-label={`Edit ${h.name}`}
                      onClick={() => openEdit(h)}
                      className="text-caption hover:text-ink flex size-8 items-center justify-center rounded-full"
                    >
                      <PencilIcon className="size-4" />
                    </button>
                    <AlertDialog>
                      <AlertDialogTrigger
                        render={
                          <button
                            type="button"
                            aria-label={`Delete ${h.name}`}
                            className="text-caption hover:text-destructive flex size-8 items-center justify-center rounded-full"
                          >
                            <Trash2Icon className="size-4" />
                          </button>
                        }
                      />
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete {h.name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            The habit stops showing up going forward. Days you
                            already checked off stay in your history.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(h)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Add habit */}
          <section className="flex flex-col gap-3">
            <h3 className="text-caption text-xs font-bold uppercase tracking-wide">
              Add a habit
            </h3>
            <Input
              className="h-11"
              placeholder="Drink water, read 30m, …"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
            />
            <ColorSwatches value={newColor} onChange={setNewColor} />
            <Button
              className="h-11 w-full gap-1.5"
              onClick={handleAdd}
              disabled={!newName.trim()}
            >
              <PlusIcon className="size-4" />
              Add habit
            </Button>
          </section>
        </div>

        <DialogFooter className="border-divider border-t px-5 py-3">
          <DialogClose render={<Button variant="outline" className="w-full" />}>
            Done
          </DialogClose>
        </DialogFooter>
      </DialogContent>

      {/* Edit habit — rename + color */}
      <Dialog
        open={editing !== null}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit habit</DialogTitle>
            <DialogDescription>Rename it or give it a color.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="v2-habit-name">
                Name
              </label>
              <Input
                id="v2-habit-name"
                className="h-11"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSaveEdit();
                  }
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">
                Color{" "}
                <span className="text-caption font-normal">
                  (tap the selected one to clear)
                </span>
              </span>
              <ColorSwatches value={editColor} onChange={setEditColor} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button disabled={!editName.trim()} onClick={handleSaveEdit}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

// "Jul 7 – 13" style label for a Monday-anchored week.
function formatWeekLabel(weekStart: string): string {
  const [y, m, d] = weekStart.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d));
  const end = new Date(Date.UTC(y, m - 1, d + 6));
  const fmt = (dt: Date, withMonth: boolean) =>
    dt.toLocaleDateString("en-US", {
      timeZone: "UTC",
      month: withMonth ? "short" : undefined,
      day: "numeric",
    });
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  return `${fmt(start, true)} – ${fmt(end, !sameMonth)}`;
}
