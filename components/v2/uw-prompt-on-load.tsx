"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

import { UwPromptSheet } from "@/components/v2/uw-prompt-sheet";
import { useTakeoverActive } from "@/lib/takeover";

// The UW info prompt's one-time sheet, mounted by the root layout only when
// uwPromptFor() says this member has never been asked (and no plan-complete
// modal or release note is up: one dialog at a time). It opens at mount, on
// Progress only and never over the weekly review, for WhatsNewModal's reasons
// (an allowlist, and deferral for free: it waits, unstamped, until "/").
//
// Its close stamps profiles.uw_prompt and the action revalidates the layout,
// so it drops out of the server tree in the same round-trip.
export function UwPromptOnLoad({ groupsLive }: { groupsLive: boolean }) {
  const pathname = usePathname();
  const takenOver = useTakeoverActive();
  const [open, setOpen] = useState(true);

  // After the hooks: this survives navigation away from "/".
  if (pathname !== "/" || takenOver) return null;

  return (
    <UwPromptSheet
      open={open}
      onClose={() => setOpen(false)}
      via="sheet"
      stamped={false}
      groupsLive={groupsLive}
    />
  );
}
