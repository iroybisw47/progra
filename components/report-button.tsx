"use client";

import { useState, useTransition } from "react";
import { FlagIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { reportContent } from "@/app/actions/reports";
import {
  REPORT_NOTE_MAX,
  REPORT_REASONS,
  REPORT_REASON_LABELS,
  type ReportReason,
  type ReportTargetType,
} from "@/lib/social/reports";
import { cn } from "@/lib/utils";

// A flag control + report dialog. Render it only on OTHER people's content — the
// caller decides. Reporting is fire-and-forget: it writes a row only the admin
// can read, so there's nothing to refresh.
export function ReportButton({
  targetType,
  targetId,
  label,
  className,
}: {
  targetType: ReportTargetType;
  targetId: string;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!reason) {
      toast.error("Pick a reason.");
      return;
    }
    startTransition(async () => {
      const r = await reportContent(targetType, targetId, reason, note);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success("Thanks — we'll take a look.");
      setOpen(false);
      setReason(null);
      setNote("");
    });
  }

  return (
    <>
      <button
        type="button"
        aria-label={`Report ${targetType}`}
        onClick={() => setOpen(true)}
        className={cn(
          "text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1 text-xs transition-colors",
          className
        )}
      >
        <FlagIcon className="size-3.5" />
        {label}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report this {targetType}</DialogTitle>
            <DialogDescription>
              Tell us what&rsquo;s wrong. Your report is private.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            {REPORT_REASONS.map((r) => (
              <Button
                key={r}
                type="button"
                variant={reason === r ? "secondary" : "outline"}
                aria-pressed={reason === r}
                className="justify-start"
                onClick={() => setReason(r)}
              >
                {REPORT_REASON_LABELS[r]}
              </Button>
            ))}
            <Textarea
              placeholder="Add a note (optional)"
              maxLength={REPORT_NOTE_MAX}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending || !reason}>
              Submit report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
