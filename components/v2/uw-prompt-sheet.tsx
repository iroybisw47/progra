"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { markUwPrompt, setUwProfile } from "@/app/actions/uw";
import { UwFields } from "@/components/uw-fields";
import { BottomSheet, BottomSheetContent } from "@/components/v2/bottom-sheet";
import { PrimaryButton } from "@/components/v2/primary-button";
import { track } from "@/lib/telemetry/client";
import type { UwProfileInput } from "@/lib/uw";
import { uwBlockSaveInput, type UwBlockState } from "@/lib/uw-fields";
import { UW_PROMPT_COPY, type UwPromptStamp } from "@/lib/uw-prompt";

type Result = { ok: true } | { error: string };

// The two writes, as props so the dev preview can run the sheet with no
// database (app/dev/uw-prompt).
export type UwPromptServices = {
  setUwProfile: (input: UwProfileInput) => Promise<Result>;
  markUwPrompt: (stamp: UwPromptStamp) => Promise<Result>;
};

const LIVE: UwPromptServices = { setUwProfile, markUwPrompt };

// Yes starts from nothing (only members outside the cohort are asked), and
// listed, with the disclosure right under the switch, as onboarding v3's Yes
// does (P9c).
const EMPTY_BLOCK: UwBlockState = {
  isUw: true,
  majors: { items: [], draft: "" },
  interests: { items: [], draft: "" },
  listed: true,
};

// The secondary buttons, in beta-full.tsx's and error.tsx's outline.
const SECONDARY =
  "border-control-border text-body h-12 flex-1 rounded-[15px] border-[1.5px] text-sm font-semibold transition-transform active:scale-[.98] disabled:opacity-50";

// The UW info prompt (lib/uw-prompt.ts): "Are you a UW student?", then, on
// Yes, the same majors, interests and listing switch as Settings → Edit
// profile (components/uw-fields.tsx), saved through the same setUwProfile.
// Only members outside the cohort ever see it (uwPromptFor).
//
// EVERY close path writes, for WhatsNewModal's reason: Yes saves (and
// setUwProfile stamps 'done'), No stamps 'done', and anything else (Not now,
// the backdrop, Escape, a drag on the handle) stamps 'later', which keeps the
// Friends card. `stamped` says 'later' is already stored, so reopening from
// the card and putting it away again writes nothing. While a save is running
// it can't be put away, so a slow Save can't be undone into a 'later'.
export function UwPromptSheet({
  open,
  onClose,
  via,
  stamped,
  groupsLive,
  services = LIVE,
}: {
  open: boolean;
  onClose: () => void;
  via: "sheet" | "card";
  stamped: boolean;
  // FRIENDS_V3: whether the UW groups exist for the toast to point at.
  groupsLive: boolean;
  services?: UwPromptServices;
}) {
  const [step, setStep] = useState<"ask" | "fields">("ask");
  const [block, setBlock] = useState<UwBlockState>(EMPTY_BLOCK);
  const [pending, startTransition] = useTransition();
  // One answer per opening: a No that's closing can't also be a Not now.
  const answered = useRef(false);

  useEffect(() => {
    if (!open) return;
    answered.current = false;
    track("uw_prompt_shown", { via });
  }, [open, via]);

  function answer(kind: "no" | "later") {
    if (answered.current || pending) return;
    answered.current = true;
    track("uw_prompt_answered", { via, answer: kind });
    onClose();
    // Best-effort, like WhatsNewModal's stamp: on failure the sheet or card
    // simply comes back on a later load.
    if (kind === "no") void services.markUwPrompt("done");
    else if (!stamped) void services.markUwPrompt("later");
  }

  function save() {
    if (answered.current) return;
    startTransition(async () => {
      let r: Result;
      try {
        r = await services.setUwProfile(uwBlockSaveInput(block));
      } catch {
        r = {
          error:
            "Couldn't save your UW details. Check your connection and try again.",
        };
      }
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      answered.current = true;
      track("uw_prompt_answered", { via, answer: "yes" });
      toast.success(
        groupsLive ? UW_PROMPT_COPY.saved : UW_PROMPT_COPY.savedNoGroups,
      );
      onClose();
    });
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) answer("later");
      }}
    >
      {step === "ask" ? (
        <BottomSheetContent title={UW_PROMPT_COPY.askTitle}>
          <div className="flex flex-col gap-4 pb-1">
            <p className="text-body text-[14px] leading-[1.5] text-pretty">
              {UW_PROMPT_COPY.askBody}
            </p>
            <PrimaryButton onClick={() => setStep("fields")}>
              {UW_PROMPT_COPY.yes}
            </PrimaryButton>
            <div className="flex gap-2.5">
              <button
                type="button"
                className={SECONDARY}
                onClick={() => answer("no")}
              >
                {UW_PROMPT_COPY.no}
              </button>
              <button
                type="button"
                className={SECONDARY}
                onClick={() => answer("later")}
              >
                {UW_PROMPT_COPY.later}
              </button>
            </div>
          </div>
        </BottomSheetContent>
      ) : (
        <BottomSheetContent title={UW_PROMPT_COPY.fieldsTitle}>
          <div className="flex flex-col gap-4 pb-1">
            <p className="text-body text-[14px] leading-[1.5] text-pretty">
              {UW_PROMPT_COPY.fieldsIntro}
            </p>
            <UwFields
              value={block}
              onChange={setBlock}
              savedIsUw={false}
              disabled={pending}
              showUwSwitch={false}
            />
            <PrimaryButton disabled={pending} onClick={save}>
              {pending ? UW_PROMPT_COPY.saving : UW_PROMPT_COPY.save}
            </PrimaryButton>
            <p className="text-caption text-center text-[11px] leading-snug text-pretty">
              {UW_PROMPT_COPY.fieldsBody}
            </p>
          </div>
        </BottomSheetContent>
      )}
    </BottomSheet>
  );
}
