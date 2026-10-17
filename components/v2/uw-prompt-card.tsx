"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { ChevronRightIcon, GraduationCapIcon, XIcon } from "lucide-react";

import { markUwPrompt } from "@/app/actions/uw";
import type { UwPromptServices } from "@/components/v2/uw-prompt-sheet";
import { track } from "@/lib/telemetry/client";
import { UW_PROMPT_COPY } from "@/lib/uw-prompt";

// Lazy, per AGENTS.md's rule for dialogs: the sheet's chunk (with the chip
// fields) loads on the first tap, not with the Friends tab.
const UwPromptSheet = dynamic(
  () => import("@/components/v2/uw-prompt-sheet").then((m) => m.UwPromptSheet),
  { ssr: false },
);

// The UW info prompt's way back in (lib/uw-prompt.ts): a card on the Friends
// tab for a member who hasn't answered, there until they do. A tap opens the
// same sheet as the one-time prompt on Progress; the ✕ stops asking for good.
// app/friends/page.tsx renders it only while uwPromptFor() says card, and a
// save or a ✕ revalidates it away.
export function UwPromptCard({
  stamped,
  groupsLive,
  services,
}: {
  // profiles.uw_prompt is already 'later' (see UwPromptSheet).
  stamped: boolean;
  groupsLive: boolean;
  // Dev preview only (app/dev/uw-prompt); the real actions otherwise.
  services?: UwPromptServices;
}) {
  const [open, setOpen] = useState(false);
  // Mounted from the first tap on, so closing animates out.
  const [opened, setOpened] = useState(false);
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  function dismiss() {
    setHidden(true);
    track("uw_prompt_answered", { via: "card", answer: "dismiss" });
    void (services?.markUwPrompt ?? markUwPrompt)("done");
  }

  return (
    <>
      <div className="border-hairline bg-card flex items-center gap-1 rounded-[18px] border py-1 pr-1 pl-3.5">
        <button
          type="button"
          onClick={() => {
            setOpened(true);
            setOpen(true);
          }}
          className="flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left transition-transform active:scale-[.99]"
        >
          <span className="bg-brand/10 text-brand flex size-9 shrink-0 items-center justify-center rounded-full">
            <GraduationCapIcon className="size-[18px]" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-ink text-[14px] leading-tight font-semibold">
              {UW_PROMPT_COPY.cardTitle}
            </span>
            <span className="text-caption text-xs leading-snug">
              {UW_PROMPT_COPY.cardBody}
            </span>
          </span>
          <ChevronRightIcon className="text-faint size-[18px] shrink-0" />
        </button>
        <button
          type="button"
          aria-label={UW_PROMPT_COPY.cardDismiss}
          onClick={dismiss}
          className="text-faint flex size-11 shrink-0 items-center justify-center rounded-full"
        >
          <XIcon className="size-4" />
        </button>
      </div>
      {opened && (
        <UwPromptSheet
          open={open}
          onClose={() => setOpen(false)}
          via="card"
          stamped={stamped}
          groupsLive={groupsLive}
          services={services}
        />
      )}
    </>
  );
}
