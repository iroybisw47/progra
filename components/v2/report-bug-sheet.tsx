"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { submitBugReport } from "@/app/actions/bug-reports";
import { BottomSheet, BottomSheetContent } from "@/components/v2/bottom-sheet";
import { PrimaryButton } from "@/components/v2/primary-button";
import { track } from "@/lib/analytics";
import { BUG_DESCRIPTION_MAX } from "@/lib/bug-reports";
import { getReportRoute } from "@/lib/last-route";
import { useIsNativeApp } from "@/lib/use-is-native-app";

// The one place a user can tell us something is broken. Opened from
// Settings → Help today; built to be opened from anywhere, since the planned
// "here's how to report a bug" prompt will want to trigger it in context.
export function ReportBugSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [description, setDescription] = useState("");
  const [pending, startTransition] = useTransition();
  const isNative = useIsNativeApp();

  // Read during render, not at submit: it names the screen in the disclosure
  // below, and it can't change while the sheet is open. Safe because this
  // component is dynamic({ ssr: false }) — there is no server render to
  // disagree with.
  const route = getReportRoute();

  function send() {
    const text = description.trim();
    // Caught here so an empty submit costs no round-trip. The action re-checks.
    if (!text) {
      toast.error("Tell us what went wrong.");
      return;
    }

    startTransition(async () => {
      const result = await submitBugReport({
        description: text,
        route,
        platform: isNative ? "native" : "web",
        userAgent:
          typeof navigator === "undefined" ? null : navigator.userAgent,
        viewport:
          typeof window === "undefined"
            ? null
            : `${window.innerWidth}x${window.innerHeight}`,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      track("bug_report_submitted", { route });
      setDescription("");
      onOpenChange(false);
      toast.success("Thanks — we'll take a look.");
    });
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent title="Report a bug">
        <div className="flex flex-col gap-5 pb-1">
          <div className="flex flex-col gap-[7px]">
            <span className="section-label">What went wrong?</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={BUG_DESCRIPTION_MAX}
              rows={5}
              autoFocus
              placeholder="What were you doing, and what happened instead?"
              className="text-ink border-control-border w-full rounded-[13px] border-[1.5px] px-3.5 py-2.5 text-[15px] leading-[1.5] outline-none placeholder:text-disabled"
            />
            {/* The app's first character counter. Worth it at 1000 chars, where
                hitting the cap would otherwise be silent. */}
            <span className="text-caption self-end text-xs tabular-nums">
              {description.length} / {BUG_DESCRIPTION_MAX}
            </span>
          </div>

          {/* Disclosure, not decoration: this is what makes the silent context
              capture honest. Names the actual screen so there's no ambiguity
              about what "context" means. */}
          <p className="text-caption text-xs leading-relaxed text-pretty">
            We&apos;ll include your device details
            {route ? (
              <>
                {" "}
                and the screen you came from (<code>{route}</code>)
              </>
            ) : null}{" "}
            so we can reproduce it.
          </p>

          <PrimaryButton onClick={send} disabled={pending}>
            {pending ? "Sending…" : "Send report"}
          </PrimaryButton>
        </div>
      </BottomSheetContent>
    </BottomSheet>
  );
}
