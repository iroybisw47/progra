"use client";

import { CheckIcon, SettingsIcon } from "lucide-react";

import { AvatarInitials } from "@/components/avatar-initials";
import { NUDGE_PRESETS, NUDGE_PRESET_KEYS } from "@/lib/social/nudges";
import { matchReason, type UwPeer } from "@/lib/uw";
import { cn } from "@/lib/utils";

import { CARD, StepTemplate, rise } from "../onboarding-ui";

// The last step, in two versions.
//
// A UW student gets the REAL one: peers who share their major, clubs or goals,
// each addable then and there, with the invite share sheet underneath. Everyone
// else gets the practice nudge below — a mock profile laid out like the real
// one (the Nudge pill sits left of the settings gear, as on
// /profile/[username]), which sends nothing.
//
// `peers === null` is the discriminator: not a UW student, so there is no
// cohort to show. An empty ARRAY is a UW student with no matches yet, which is
// a different screen — we say so rather than padding the list with strangers.
export function FriendsStep({
  eyebrow,
  peers,
  added,
  onAdd,
  addPending,
  nudgeOpen,
  onOpenNudge,
  nudged,
  onNudge,
}: {
  eyebrow: string | null;
  peers: readonly UwPeer[] | null;
  added: readonly string[];
  onAdd: (userId: string) => void;
  addPending: string | null;
  nudgeOpen: boolean;
  onOpenNudge: () => void;
  // The chosen preset's copy, once one has been picked.
  nudged: string | null;
  onNudge: (message: string) => void;
}) {
  if (peers) {
    return (
      <UwPeersStep
        eyebrow={eyebrow}
        peers={peers}
        added={added}
        onAdd={onAdd}
        addPending={addPending}
      />
    );
  }
  return (
    <StepTemplate
      eyebrow={eyebrow}
      title="Hold your friends accountable."
      body="Your friends hold you accountable, and you hold them accountable. When a friend is falling behind, send them a nudge. Try it below."
    >
      <div className={`${CARD} flex flex-col gap-3 p-4`}>
        <span className="section-label">Practice on a profile</span>
        <div className="flex items-center gap-2.5">
          <span
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
            style={{ backgroundColor: "rgba(208,109,161,.14)", color: "var(--palette-10-ink)" }}
          >
            MP
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-body text-[14.5px] font-semibold">Maya</span>
            <span className="text-faint text-[11.5px]">@maya</span>
          </div>
          <button
            type="button"
            onClick={onOpenNudge}
            aria-disabled={nudged !== null || undefined}
            className={cn(
              "bg-brand text-primary-foreground h-8 shrink-0 rounded-full px-4 text-[12.5px] font-semibold transition-[transform,opacity] duration-200 active:scale-95",
              nudged !== null && "opacity-50"
            )}
          >
            {nudged !== null ? "Nudged" : "Nudge"}
          </button>
          <span
            aria-hidden
            className="border-hairline text-caption flex size-8 shrink-0 items-center justify-center rounded-full border-[1.5px]"
          >
            <SettingsIcon className="size-[15px]" strokeWidth={2} />
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-faint min-w-0 flex-1 truncate text-[11px]">
              Thesis writing · 2.5h of 8h this week
            </span>
            <span className="text-destructive text-[9.5px] font-bold tracking-[0.08em] whitespace-nowrap uppercase">
              Behind pace
            </span>
          </div>
          <div className="bg-track h-[7px] overflow-hidden rounded-full">
            <div className="h-full w-[31%] rounded-full" style={{ backgroundColor: "var(--cat-plum)" }} />
          </div>
        </div>

        {nudgeOpen && nudged === null && (
          <div
            className="flex flex-col gap-[7px]"
            style={{ animation: "rise .3s cubic-bezier(.22,1,.36,1) both", ...rise("0s") }}
          >
            <span className="section-label">Pick a message</span>
            {NUDGE_PRESET_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => onNudge(NUDGE_PRESETS[key])}
                className="border-control-border text-body hover:border-brand w-full rounded-[12px] border-[1.5px] bg-white px-3 py-2.5 text-left text-[13px] font-semibold transition-[transform,border-color] duration-150 active:scale-[.98]"
              >
                {NUDGE_PRESETS[key]}
              </button>
            ))}
          </div>
        )}

        {nudged !== null && (
          <div className="check-pop flex flex-col gap-[7px]">
            <span className="bg-brand text-primary-foreground max-w-[85%] self-end rounded-[16px_16px_4px_16px] px-3.5 py-2.5 text-[13.5px] leading-[1.4] font-medium">
              {nudged}
            </span>
            <span className="flex items-center gap-1.5 self-end">
              <CheckIcon className="size-[13px] text-success" strokeWidth={2.6} />
              <span className="text-xs font-semibold text-success">Nudge sent to Maya</span>
            </span>
          </div>
        )}
      </div>
    </StepTemplate>
  );
}

// The UW half. Rows are deliberately plain: a face, a name, the reason, and one
// button. The reason is words from matchReason(), never a score — "Same major ·
// 2 clubs in common" is something a student can act on; "92% match" isn't.
function UwPeersStep({
  eyebrow,
  peers,
  added,
  onAdd,
  addPending,
}: {
  eyebrow: string | null;
  peers: readonly UwPeer[];
  added: readonly string[];
  onAdd: (userId: string) => void;
  addPending: string | null;
}) {
  return (
    <StepTemplate
      eyebrow={eyebrow}
      title={peers.length > 0 ? "Students like you." : "You're early at UW."}
      body={
        peers.length > 0
          ? "These Huskies share your major, your clubs, or what you're working on. Add a few — you'll see each other's hours all week."
          : "Nobody at UW matches your major or clubs yet. Bring someone with you and you'll both have someone watching."
      }
    >
      {peers.length > 0 && (
        <div className={`${CARD} flex flex-col p-4`}>
          {peers.map((peer, i) => {
            const isAdded = added.includes(peer.userId);
            const name = peer.displayName?.trim() || `@${peer.username}`;
            return (
              <div
                key={peer.userId}
                className={cn(
                  "flex items-center gap-2.5 py-2.5",
                  i > 0 && "border-hairline border-t"
                )}
              >
                <AvatarInitials
                  name={peer.displayName}
                  username={peer.username}
                  avatarUrl={peer.avatarUrl}
                  className="size-11 shrink-0 text-sm font-semibold"
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-body truncate text-[14.5px] font-semibold">
                    {name}
                  </span>
                  <span className="text-brand truncate text-[11.5px] font-semibold">
                    {matchReason(peer)}
                  </span>
                  {peer.goalTitles.length > 0 && (
                    // These are the goals that MATCHED, not their newest —
                    // which is what makes this line the hook rather than
                    // trivia, and is why the count beside it can't describe
                    // anything hidden. See uw-cohort.sql STEP 4.
                    <span className="text-faint truncate text-[11px]">
                      Both on: {peer.goalTitles.join(" · ")}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => !isAdded && onAdd(peer.userId)}
                  disabled={addPending === peer.userId}
                  aria-disabled={isAdded || undefined}
                  className={cn(
                    "bg-brand text-primary-foreground h-8 shrink-0 rounded-full px-4 text-[12.5px] font-semibold transition-[transform,opacity] duration-200 active:scale-95 disabled:opacity-50",
                    isAdded && "opacity-50"
                  )}
                >
                  {isAdded ? "Added" : "Add"}
                </button>
              </div>
            );
          })}
        </div>
      )}
      <div className="border-hairline flex flex-col gap-1 border-t pt-3.5">
        <span className="section-label">Already know someone here?</span>
        <p className="text-caption text-[12px] leading-snug">
          Invite your own friends below — UW or not, they&apos;ll see your week
          the same way.
        </p>
      </div>
    </StepTemplate>
  );
}
