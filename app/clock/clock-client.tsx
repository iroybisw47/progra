"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { useOptimistic } from "react";
import {
  CalendarIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  HistoryIcon,
  MoonIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  SunIcon,
  XIcon,
} from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { CategoryPicker } from "@/components/category-picker";
import { ColorSwatches } from "@/components/color-swatches";
import { GoalPicker } from "@/components/goal-picker";
import type { SessionDialogMode } from "@/components/session-dialog";
import { Ticking } from "@/components/ticking";
import { WeekBreakdown } from "@/components/week-breakdown";

// Click-gated dialogs load as lazy chunks after hydration instead of shipping
// in /clock's critical bundle (they render nothing while closed).
const SessionDialog = dynamic(
  () => import("@/components/session-dialog").then((m) => m.SessionDialog),
  { ssr: false }
);
const EventCategoryDialog = dynamic(
  () =>
    import("@/components/event-category-dialog").then(
      (m) => m.EventCategoryDialog
    ),
  { ssr: false }
);
const SessionPhotoStep = dynamic(
  () =>
    import("@/components/session-photo-step").then((m) => m.SessionPhotoStep),
  { ssr: false }
);

import { type Category, type Session } from "@/lib/storage";
import type { DayEvent } from "@/lib/db/calendar-events";
import type { Goal } from "@/lib/db/goals";
import { aggregateWeek, buildCategoryBreakdown } from "@/lib/aggregate";
import { isPaused, sessionPausedMs, sessionWorkedMs } from "@/lib/session";
import { useNowMinute } from "@/lib/hooks";
import { REDESIGN } from "@/lib/flags";
import { cn } from "@/lib/utils";
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
import { formatDuration, formatElapsed } from "@/lib/duration";

import {
  createCategory,
  deleteCategory,
  updateCategory,
} from "@/app/actions/categories";
import {
  clockIn,
  clockOut,
  pauseSession,
  resumeSession,
  updateSession,
} from "@/app/actions/sessions";

const HOUR_MS = 60 * 60 * 1000;

function formatHours(ms: number): string {
  return `${(ms / HOUR_MS).toFixed(1)}h`;
}

// Session attribution for the day-row breakdown: belongs to the local-day
// of `endedAt` (or `now` for active). Mirrors the rule in lib/aggregate.
function attributionEnd(s: Session, now: number): number {
  return s.endedAt ?? now;
}

type DayRow =
  | { kind: "session"; session: Session; ms: number; sortKey: number }
  | { kind: "event"; event: DayEvent; ms: number; sortKey: number };

function dayBreakdown(
  sessions: Session[],
  events: DayEvent[],
  now: number,
  dayDate: Date
): { rows: DayRow[]; total: number } {
  const key = formatLocalDate(dayDate);
  const rows: DayRow[] = [];

  for (const s of sessions) {
    const end = attributionEnd(s, now);
    const ms = sessionWorkedMs(s, now);
    if (ms <= 0) continue;
    if (formatLocalDate(new Date(end)) !== key) continue;
    rows.push({ kind: "session", session: s, ms, sortKey: s.startedAt });
  }

  for (const e of events) {
    const ms = e.endMs - e.startMs;
    if (ms <= 0) continue;
    if (formatLocalDate(new Date(e.startMs)) !== key) continue;
    rows.push({ kind: "event", event: e, ms, sortKey: e.startMs });
  }

  rows.sort((a, b) => a.sortKey - b.sortKey);
  const total = rows.reduce((acc, r) => acc + r.ms, 0);
  return { rows, total };
}

type SessionDialogState =
  | { mode: SessionDialogMode; session?: Session }
  | null;

type ClockClientProps = {
  categories: Category[];
  sessions: Session[];
  events: DayEvent[];
  goals: Goal[];
  // Signed URL for the active session's photo, or null. Shown as a thumbnail on
  // the active card.
  activePhotoUrl: string | null;
};

export function ClockClient({
  categories,
  sessions,
  events,
  goals,
  activePhotoUrl,
}: ClockClientProps) {
  const router = useRouter();
  // Minute-quantized tick: totals and week/day boundaries only need minute
  // resolution. The second-live timer lives in a <Ticking> leaf below, so the
  // 1000-line screen re-renders once a minute instead of once a second.
  const now = useNowMinute();
  const [, startTransition] = useTransition();

  // Optimistic exclusion: clicking "Hide event" drops the event from the
  // rendered list and weekly totals before the server roundtrip completes.
  const [optimisticEvents, hideOptimistic] = useOptimistic(
    events,
    (state: DayEvent[], hiddenId: string): DayEvent[] =>
      state.filter((e) => e.id !== hiddenId)
  );

  const [taskName, setTaskName] = useState("");
  const [description, setDescription] = useState("");
  // A clock-in targets EITHER a category OR a goal. `pickerMode` is which list
  // is currently revealed; selecting from one clears the other.
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [pickerMode, setPickerMode] = useState<"category" | "goal">("category");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [pendingCategoryDelete, setPendingCategoryDelete] = useState<Category | null>(null);
  // Category edit dialog: rename + palette color. Draft state is seeded when
  // the pencil opens the dialog.
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState<string | null>(null);
  const [sessionDialog, setSessionDialog] = useState<SessionDialogState>(null);
  const [eventDialog, setEventDialog] = useState<DayEvent | null>(null);
  // The optional photo step, opened after clock-in. One photo per session,
  // captured while it runs.
  const [photoStep, setPhotoStep] = useState<{ sessionId: string } | null>(
    null
  );
  // null = week mode; 0..6 (Mon-first) = day mode for that weekday of this week.
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);

  // Clock-only theme. Scoped to this screen via a `dark` class on the wrapper
  // (activates the warm-charcoal dark tokens for this subtree only — the rest
  // of the app and the tab bar stay light). Persisted in localStorage; read
  // lazily (SSR-guarded) so there's no setState-in-effect. The wrapper is
  // suppressHydrationWarning since its class can differ from the server's.
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("clock-theme") === "dark";
    } catch {
      return false;
    }
  });
  function toggleTheme() {
    setDark((d) => {
      const next = !d;
      try {
        localStorage.setItem("clock-theme", next ? "dark" : "light");
      } catch {
        // ignore storage failures (private mode etc.)
      }
      return next;
    });
  }

  const activeSession = sessions.find((s) => s.endedAt === null) ?? null;

  // Inline notes draft for the active session. Reset when the active session
  // changes (clock out → new clock in) using the render-time prop-sync pattern.
  const [notesDraft, setNotesDraft] = useState(
    activeSession?.description ?? ""
  );
  const [notesSessionId, setNotesSessionId] = useState<string | null>(
    activeSession?.id ?? null
  );
  if ((activeSession?.id ?? null) !== notesSessionId) {
    setNotesSessionId(activeSession?.id ?? null);
    setNotesDraft(activeSession?.description ?? "");
  }

  const hydrated = now !== 0;
  const nowDate = new Date(hydrated ? now : 0);
  // Memoized so keystrokes into the controlled inputs (task name, notes, new
  // category) re-render without re-running the aggregation passes — these only
  // recompute when the data or the minute changes.
  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c] as const)),
    [categories]
  );
  const goalById = useMemo(
    () => new Map(goals.map((g) => [g.id, g] as const)),
    [goals]
  );

  const weekStartDate = hydrated ? startOfWeek(nowDate) : null;
  const weekEndDate = hydrated ? endOfWeek(nowDate) : null;
  const todayIndex = hydrated ? dayIndexMonFirst(nowDate) : -1;
  const weekly = useMemo(
    () => aggregateWeek(sessions, optimisticEvents, hydrated ? now : 0),
    [sessions, optimisticEvents, hydrated, now]
  );

  // Goal clock-ins surface here as "Goal: {name}" rows, same as the home and
  // History breakdowns (shared buildCategoryBreakdown).
  const categoryBreakdown = useMemo(
    () => buildCategoryBreakdown(weekly.perCategory, categories, goals),
    [weekly, categories, goals]
  );

  function categoryName(id: string | null): string {
    if (id === null) return "Uncategorized";
    return categoryById.get(id)?.name ?? "Uncategorized";
  }

  // A session's display label: its goal ("Goal: {name}") when it's a goal
  // clock-in, otherwise its category name.
  function sessionLabel(s: Session): string {
    if (s.goalId) return `Goal: ${goalById.get(s.goalId)?.title ?? "goal"}`;
    return categoryName(s.categoryId);
  }

  const inDayMode =
    selectedDayIndex !== null && hydrated && weekStartDate !== null;
  const selectedDate = inDayMode
    ? addDays(weekStartDate, selectedDayIndex)
    : null;
  const isTodaySelected =
    selectedDate !== null &&
    formatLocalDate(selectedDate) === formatLocalDate(nowDate);
  // Self-contained deps (re-derives the date from primitives) so the memo
  // survives selectedDate's per-render object identity.
  const day = useMemo(() => {
    if (selectedDayIndex === null || !hydrated) {
      return { rows: [] as DayRow[], total: 0 };
    }
    const date = addDays(startOfWeek(new Date(now)), selectedDayIndex);
    return dayBreakdown(sessions, optimisticEvents, now, date);
  }, [sessions, optimisticEvents, hydrated, now, selectedDayIndex]);
  const dayLabel =
    selectedDate === null
      ? ""
      : isTodaySelected
        ? "Today"
        : formatLongDate(selectedDate);

  function handleClockIn() {
    const name = taskName.trim();
    const goalMode = pickerMode === "goal";
    const categoryId = goalMode ? null : selectedCategoryId;
    const goalId = goalMode ? selectedGoalId : null;
    if (!name || (categoryId === null && goalId === null)) return;
    const label =
      goalId !== null
        ? `Goal: ${goalById.get(goalId)?.title ?? "goal"}`
        : categoryName(categoryId);
    startTransition(async () => {
      const r = await clockIn({
        categoryId,
        goalId,
        taskName: name,
        description,
      });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setTaskName("");
      setDescription("");
      setSelectedCategoryId(null);
      setSelectedGoalId(null);
      toast.success(`Clocked into ${label}`);
      if (REDESIGN) {
        // The redesign runs the session on the full-screen /clock/live timer.
        // Navigate there and let it prompt for the photo (capture=photo);
        // refreshing here would trip the /clock → /clock/live redirect guard and
        // destroy the photo dialog before it's usable.
        router.push("/clock/live?capture=photo");
        return;
      }
      // Timer is already running; the photo step opens over it and is skippable.
      setPhotoStep({ sessionId: r.sessionId });
    });
  }

  function handleClockOut() {
    if (!activeSession) return;
    const session = activeSession;
    startTransition(async () => {
      const r = await clockOut();
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(`Logged ${formatDuration(sessionWorkedMs(session, Date.now()))}`);
      // No photo step here: a session's one photo is taken while it runs, and
      // this session has just ended.
    });
  }

  function handlePauseResume() {
    if (!activeSession) return;
    const paused = isPaused(activeSession);
    startTransition(async () => {
      const r = paused ? await resumeSession() : await pauseSession();
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
    });
  }

  function handleSaveNotes() {
    if (!activeSession) return;
    const id = activeSession.id;
    const next = notesDraft;
    startTransition(async () => {
      const r = await updateSession(id, { description: next });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success("Notes saved");
    });
  }

  function handleAddCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    const lower = name.toLowerCase();
    if (categories.some((c) => c.name.toLowerCase() === lower)) {
      setNewCategoryName("");
      return;
    }
    startTransition(async () => {
      const r = await createCategory(name);
      if ("error" in r) {
        if (r.code === "duplicate") {
          setNewCategoryName("");
          return;
        }
        toast.error(r.error);
        return;
      }
      setNewCategoryName("");
      toast.success(`Added ${name}`);
    });
  }

  function openCategoryEdit(cat: Category) {
    setEditingCategory(cat);
    setEditName(cat.name);
    setEditColor(cat.color);
  }

  function handleSaveCategory() {
    if (!editingCategory) return;
    const name = editName.trim();
    if (!name) return;
    const id = editingCategory.id;
    const color = editColor;
    startTransition(async () => {
      const r = await updateCategory(id, { name, color });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setEditingCategory(null);
      toast.success(`Saved ${name}`);
    });
  }

  function handleConfirmCategoryDelete() {
    if (!pendingCategoryDelete) return;
    const cat = pendingCategoryDelete;
    startTransition(async () => {
      const r = await deleteCategory(cat.id);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      if (selectedCategoryId === cat.id) setSelectedCategoryId(null);
      toast.success(`Removed ${cat.name}`);
      setPendingCategoryDelete(null);
    });
  }

  const activeSelection =
    pickerMode === "goal" ? selectedGoalId : selectedCategoryId;
  const canClockIn = taskName.trim().length > 0 && activeSelection !== null;

  return (
    <div
      suppressHydrationWarning
      className={cn(
        "flex flex-1 flex-col items-center px-5 pt-8 pb-24 transition-colors sm:pt-12",
        dark && "dark bg-[#22352f] text-[#ece6da]"
      )}
    >
      <main className="flex w-full max-w-md flex-col gap-5">
        <header className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-semibold tracking-tight">Clock</h1>
            <p className="text-muted-foreground text-sm">
              Track deep work in real time.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            aria-pressed={dark}
            onClick={toggleTheme}
            className="mt-1 shrink-0"
          >
            {dark ? <SunIcon /> : <MoonIcon />}
          </Button>
        </header>

        {activeSession ? (
          REDESIGN ? (
            // The active session lives on the full-screen /clock/live stopwatch;
            // here it's a compact strip (tap to reopen) so this page's tools —
            // categories, add-past-session, the week view — stay usable while
            // tracking. No pause/clock-out here; those are on the stopwatch.
            <div className="flex flex-col gap-2">
              <Link
                href="/clock/live"
                aria-label="Open the live timer"
                className="border-hairline bg-brand/10 flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition-transform active:scale-[.99]"
              >
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    isPaused(activeSession)
                      ? "bg-faint"
                      : "bg-brand animate-pulse"
                  )}
                />
                <Ticking>
                  {(tick) => (
                    <span className="font-mono text-lg font-bold tabular-nums">
                      {formatElapsed(
                        tick !== 0 ? sessionWorkedMs(activeSession, tick) : 0
                      )}
                    </span>
                  )}
                </Ticking>
                <span className="text-muted-foreground min-w-0 flex-1 truncate text-sm">
                  {activeSession.taskName}
                </span>
                <ChevronUpIcon className="text-muted-foreground size-4 shrink-0" />
              </Link>
              <Button
                variant="ghost"
                className="h-10 w-full"
                disabled={!hydrated || categories.length === 0}
                onClick={() => setSessionDialog({ mode: "create" })}
              >
                <PlusIcon /> Add past session
              </Button>
            </div>
          ) : (
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
              {/* Second-live numbers render inside the <Ticking> leaf so only
                  this block re-renders every second, not the whole screen. */}
              <Ticking>
                {(tick) => (
                  <div className="flex flex-col gap-1">
                    <div className="font-mono text-5xl tabular-nums tracking-tight">
                      {formatElapsed(
                        tick !== 0 ? sessionWorkedMs(activeSession, tick) : 0
                      )}
                    </div>
                    {/* Worked time is the big number; paused is shown plainly. */}
                    {tick !== 0 &&
                      (() => {
                        const paused = isPaused(activeSession);
                        const pausedTotal = sessionPausedMs(activeSession, tick);
                        if (!paused && pausedTotal <= 0) return null;
                        return (
                          <div className="text-muted-foreground flex items-center gap-2 text-sm">
                            {paused && (
                              <Badge variant="outline" className="gap-1">
                                <PauseIcon className="size-3" /> Paused
                              </Badge>
                            )}
                            {pausedTotal > 0 && (
                              <span>paused {formatDuration(pausedTotal)}</span>
                            )}
                          </div>
                        );
                      })()}
                  </div>
                )}
              </Ticking>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{activeSession.taskName}</span>
                <Badge variant="secondary">
                  {sessionLabel(activeSession)}
                </Badge>
              </div>

              {activePhotoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activePhotoUrl}
                  alt="Photo for this session"
                  loading="lazy"
                  decoding="async"
                  className="size-16 rounded-md object-cover"
                />
              )}

              {/* Inline notes — jot as you work. Reuses the session note. */}
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-sm font-medium"
                  htmlFor="active-notes"
                >
                  Notes
                </label>
                <Textarea
                  id="active-notes"
                  className="min-h-20"
                  placeholder="What's happening this session?"
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                />
                {notesDraft !== (activeSession.description ?? "") && (
                  <Button
                    variant="secondary"
                    className="h-9 self-end"
                    onClick={handleSaveNotes}
                  >
                    Save notes
                  </Button>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="h-11 flex-1 text-base"
                  onClick={handlePauseResume}
                >
                  {isPaused(activeSession) ? (
                    <>
                      <PlayIcon /> Resume
                    </>
                  ) : (
                    <>
                      <PauseIcon /> Pause
                    </>
                  )}
                </Button>
                <Button
                  variant="destructive"
                  className="h-11 flex-1 text-base"
                  onClick={handleClockOut}
                >
                  Clock Out
                </Button>
              </div>
            </CardContent>
          </Card>
          )
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
              {/* Clock into a category OR a goal — pick one. The two buttons
                  switch which list shows; choosing from one clears the other. */}
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={pickerMode === "category" ? "secondary" : "outline"}
                    className="h-9 flex-1"
                    aria-pressed={pickerMode === "category"}
                    onClick={() => setPickerMode("category")}
                  >
                    Category
                    {selectedCategoryId
                      ? `: ${categoryName(selectedCategoryId)}`
                      : ""}
                  </Button>
                  <Button
                    type="button"
                    variant={pickerMode === "goal" ? "secondary" : "outline"}
                    className="h-9 flex-1"
                    aria-pressed={pickerMode === "goal"}
                    onClick={() => setPickerMode("goal")}
                  >
                    Goal
                    {selectedGoalId
                      ? `: ${goalById.get(selectedGoalId)?.title ?? "goal"}`
                      : ""}
                  </Button>
                </div>
                {pickerMode === "category" ? (
                  <CategoryPicker
                    categories={categories}
                    selectedId={selectedCategoryId}
                    onSelect={(id) => {
                      setSelectedCategoryId(id);
                      setSelectedGoalId(null);
                    }}
                  />
                ) : (
                  <GoalPicker
                    goals={goals}
                    selectedId={selectedGoalId}
                    onSelect={(id) => {
                      setSelectedGoalId(id);
                      setSelectedCategoryId(null);
                    }}
                  />
                )}
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
                    className="flex items-center justify-between gap-2 py-2"
                  >
                    <span className="flex min-w-0 items-center gap-2 text-sm">
                      <span
                        aria-hidden
                        className={cn(
                          "size-2.5 shrink-0 rounded-full",
                          !cat.color && "bg-muted ring-border ring-1"
                        )}
                        style={
                          cat.color ? { backgroundColor: cat.color } : undefined
                        }
                      />
                      <span className="truncate">{cat.name}</span>
                    </span>
                    <span className="flex shrink-0 items-center">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Edit ${cat.name}`}
                        onClick={() => openCategoryEdit(cat)}
                      >
                        <PencilIcon />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Delete ${cat.name}`}
                        onClick={() => setPendingCategoryDelete(cat)}
                      >
                        <XIcon />
                      </Button>
                    </span>
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
                      const widthPct =
                        day.total > 0
                          ? `${Math.max(2, (row.ms / day.total) * 100)}%`
                          : "0%";

                      if (row.kind === "session") {
                        const s = row.session;
                        const isActive = s.endedAt === null;
                        return (
                          <button
                            key={`s-${s.id}`}
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
                                {sessionLabel(s)} - {s.taskName}
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
                                style={{ width: widthPct }}
                              />
                            </div>
                          </button>
                        );
                      }

                      const e = row.event;
                      const catName = e.category?.name ?? "Uncategorized";
                      return (
                        <button
                          key={`e-${e.id}`}
                          type="button"
                          onClick={() => setEventDialog(e)}
                          className="-mx-1 flex flex-col gap-1 rounded-md px-1 py-1 text-left transition-colors hover:bg-muted/50"
                        >
                          <div className="flex items-baseline justify-between gap-2 text-sm">
                            <span className="flex min-w-0 items-center gap-1.5 truncate">
                              <CalendarIcon
                                aria-label="From Google Calendar"
                                className="size-3 shrink-0 text-muted-foreground"
                              />
                              <span className="truncate">
                                {catName} - {e.title ?? "(no title)"}
                              </span>
                            </span>
                            <span className="font-mono tabular-nums text-muted-foreground shrink-0">
                              {formatDuration(row.ms)}
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
                            <div
                              className="h-full bg-primary/30"
                              style={{ width: widthPct }}
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
                  <WeekBreakdown rows={categoryBreakdown} />
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

        {/* Session history — opens the full past-session browser. */}
        <Link href="/sessions" className="block">
          <Card className="hover:bg-muted/30 transition-colors">
            <CardContent className="flex items-center justify-between gap-3 px-5 py-4">
              <div className="flex items-center gap-3">
                <HistoryIcon className="text-muted-foreground size-5 shrink-0" />
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium">Session history</p>
                  <p className="text-muted-foreground text-xs">
                    Browse past sessions by day or category.
                  </p>
                </div>
              </div>
              <ChevronRightIcon className="text-muted-foreground size-4 shrink-0" />
            </CardContent>
          </Card>
        </Link>
      </main>

      {/* Category edit — rename + palette color */}
      <Dialog
        open={editingCategory !== null}
        onOpenChange={(open) => {
          if (!open) setEditingCategory(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit category</DialogTitle>
            <DialogDescription>
              Rename it or give it a color — the color shows up across the
              week, history and recap breakdowns.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="category-name">
                Name
              </label>
              <Input
                id="category-name"
                className="h-10"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSaveCategory();
                  }
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">
                Color{" "}
                <span className="text-muted-foreground font-normal">
                  (tap the selected one to clear)
                </span>
              </span>
              <ColorSwatches value={editColor} onChange={setEditColor} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button disabled={!editName.trim()} onClick={handleSaveCategory}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
          goals={goals}
          now={nowDate}
        />
      )}

      <EventCategoryDialog
        event={eventDialog}
        categories={categories}
        onHide={hideOptimistic}
        onOpenChange={(open) => {
          if (!open) setEventDialog(null);
        }}
      />

      <SessionPhotoStep
        open={photoStep !== null}
        onOpenChange={(o) => {
          if (!o) setPhotoStep(null);
        }}
        sessionId={photoStep?.sessionId ?? null}
      />
    </div>
  );
}
