"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { PencilIcon } from "lucide-react";

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
import { BottomSheet, BottomSheetContent } from "@/components/v2/bottom-sheet";
import { archiveGoal, createGoal, updateGoal } from "@/app/actions/goals";
import { goalColor } from "@/lib/colors";
import { formatDuration } from "@/lib/duration";

const HOUR_MS = 60 * 60 * 1000;
const fmtH = (ms: number) => `${(ms / HOUR_MS).toFixed(1)}h`;

export type ManageGoal = {
  id: string;
  title: string;
  quotaHours: number;
  actualMs: number;
};

// The goals manager: a bottom sheet listing this week's goals as cards, and a
// second sheet on top of it for editing one (rename, weekly quota, delete).
// Mirrors ManageHabits so the two "manage" affordances on Progress behave the
// same way. Every mutation goes through the existing goal actions.
export function ManageGoals({
  open,
  onOpenChange,
  goals,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goals: ManageGoal[];
}) {
  const [pending, startTransition] = useTransition();
  // null = closed; { id: null } = the new-goal form.
  const [editing, setEditing] = useState<{
    id: string | null;
    title: string;
    quota: number;
  } | null>(null);

  function openNew() {
    setEditing({ id: null, title: "", quota: 5 });
  }

  function openEdit(goal: ManageGoal) {
    setEditing({ id: goal.id, title: goal.title, quota: goal.quotaHours });
  }

  function save() {
    if (!editing) return;
    const title = editing.title.trim();
    if (!title) {
      toast.error("Give your goal a name");
      return;
    }
    const { id, quota } = editing;
    startTransition(async () => {
      const r = id
        ? await updateGoal(id, { title, weeklyQuotaHours: quota })
        : await createGoal({ title, weeklyQuotaHours: quota });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setEditing(null);
      toast.success(id ? `Saved ${title}` : `Added ${title}`);
    });
  }

  function remove(goal: { id: string; title: string }) {
    startTransition(async () => {
      const r = await archiveGoal(goal.id);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setEditing(null);
      toast.success(`Deleted ${goal.title}`);
    });
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent title="Goals" meta="Tap a goal to edit">
        <div className="flex flex-col gap-2.5 pb-1">
          {goals.length === 0 && (
            <p className="text-caption text-[13px]">
              No goals yet — a goal is a weekly hour target you clock in
              against.
            </p>
          )}
          {goals.map((g) => {
            const color = goalColor(g.id);
            const quotaMs = g.quotaHours * HOUR_MS;
            const pct =
              quotaMs > 0 ? Math.min(100, (g.actualMs / quotaMs) * 100) : 0;
            const leftMs = Math.max(0, quotaMs - g.actualMs);
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => openEdit(g)}
                className="border-hairline hover:border-brand flex flex-col gap-2 rounded-2xl border-[1.5px] px-3.5 py-3 text-left transition-[border-color,transform] active:scale-[.99]"
              >
                <div className="flex w-full items-center gap-2">
                  <span
                    aria-hidden
                    className="size-[9px] shrink-0 rounded-[2px]"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-body min-w-0 flex-1 truncate text-sm font-semibold">
                    {g.title}
                  </span>
                  <span className="text-ink shrink-0 text-sm font-semibold tabular-nums">
                    {fmtH(g.actualMs)}
                  </span>
                  <span className="text-caption shrink-0 text-xs tabular-nums">
                    / {g.quotaHours.toFixed(0)}h
                  </span>
                  <span className="border-hairline text-caption flex h-7 w-[30px] shrink-0 items-center justify-center rounded-[9px] border-[1.5px]">
                    <PencilIcon className="size-3" />
                  </span>
                </div>
                <div className="bg-track h-1.5 w-full overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: g.actualMs > 0 ? `${Math.max(2, pct)}%` : "0%",
                      backgroundColor: color,
                    }}
                  />
                </div>
                <span className="text-faint text-xs">
                  {leftMs > 0
                    ? `${formatDuration(leftMs)} left this week`
                    : "Quota met"}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={openNew}
            className="bg-brand text-primary-foreground mt-0.5 h-[46px] w-full rounded-[15px] text-sm font-semibold transition-transform active:scale-[.98]"
          >
            + Add a goal
          </button>
        </div>
      </BottomSheetContent>

      {/* Edit / new goal — its own sheet on top. */}
      <BottomSheet
        open={editing !== null}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
      >
        <BottomSheetContent
          title={editing?.id ? "Edit goal" : "New goal"}
          meta="Hours you're committing to each week"
        >
          <div className="flex flex-col gap-5 pb-1">
            <input
              aria-label="Goal name"
              className="text-ink w-full border-b-2 border-[var(--hairline)] bg-transparent pb-2 text-[19px] font-medium tracking-[-0.01em] outline-none placeholder:text-[var(--disabled)]"
              placeholder="Goal name"
              maxLength={120}
              value={editing?.title ?? ""}
              onChange={(e) =>
                setEditing((s) => (s ? { ...s, title: e.target.value } : s))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  save();
                }
              }}
            />

            <div className="flex flex-col gap-[7px]">
              <span className="section-label">Weekly quota</span>
              <div className="border-control-border flex h-11 items-center justify-center gap-[18px] rounded-[13px] border-[1.5px]">
                <QuotaButton
                  label="Fewer hours"
                  disabled={(editing?.quota ?? 1) <= 1}
                  onClick={() =>
                    setEditing((s) =>
                      s ? { ...s, quota: Math.max(1, s.quota - 1) } : s
                    )
                  }
                >
                  −
                </QuotaButton>
                <span className="text-ink min-w-16 text-center text-base font-semibold tabular-nums">
                  {editing?.quota ?? 1}h
                </span>
                <QuotaButton
                  label="More hours"
                  disabled={(editing?.quota ?? 1) >= 40}
                  onClick={() =>
                    setEditing((s) =>
                      s ? { ...s, quota: Math.min(40, s.quota + 1) } : s
                    )
                  }
                >
                  +
                </QuotaButton>
              </div>
            </div>

            <div className="flex gap-2.5">
              {editing?.id && (
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
                      <AlertDialogTitle>
                        Delete {editing.title}?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        The goal stops showing up going forward. Sessions you
                        already clocked against it stay in your history.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() =>
                          remove({ id: editing.id!, title: editing.title })
                        }
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <button
                type="button"
                onClick={save}
                disabled={pending || !editing?.title.trim()}
                className="bg-brand text-primary-foreground h-12 flex-1 rounded-[15px] text-sm font-semibold transition-transform active:scale-[.98] disabled:opacity-40"
              >
                Save goal
              </button>
            </div>
          </div>
        </BottomSheetContent>
      </BottomSheet>
    </BottomSheet>
  );
}

function QuotaButton({
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
      className="border-hairline text-caption flex size-[30px] items-center justify-center rounded-[10px] border-[1.5px] text-[15px] leading-none font-semibold transition-transform active:scale-90 disabled:opacity-35"
    >
      {children}
    </button>
  );
}
