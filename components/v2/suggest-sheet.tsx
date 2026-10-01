"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { submitSuggestion } from "@/app/actions/suggestions";
import { BottomSheet, BottomSheetContent } from "@/components/v2/bottom-sheet";
import { PrimaryButton } from "@/components/v2/primary-button";
import { track } from "@/lib/analytics";
import { SUGGESTION_BODY_MAX } from "@/lib/suggestions";

// The one place a user can tell us what they wish the app did. Sibling of
// ReportBugSheet, and deliberately plainer than it: a bug report captures device
// context so we can reproduce it, a suggestion needs nothing but the idea and
// who had it — so there is no disclosure line here, because there is nothing
// silent to disclose.
export function SuggestSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  function send() {
    const text = body.trim();
    // Caught here so an empty submit costs no round-trip. The action re-checks.
    if (!text) {
      toast.error("Tell us your idea first.");
      return;
    }

    startTransition(async () => {
      const result = await submitSuggestion(text);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      track("suggestion_submitted", { length: text.length });
      setBody("");
      onOpenChange(false);
      toast.success("Thanks — suggestion sent.");
    });
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent
        title="Make a suggestion"
        meta="Goes straight to the person building this"
      >
        <div className="flex flex-col gap-5 pb-1">
          <div className="flex flex-col gap-[7px]">
            <span className="section-label">What should Progra do?</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={SUGGESTION_BODY_MAX}
              rows={5}
              autoFocus
              placeholder="A feature you want, something that feels wrong, anything you'd change."
              className="text-ink border-control-border w-full rounded-[13px] border-[1.5px] px-3.5 py-2.5 text-[15px] leading-[1.5] outline-none placeholder:text-disabled"
            />
            {/* Same counter as the bug sheet, for the same reason: at 1000 chars
                hitting the cap would otherwise be silent. */}
            <span className="text-caption self-end text-xs tabular-nums">
              {body.length} / {SUGGESTION_BODY_MAX}
            </span>
          </div>

          {/* Your name is attached, and saying so is the honest version of
              "includes the user" — it also tends to improve what people send. */}
          <p className="text-caption text-xs leading-relaxed text-pretty">
            Sent with your name, so we can follow up if we need to.
          </p>

          <PrimaryButton onClick={send} disabled={pending}>
            {pending ? "Sending…" : "Send suggestion"}
          </PrimaryButton>
        </div>
      </BottomSheetContent>
    </BottomSheet>
  );
}
