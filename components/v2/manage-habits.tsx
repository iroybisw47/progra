"use client";

import { useEffect, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";

import { track } from "@/lib/analytics";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
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
import { PrimaryButton } from "@/components/v2/primary-button";
import {
  BottomSheet,
  BottomSheetContent,
} from "@/components/v2/bottom-sheet";
import { Input } from "@/components/ui/input";
import { entityColor } from "@/lib/colors";
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

  // Optimistic privacy overlay keyed by habit id, so the eye flips instantly
  // before updateHabit + refresh lands. Base is empty; once the transition
  // ends the override clears and the value falls back to the refreshed
  // h.isPrivate from props — same lifecycle as the completions set above.
  const [privateOverrides, setPrivateOverride] = useOptimistic<
    Record<string, boolean>,
    { id: string; value: boolean }
  >({}, (state, { id, value }) => ({ ...state, [id]: value }));
  const isHabitPrivate = (h: Habit) => privateOverrides[h.id] ?? h.isPrivate;

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
    // The action toggles, so read the CURRENT state to know which way it went —
    // only checking a habit ON is the activation signal worth counting.
    const checkingOn = !doneSet.has(key);
    startTransition(async () => {
      addOptimistic(key);
      const r = await toggleHabitCompletion(habitId, date);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      if (checkingOn) track("habit_checked", { backfilled: date !== today });
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
    });
  }

  function togglePrivacy(habit: Habit) {
    const next = !isHabitPrivate(habit);
    startTransition(async () => {
      setPrivateOverride({ id: habit.id, value: next });
      const r = await updateHabit(habit.id, { isPrivate: next });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(
        next
          ? `${habit.name} is now private`
          : `${habit.name} is now visible to friends`
      );
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
    });
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent title="Habits" meta="Tap a day to check it off">
        <div className="flex flex-col gap-6 pb-1">
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
              <div className="flex flex-col">
                <div className="flex items-center gap-1 pb-[7px]">
                  <span className="flex-1" />
                  {LETTERS.map((l, i) => (
                    <span
                      key={i}
                      className={cn(
                        "w-[26px] text-center text-[9px] font-semibold tracking-[0.06em]",
                        dayDates[i] === today ? "text-brand" : "text-disabled"
                      )}
                    >
                      {l}
                    </span>
                  ))}
                </div>

                {habits.map((h) => {
                  const color = entityColor(h.color);
                  return (
                    <div
                      key={h.id}
                      className="border-divider flex items-center gap-1 border-t py-1.5"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-1.5 pr-1">
                        <span
                          aria-hidden
                          className="size-2 shrink-0 rounded-[2px]"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-body truncate text-[13px]">
                          {h.name}
                        </span>
                      </div>
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
                              "flex size-[26px] shrink-0 items-center justify-center rounded-[8px] border-[1.5px] text-white transition-[background-color,border-color,transform] duration-150",
                              !isDone && "border-hairline",
                              isFuture ? "opacity-35" : "active:scale-90"
                            )}
                            style={
                              isDone
                                ? { backgroundColor: color, borderColor: color }
                                : undefined
                            }
                          >
                            {isDone && (
                              <CheckIcon className="size-3" strokeWidth={3.4} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Habit list — rename / recolor / delete */}
          {habits.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="section-label">Your habits</h3>
              <ul className="border-control-border flex flex-col rounded-2xl border">
                {habits.map((h, i) => {
                  const priv = isHabitPrivate(h);
                  return (
                  <li
                    key={h.id}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2.5",
                      i > 0 && "border-divider border-t"
                    )}
                  >
                    <span
                      aria-hidden
                      className="size-[9px] shrink-0 rounded-[2px]"
                      style={{ backgroundColor: entityColor(h.color) }}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {h.name}
                    </span>
                    <button
                      type="button"
                      aria-label={
                        priv
                          ? `${h.name} is private — tap to make it visible to friends`
                          : `${h.name} is visible to friends — tap to make it private`
                      }
                      aria-pressed={!priv}
                      onClick={() => togglePrivacy(h)}
                      className={cn(
                        "flex size-8 items-center justify-center rounded-full transition-colors",
                        priv ? "text-caption opacity-40" : "text-ink"
                      )}
                    >
                      <EyeIcon className="size-4" />
                    </button>
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
                  );
                })}
              </ul>
            </section>
          )}

          {/* Add habit */}
          <section className="flex flex-col gap-3">
            <h3 className="section-label">Add a habit</h3>
            <Input
              className="h-12"
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
            <PrimaryButton onClick={handleAdd} disabled={!newName.trim()}>
              <PlusIcon className="size-4" />
              Add habit
            </PrimaryButton>
          </section>
        </div>
      </BottomSheetContent>

      {/* Edit habit — rename + recolor, in its own sheet on top. */}
      <BottomSheet
        open={editing !== null}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
      >
        <BottomSheetContent title="Edit habit" meta="Tap the color again to clear">
          <div className="flex flex-col gap-5 pb-1">
            <Input
              aria-label="Habit name"
              className="h-12 rounded-[13px] border-[1.5px] text-[15px]"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSaveEdit();
                }
              }}
            />
            <ColorSwatches value={editColor} onChange={setEditColor} />
            <PrimaryButton disabled={!editName.trim()} onClick={handleSaveEdit}>
              Save habit
            </PrimaryButton>
          </div>
        </BottomSheetContent>
      </BottomSheet>
    </BottomSheet>
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
