"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { toggleReaction } from "@/app/actions/reactions";
import { REACTION_EMOJIS } from "@/lib/social/reactions";
import type { ReactionSummary } from "@/lib/db/reactions";

// The fixed emoji palette under a feed item. Tap to react, tap again to remove.
// Your own reactions are highlighted; counts show when > 0. Toggles are
// optimistic (same pattern as kudos-button): the tap flips instantly, the
// action's revalidation delivers the reconciled counts, and an error reverts
// the optimistic layer with a toast.
export function ReactionBar({
  sessionId,
  reactions,
}: {
  sessionId: string;
  reactions: ReactionSummary[];
}) {
  const [pending, startTransition] = useTransition();
  const [optimisticReactions, applyToggle] = useOptimistic(
    reactions,
    (state: ReactionSummary[], emoji: string): ReactionSummary[] => {
      const existing = state.find((r) => r.emoji === emoji);
      if (!existing) {
        return [...state, { emoji, count: 1, mine: true }];
      }
      return state.map((r) =>
        r.emoji === emoji
          ? {
              ...r,
              mine: !r.mine,
              count: Math.max(0, r.count + (r.mine ? -1 : 1)),
            }
          : r
      );
    }
  );
  const byEmoji = new Map(optimisticReactions.map((r) => [r.emoji, r]));

  function toggle(emoji: string) {
    startTransition(async () => {
      applyToggle(emoji);
      const r = await toggleReaction(sessionId, emoji);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {REACTION_EMOJIS.map((emoji) => {
        const summary = byEmoji.get(emoji);
        const count = summary?.count ?? 0;
        const mine = summary?.mine ?? false;
        return (
          <button
            key={emoji}
            type="button"
            disabled={pending}
            aria-pressed={mine}
            aria-label={`React ${emoji}`}
            onClick={() => toggle(emoji)}
            className={cn(
              "flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm transition-colors disabled:opacity-50",
              mine
                ? "border-brand/60 bg-brand/10"
                : "border-border hover:bg-muted/50"
            )}
          >
            <span>{emoji}</span>
            {count > 0 && (
              <span className="text-muted-foreground text-xs tabular-nums">
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
