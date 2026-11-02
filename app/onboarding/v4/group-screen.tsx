"use client";

import { CheckIcon } from "lucide-react";

import { itemStyle, type ItemPhase } from "@/lib/motion";
import {
  GROUP_COPY,
  isGroupFull,
  joinCopy,
  memberCountLine,
  type GroupSummary,
} from "@/lib/groups";
import { cn } from "@/lib/utils";

// "Join a group" (GROUPS_ONBOARDING), before find your friends: the browse
// list, each group with what joining it does — "You'll be friends with all N
// members, and they'll see your sessions." — the same line the group page's
// sheet says. Join toggles to "✓ Joined" and back (a leave). Several can be
// joined; the shell's CTA is "Skip for now" until one is, then "Continue · N
// joined". Full groups are greyed and can't be joined. The writes are the
// shell's (joinGroup / leaveGroup through its services); this only lists and
// calls back.

// The 30px toggle, as find your friends' Add (components/v2/person-row.tsx).
const TOGGLE =
  "relative flex h-[30px] shrink-0 items-center gap-[5px] rounded-[10px] border-[1.5px] px-3 text-[12px] font-semibold transition-transform active:scale-[.94] before:absolute before:inset-x-0 before:-inset-y-[7px] before:content-[''] disabled:opacity-50";

export function GroupScreen({
  phase,
  reduced,
  eyebrow,
  groups,
  joined,
  onToggle,
}: {
  phase: ItemPhase;
  reduced: boolean;
  eyebrow: string;
  groups: readonly GroupSummary[];
  // Joined in this run or already a member, by group id.
  joined: ReadonlySet<string>;
  onToggle: (group: GroupSummary) => void;
}) {
  return (
    <div className="absolute inset-x-0 top-0 bottom-[108px] overflow-y-auto overscroll-contain px-6">
      <div className="mx-auto flex max-w-[420px] flex-col pt-[18px] pb-6">
        <span className="section-label" style={itemStyle(phase, 0, reduced)}>
          {eyebrow}
        </span>
        <h2
          className="text-ink mt-3 font-serif text-[32px] leading-[1.1] font-medium tracking-[-0.02em]"
          style={itemStyle(phase, 1, reduced)}
        >
          Join a group
        </h2>
        <p className="text-secondary-ink mt-2 text-[14px] leading-[1.45] text-pretty" style={itemStyle(phase, 2, reduced)}>
          A group is people working alongside you. You’ll see each other’s sessions, and how your week stacks up.
        </p>

        <ul role="list" className="mt-5 flex flex-col" style={itemStyle(phase, 3, reduced)}>
          {groups.map((g) => {
            const on = joined.has(g.groupId);
            const full = !on && isGroupFull(g);
            return (
              <li key={g.groupId} className={cn("border-divider flex items-start gap-3 border-t py-3", full && "opacity-50")}>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-body text-[14px] leading-[1.25] font-semibold">{g.name}</span>
                  <span className="text-faint text-[11.5px] tabular-nums">
                    {memberCountLine(g)}
                    {!g.autoFriend && ` · ${GROUP_COPY.open}`}
                    {full && ` · ${GROUP_COPY.full}`}
                  </span>
                  {!full && (
                    <span className="text-caption pt-0.5 text-[12px] leading-[1.4] text-pretty">{joinCopy(g)}</span>
                  )}
                </div>
                <button
                  type="button"
                  disabled={full}
                  onClick={() => onToggle(g)}
                  className={cn(
                    TOGGLE,
                    on ? "border-brand bg-brand text-primary-foreground" : "border-control-border text-caption bg-card"
                  )}
                >
                  {on && <CheckIcon aria-hidden className="size-[11px]" strokeWidth={3.5} />}
                  {on ? GROUP_COPY.joined : full ? GROUP_COPY.full : GROUP_COPY.join}
                  <span className="sr-only"> {g.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
