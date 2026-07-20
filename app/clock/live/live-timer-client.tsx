"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  CameraIcon,
  ChevronDownIcon,
  FileTextIcon,
  ImageIcon,
  PencilIcon,
} from "lucide-react";

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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CategoryPicker } from "@/components/category-picker";
import { GoalPicker } from "@/components/goal-picker";
import { SessionPhotoStep } from "@/components/session-photo-step";
import { ToggleSwitch } from "@/components/v2/toggle-switch";
import {
  clockOut,
  editActiveSessionTime,
  pauseSession,
  resumeSession,
  updateSession,
} from "@/app/actions/sessions";
import { sessionWorkedMs } from "@/lib/session";
import { useNow } from "@/lib/hooks";
import { formatTime } from "@/lib/dates";
import type { Attribution } from "@/lib/session-attribution";
import type { Category } from "@/lib/storage";
import type { Goal } from "@/lib/db/goals";
import { cn } from "@/lib/utils";

type Props = {
  sessionId: string;
  label: string;
  description: string | null;
  attribution: Attribution;
  startedAt: number;
  pausedMs: number;
  pausedSince: number | null;
  hasPhoto: boolean;
  // Raw fields + option lists for editing title/category/goal in place.
  taskName: string;
  categoryId: string | null;
  goalId: string | null;
  categories: Category[];
  goals: Goal[];
};

// m:ss under an hour, h:mm:ss past it.
function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function formatHM(ms: number): string {
  const total = Math.round(ms / 60000);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// datetime-local value (local wall time, no zone) for an epoch ms.
function toLocalInput(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function LiveTimerClient({
  sessionId,
  label,
  description,
  attribution,
  startedAt,
  pausedMs,
  pausedSince,
  hasPhoto,
  taskName,
  categoryId,
  goalId,
  categories,
  goals,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  // Photo capture lives here, and only here — a session's one photo is taken
  // while it runs. Clock-in routes here with `?capture=photo`, which auto-opens
  // the step once — seeded in a useState initializer (not an effect) so it fires
  // only on the initial mount, never on a nav-ticker reopen. The mount effect
  // strips the param so a hard refresh won't re-prompt; it only navigates, so
  // it's not a setState-in-effect.
  const capture = searchParams.get("capture");
  const [photoOpen, setPhotoOpen] = useState(
    () => capture === "photo" && !hasPhoto
  );
  useEffect(() => {
    if (capture) router.replace("/clock/live");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live tick. useNow is 0 during SSR; a lazy client Date.now() seeds a correct
  // first paint (no purity-rule violation — it's a useState initializer).
  const [seedNow] = useState(() => Date.now());
  const tick = useNow();
  const now = tick === 0 ? seedNow : tick;

  const timing = { startedAt, endedAt: null, pausedMs, pausedSince };
  const paused = pausedSince != null;
  const worked = sessionWorkedMs(timing, now);
  const pausedTotalMs = pausedMs + (pausedSince != null ? now - pausedSince : 0);

  // Edit sheet — title, category/goal, and time.
  const [editOpen, setEditOpen] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null
  );
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [pickerMode, setPickerMode] = useState<"category" | "goal">("category");
  const [startInput, setStartInput] = useState("");
  const [stillRunning, setStillRunning] = useState(true);
  const [endInput, setEndInput] = useState("");
  const [seedEndInput, setSeedEndInput] = useState("");

  function openEdit() {
    setTitleInput(taskName);
    setSelectedCategoryId(categoryId);
    setSelectedGoalId(goalId);
    setPickerMode(goalId ? "goal" : "category");
    setStartInput(toLocalInput(startedAt));
    setStillRunning(true);
    const endSeed = toLocalInput(Date.now());
    setEndInput(endSeed);
    setSeedEndInput(endSeed);
    setEditOpen(true);
  }

  // Notes sheet — writes the session's description (which also surfaces on the
  // feed post for a public session).
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");

  function openNotes() {
    setNotesDraft(description ?? "");
    setNotesOpen(true);
  }

  function handleSaveNotes() {
    startTransition(async () => {
      const r = await updateSession(sessionId, { description: notesDraft });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setNotesOpen(false);
      toast.success("Notes saved");
      router.refresh();
    });
  }

  function togglePause() {
    startTransition(async () => {
      const r = paused ? await resumeSession() : await pauseSession();
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      router.refresh();
    });
  }

  function handleStop() {
    startTransition(async () => {
      const r = await clockOut();
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      router.push(`/clock/finish?sid=${r.sessionId}`);
    });
  }

  function handleSaveEdit() {
    const trimmedTitle = titleInput.trim();
    if (!trimmedTitle) {
      toast.error("Enter a task name");
      return;
    }
    if (!selectedCategoryId && !selectedGoalId) {
      toast.error("Pick a category or a goal");
      return;
    }
    // datetime-local is minute-resolution, so re-parsing an untouched field
    // would shave the seconds and creep the start earlier on every save — keep
    // the exact original start when the field wasn't changed.
    const startedAtMs =
      startInput === toLocalInput(startedAt)
        ? startedAt
        : new Date(startInput).getTime();
    if (!Number.isFinite(startedAtMs)) {
      toast.error("Enter a valid start time");
      return;
    }
    let endedAtMs: number | null = null;
    if (!stillRunning) {
      // An untouched end means "finish now" — use the live clock so an
      // immediate finish isn't rejected for landing in the start's minute.
      endedAtMs =
        endInput === seedEndInput ? Date.now() : new Date(endInput).getTime();
      if (!Number.isFinite(endedAtMs)) {
        toast.error("Enter a valid end time");
        return;
      }
    }
    startTransition(async () => {
      // Title + category/goal first. This never ends the session, so the time
      // edit below still finds the active row. Exactly one axis is non-null
      // (validated above), satisfying updateSession's resolveAxis.
      const u = await updateSession(sessionId, {
        taskName: trimmedTitle,
        categoryId: selectedCategoryId,
        goalId: selectedGoalId,
      });
      if ("error" in u) {
        toast.error(u.error);
        return;
      }
      // Time (and, if ending, pause settlement + finish routing) stays with the
      // existing action, unchanged.
      const r = await editActiveSessionTime({ startedAtMs, endedAtMs });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setEditOpen(false);
      if (r.ended) {
        router.push(`/clock/finish?sid=${r.sessionId}`);
      } else {
        toast.success("Session updated");
        router.refresh();
      }
    });
  }

  return (
    <div className="bg-card fixed inset-0 z-50 flex flex-col animate-[fade-up_.35s_cubic-bezier(.2,.8,.2,1)_both]">
      {/* Top bar: minimize · status · edit */}
      <div className="flex items-center justify-between px-[18px] pt-[max(env(safe-area-inset-top),24px)] pb-2">
        <button
          type="button"
          aria-label="Minimize"
          onClick={() => router.push("/")}
          className="bg-track text-caption flex size-9 items-center justify-center rounded-full active:scale-90"
        >
          <ChevronDownIcon className="size-4" strokeWidth={2.2} />
        </button>
        <div className="text-caption flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[.08em]">
          <span
            className={cn(
              "size-2 rounded-full",
              paused ? "bg-faint" : "bg-brand animate-pulse"
            )}
          />
          {paused ? "Paused" : "Tracking"}
        </div>
        <button
          type="button"
          aria-label="Edit time"
          onClick={openEdit}
          className="text-caption hover:text-ink flex size-9 items-center justify-center rounded-full"
        >
          <PencilIcon className="size-4" />
        </button>
      </div>

      {/* Center: task + timer */}
      <div className="flex flex-1 flex-col items-center justify-center gap-[18px] px-7">
        <div className="flex flex-col items-center gap-2.5 text-center">
          <div className="text-[17px] font-bold tracking-[-0.01em]">{label}</div>
          <span
            className={cn(
              "rounded-full px-3 py-[5px] text-[11.5px] font-bold",
              attribution.isGoal
                ? "bg-brand/10 text-brand"
                : "bg-track text-body"
            )}
          >
            {attribution.isGoal ? `Goal · ${attribution.text}` : attribution.text}
          </span>
          {description && (
            <p className="text-faint max-w-[280px] text-xs leading-relaxed">
              {description}
            </p>
          )}
        </div>

        <div className="relative flex items-center justify-center py-2.5">
          {/* Breathing glow — faithful to the design; freezes/hides when paused. */}
          <span
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 size-[250px] rounded-full transition-opacity duration-500"
            style={{
              background:
                "radial-gradient(circle, var(--sand) 0%, transparent 68%)",
              transform: "translate(-50%, -50%)",
              opacity: paused ? 0 : 1,
              animation: paused ? undefined : "breathe 2.6s ease infinite",
            }}
          />
          <span
            className={cn(
              "relative font-mono text-[62px] font-bold tabular-nums tracking-[-0.03em] transition-colors",
              paused ? "text-faint" : "text-ink"
            )}
          >
            {formatElapsed(worked)}
          </span>
        </div>

        <div className="text-faint text-xs">
          Started {formatTime(new Date(startedAt))}
          {pausedTotalMs > 0 && ` · paused ${formatHM(pausedTotalMs)}`}
        </div>

        <div className="flex flex-col items-center gap-2.5">
          {/* Notes sit above the photo affordance. */}
          <button
            type="button"
            onClick={openNotes}
            className="border-hairline text-caption hover:text-ink flex items-center gap-2 rounded-full border px-3 py-[7px] text-xs font-medium active:scale-95"
          >
            <FileTextIcon className="size-3.5" />
            {description ? "Edit notes" : "Add notes"}
          </button>

          {hasPhoto ? (
            <div className="border-hairline text-caption flex items-center gap-2 rounded-full border px-3 py-[7px] text-xs font-medium">
              <ImageIcon className="size-3.5" />
              Photo attached
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setPhotoOpen(true)}
              className="border-hairline text-caption hover:text-ink flex items-center gap-2 rounded-full border px-3 py-[7px] text-xs font-medium active:scale-95"
            >
              <CameraIcon className="size-3.5" />
              Add photo
            </button>
          )}
        </div>
      </div>

      {/* Bottom: pause/resume + stop */}
      <div className="flex gap-3 px-6 pb-[max(env(safe-area-inset-bottom),48px)] pt-2">
        <button
          type="button"
          onClick={togglePause}
          disabled={pending}
          className="bg-brand/10 text-brand flex-1 rounded-[18px] py-4 text-[15px] font-bold active:scale-[.97] disabled:opacity-60"
        >
          {paused ? "Resume" : "Pause"}
        </button>
        <button
          type="button"
          onClick={handleStop}
          disabled={pending}
          className="flex flex-[1.4] items-center justify-center gap-2.5 rounded-[18px] bg-ink py-4 text-[15px] font-bold text-[color:var(--card)] shadow-[0_10px_22px_rgba(25,30,38,.25)] active:scale-[.97] disabled:opacity-60"
        >
          <span className="size-2.5 rounded-[3px] bg-[color:var(--card)]" />
          Stop
        </button>
      </div>

      {/* Edit-time sheet */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit session</DialogTitle>
            <DialogDescription>
              Change what you&rsquo;re working on, or correct the time — and, if
              it&rsquo;s already over, when it ended.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-title">Task</Label>
              <Input
                id="edit-title"
                className="h-11"
                placeholder="What are you working on?"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
              />
            </div>

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
                </Button>
                <Button
                  type="button"
                  variant={pickerMode === "goal" ? "secondary" : "outline"}
                  className="h-9 flex-1"
                  aria-pressed={pickerMode === "goal"}
                  onClick={() => setPickerMode("goal")}
                >
                  Goal
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
                  emptyHint="Add a category on the clock screen first."
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

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-start">Started at</Label>
              <Input
                id="edit-start"
                type="datetime-local"
                className="h-11"
                value={startInput}
                onChange={(e) => setStartInput(e.target.value)}
              />
            </div>

            <div className="border-hairline flex items-center justify-between rounded-xl border px-3.5 py-3">
              <div className="flex flex-col">
                <span className="text-sm font-medium">Still running</span>
                <span className="text-caption text-xs">
                  Turn off to set an end time and finish.
                </span>
              </div>
              <ToggleSwitch
                ariaLabel="Still running"
                checked={stillRunning}
                onCheckedChange={setStillRunning}
              />
            </div>

            {!stillRunning && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-end">Ended at</Label>
                <Input
                  id="edit-end"
                  type="datetime-local"
                  className="h-11"
                  value={endInput}
                  onChange={(e) => setEndInput(e.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button onClick={handleSaveEdit} disabled={pending}>
              {stillRunning ? "Save" : "Finish session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notes sheet — saved as the session's description. */}
      <Dialog open={notesOpen} onOpenChange={setNotesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Session notes</DialogTitle>
            <DialogDescription>
              Jot down what happened this session. Saved with the session — and
              shown on your post if it&rsquo;s public.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            autoFocus
            rows={5}
            placeholder="What's happening this session?"
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
          />
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button onClick={handleSaveNotes} disabled={pending}>
              Save notes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Photo capture — only possible while the session is active. */}
      <SessionPhotoStep
        open={photoOpen}
        onOpenChange={setPhotoOpen}
        sessionId={sessionId}
        onComplete={() => router.refresh()}
      />
    </div>
  );
}
