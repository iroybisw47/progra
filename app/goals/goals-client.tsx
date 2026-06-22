"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  PencilIcon,
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

import { archiveGoal, createGoal } from "@/app/actions/goals";
import {
  createSessionPlan,
  deleteSessionPlan,
  reorderSessionPlans,
  updateSessionPlan,
} from "@/app/actions/session-plans";
import type { Goal } from "@/lib/db/goals";
import type { SessionPlan } from "@/lib/db/session-plans";

type Props = {
  goals: Goal[];
  plans: SessionPlan[];
};

export function GoalsClient({ goals, plans }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGoalDescription, setNewGoalDescription] = useState("");
  const [newGoalQuota, setNewGoalQuota] = useState("");

  const [newPlanTitleByGoal, setNewPlanTitleByGoal] = useState<
    Record<string, string>
  >({});
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editPlanTitle, setEditPlanTitle] = useState("");
  const [pendingPlanDelete, setPendingPlanDelete] =
    useState<SessionPlan | null>(null);
  const [pendingGoalArchive, setPendingGoalArchive] = useState<Goal | null>(
    null
  );

  const plansByGoal = new Map<string, SessionPlan[]>();
  for (const p of plans) {
    const list = plansByGoal.get(p.goalId) ?? [];
    list.push(p);
    plansByGoal.set(p.goalId, list);
  }

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

  function handleAddPlan(goalId: string) {
    const title = (newPlanTitleByGoal[goalId] ?? "").trim();
    if (!title) return;
    startTransition(async () => {
      const r = await createSessionPlan({ goalId, title });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setNewPlanTitleByGoal((s) => ({ ...s, [goalId]: "" }));
      router.refresh();
    });
  }

  function handleStartEdit(plan: SessionPlan) {
    setEditingPlanId(plan.id);
    setEditPlanTitle(plan.title);
  }

  function handleSaveEdit() {
    if (!editingPlanId) return;
    const title = editPlanTitle.trim();
    if (!title) return;
    const id = editingPlanId;
    startTransition(async () => {
      const r = await updateSessionPlan(id, { title });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setEditingPlanId(null);
      router.refresh();
    });
  }

  function handleDeletePlan() {
    if (!pendingPlanDelete) return;
    const id = pendingPlanDelete.id;
    startTransition(async () => {
      const r = await deleteSessionPlan(id);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setPendingPlanDelete(null);
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

  function handleMovePlan(
    goalId: string,
    planId: string,
    direction: -1 | 1
  ) {
    const list = plansByGoal.get(goalId) ?? [];
    const idx = list.findIndex((p) => p.id === planId);
    if (idx < 0) return;
    const swapWith = idx + direction;
    if (swapWith < 0 || swapWith >= list.length) return;
    const next = [...list];
    [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
    const orderedIds = next.map((p) => p.id);
    startTransition(async () => {
      const r = await reorderSessionPlans(goalId, orderedIds);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      router.refresh();
    });
  }

  const newQuotaNum = parseFloat(newGoalQuota);
  const canAddGoal =
    newGoalTitle.trim().length > 0 &&
    Number.isFinite(newQuotaNum) &&
    newQuotaNum > 0;

  return (
    <div className="flex flex-1 flex-col items-center px-5 pt-8 pb-24 sm:pt-12">
      <main className="flex w-full max-w-md flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">Goals</h1>
          <p className="text-muted-foreground text-sm">
            Plan your week, one session at a time.
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
            const goalPlans = plansByGoal.get(goal.id) ?? [];
            return (
              <Card key={goal.id}>
                <CardHeader>
                  <CardTitle>{goal.title}</CardTitle>
                  <CardDescription>
                    {goal.weeklyQuotaHours.toFixed(1)}h / week
                  </CardDescription>
                  <CardAction>
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
                  {goalPlans.length === 0 ? (
                    <p className="text-muted-foreground text-sm py-2">
                      No planned sessions yet.
                    </p>
                  ) : (
                    <ol className="flex flex-col divide-y divide-border">
                      {goalPlans.map((plan, idx) => {
                        const isEditing = editingPlanId === plan.id;
                        const isDone = plan.status === "done";
                        return (
                          <li
                            key={plan.id}
                            className="flex min-h-11 items-center gap-1.5 py-1"
                          >
                            <span className="text-muted-foreground w-5 shrink-0 font-mono text-xs">
                              {idx + 1}.
                            </span>
                            {isEditing ? (
                              <>
                                <Input
                                  className="h-9 flex-1"
                                  value={editPlanTitle}
                                  onChange={(e) =>
                                    setEditPlanTitle(e.target.value)
                                  }
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      handleSaveEdit();
                                    } else if (e.key === "Escape") {
                                      setEditingPlanId(null);
                                    }
                                  }}
                                />
                                <Button
                                  size="icon-sm"
                                  variant="ghost"
                                  aria-label="Save"
                                  onClick={handleSaveEdit}
                                >
                                  <CheckIcon />
                                </Button>
                                <Button
                                  size="icon-sm"
                                  variant="ghost"
                                  aria-label="Cancel edit"
                                  onClick={() => setEditingPlanId(null)}
                                >
                                  <XIcon />
                                </Button>
                              </>
                            ) : (
                              <>
                                <span
                                  className={
                                    "flex-1 text-sm " +
                                    (isDone
                                      ? "text-muted-foreground line-through"
                                      : "")
                                  }
                                >
                                  {plan.title}
                                </span>
                                {isDone && (
                                  <Badge
                                    variant="secondary"
                                    className="h-5 text-xs"
                                  >
                                    done
                                  </Badge>
                                )}
                                <Button
                                  size="icon-sm"
                                  variant="ghost"
                                  aria-label="Move up"
                                  disabled={idx === 0}
                                  onClick={() =>
                                    handleMovePlan(goal.id, plan.id, -1)
                                  }
                                >
                                  <ArrowUpIcon />
                                </Button>
                                <Button
                                  size="icon-sm"
                                  variant="ghost"
                                  aria-label="Move down"
                                  disabled={idx === goalPlans.length - 1}
                                  onClick={() =>
                                    handleMovePlan(goal.id, plan.id, 1)
                                  }
                                >
                                  <ArrowDownIcon />
                                </Button>
                                <Button
                                  size="icon-sm"
                                  variant="ghost"
                                  aria-label={`Edit ${plan.title}`}
                                  onClick={() => handleStartEdit(plan)}
                                >
                                  <PencilIcon />
                                </Button>
                                <Button
                                  size="icon-sm"
                                  variant="ghost"
                                  aria-label={`Delete ${plan.title}`}
                                  onClick={() => setPendingPlanDelete(plan)}
                                >
                                  <XIcon />
                                </Button>
                              </>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  )}
                  <div className="flex gap-2">
                    <Input
                      className="h-10"
                      placeholder="New planned session"
                      value={newPlanTitleByGoal[goal.id] ?? ""}
                      onChange={(e) =>
                        setNewPlanTitleByGoal((s) => ({
                          ...s,
                          [goal.id]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddPlan(goal.id);
                        }
                      }}
                    />
                    <Button
                      className="h-10"
                      variant="secondary"
                      onClick={() => handleAddPlan(goal.id)}
                      disabled={
                        !(newPlanTitleByGoal[goal.id] ?? "").trim()
                      }
                    >
                      Add
                    </Button>
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
        open={pendingPlanDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingPlanDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete planned session?</DialogTitle>
            <DialogDescription>
              {pendingPlanDelete
                ? `"${pendingPlanDelete.title}" will be removed. Past clock-ins attached to it stay logged.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button variant="destructive" onClick={handleDeletePlan}>
              Delete
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
                ? `"${pendingGoalArchive.title}" will be hidden from this list. Its planned sessions stay attached to past clock-ins.`
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
