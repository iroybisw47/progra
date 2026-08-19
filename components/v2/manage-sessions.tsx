"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarIcon } from "lucide-react";

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
import { BottomSheet, BottomSheetContent } from "@/components/v2/bottom-sheet";
import { PickerPill } from "@/components/category-picker";
import {
  createSession,
  deleteSession,
  updateSession,
} from "@/app/actions/sessions";
import type { SessionToday } from "@/components/v2/progress-client";
import type { Goal } from "@/lib/db/goals";
import type { Category } from "@/lib/storage";
import { entityColor, goalColorOf } from "@/lib/colors";
import { formatTime12 } from "@/lib/dates";
import { formatDuration } from "@/lib/duration";
import { cn } from "@/lib/utils";

// How much the ± buttons move a session's length.
const STEP_MIN = 15;
const MIN_MIN = 5;
const MAX_MIN = 10 * 60; // the session cap — a longer one would be trimmed anyway

type Draft = {
  // null = a new session.
  id: string | null;
  title: string;
  categoryId: string | null;
  goalId: string | null;
  // Local wall-clock start, "HH:MM" (24h) — what <input type="time"> speaks.
  start: string;
  minutes: number;
};

// The sessions manager: a bottom sheet listing today's rows, and a second sheet
// for adding or editing one — name, what it counts towards, start time and
// duration. Mirrors the habits and goals sheets; every mutation goes through
// the existing session actions.
//
// Imported calendar events are listed but not editable here: they belong to
// Google Calendar, and their category is changed from /clock.
export function ManageSessions({
  open,
  onOpenChange,
  sessions,
  categories,
  goals,
  dateLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessions: SessionToday[];
  categories: Category[];
  goals: Goal[];
  dateLabel: string;
}) {
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);

  function openNew() {
    const now = new Date();
    setDraft({
      id: null,
      title: "",
      categoryId: categories[0]?.id ?? null,
      goalId: categories.length === 0 ? (goals[0]?.id ?? null) : null,
      start: toTimeInput(now.getTime() - 60 * 60_000),
      minutes: 60,
    });
  }

  function openEdit(s: SessionToday) {
    setDraft({
      id: s.id,
      title: s.label,
      categoryId: s.categoryId,
      goalId: s.goalId,
      start: toTimeInput(s.startedAt),
      minutes: Math.max(MIN_MIN, Math.round(s.workedMs / 60_000)),
    });
  }

  function save() {
    if (!draft) return;
    const title = draft.title.trim();
    if (!title) {
      toast.error("Name the session first");
      return;
    }
    if (!draft.categoryId && !draft.goalId) {
      toast.error("Pick a category or a goal");
      return;
    }
    const startedAt = fromTimeInput(draft.start);
    if (startedAt === null) {
      toast.error("Enter a valid start time");
      return;
    }
    const endedAt = startedAt + draft.minutes * 60_000;
    if (endedAt > Date.now()) {
      toast.error("That would end in the future");
      return;
    }
    const { id, categoryId, goalId } = draft;
    startTransition(async () => {
      const r = id
        ? await updateSession(id, {
            taskName: title,
            categoryId,
            goalId,
            startedAt,
            endedAt,
          })
        : await createSession({
            taskName: title,
            categoryId,
            goalId,
            startedAt,
            endedAt,
          });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setDraft(null);
      toast.success(id ? "Session updated" : `Logged ${title}`);
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const r = await deleteSession(id);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setDraft(null);
      toast.success("Session deleted");
    });
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent title="Sessions" meta={dateLabel}>
        <div className="flex flex-col pb-1">
          {sessions.length === 0 && (
            <p className="text-caption pb-3 text-[13px]">
              Nothing tracked yet today.
            </p>
          )}
          {sessions.map((s) => {
            const color = s.goalId
              ? goalColorOf({
                  id: s.goalId,
                  color: goals.find((g) => g.id === s.goalId)?.color ?? null,
                })
              : entityColor(s.catColor);
            const isEvent = s.kind === "event";
            return (
              <button
                key={s.id}
                type="button"
                disabled={isEvent || s.active}
                onClick={() => openEdit(s)}
                className="border-divider flex items-center gap-[11px] border-t py-3 text-left disabled:opacity-60"
              >
                <span
                  aria-hidden
                  className="h-7 w-[3px] shrink-0 rounded-[2px]"
                  style={{ backgroundColor: color }}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-body truncate text-sm font-semibold">
                    {s.label}
                  </span>
                  <span className="text-faint truncate text-xs">
                    {isEvent && (
                      <CalendarIcon
                        aria-label="From Google Calendar"
                        className="mr-1 inline size-3 align-[-2px]"
                      />
                    )}
                    {s.isGoal
                      ? (s.goalName ?? "Goal")
                      : (s.catName ?? "Uncategorized")}
                    {" · "}
                    {formatTime12(new Date(s.startedAt))}
                    {s.active && " · running"}
                  </span>
                </div>
                <span className="shrink-0 text-[13px] font-semibold tabular-nums text-secondary-ink">
                  {formatDuration(s.workedMs)}
                </span>
              </button>
            );
          })}

          <PrimaryButton onClick={openNew} className="mt-3">
            + Add a session
          </PrimaryButton>
          <p className="text-disabled pt-2.5 text-[11px]">
            Calendar events and a running session can&rsquo;t be edited here.
          </p>
        </div>
      </BottomSheetContent>

      {/* Add / edit — its own sheet on top. */}
      <BottomSheet
        open={draft !== null}
        onOpenChange={(o) => {
          if (!o) setDraft(null);
        }}
      >
        <BottomSheetContent
          title={draft?.id ? "Edit session" : "Add session"}
          meta={dateLabel}
        >
          <div className="flex flex-col gap-5 pb-1">
            <input
              aria-label="What was it?"
              className="text-ink w-full border-b-2 border-hairline bg-transparent pb-2 text-[19px] font-medium tracking-[-0.01em] outline-none placeholder:text-disabled"
              placeholder="What was it?"
              maxLength={200}
              value={draft?.title ?? ""}
              onChange={(e) =>
                setDraft((d) => (d ? { ...d, title: e.target.value } : d))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  save();
                }
              }}
            />

            <div className="flex flex-col gap-[9px]">
              <span className="section-label">Counts toward</span>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((c) => (
                  <PickerPill
                    key={c.id}
                    label={c.name}
                    color={entityColor(c.color)}
                    selected={draft?.categoryId === c.id}
                    onSelect={() =>
                      setDraft((d) =>
                        d ? { ...d, categoryId: c.id, goalId: null } : d
                      )
                    }
                  />
                ))}
                {goals.map((g) => (
                  <PickerPill
                    key={g.id}
                    label={g.title}
                    color={goalColorOf(g)}
                    selected={draft?.goalId === g.id}
                    onSelect={() =>
                      setDraft((d) =>
                        d ? { ...d, goalId: g.id, categoryId: null } : d
                      )
                    }
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex flex-1 flex-col gap-[7px]">
                <span className="section-label">Start</span>
                <input
                  type="time"
                  aria-label="Start time"
                  className="text-ink w-full border-b-2 border-hairline bg-transparent pb-2 text-base font-semibold tabular-nums outline-none"
                  value={draft?.start ?? ""}
                  onChange={(e) =>
                    setDraft((d) => (d ? { ...d, start: e.target.value } : d))
                  }
                />
              </div>
              <div className="flex flex-1 flex-col gap-[7px]">
                <span className="section-label">Duration</span>
                <div className="flex items-center gap-2">
                  <StepButton
                    label="Shorter"
                    disabled={(draft?.minutes ?? 0) <= MIN_MIN}
                    onClick={() =>
                      setDraft((d) =>
                        d
                          ? {
                              ...d,
                              minutes: Math.max(MIN_MIN, d.minutes - STEP_MIN),
                            }
                          : d
                      )
                    }
                  >
                    −
                  </StepButton>
                  <span className="text-ink flex-1 text-center text-base font-semibold whitespace-nowrap tabular-nums">
                    {formatDuration((draft?.minutes ?? 0) * 60_000)}
                  </span>
                  <StepButton
                    label="Longer"
                    disabled={(draft?.minutes ?? 0) >= MAX_MIN}
                    onClick={() =>
                      setDraft((d) =>
                        d
                          ? {
                              ...d,
                              minutes: Math.min(MAX_MIN, d.minutes + STEP_MIN),
                            }
                          : d
                      )
                    }
                  >
                    +
                  </StepButton>
                </div>
              </div>
            </div>

            <div className="flex gap-2.5">
              {draft?.id && (
                <AlertDialog>
                  <AlertDialogTrigger
                    render={
                      <button
                        type="button"
                        className="text-destructive h-12 shrink-0 rounded-[15px] border-[1.5px] border-[#f0e3e0] px-4 text-sm font-semibold"
                      >
                        Delete
                      </button>
                    }
                  />
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this session?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Its hours come off your week, and it disappears from
                        your feed. This can&rsquo;t be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => remove(draft.id!)}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <PrimaryButton
                onClick={save}
                disabled={pending || !draft?.title.trim()}
                className="flex-1"
              >
                Save session
              </PrimaryButton>
            </div>
          </div>
        </BottomSheetContent>
      </BottomSheet>
    </BottomSheet>
  );
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "border-hairline text-caption flex size-[30px] shrink-0 items-center justify-center rounded-[10px] border-[1.5px] text-[15px] leading-none font-semibold",
        "transition-transform active:scale-90 disabled:opacity-35"
      )}
    >
      {children}
    </button>
  );
}

// epoch ms → "HH:MM" in local time, and back onto today's date.
function toTimeInput(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function fromTimeInput(value: string): number | null {
  const [h, m] = value.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.getTime();
}
