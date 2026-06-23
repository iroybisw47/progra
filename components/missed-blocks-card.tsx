"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

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

import {
  acceptReslot,
  dismissMissedBlock,
} from "@/app/actions/scheduled-blocks";
import type { ScheduledBlock } from "@/lib/db/scheduled-blocks";

const HOUR_MS = 60 * 60 * 1000;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatBlockOrigin(startMs: number): string {
  // "Tue Jun 16 at 14:00"
  const d = new Date(startMs);
  const day = d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return `${day} at ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatSuggestion(startMs: number): string {
  // "Wed 09:00"
  const d = new Date(startMs);
  const day = d.toLocaleDateString(undefined, { weekday: "short" });
  return `${day} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatHours(ms: number): string {
  return `${(ms / HOUR_MS).toFixed(1)}h`;
}

function toDateTimeLocal(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function fromDateTimeLocal(s: string): number {
  const [date, time] = s.split("T");
  if (!date || !time) return NaN;
  const [y, m, d] = date.split("-").map(Number);
  const [h, mn] = time.split(":").map(Number);
  return new Date(y, m - 1, d, h, mn, 0, 0).getTime();
}

export type MissedItem = {
  block: ScheduledBlock;
  goalTitle: string;
  planTitle: string | null;
  suggestions: { startMs: number; endMs: number }[];
};

type Props = {
  items: MissedItem[];
};

export function MissedBlocksCard({ items }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [customForBlock, setCustomForBlock] = useState<MissedItem | null>(null);
  const [customStart, setCustomStart] = useState<string>("");

  if (items.length === 0) return null;

  function openCustom(item: MissedItem) {
    // Default custom-time start = next-hour boundary after now.
    const next = new Date();
    next.setMinutes(0, 0, 0);
    next.setHours(next.getHours() + 1);
    setCustomStart(toDateTimeLocal(next.getTime()));
    setCustomForBlock(item);
  }

  function closeCustom() {
    setCustomForBlock(null);
  }

  function handleAccept(item: MissedItem, startMs: number, endMs: number) {
    startTransition(async () => {
      const r = await acceptReslot({
        missedBlockId: item.block.id,
        newStartMs: startMs,
        newEndMs: endMs,
      });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(
        `Moved to ${formatSuggestion(startMs)}`
      );
      router.refresh();
    });
  }

  function handleCustomSave() {
    if (!customForBlock) return;
    const startMs = fromDateTimeLocal(customStart);
    if (!Number.isFinite(startMs)) {
      toast.error("Invalid time");
      return;
    }
    const duration =
      customForBlock.block.endMs - customForBlock.block.startMs;
    const endMs = startMs + duration;
    const item = customForBlock;
    closeCustom();
    handleAccept(item, startMs, endMs);
  }

  function handleDismiss(item: MissedItem) {
    startTransition(async () => {
      const r = await dismissMissedBlock(item.block.id);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Needs reslotting</CardTitle>
          <CardDescription>
            {items.length === 1
              ? "One block didn't happen this week. Pick a new spot, or dismiss it."
              : `${items.length} blocks didn't happen. Pick new spots, or dismiss.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {items.map((item) => {
            const label = item.planTitle ?? "Goal time";
            const duration =
              item.block.endMs - item.block.startMs;
            return (
              <div key={item.block.id} className="flex flex-col gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm">
                    <span className="font-medium">{item.goalTitle}</span>
                    <span className="text-muted-foreground"> — {label}</span>
                  </span>
                  <span className="text-muted-foreground text-xs">
                    Was {formatBlockOrigin(item.block.startMs)}, {formatHours(duration)}
                  </span>
                </div>

                {item.suggestions.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {item.suggestions.map((s) => (
                      <Badge
                        key={`${item.block.id}-${s.startMs}`}
                        variant="outline"
                        className="h-8 cursor-pointer px-3 text-sm"
                        render={
                          <button
                            type="button"
                            onClick={() => handleAccept(item, s.startMs, s.endMs)}
                          />
                        }
                      >
                        {formatSuggestion(s.startMs)}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    No open slots left this week. Try Other time.
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openCustom(item)}
                  >
                    Other time
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDismiss(item)}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog
        open={customForBlock !== null}
        onOpenChange={(open) => {
          if (!open) closeCustom();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pick a custom time</DialogTitle>
            <DialogDescription>
              {customForBlock
                ? `${customForBlock.goalTitle} — ${customForBlock.planTitle ?? "Goal time"} · ${formatHours(customForBlock.block.endMs - customForBlock.block.startMs)}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="custom-start">
              Start
            </label>
            <Input
              id="custom-start"
              type="datetime-local"
              className="h-10"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              Duration stays the same as the missed block.
            </p>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button onClick={handleCustomSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
