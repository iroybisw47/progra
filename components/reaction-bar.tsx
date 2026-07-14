"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { toggleReaction } from "@/app/actions/reactions";
import { REACTION_EMOJIS } from "@/lib/social/reactions";
import type { ReactionSummary } from "@/lib/db/reactions";

// The fixed emoji palette under a feed item. Tap to react, tap again to remove.
// Your own reactions are highlighted; counts show when > 0. Refreshes the server
// component (which re-reads reactions) on success.
export function ReactionBar({
  sessionId,
  reactions,
}: {
  sessionId: string;
  reactions: ReactionSummary[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const byEmoji = new Map(reactions.map((r) => [r.emoji, r]));

  function toggle(emoji: string) {
    startTransition(async () => {
      const r = await toggleReaction(sessionId, emoji);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      router.refresh();
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
