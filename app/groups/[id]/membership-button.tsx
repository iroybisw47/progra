"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { GROUP_COPY, isGroupFull, type GroupSummary } from "@/lib/groups";
import { cn } from "@/lib/utils";

// Lazy, per the repo's dialog rule: the sheet only loads on a tap.
const MembershipSheet = dynamic(() => import("./membership-sheet").then((m) => m.MembershipSheet), {
  ssr: false,
});

// Join (a non-member's full-width button under the header, greyed "Full" at
// the cap) or Leave (a member's small chip beside the name). Either opens the
// sheet that says what it does before it does it.
export function MembershipButton({ group }: { group: GroupSummary }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const full = !group.isMember && isGroupFull(group);

  function show() {
    setLoaded(true);
    setOpen(true);
  }

  return (
    <>
      {group.isMember ? (
        <button
          type="button"
          onClick={show}
          aria-haspopup="dialog"
          className="border-hairline text-caption mt-1 h-8 shrink-0 rounded-[11px] border-[1.5px] px-3 text-[12px] font-semibold transition-transform active:scale-95"
        >
          {GROUP_COPY.leave}
        </button>
      ) : (
        <button
          type="button"
          onClick={show}
          disabled={full}
          aria-haspopup="dialog"
          className={cn(
            "h-12 w-full rounded-[15px] text-sm font-semibold transition-transform active:scale-[.97]",
            full
              ? "bg-track text-faint"
              : "bg-brand text-primary-foreground shadow-[0_10px_22px_-10px_var(--glow)]"
          )}
        >
          {full ? GROUP_COPY.full : GROUP_COPY.join}
        </button>
      )}
      {loaded && <MembershipSheet open={open} onOpenChange={setOpen} group={group} />}
    </>
  );
}
