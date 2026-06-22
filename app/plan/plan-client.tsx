"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { PlusIcon, RefreshCwIcon } from "lucide-react";

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

import {
  createBlock,
  deleteBlock,
  regenerateWeek,
  updateBlock,
} from "@/app/actions/scheduled-blocks";
import type { BusyInterval } from "@/lib/db/calendar-events";
import type { Goal } from "@/lib/db/goals";
import type { ScheduledBlock } from "@/lib/db/scheduled-blocks";
import type { SessionPlan } from "@/lib/db/session-plans";
import { DAY_LABELS, formatRange } from "@/lib/dates";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WAKING_START = 8;
const WAKING_END = 23;
const PX_PER_HOUR = 36;
const GOAL_PALETTE = [
  "#3b82f6",
  "#22c55e",
  "#ec4899",
  "#f97316",
  "#8b5cf6",
  "#06b6d4",
  "#eab308",
  "#ef4444",
];

function colorForGoalIdx(idx: number): string {
  return GOAL_PALETTE[idx % GOAL_PALETTE.length];
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toDateTimeLocal(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function fromDateTimeLocal(s: string): number {
  // "YYYY-MM-DDTHH:mm"
  const [date, time] = s.split("T");
  if (!date || !time) return NaN;
  const [y, m, d] = date.split("-").map(Number);
  const [h, mn] = time.split(":").map(Number);
  return new Date(y, m - 1, d, h, mn, 0, 0).getTime();
}

function formatHm(ms: number): string {
  const d = new Date(ms);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function overlapsBusy(
  startMs: number,
  endMs: number,
  busy: BusyInterval[]
): boolean {
  return busy.some((b) => b.endMs > startMs && b.startMs < endMs);
}

type EditingState =
  | { mode: "create" }
  | { mode: "edit"; block: ScheduledBlock }
  | null;

type Props = {
  weekStartMs: number;
  weekEndMs: number;
  goals: Goal[];
  plans: SessionPlan[];
  blocks: ScheduledBlock[];
  busy: BusyInterval[];
};

export function PlanClient({
  weekStartMs,
  weekEndMs,
  goals,
  plans,
  blocks,
  busy,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [editing, setEditing] = useState<EditingState>(null);
  const [pendingDelete, setPendingDelete] = useState<ScheduledBlock | null>(
    null
  );
  const [pendingOverlapSave, setPendingOverlapSave] = useState<
    null | (() => void)
  >(null);

  // Edit-dialog form state.
  const [formGoalId, setFormGoalId] = useState<string>("");
  const [formPlanId, setFormPlanId] = useState<string>(""); // "" = no plan
  const [formStart, setFormStart] = useState<string>("");
  const [formEnd, setFormEnd] = useState<string>("");
  const [formIsFlex, setFormIsFlex] = useState<boolean>(false);

  const goalIndexById = new Map(goals.map((g, i) => [g.id, i] as const));
  const goalById = new Map(goals.map((g) => [g.id, g] as const));
  const planById = new Map(plans.map((p) => [p.id, p] as const));

  function openCreate(defaultStartMs: number) {
    if (goals.length === 0) {
      toast.error("Add a goal first");
      return;
    }
    const startMs = defaultStartMs;
    const endMs = defaultStartMs + 2 * HOUR_MS;
    setEditing({ mode: "create" });
    setFormGoalId(goals[0].id);
    setFormPlanId("");
    setFormStart(toDateTimeLocal(startMs));
    setFormEnd(toDateTimeLocal(endMs));
    setFormIsFlex(false);
  }

  function openEdit(block: ScheduledBlock) {
    setEditing({ mode: "edit", block });
    setFormGoalId(block.goalId);
    setFormPlanId(block.sessionPlanId ?? "");
    setFormStart(toDateTimeLocal(block.startMs));
    setFormEnd(toDateTimeLocal(block.endMs));
    setFormIsFlex(block.isFlex);
  }

  function closeEdit() {
    setEditing(null);
  }

  function handleRegenerate() {
    startTransition(async () => {
      const r = await regenerateWeek(weekStartMs, weekEndMs);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(
        `Placed ${r.placed}${r.skipped > 0 ? `, skipped ${r.skipped}` : ""}`
      );
      router.refresh();
    });
  }

  function handleSave() {
    const startMs = fromDateTimeLocal(formStart);
    const endMs = fromDateTimeLocal(formEnd);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      toast.error("Invalid time");
      return;
    }
    if (endMs <= startMs) {
      toast.error("End must be after start");
      return;
    }
    if (!formGoalId) {
      toast.error("Pick a goal");
      return;
    }

    const sessionPlanId = formPlanId || null;
    const proceed = () => {
      startTransition(async () => {
        const r =
          editing?.mode === "edit"
            ? await updateBlock(editing.block.id, {
                goalId: formGoalId,
                sessionPlanId,
                startMs,
                endMs,
                isFlex: formIsFlex,
              })
            : await createBlock({
                goalId: formGoalId,
                sessionPlanId,
                startMs,
                endMs,
                isFlex: formIsFlex,
              });
        if ("error" in r) {
          toast.error(r.error);
          return;
        }
        closeEdit();
        router.refresh();
      });
    };

    if (overlapsBusy(startMs, endMs, busy)) {
      setPendingOverlapSave(() => () => {
        setPendingOverlapSave(null);
        proceed();
      });
      return;
    }
    proceed();
  }

  function handleDelete() {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    startTransition(async () => {
      const r = await deleteBlock(id);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setPendingDelete(null);
      router.refresh();
    });
  }

  const totalHours = WAKING_END - WAKING_START;
  const gridHeight = totalHours * PX_PER_HOUR;

  function dayIdxOfMs(ms: number): number {
    return Math.floor((ms - weekStartMs) / DAY_MS);
  }

  const busyByDay: BusyInterval[][] = [[], [], [], [], [], [], []];
  for (const b of busy) {
    const idx = dayIdxOfMs(b.startMs);
    if (idx >= 0 && idx < 7) busyByDay[idx].push(b);
  }

  const blocksByDay: ScheduledBlock[][] = [[], [], [], [], [], [], []];
  for (const b of blocks) {
    const idx = dayIdxOfMs(b.startMs);
    if (idx >= 0 && idx < 7) blocksByDay[idx].push(b);
  }

  const weekStartDate = new Date(weekStartMs);
  const weekEndDate = new Date(weekEndMs);

  const formPlans = formGoalId
    ? plans
        .filter((p) => p.goalId === formGoalId && p.status === "planned")
        .sort((a, b) => a.sortOrder - b.sortOrder)
    : [];

  return (
    <div className="flex flex-1 flex-col items-center px-3 pt-8 pb-24 sm:pt-12">
      <main className="flex w-full max-w-3xl flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">Plan</h1>
          <p className="text-muted-foreground text-sm">
            {formatRange(weekStartDate, weekEndDate)} — schedule the week
            around your calendar.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>This week</CardTitle>
            <CardDescription>
              Calendar in gray, goal blocks in color. Tap a goal block to edit.
            </CardDescription>
            <CardAction>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    // Default to Monday 10am for "Add"
                    const d = new Date(weekStartMs);
                    d.setHours(10, 0, 0, 0);
                    openCreate(d.getTime());
                  }}
                  disabled={goals.length === 0}
                >
                  <PlusIcon /> Add
                </Button>
                <Button
                  size="sm"
                  onClick={handleRegenerate}
                  disabled={goals.length === 0}
                >
                  <RefreshCwIcon /> Generate
                </Button>
              </div>
            </CardAction>
          </CardHeader>
          <CardContent>
            {goals.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                Add some goals on /goals first, then come back to plan your
                week.
              </p>
            ) : (
              <div className="flex gap-1">
                {/* Time axis */}
                <div
                  className="relative w-10 shrink-0"
                  style={{ height: gridHeight }}
                >
                  {Array.from({ length: totalHours + 1 }, (_, i) => {
                    const hour = WAKING_START + i;
                    return (
                      <div
                        key={i}
                        className="text-muted-foreground absolute -translate-y-1/2 text-[10px] tabular-nums"
                        style={{ top: i * PX_PER_HOUR }}
                      >
                        {pad2(hour)}:00
                      </div>
                    );
                  })}
                </div>

                {/* 7 day columns */}
                <div className="grid flex-1 grid-cols-7 gap-1">
                  {Array.from({ length: 7 }, (_, dayIdx) => {
                    const dayStartMs = weekStartMs + dayIdx * DAY_MS;
                    const dayLabel = DAY_LABELS[dayIdx];
                    const dayDate = new Date(dayStartMs).getDate();
                    return (
                      <div key={dayIdx} className="flex flex-col">
                        <div className="text-muted-foreground text-center text-[10px]">
                          {dayLabel} {dayDate}
                        </div>
                        <div
                          className="bg-muted/20 relative rounded-md border"
                          style={{ height: gridHeight }}
                        >
                          {/* Hour lines */}
                          {Array.from({ length: totalHours - 1 }, (_, i) => (
                            <div
                              key={i}
                              className="border-border/40 absolute inset-x-0 border-t"
                              style={{ top: (i + 1) * PX_PER_HOUR }}
                            />
                          ))}

                          {/* Busy events (read-only) */}
                          {busyByDay[dayIdx].map((ev) => {
                            const top =
                              ((ev.startMs - dayStartMs) / HOUR_MS -
                                WAKING_START) *
                              PX_PER_HOUR;
                            const height =
                              ((ev.endMs - ev.startMs) / HOUR_MS) * PX_PER_HOUR;
                            const visTop = Math.max(0, top);
                            const visHeight = Math.min(
                              gridHeight - visTop,
                              height - (visTop - top)
                            );
                            if (visHeight <= 0) return null;
                            return (
                              <div
                                key={`b-${ev.id}`}
                                className="bg-muted-foreground/20 text-muted-foreground absolute inset-x-0 mx-0.5 overflow-hidden rounded-sm px-1 text-[9px] leading-tight"
                                style={{ top: visTop, height: visHeight }}
                                title={ev.title ?? ""}
                              >
                                {ev.title ?? "Busy"}
                              </div>
                            );
                          })}

                          {/* Scheduled blocks (clickable) */}
                          {blocksByDay[dayIdx].map((blk) => {
                            const top =
                              ((blk.startMs - dayStartMs) / HOUR_MS -
                                WAKING_START) *
                              PX_PER_HOUR;
                            const height =
                              ((blk.endMs - blk.startMs) / HOUR_MS) *
                              PX_PER_HOUR;
                            const visTop = Math.max(0, top);
                            const visHeight = Math.min(
                              gridHeight - visTop,
                              height - (visTop - top)
                            );
                            if (visHeight <= 0) return null;
                            const goalIdx = goalIndexById.get(blk.goalId) ?? 0;
                            const color = colorForGoalIdx(goalIdx);
                            const planTitle = blk.sessionPlanId
                              ? planById.get(blk.sessionPlanId)?.title
                              : null;
                            const goalTitle =
                              goalById.get(blk.goalId)?.title ?? "Goal";
                            const label = planTitle ?? goalTitle;
                            return (
                              <button
                                key={`s-${blk.id}`}
                                type="button"
                                onClick={() => openEdit(blk)}
                                className="absolute inset-x-0 mx-0.5 overflow-hidden rounded-sm border px-1 text-left text-[9px] leading-tight hover:brightness-110"
                                style={{
                                  top: visTop,
                                  height: visHeight,
                                  backgroundColor: `${color}33`,
                                  borderColor: color,
                                }}
                                title={`${goalTitle} — ${label} (${formatHm(blk.startMs)}–${formatHm(blk.endMs)})`}
                              >
                                <span className="text-foreground/90 line-clamp-2 font-medium">
                                  {label}
                                </span>
                                <span className="text-muted-foreground block">
                                  {formatHm(blk.startMs)}
                                </span>
                              </button>
                            );
                          })}

                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Legend of goal colors */}
        {goals.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Goals</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {goals.map((g, i) => (
                <span
                  key={g.id}
                  className="flex items-center gap-1.5 text-sm"
                >
                  <span
                    aria-hidden
                    className="size-3 shrink-0 rounded-sm"
                    style={{ backgroundColor: colorForGoalIdx(i) }}
                  />
                  {g.title}
                </span>
              ))}
            </CardContent>
          </Card>
        )}
      </main>

      {/* Edit/create dialog */}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) closeEdit();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing?.mode === "edit" ? "Edit block" : "Add block"}
            </DialogTitle>
            <DialogDescription>
              Pick a goal, optional planned session, and time range.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="block-goal">
                Goal
              </label>
              <select
                id="block-goal"
                className="bg-background h-10 rounded-md border px-2 text-sm"
                value={formGoalId}
                onChange={(e) => {
                  setFormGoalId(e.target.value);
                  setFormPlanId("");
                }}
              >
                {goals.length === 0 ? (
                  <option value="">No active goals</option>
                ) : (
                  goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="block-plan">
                Planned session{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </label>
              <select
                id="block-plan"
                className="bg-background h-10 rounded-md border px-2 text-sm"
                value={formPlanId}
                onChange={(e) => setFormPlanId(e.target.value)}
              >
                <option value="">Goal time (no plan)</option>
                {formPlans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" htmlFor="block-start">
                  Start
                </label>
                <Input
                  id="block-start"
                  type="datetime-local"
                  className="h-10"
                  value={formStart}
                  onChange={(e) => setFormStart(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" htmlFor="block-end">
                  End
                </label>
                <Input
                  id="block-end"
                  type="datetime-local"
                  className="h-10"
                  value={formEnd}
                  onChange={(e) => setFormEnd(e.target.value)}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formIsFlex}
                onChange={(e) => setFormIsFlex(e.target.checked)}
              />
              Flex (movable; reserved for step 4)
            </label>
          </div>

          <DialogFooter>
            {editing?.mode === "edit" && (
              <Button
                variant="destructive"
                onClick={() => {
                  if (editing?.mode !== "edit") return;
                  const blk = editing.block;
                  closeEdit();
                  setPendingDelete(blk);
                }}
              >
                Delete
              </Button>
            )}
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete block?</DialogTitle>
            <DialogDescription>
              This scheduled block will be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Overlap warning */}
      <Dialog
        open={pendingOverlapSave !== null}
        onOpenChange={(open) => {
          if (!open) setPendingOverlapSave(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Overlaps a calendar event</DialogTitle>
            <DialogDescription>
              This block overlaps a fixed event on your calendar. Save anyway?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button onClick={() => pendingOverlapSave?.()}>Save anyway</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
