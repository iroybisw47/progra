"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { useOptimistic } from "react";
import {
  CalendarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  XIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
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
import { entityColor, goalColorOf } from "@/lib/colors";
import {
  isPaused,
  sessionAttributionEnd,
  sessionPausedMs,
  sessionWorkedMs,
} from "@/lib/session";
import { useNowMinute } from "@/lib/hooks";
import { REDESIGN, TIMED_SESSIONS } from "@/lib/flags";
import { primeTimerSound } from "@/lib/timer-sound";
import {
  BREAK_PRESETS,
  SessionPlanPicker,
  type BreakPreset,
} from "@/components/v2/session-plan-picker";
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
    const end = sessionAttributionEnd(s, now);
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
  // ?goal=<id> from a Progress "Goals today" tap — pre-selects the goal picker.
  initialGoalId?: string | null;
};

export function ClockClient({
  categories,
  sessions,
  events,
  goals,
  activePhotoUrl,
  initialGoalId = null,
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
  // The clock-in form is one compact block: the note field and the two picker
  // panels stay folded away until asked for, so the default state is a name, a
  // target and a button.
  const [noteOpen, setNoteOpen] = useState(false);
  const [pickPanelOpen, setPickPanelOpen] = useState(false);
  const [modePanelOpen, setModePanelOpen] = useState(false);
  // Timed sessions (behind TIMED_SESSIONS). "open" is the default, so with the
  // flag off — and for every user who never touches the control — this is the
  // open-ended clock-in the app has always had, writing no plan columns.
  const [timerMode, setTimerMode] = useState<"open" | "timed">("open");
  const [plannedMinutes, setPlannedMinutes] = useState<number | null>(null);
  const [breakPreset, setBreakPreset] = useState<BreakPreset>("none");
  // A clock-in targets EITHER a category OR a goal. `pickerMode` is which list
  // is currently revealed; selecting from one clears the other. When ?goal=<id>
  // points at a real active goal, seed the goal picker with it (guarded so a
  // stale/archived id doesn't leave a phantom selection).
  const preselectGoal =
    initialGoalId !== null && goals.some((g) => g.id === initialGoalId)
      ? initialGoalId
      : null;
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(
    preselectGoal
  );
  const [pickerMode, setPickerMode] = useState<"category" | "goal">(
    preselectGoal ? "goal" : "category"
  );
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
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

  // The day strip always has a day selected — today until another is tapped,
  // which is what the sessions list under it reads from.
  const effectiveDayIndex =
    selectedDayIndex ?? (hydrated && todayIndex >= 0 ? todayIndex : null);
  const inDayMode =
    effectiveDayIndex !== null && hydrated && weekStartDate !== null;
  const selectedDate = inDayMode
    ? addDays(weekStartDate, effectiveDayIndex)
    : null;
  const isTodaySelected =
    selectedDate !== null &&
    formatLocalDate(selectedDate) === formatLocalDate(nowDate);
  // Self-contained deps (re-derives the date from primitives) so the memo
  // survives selectedDate's per-render object identity.
  const day = useMemo(() => {
    if (!hydrated) {
      return { rows: [] as DayRow[], total: 0 };
    }
    // Same fallback as effectiveDayIndex, re-derived from primitives so the
    // memo doesn't depend on a value computed above it.
    const idx = selectedDayIndex ?? dayIndexMonFirst(new Date(now));
    const date = addDays(startOfWeek(new Date(now)), idx);
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
    // Unlock audio here, while a real user gesture is still in scope: a break
    // chime fires from a setTimeout much later, which has no gesture behind it
    // and would be blocked. Harmless for open-ended sessions.
    primeTimerSound();
    startTransition(async () => {
      const r = await clockIn({
        categoryId,
        goalId,
        taskName: name,
        description,
        // Omitted entirely in open mode, so that path writes the same row it
        // always has. Break columns ride along only when a preset is chosen.
        ...(timerMode === "timed" && plannedMinutes !== null
          ? {
              plan: {
                plannedWorkMs: plannedMinutes * 60_000,
                workIntervalMs: BREAK_PRESETS[breakPreset].workIntervalMs,
                breakMs: BREAK_PRESETS[breakPreset].breakMs,
              },
            }
          : {}),
      });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setTaskName("");
      setDescription("");
      setSelectedCategoryId(null);
      setSelectedGoalId(null);
      setTimerMode("open");
      setPlannedMinutes(null);
      setBreakPreset("none");
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
  // In timed mode a duration is required — there's no sensible default target,
  // and silently picking one would start a session nobody asked for.
  const timedPlanReady = timerMode === "open" || plannedMinutes !== null;
  const canClockIn =
    taskName.trim().length > 0 && activeSelection !== null && timedPlanReady;

  // The two summary chips above the CTA: what this session counts towards, and
  // whether it runs to a target.
  const pickedLabel =
    pickerMode === "goal"
      ? selectedGoalId
        ? goalById.get(selectedGoalId)?.title ?? "Goal"
        : "Goal"
      : selectedCategoryId
        ? categoryName(selectedCategoryId)
        : "Category";
  const pickedColor =
    pickerMode === "goal"
      ? selectedGoalId
        ? goalColorOf({
            id: selectedGoalId,
            color: goalById.get(selectedGoalId)?.color ?? null,
          })
        : "var(--disabled)"
      : selectedCategoryId
        ? entityColor(categoryById.get(selectedCategoryId)?.color ?? null)
        : "var(--disabled)";
  const modeSummary =
    timerMode === "timed" && plannedMinutes !== null
      ? formatDuration(plannedMinutes * 60_000)
      : "Until I stop";

  return (
    <div className="flex flex-1 flex-col items-center px-5 pt-7 pb-28">
      <main className="flex w-full max-w-md flex-col">
        <header className="flex items-center gap-3">
          <span className="section-label">
            {activeSession ? "Tracking" : "Clock in"}
          </span>
        </header>

        {activeSession ? (
          REDESIGN ? (
            // The active session lives on the full-screen /clock/live stopwatch;
            // here it's a compact strip (tap to reopen) so this page's tools —
            // categories, add-past-session, the week view — stay usable while
            // tracking. No pause/clock-out here; those are on the stopwatch.
            <div className="flex flex-col gap-3 pt-5">
              <Link
                href="/clock/live"
                aria-label="Open the live timer"
                className="flex flex-col gap-3 transition-transform active:scale-[.99]"
              >
                <Ticking>
                  {(tick) => (
                    <span className="stat-num text-[52px] leading-[0.9]">
                      {formatElapsed(
                        tick !== 0 ? sessionWorkedMs(activeSession, tick) : 0
                      )}
                    </span>
                  )}
                </Ticking>
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={cn(
                      "size-[9px] shrink-0 rounded-[2px]",
                      !isPaused(activeSession) &&
                        "animate-[pulse-dot_1.6s_infinite]"
                    )}
                    style={{
                      backgroundColor: isPaused(activeSession)
                        ? "var(--disabled)"
                        : activeSession.goalId
                          ? goalColorOf({
                              id: activeSession.goalId,
                              color:
                                goalById.get(activeSession.goalId)?.color ??
                                null,
                            })
                          : entityColor(
                              categoryById.get(activeSession.categoryId ?? "")
                                ?.color ?? null
                            ),
                    }}
                  />
                  <span className="text-body text-sm font-semibold">
                    {activeSession.taskName}
                  </span>
                  <span className="text-faint truncate text-[13px]">
                    {sessionLabel(activeSession)}
                  </span>
                  <ChevronUpIcon className="text-disabled ml-auto size-4 shrink-0" />
                </span>
              </Link>
              <button
                type="button"
                disabled={!hydrated || categories.length === 0}
                onClick={() => setSessionDialog({ mode: "create" })}
                className="text-caption self-center pt-1 text-xs font-medium disabled:opacity-40"
              >
                + Add past session
              </button>
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
          <div className="flex flex-col gap-2.5 pt-3">
            {/* Name, with the optional note folded in behind "+ note". */}
            <div className="border-control-border bg-card rounded-[13px] border-[1.5px]">
              <div className="flex items-center">
                <input
                  id="task-name"
                  aria-label="What are you working on?"
                  className="text-ink h-[50px] min-w-0 flex-1 bg-transparent pl-3.5 text-base font-medium outline-none placeholder:text-disabled"
                  placeholder="What are you working on?"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                />
                {!noteOpen && (
                  <button
                    type="button"
                    onClick={() => setNoteOpen(true)}
                    className="text-disabled hover:text-brand shrink-0 px-3.5 text-xs font-medium whitespace-nowrap"
                  >
                    + note
                  </button>
                )}
              </div>
              {noteOpen && (
                <div>
                  <div className="bg-hairline mx-3.5 h-px" />
                  <input
                    id="task-desc"
                    aria-label="Description (optional)"
                    className="text-ink h-9 w-full bg-transparent px-3.5 text-[13px] outline-none placeholder:text-disabled"
                    placeholder="Description (optional)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* What it counts towards · how long it runs. Both fold open. */}
            <div className="flex gap-2">
              <button
                type="button"
                aria-expanded={pickPanelOpen}
                onClick={() => {
                  setPickPanelOpen((o) => !o);
                  setModePanelOpen(false);
                }}
                className={cn(
                  "bg-card text-body flex h-[38px] min-w-0 flex-1 items-center justify-center gap-[7px] rounded-xl border-[1.5px] px-2.5 text-[12.5px] font-semibold transition-colors",
                  pickPanelOpen ? "border-brand" : "border-control-border"
                )}
              >
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: pickedColor }}
                />
                <span className="truncate">{pickedLabel}</span>
                <ChevronDownIcon
                  className={cn(
                    "text-disabled size-3 shrink-0 transition-transform",
                    pickPanelOpen && "rotate-180"
                  )}
                  strokeWidth={2.4}
                />
              </button>
              {TIMED_SESSIONS && (
                <button
                  type="button"
                  aria-expanded={modePanelOpen}
                  onClick={() => {
                    setModePanelOpen((o) => !o);
                    setPickPanelOpen(false);
                  }}
                  className={cn(
                    "bg-card text-body flex h-[38px] min-w-0 flex-1 items-center justify-center gap-[7px] rounded-xl border-[1.5px] px-2.5 text-[12.5px] font-semibold transition-colors",
                    modePanelOpen ? "border-brand" : "border-control-border"
                  )}
                >
                  <ClockIcon className="text-caption size-[13px] shrink-0" />
                  <span className="truncate">{modeSummary}</span>
                  <ChevronDownIcon
                    className={cn(
                      "text-disabled size-3 shrink-0 transition-transform",
                      modePanelOpen && "rotate-180"
                    )}
                    strokeWidth={2.4}
                  />
                </button>
              )}
            </div>

            {/* Clock into a category OR a goal — pick one. The two tabs switch
                which list shows; choosing from one clears the other. */}
            {pickPanelOpen && (
              <div className="border-control-border flex flex-col gap-3 rounded-[13px] border-[1.5px] p-3">
                <div className="flex items-center gap-2">
                  {(
                    [
                      ["category", "Category"],
                      ["goal", "Goal"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={pickerMode === key}
                      onClick={() => setPickerMode(key)}
                      className={cn(
                        "h-8 flex-1 rounded-[10px] border-[1.5px] text-xs font-semibold transition-colors",
                        pickerMode === key
                          ? "border-brand bg-brand text-primary-foreground"
                          : "border-control-border text-caption bg-card"
                      )}
                    >
                      {label}
                    </button>
                  ))}
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
            )}

            {TIMED_SESSIONS && modePanelOpen && (
              <div className="border-control-border rounded-[13px] border-[1.5px] p-3">
                <SessionPlanPicker
                  mode={timerMode}
                  onModeChange={setTimerMode}
                  plannedMinutes={plannedMinutes}
                  onPlannedMinutesChange={setPlannedMinutes}
                  breakPreset={breakPreset}
                  onBreakPresetChange={setBreakPreset}
                />
              </div>
            )}

            <button
              type="button"
              disabled={!canClockIn}
              onClick={handleClockIn}
              className="bg-brand text-primary-foreground mt-1 h-[52px] w-full rounded-[15px] text-base font-semibold shadow-[0_10px_22px_-10px_rgba(28,58,94,.55)] transition-transform active:scale-[.98] disabled:opacity-40 disabled:shadow-none"
            >
              {/* The label is the real affordance for "which of the two am I
                  starting?" — whatever else gets skimmed, this doesn't. */}
              {TIMED_SESSIONS && timerMode === "timed" && plannedMinutes !== null
                ? `Clock in for ${formatDuration(plannedMinutes * 60_000)}`
                : "Clock in"}
            </button>
            <button
              type="button"
              disabled={!hydrated || categories.length === 0}
              onClick={() => setSessionDialog({ mode: "create" })}
              className="text-caption hover:text-brand self-center pt-1.5 text-xs font-medium disabled:opacity-40"
            >
              + Add past session
            </button>
          </div>
        )}

        {/* The quiet zone: everything that isn't starting a session sits on the
            inset panel below the fold — this week, the day's sessions, and the
            category list. */}
        <div className="bg-inset border-hairline -mx-5 mt-6 border-t px-5 pb-3">
          <div className="flex items-center gap-[7px] pt-5 pb-2.5">
            <span className="section-label">This week</span>
            <span className="flex-1" />
            <span className="text-caption text-[10px] font-semibold tracking-[0.06em]">
              {weekStartDate && weekEndDate
                ? formatRange(weekStartDate, weekEndDate)
                : " "}
            </span>
          </div>
          <div className="stat-num pb-3 text-2xl leading-[0.9] text-secondary-ink">
            {formatHours(weekly.total)}
          </div>
          {categoryBreakdown.length === 0 ? (
            <p className="text-caption pb-2 text-[13px]">
              No sessions logged yet this week.
            </p>
          ) : (
            <>
              <div className="bg-track mb-2.5 flex h-[9px] w-full gap-[3px] overflow-hidden rounded-full">
                {categoryBreakdown.map((row) => (
                  <span
                    key={row.id ?? "uncategorized"}
                    className="h-full"
                    style={{
                      width:
                        weekly.total > 0
                          ? `${(row.ms / weekly.total) * 100}%`
                          : "0%",
                      backgroundColor: row.color ?? "var(--faint)",
                    }}
                  />
                ))}
              </div>
              <div className="flex flex-col">
                {categoryBreakdown.slice(0, 4).map((row) => (
                  <div
                    key={row.id ?? "uncategorized"}
                    className="flex items-center gap-2.5 py-0.5"
                  >
                    <span
                      aria-hidden
                      className="size-[9px] shrink-0 rounded-[2px]"
                      style={{ backgroundColor: row.color ?? "var(--faint)" }}
                    />
                    <span className="text-secondary-ink min-w-0 flex-1 truncate text-[12.5px] leading-[1.55]">
                      {row.isGoal ? row.name.replace(/^Goal: /, "") : row.name}
                    </span>
                    <span className="text-secondary-ink shrink-0 text-[12.5px] font-semibold tabular-nums">
                      {formatHours(row.ms)}
                    </span>
                    <span className="text-caption w-9 shrink-0 text-right text-xs tabular-nums">
                      {weekly.total > 0
                        ? `${Math.round((row.ms / weekly.total) * 100)}%`
                        : "0%"}
                    </span>
                  </div>
                ))}
                {categoryBreakdown.length > 4 && (
                  <div className="text-disabled pt-1.5 text-[11px]">
                    +{categoryBreakdown.length - 4} more this week
                  </div>
                )}
              </div>
            </>
          )}

          <div className="bg-hairline mt-3.5 h-px" />
          <div className="flex items-center gap-[7px] pt-3.5 pb-2">
            <span className="section-label">Sessions</span>
            <span className="flex-1" />
            <Link
              href="/sessions"
              className="text-caption text-[10px] font-semibold tracking-[0.06em]"
            >
              {dayLabel || "All"}
            </Link>
          </div>

          {/* Day strip — tap a day to list what was logged on it. */}
          <div className="flex gap-1 pb-1">
            {DAY_LABELS.map((label, i) => {
              const ms = weekly.perDay[i];
              const isToday = i === todayIndex;
              const isSelected = effectiveDayIndex === i;
              return (
                <button
                  key={label}
                  type="button"
                  disabled={!hydrated}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedDayIndex(i)}
                  className={cn(
                    "flex flex-1 flex-col items-center rounded-[10px] border-[1.5px] pt-1 pb-[3px] transition-[background-color,border-color,transform] active:scale-90 disabled:pointer-events-none disabled:opacity-50",
                    isSelected
                      ? "border-brand bg-brand"
                      : isToday
                        ? "border-[#b7c4d3] bg-inset-2"
                        : "border-control-border bg-inset-2"
                  )}
                >
                  <span
                    className={cn(
                      "text-[9px] font-semibold",
                      isSelected
                        ? "text-white/70"
                        : isToday
                          ? "text-brand"
                          : "text-faint"
                    )}
                  >
                    {label}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-semibold tabular-nums",
                      isSelected
                        ? "text-white"
                        : ms > 0
                          ? "text-ink"
                          : "text-disabled"
                    )}
                  >
                    {ms > 0 ? formatHours(ms) : "—"}
                  </span>
                </button>
              );
            })}
          </div>

          {day.rows.length === 0 ? (
            <div className="border-hairline text-disabled border-t pt-2.5 text-xs">
              No sessions logged.
            </div>
          ) : (
            day.rows.map((row) => {
              if (row.kind === "session") {
                const s = row.session;
                const isActive = s.endedAt === null;
                return (
                  <button
                    key={`s-${s.id}`}
                    type="button"
                    onClick={() =>
                      setSessionDialog({
                        mode: isActive ? "edit-active" : "edit-completed",
                        session: s,
                      })
                    }
                    className="border-hairline flex w-full items-center gap-2.5 border-t py-[7px] text-left transition-transform active:scale-[.99]"
                  >
                    <span
                      aria-hidden
                      className="h-5 w-[3px] shrink-0 rounded-[2px]"
                      style={{
                        backgroundColor: s.goalId
                          ? goalColorOf({
                              id: s.goalId,
                              color: goalById.get(s.goalId)?.color ?? null,
                            })
                          : entityColor(
                              categoryById.get(s.categoryId ?? "")?.color ?? null
                            ),
                      }}
                    />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[13px] leading-[1.25] font-semibold text-secondary-ink">
                        {s.taskName}
                      </span>
                      <span className="text-faint truncate text-[11px] leading-[1.3]">
                        {sessionLabel(s)}
                        {isActive && " · in progress"}
                      </span>
                    </div>
                    <span className="shrink-0 text-[13px] font-semibold tabular-nums text-secondary-ink">
                      {formatDuration(row.ms)}
                    </span>
                    <PencilIcon className="text-disabled size-3 shrink-0" />
                  </button>
                );
              }

              const e = row.event;
              return (
                <button
                  key={`e-${e.id}`}
                  type="button"
                  onClick={() => setEventDialog(e)}
                  className="border-hairline flex w-full items-center gap-2.5 border-t py-[7px] text-left transition-transform active:scale-[.99]"
                >
                  <span
                    aria-hidden
                    className="h-5 w-[3px] shrink-0 rounded-[2px]"
                    style={{
                      backgroundColor: entityColor(e.category?.color ?? null),
                    }}
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[13px] leading-[1.25] font-semibold text-secondary-ink">
                      {e.title ?? "(no title)"}
                    </span>
                    <span className="text-faint truncate text-[11px] leading-[1.3]">
                      <CalendarIcon
                        aria-label="From Google Calendar"
                        className="mr-1 inline size-3 align-[-2px]"
                      />
                      {e.category?.name ?? "Uncategorized"}
                    </span>
                  </div>
                  <span className="shrink-0 text-[13px] font-semibold tabular-nums text-secondary-ink">
                    {formatDuration(row.ms)}
                  </span>
                  <PencilIcon className="text-disabled size-3 shrink-0" />
                </button>
              );
            })
          )}
          <button
            type="button"
            disabled={!hydrated || categories.length === 0}
            onClick={() => setSessionDialog({ mode: "create" })}
            className="border-hairline flex w-full items-center gap-2.5 border-t pt-2 text-left disabled:opacity-40"
          >
            <span
              aria-hidden
              className="h-4 w-[3px] shrink-0 border-l-[1.5px] border-dashed border-[#d5d9df]"
            />
            <span className="text-caption text-xs font-medium">
              + Add a session to {dayLabel.toLowerCase() || "this day"}
            </span>
          </button>

          <div className="bg-hairline mt-3.5 h-px" />
          <div className="flex items-center gap-[7px] pt-3.5 pb-2">
            <span className="section-label">Categories</span>
            <span className="flex-1" />
            <button
              type="button"
              onClick={() => setAddCategoryOpen((o) => !o)}
              className="text-brand text-xs font-semibold"
            >
              {addCategoryOpen ? "Close" : "+ Add"}
            </button>
          </div>
          {addCategoryOpen && (
            <div className="flex gap-2 pt-0.5 pb-2.5">
              <input
                aria-label="New category"
                className="text-ink min-w-0 flex-1 border-b-2 border-hairline bg-transparent pb-2 text-sm font-medium outline-none placeholder:text-disabled"
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
              <button
                type="button"
                onClick={handleAddCategory}
                disabled={!newCategoryName.trim()}
                className="bg-brand text-primary-foreground h-8 shrink-0 rounded-[10px] px-3.5 text-xs font-semibold disabled:opacity-40"
              >
                Add
              </button>
            </div>
          )}
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="border-hairline flex items-center gap-2.5 border-t py-2"
            >
              <span
                aria-hidden
                className="size-[9px] shrink-0 rounded-[2px]"
                style={{ backgroundColor: entityColor(cat.color) }}
              />
              <button
                type="button"
                aria-label={`Edit ${cat.name}`}
                onClick={() => openCategoryEdit(cat)}
                className="min-w-0 flex-1 truncate text-left text-[13px] text-secondary-ink"
              >
                {cat.name}
              </button>
              <button
                type="button"
                aria-label={`Edit ${cat.name}`}
                onClick={() => openCategoryEdit(cat)}
                className="text-disabled shrink-0"
              >
                <PencilIcon className="size-3" />
              </button>
              <button
                type="button"
                aria-label={`Delete ${cat.name}`}
                onClick={() => setPendingCategoryDelete(cat)}
                className="text-disabled shrink-0"
              >
                <XIcon className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
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
