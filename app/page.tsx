"use client";

import { useState } from "react";
import { toast } from "sonner";
import { XIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
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
import { Toaster } from "@/components/ui/sonner";

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
  dayIndexMonFirst,
  endOfDay,
  endOfWeek,
  formatRange,
  startOfWeek,
} from "@/lib/week";

const HOUR_MS = 60 * 60 * 1000;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatHours(ms: number): string {
  return `${(ms / HOUR_MS).toFixed(1)}h`;
}

function aggregateWeek(sessions: Session[], now: number) {
  const weekStart = startOfWeek(new Date(now)).getTime();
  const weekEnd = endOfWeek(new Date(now)).getTime();
  const perCategory = new Map<string | null, number>();
  const perDay = [0, 0, 0, 0, 0, 0, 0];
  for (const s of sessions) {
    const a = Math.max(s.startedAt, weekStart);
    const rawEnd = s.endedAt ?? now;
    const b = Math.min(rawEnd, weekEnd);
    if (b <= a) continue;
    let cursor = a;
    while (cursor < b) {
      const dayEndMs = endOfDay(new Date(cursor)).getTime();
      const slice = Math.min(b, dayEndMs + 1);
      perDay[dayIndexMonFirst(new Date(cursor))] += slice - cursor;
      cursor = slice;
    }
    perCategory.set(
      s.categoryId,
      (perCategory.get(s.categoryId) ?? 0) + (b - a)
    );
  }
  return { perCategory, perDay, total: perDay.reduce((x, y) => x + y, 0) };
}

export default function Home() {
  const categories = useCategories();
  const sessions = useSessions();
  const now = useNow();

  const [taskName, setTaskName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);

  const activeSession = sessions.find((s) => s.endedAt === null) ?? null;
  const hydrated = now !== 0;
  const categoryById = new Map(categories.map((c) => [c.id, c] as const));

  const weekStartDate = hydrated ? startOfWeek(new Date(now)) : null;
  const weekEndDate = hydrated ? endOfWeek(new Date(now)) : null;
  const todayIndex = hydrated ? dayIndexMonFirst(new Date(now)) : -1;
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

  function handleClockIn() {
    const name = taskName.trim();
    if (!name || !selectedCategoryId) return;
    const session: Session = {
      id: crypto.randomUUID(),
      categoryId: selectedCategoryId,
      taskName: name,
      description: description.trim() || undefined,
      startedAt: Date.now(),
      endedAt: null,
    };
    updateSessions([...sessions, session]);
    setTaskName("");
    setDescription("");
    setSelectedCategoryId(null);
    const catName = categoryById.get(selectedCategoryId)?.name ?? "Uncategorized";
    toast.success(`Clocked into ${catName}`);
  }

  function handleClockOut() {
    if (!activeSession) return;
    const endedAt = Date.now();
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
      createdAt: Date.now(),
    };
    updateCategories([...categories, cat]);
    setNewCategoryName("");
    toast.success(`Added ${name}`);
  }

  function handleConfirmDelete() {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    updateSessions(
      sessions.map((s) => (s.categoryId === id ? { ...s, categoryId: null } : s))
    );
    updateCategories(categories.filter((c) => c.id !== id));
    if (selectedCategoryId === id) setSelectedCategoryId(null);
    toast.success(`Removed ${pendingDelete.name}`);
    setPendingDelete(null);
  }

  const canClockIn = taskName.trim().length > 0 && selectedCategoryId !== null;

  return (
    <div className="flex flex-1 flex-col items-center px-5 py-8 sm:py-12">
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
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="font-mono text-5xl tabular-nums tracking-tight">
                {formatElapsed(hydrated ? now - activeSession.startedAt : 0)}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{activeSession.taskName}</span>
                <Badge variant="secondary">
                  {activeSession.categoryId
                    ? categoryById.get(activeSession.categoryId)?.name ?? "Uncategorized"
                    : "Uncategorized"}
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
                {categories.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Add a category below to get started.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {categories.map((cat) => (
                      <Badge
                        key={cat.id}
                        variant={selectedCategoryId === cat.id ? "default" : "outline"}
                        className="h-8 cursor-pointer px-3 text-sm"
                        render={
                          <button
                            type="button"
                            aria-pressed={selectedCategoryId === cat.id}
                            onClick={() => setSelectedCategoryId(cat.id)}
                          />
                        }
                      >
                        {cat.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <Button
                className="h-11 w-full text-base"
                disabled={!canClockIn}
                onClick={handleClockIn}
              >
                Clock In
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
                      onClick={() => setPendingDelete(cat)}
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
          <CardHeader>
            <CardTitle>This week</CardTitle>
            <CardDescription>
              {weekStartDate && weekEndDate
                ? formatRange(weekStartDate, weekEndDate)
                : " "}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
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
                  <div key={row.id ?? "uncategorized"} className="flex flex-col gap-1">
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

            <div className="grid grid-cols-7 gap-1">
              {DAY_LABELS.map((label, i) => {
                const ms = weekly.perDay[i];
                const isToday = i === todayIndex;
                return (
                  <div
                    key={label}
                    className={
                      "flex flex-col items-center gap-0.5 rounded-md py-1.5 text-xs " +
                      (isToday ? "bg-primary/10 ring-1 ring-primary/30" : "")
                    }
                  >
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-mono tabular-nums">
                      {ms > 0 ? `${(ms / HOUR_MS).toFixed(1)}h` : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </main>

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete category?</DialogTitle>
            <DialogDescription>
              {pendingDelete
                ? `"${pendingDelete.name}" will be removed. Its sessions will stay logged as Uncategorized.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  );
}
