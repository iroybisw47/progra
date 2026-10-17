"use client";

import { useState } from "react";

import { UwPromptCard } from "@/components/v2/uw-prompt-card";
import {
  UwPromptSheet,
  type UwPromptServices,
} from "@/components/v2/uw-prompt-sheet";

// The client half of the UW prompt's dev preview (page.tsx says what it's for).
export function UwPromptPreviewClient({ fail }: { fail: boolean }) {
  const [open, setOpen] = useState(true);
  const [log, setLog] = useState<string[]>([]);
  const [services] = useState<UwPromptServices>(() => {
    const answer = async (line: string) => {
      await new Promise((r) => setTimeout(r, 150));
      setLog((l) => [...l, `${fail ? "FAILED " : ""}${line}`]);
      return fail
        ? { error: "Couldn't save your UW details." }
        : ({ ok: true } as const);
    };
    return {
      setUwProfile: (input) => answer(`setUwProfile ${JSON.stringify(input)}`),
      markUwPrompt: (stamp) => answer(`markUwPrompt("${stamp}")`),
    };
  });

  return (
    <div className="flex flex-1 flex-col items-center pt-7 pb-28">
      <main className="flex w-full max-w-md flex-col gap-4 px-5">
        <span className="section-label">Friends (preview)</span>
        <UwPromptCard stamped={false} groupsLive services={services} />
        <button
          type="button"
          className="text-brand self-start text-sm font-semibold"
          onClick={() => setOpen(true)}
        >
          Reopen the on-load sheet
        </button>
        <ol className="text-caption flex flex-col gap-1 font-mono text-[11px] break-all">
          {log.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ol>
      </main>
      <UwPromptSheet
        open={open}
        onClose={() => setOpen(false)}
        via="sheet"
        stamped={false}
        groupsLive
        services={services}
      />
    </div>
  );
}
