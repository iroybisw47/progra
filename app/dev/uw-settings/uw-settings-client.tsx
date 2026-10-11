"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { UwFields } from "@/components/uw-fields";
import { PrimaryButton } from "@/components/v2/primary-button";
import type { UwProfilePayload } from "@/lib/uw";
import { saveUwBlock, uwBlockSaveInput, uwBlockState } from "@/lib/uw-fields";
import {
  createUwSettingsPreviewSave,
  previewStoredRow,
  uwSettingsSaved,
  type UwSettingsFixture,
} from "@/lib/uw-settings-preview";

// The client half of the UW block's dev preview (page.tsx says what it's
// for). `saved` stands in for the profile row: a Save that writes replaces it
// with what the fake stored, and resets the block from it, as a real save's
// revalidation hands Settings fresh props and the next open starts from them.
// The page keys this by fixture, so a new fixture starts from its own row.
//
// The frame is Edit profile's, minus the avatar, name, handle and bio above
// the block: the sheet's title row, the hairline, the block, then Save.
export function UwSettingsPreviewClient({
  fixture,
  fail,
}: {
  fixture: UwSettingsFixture;
  fail: boolean;
}) {
  const [saved, setSaved] = useState(() => uwSettingsSaved(fixture));
  const [block, setBlock] = useState(() => uwBlockState(uwSettingsSaved(fixture)));
  const [save] = useState(() => createUwSettingsPreviewSave({ fail }));
  const [last, setLast] = useState<{ wrote: boolean; payload: UwProfilePayload | null } | null>(
    null
  );
  const [pending, startTransition] = useTransition();

  function onSave() {
    startTransition(async () => {
      const input = uwBlockSaveInput(block);
      const r = await saveUwBlock(saved, block, save);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      const stored = r.wrote ? previewStoredRow(input) : null;
      if (stored) {
        setSaved(stored.saved);
        setBlock(uwBlockState(stored.saved));
      }
      setLast({ wrote: r.wrote, payload: stored?.payload ?? null });
      toast.success("Saved");
    });
  }

  return (
    <div className="flex flex-1 flex-col items-center pt-7 pb-28">
      <main className="flex w-full max-w-md flex-col gap-5 px-5">
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-ink font-serif text-[21px] leading-none font-medium tracking-[-0.01em]">
            Edit profile
          </h1>
          <span className="flex-1" />
          <span className="text-faint text-xs whitespace-nowrap">Visible to friends</span>
        </div>
        <div className="bg-hairline h-px" />
        <UwFields value={block} onChange={setBlock} savedIsUw={saved.isUw} disabled={pending} />
        <PrimaryButton disabled={pending} onClick={onSave}>
          {pending ? "Saving…" : "Save"}
        </PrimaryButton>

        {/* Not part of the block: what the last Save sent, so a screenshot
            can show the columns as well as the fields. */}
        <div className="bg-inset rounded-[13px] px-3.5 py-3">
          <span className="section-label">Preview · last save</span>
          <pre className="text-secondary-ink mt-2 overflow-x-auto font-mono text-[11px] leading-[1.5] whitespace-pre-wrap">
            {last === null
              ? "Nothing saved yet."
              : last.wrote
                ? JSON.stringify(last.payload, null, 2)
                : "No change, so setUwProfile wasn't called."}
          </pre>
        </div>
      </main>
    </div>
  );
}
