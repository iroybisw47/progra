"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PencilIcon, PlusIcon, XIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { CategoryPicker } from "@/components/category-picker";
import { SessionDialog, type SessionDialogMode } from "@/components/session-dialog";

import { type Category, type Session } from "@/lib/storage";
import {
  updateCategories,
  updateSessions,
  useCategories,
  useNow,
  useSessions,
} from "@/lib/hooks";
import {
  DAY_LABELS,
  addDays,
  dayIndexMonFirst,
  endOfWeek,
  formatLocalDate,
  formatLongDate,
  formatRange,
  startOfWeek,
} from "@/lib/dates";
import { formatDuration, formatElapsed, nowTs } from "@/lib/duration";

const HOUR_MS = 60 * 60 * 1000;

function formatHours(ms: number): string {
  return `${(ms / HOUR_MS).toFixed(1)}h`;
}

// Attribution rule (per spec): a session belongs wholly to the local day of
// its `endedAt`. A still-running session is attributed to `now` (today), so
// the recap keeps ticking while clocked in.
function attributionEnd(s: Session, now: number): number {
  return s.endedAt ?? now;
}

function aggregateWeek(sessions: Session[], now: number) {
  const weekStart = startOfWeek(new Date(now)).getTime();
  const weekEnd = endOfWeek(new Date(now)).getTime();
  const perCategory = new Map<string | null, number>();
  const perDay = [0, 0, 0, 0, 0, 0, 0];
  for (const s of sessions) {
    const end = attributionEnd(s, now);
    const ms = end - s.startedAt;
    if (ms <= 0) continue;
    if (end < weekStart || end > weekEnd) continue;
    perDay[dayIndexMonFirst(new Date(end))] += ms;
    perCategory.set(s.categoryId, (perCategory.get(s.categoryId) ?? 0) + ms);
  }
  return { perCategory, perDay, total: perDay.reduce((x, y) => x + y, 0) };
}

function dayBreakdown(sessions: Session[], now: number, dayDate: Date) {
  const key = formatLocalDate(dayDate);
  const rows = sessions
    .map((s) => {
      const end = attributionEnd(s, now);
      return { session: s, ms: end - s.startedAt, end };
    })
    .filter(
      (r) => r.ms > 0 && formatLocalDate(new Date(r.end)) === key
    )
    .sort((a, b) => a.session.startedAt - b.session.startedAt);
  const total = rows.reduce((acc, r) => acc + r.ms, 0);
  return { rows, total };
}

type SessionDialogState =
  | { mode: SessionDialogMode; session?: Session }
  | null;

export default function ClockPage() {
  const categories = useCategories();
  const sessions = useSessions();
  const now = useNow();

  const [taskName, setTaskName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [pendingCategoryDelete, setPendingCategoryDelete] = useState<Category | null>(null);
  const [sessionDialog, setSessionDialog] = useState<SessionDialogState>(null);
  // null = week mode; 0..6 (Mon-first) = day mode for that weekday of this week.
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);

  const activeSession = sessions.find((s) => s.endedAt === null) ?? null;
  const hydrated = now !== 0;
  const nowDate = new Date(hydrated ? now : 0);
  const categoryById = new Map(categories.map((c) => [c.id, c] as const));

  const weekStartDate = hydrated ? startOfWeek(nowDate) : null;
  const weekEndDate = hydrated ? endOfWeek(nowDate) : null;
  const todayIndex = hydrated ? dayIndexMonFirst(nowDate) : -1;
  const weekly = aggregateWeek(sessions, hydrated ? now : 0);

  const categoryBreakdown = Array.from(weekly.perCategory.entries())
    .map(([id, ms]) => ({
      id,
      name:
        id === null
          ? "Uncategorized"
          : categoryById.get(id)?.name ?? "Uncategorized",
      ms,
    }))
    .sort((a, b) => b.ms - a.ms);
  const maxCatMs = categoryBreakdown[0]?.ms ?? 0;

  function categoryName(id: string | null): string {
    if (id === null) return "Uncategorized";
    return categoryById.get(id)?.name ?? "Uncategorized";
  }

  const inDayMode =
    selectedDayIndex !== null && hydrated && weekStartDate !== null;
  const selectedDate = inDayMode
    ? addDays(weekStartDate, selectedDayIndex)
    : null;
  const isTodaySelected =
    selectedDate !== null &&
    formatLocalDate(selectedDate) === formatLocalDate(nowDate);
  const day = selectedDate
    ? dayBreakdown(sessions, now, selectedDate)
    : { rows: [], total: 0 };
  const dayLabel =
    selectedDate === null
      ? ""
      : isTodaySelected
        ? "Today"
        : formatLongDate(selectedDate);

  function handleClockIn() {
    const name = taskName.trim();
    if (!name || !selectedCategoryId) return;
    const session: Session = {
      id: crypto.randomUUID(),
      categoryId: selectedCategoryId,
      taskName: name,
      description: description.trim() || undefined,
      startedAt: nowTs(),
      endedAt: null,
    };
    updateSessions([...sessions, session]);
    setTaskName("");
    setDescription("");
    setSelectedCategoryId(null);
    toast.success(`Clocked into ${categoryName(selectedCategoryId)}`);
  }

  function handleClockOut() {
    if (!activeSession) return;
    const endedAt = nowTs();
    updateSessions(
      sessions.map((s) => (s.id === activeSession.id ? { ...s, endedAt } : s))
    );
    toast.success(`Logged ${formatDuration(endedAt - activeSession.startedAt)}`);
  }

  function handleAddCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    const lower = name.toLowerCase();
    if (categories.some((c) => c.name.toLowerCase() === lower)) {
      setNewCategoryName("");
      return;
    }
    const cat: Category = {
      id: crypto.randomUUID(),
      name,
      createdAt: nowTs(),
    };
    updateCategories([...categories, cat]);
    setNewCategoryName("");
    toast.success(`Added ${name}`);
  }

  function handleConfirmCategoryDelete() {
    if (!pendingCategoryDelete) return;
    const id = pendingCategoryDelete.id;
    updateSessions(
      sessions.map((s) => (s.categoryId === id ? { ...s, categoryId: null } : s))
    );
    updateCategories(categories.filter((c) => c.id !== id));
    if (selectedCategoryId === id) setSelectedCategoryId(null);
    toast.success(`Removed ${pendingCategoryDelete.name}`);
    setPendingCategoryDelete(null);
  }

  const canClockIn = taskName.trim().length > 0 && selectedCategoryId !== null;

  return (
    <div className="flex flex-1 flex-col items-center px-5 pt-8 pb-24 sm:pt-12">
      <main className="flex w-full max-w-md flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">Progra</h1>
          <p className="text-muted-foreground text-sm">
            Plan the week. Clock in. Recap on Sunday.
          </p>
        </header>

        {activeSession ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                Clocked in
              </CardTitle>
              <CardAction>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Edit active session"
                  onClick={() =>
                    setSessionDialog({ mode: "edit-active", session: activeSession })
                  }
                >
                  <PencilIcon />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="font-mono text-5xl tabular-nums tracking-tight">
                {formatElapsed(hydrated ? now - activeSession.startedAt : 0)}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{activeSession.taskName}</span>
                <Badge variant="secondary">
                  {categoryName(activeSession.categoryId)}
                </Badge>
              </div>
              {activeSession.description && (
                <p className="text-muted-foreground text-sm">
                  {activeSession.description}
                </p>
              )}
              <Button
                variant="destructive"
                className="h-11 w-full text-base"
                onClick={handleClockOut}
              >
                Clock Out
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                Clock in
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" htmlFor="task-name">
                  Task
                </label>
                <Input
                  id="task-name"
                  className="h-10"
                  placeholder="What are you working on?"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" htmlFor="task-desc">
                  Description{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <Input
                  id="task-desc"
                  className="h-10"
                  placeholder="Notes for later you"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Category</span>
                <CategoryPicker
                  categories={categories}
                  selectedId={selectedCategoryId}
                  onSelect={setSelectedCategoryId}
                />
              </div>
              <Button
                className="h-11 w-full text-base"
                disabled={!canClockIn}
                onClick={handleClockIn}
              >
                Clock In
              </Button>
              <Button
                variant="ghost"
                className="h-10 w-full"
                disabled={!hydrated || categories.length === 0}
                onClick={() => setSessionDialog({ mode: "create" })}
              >
                <PlusIcon /> Add past session
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Categories</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Input
                className="h-10"
                placeholder="New category"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCategory();
                  }
                }}
              />
              <Button
                className="h-10"
                variant="secondary"
                onClick={handleAddCategory}
                disabled={!newCategoryName.trim()}
              >
                Add
              </Button>
            </div>
            {categories.length > 0 && (
              <ul className="flex flex-col divide-y divide-border">
                {categories.map((cat) => (
                  <li
                    key={cat.id}
                    className="flex items-center justify-between py-2"
                  >
                    <span className="text-sm">{cat.name}</span>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Delete ${cat.name}`}
                      onClick={() => setPendingCategoryDelete(cat)}
                    >
                      <XIcon />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          {inDayMode ? (
            <CardHeader>
              <CardTitle>{dayLabel}</CardTitle>
              <CardAction>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedDayIndex(null)}
                >
                  Week Overview
                </Button>
              </CardAction>
            </CardHeader>
          ) : (
            <CardHeader>
              <CardTitle>This week</CardTitle>
              <CardDescription>
                {weekStartDate && weekEndDate
                  ? formatRange(weekStartDate, weekEndDate)
                  : " "}
              </CardDescription>
            </CardHeader>
          )}
          <CardContent className="flex flex-col gap-5">
            {inDayMode ? (
              <>
                <div className="font-mono text-3xl tabular-nums">
                  {formatHours(day.total)}
                </div>

                {day.rows.length === 0 ? (
                  <p className="text-muted-foreground py-6 text-center text-sm">
                    No sessions logged
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {day.rows.map((row) => {
                      const s = row.session;
                      const isActive = s.endedAt === null;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() =>
                            setSessionDialog({
                              mode: isActive
                                ? "edit-active"
                                : "edit-completed",
                              session: s,
                            })
                          }
                          className="-mx-1 flex flex-col gap-1 rounded-md px-1 py-1 text-left transition-colors hover:bg-muted/50"
                        >
                          <div className="flex items-baseline justify-between gap-2 text-sm">
                            <span className="truncate">
                              {categoryName(s.categoryId)} - {s.taskName}
                              {isActive && (
                                <span className="text-muted-foreground">
                                  {" "}
                                  · in progress
                                </span>
                              )}
                            </span>
                            <span className="font-mono tabular-nums text-muted-foreground shrink-0">
                              {formatDuration(row.ms)}
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full bg-primary/60"
                              style={{
                                width:
                                  day.total > 0
                                    ? `${Math.max(2, (row.ms / day.total) * 100)}%`
                                    : "0%",
                              }}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="font-mono text-3xl tabular-nums">
                  {formatHours(weekly.total)}
                </div>

                {categoryBreakdown.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No sessions logged yet this week.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {categoryBreakdown.map((row) => (
                      <div
                        key={row.id ?? "uncategorized"}
                        className="flex flex-col gap-1"
                      >
                        <div className="flex items-baseline justify-between text-sm">
                          <span>{row.name}</span>
                          <span className="font-mono tabular-nums text-muted-foreground">
                            {formatHours(row.ms)}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full bg-primary/60"
                            style={{
                              width:
                                maxCatMs > 0
                                  ? `${Math.max(2, (row.ms / maxCatMs) * 100)}%`
                                  : "0%",
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            <div className="grid grid-cols-7 gap-1">
              {DAY_LABELS.map((label, i) => {
                const ms = weekly.perDay[i];
                const isToday = i === todayIndex;
                const isSelected = selectedDayIndex === i;
                return (
                  <button
                    key={label}
                    type="button"
                    disabled={!hydrated}
                    aria-pressed={isSelected}
                    onClick={() => setSelectedDayIndex(i)}
                    className={
                      "flex flex-col items-center gap-0.5 rounded-md py-1.5 text-xs transition-colors hover:bg-muted/60 disabled:pointer-events-none disabled:opacity-50 " +
                      (isSelected
                        ? "bg-primary/15 text-foreground ring-1 ring-primary"
                        : isToday
                          ? "bg-primary/10 ring-1 ring-primary/30"
                          : "")
                    }
                  >
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-mono tabular-nums">
                      {ms > 0 ? formatHours(ms) : "—"}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </main>

      <Dialog
        open={pendingCategoryDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingCategoryDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete category?</DialogTitle>
            <DialogDescription>
              {pendingCategoryDelete
                ? `"${pendingCategoryDelete.name}" will be removed. Its sessions will stay logged as Uncategorized.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button variant="destructive" onClick={handleConfirmCategoryDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {hydrated && (
        <SessionDialog
          open={sessionDialog !== null}
          onOpenChange={(o) => {
            if (!o) setSessionDialog(null);
          }}
          mode={sessionDialog?.mode ?? "create"}
          session={sessionDialog?.session}
          categories={categories}
          now={nowDate}
        />
      )}
    </div>
  );
}
