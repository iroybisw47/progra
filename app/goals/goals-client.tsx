"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { EyeIcon, LockIcon, PencilIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GoalProgressBar } from "@/components/goal-progress";
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

import { PrivacyToggle } from "@/components/privacy-toggle";
import { archiveGoal, createGoal, updateGoal } from "@/app/actions/goals";
import { SOCIAL_ENABLED } from "@/lib/flags";
import type { Goal } from "@/lib/db/goals";
import { formatRelativeDay, formatTime } from "@/lib/dates";
import { formatDuration } from "@/lib/duration";
import { useNow } from "@/lib/hooks";
import { BackLink } from "@/components/v2/back-link";

// One of this week's sessions clocked toward a goal (see app/goals/page.tsx).
export type GoalSessionInfo = {
  id: string;
  title: string;
  ms: number;
  startMs: number;
  endMs: number | null;
};

type Props = {
  goals: Goal[];
  actualMsByGoal: Record<string, number>;
  sessionsByGoal: Record<string, GoalSessionInfo[]>;
  backHref?: string;
  backLabel?: string;
};

export function GoalsClient({
  goals,
  actualMsByGoal,
  sessionsByGoal,
  backHref,
  backLabel,
}: Props) {
  const router = useRouter();
  const now = useNow();
  const hydrated = now !== 0;
  const [, startTransition] = useTransition();

  // Optimistic privacy overlay keyed by goal id, so the eye flips instantly
  // before updateGoal + refresh lands. Base is empty; once the transition ends
  // the override clears and the value falls back to the refreshed g.isPrivate.
  const [privateOverrides, setPrivateOverride] = useOptimistic<
    Record<string, boolean>,
    { id: string; value: boolean }
  >({}, (state, { id, value }) => ({ ...state, [id]: value }));
  const isGoalPrivate = (g: Goal) => privateOverrides[g.id] ?? g.isPrivate;

  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGoalDescription, setNewGoalDescription] = useState("");
  const [newGoalQuota, setNewGoalQuota] = useState("");

  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editQuota, setEditQuota] = useState("");
  const [editIsPrivate, setEditIsPrivate] = useState(false);

  const [pendingGoalArchive, setPendingGoalArchive] = useState<Goal | null>(
    null
  );

  function handleAddGoal() {
    const title = newGoalTitle.trim();
    const quota = parseFloat(newGoalQuota);
    if (!title) return;
    if (!Number.isFinite(quota) || quota <= 0) {
      toast.error("Weekly quota must be a positive number");
      return;
    }
    startTransition(async () => {
      const r = await createGoal({
        title,
        description: newGoalDescription,
        weeklyQuotaHours: quota,
      });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setNewGoalTitle("");
      setNewGoalDescription("");
      setNewGoalQuota("");
      toast.success(`Added ${title}`);
      router.refresh();
    });
  }

  function handleStartEdit(goal: Goal) {
    setEditingGoal(goal);
    setEditTitle(goal.title);
    setEditQuota(String(goal.weeklyQuotaHours));
    setEditIsPrivate(goal.isPrivate);
  }

  function handleSaveEdit() {
    if (!editingGoal) return;
    const title = editTitle.trim();
    const quota = parseFloat(editQuota);
    if (!title) {
      toast.error("Title required");
      return;
    }
    if (!Number.isFinite(quota) || quota <= 0) {
      toast.error("Weekly quota must be a positive number");
      return;
    }
    const id = editingGoal.id;
    startTransition(async () => {
      const r = await updateGoal(id, {
        title,
        weeklyQuotaHours: quota,
        isPrivate: editIsPrivate,
      });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setEditingGoal(null);
      toast.success("Saved");
      router.refresh();
    });
  }

  function togglePrivacy(goal: Goal) {
    const next = !isGoalPrivate(goal);
    startTransition(async () => {
      setPrivateOverride({ id: goal.id, value: next });
      const r = await updateGoal(goal.id, { isPrivate: next });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(
        next
          ? `${goal.title} is now private`
          : `${goal.title} is now visible to friends`
      );
      router.refresh();
    });
  }

  function handleArchiveGoal() {
    if (!pendingGoalArchive) return;
    const g = pendingGoalArchive;
    startTransition(async () => {
      const r = await archiveGoal(g.id);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setPendingGoalArchive(null);
      toast.success(`Archived ${g.title}`);
      router.refresh();
    });
  }

  const newQuotaNum = parseFloat(newGoalQuota);
  const canAddGoal =
    newGoalTitle.trim().length > 0 &&
    Number.isFinite(newQuotaNum) &&
    newQuotaNum > 0;

  const editQuotaNum = parseFloat(editQuota);
  const canSaveEdit =
    editTitle.trim().length > 0 &&
    Number.isFinite(editQuotaNum) &&
    editQuotaNum > 0;

  return (
    <div className="flex flex-1 flex-col items-center px-5 pt-8 pb-24 sm:pt-12">
      <main className="flex w-full max-w-md flex-col gap-5">
        <BackLink href={backHref} label={backLabel} />
        <header className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">Goals</h1>
          <p className="text-muted-foreground text-sm">
            Clock into a goal any time — its hours add up here.
          </p>
        </header>

        {goals.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-muted-foreground text-center text-sm">
                No active goals yet. Add one below.
              </p>
            </CardContent>
          </Card>
        ) : (
          goals.map((goal) => {
            const goalSessions = sessionsByGoal[goal.id] ?? [];
            const priv = isGoalPrivate(goal);
            return (
              <Card key={goal.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-1.5">
                    {goal.title}
                    {SOCIAL_ENABLED && goal.isPrivate && (
                      <LockIcon
                        aria-label="Private"
                        className="text-muted-foreground size-3.5 shrink-0"
                      />
                    )}
                  </CardTitle>
                  <CardDescription>
                    {goal.weeklyQuotaHours.toFixed(1)}h / week
                  </CardDescription>
                  <CardAction className="flex gap-1">
                    {SOCIAL_ENABLED && (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={
                          priv
                            ? `${goal.title} is private — tap to make it visible to friends`
                            : `${goal.title} is visible to friends — tap to make it private`
                        }
                        aria-pressed={!priv}
                        onClick={() => togglePrivacy(goal)}
                        className={
                          priv
                            ? "text-muted-foreground opacity-40"
                            : "text-foreground"
                        }
                      >
                        <EyeIcon />
                      </Button>
                    )}
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Edit ${goal.title}`}
                      onClick={() => handleStartEdit(goal)}
                    >
                      <PencilIcon />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Archive ${goal.title}`}
                      onClick={() => setPendingGoalArchive(goal)}
                    >
                      <XIcon />
                    </Button>
                  </CardAction>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {goal.description && (
                    <p className="text-muted-foreground text-sm">
                      {goal.description}
                    </p>
                  )}
                  <GoalProgressBar
                    quotaHours={goal.weeklyQuotaHours}
                    actualMs={actualMsByGoal[goal.id] ?? 0}
                  />

                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground text-[10px] uppercase tracking-[0.2em]">
                      This week
                    </span>
                    {goalSessions.length === 0 ? (
                      <p className="text-muted-foreground py-1 text-sm">
                        No sessions yet. Clock into this goal from the Clock tab.
                      </p>
                    ) : (
                      <ul className="flex flex-col divide-y divide-border">
                        {goalSessions.map((s) => (
                          <li
                            key={s.id}
                            className="flex flex-col gap-0.5 py-2"
                          >
                            <div className="flex items-baseline justify-between gap-2 text-sm">
                              <span className="truncate">{s.title}</span>
                              <span className="text-muted-foreground shrink-0 font-mono tabular-nums">
                                {formatDuration(s.ms)}
                              </span>
                            </div>
                            {hydrated && (
                              <span className="text-muted-foreground text-xs">
                                {formatRelativeDay(
                                  new Date(s.startMs),
                                  new Date(now)
                                )}
                                {" · "}
                                {formatTime(new Date(s.startMs))}
                                {s.endMs !== null
                                  ? `–${formatTime(new Date(s.endMs))}`
                                  : " · in progress"}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}

        <Card>
          <CardHeader>
            <CardTitle>Add goal</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="goal-title">
                Title
              </label>
              <Input
                id="goal-title"
                className="h-10"
                placeholder="Reading, deep work, …"
                value={newGoalTitle}
                onChange={(e) => setNewGoalTitle(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="goal-desc">
                Description{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </label>
              <Input
                id="goal-desc"
                className="h-10"
                placeholder="Notes for later you"
                value={newGoalDescription}
                onChange={(e) => setNewGoalDescription(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="goal-quota">
                Weekly quota (hours)
              </label>
              <Input
                id="goal-quota"
                className="h-10"
                type="number"
                inputMode="decimal"
                step="0.5"
                min="0"
                placeholder="e.g. 5"
                value={newGoalQuota}
                onChange={(e) => setNewGoalQuota(e.target.value)}
              />
            </div>
            <Button
              className="h-10 w-full"
              variant="secondary"
              onClick={handleAddGoal}
              disabled={!canAddGoal}
            >
              Add goal
            </Button>
          </CardContent>
        </Card>
      </main>

      <Dialog
        open={editingGoal !== null}
        onOpenChange={(open) => {
          if (!open) setEditingGoal(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit goal</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="edit-goal-title">
                Title
              </label>
              <Input
                id="edit-goal-title"
                className="h-10"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="edit-goal-quota">
                Weekly quota (hours)
              </label>
              <Input
                id="edit-goal-quota"
                className="h-10"
                type="number"
                inputMode="decimal"
                step="0.5"
                min="0"
                value={editQuota}
                onChange={(e) => setEditQuota(e.target.value)}
              />
            </div>
            {SOCIAL_ENABLED && (
              <PrivacyToggle
                id="edit-goal-private"
                checked={editIsPrivate}
                onCheckedChange={setEditIsPrivate}
              />
            )}
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button onClick={handleSaveEdit} disabled={!canSaveEdit}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingGoalArchive !== null}
        onOpenChange={(open) => {
          if (!open) setPendingGoalArchive(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive goal?</DialogTitle>
            <DialogDescription>
              {pendingGoalArchive
                ? `"${pendingGoalArchive.title}" will be hidden from this list. Past sessions clocked to it stay logged.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button variant="destructive" onClick={handleArchiveGoal}>
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
