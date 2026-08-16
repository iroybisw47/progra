"use client";

import { useOptimistic, useTransition } from "react";
import { HeartIcon } from "lucide-react";
import { toast } from "sonner";

import { toggleReaction } from "@/app/actions/reactions";
import { LIKE_EMOJI } from "@/lib/social/reactions";
import { cn } from "@/lib/utils";

// The feed's single "kudos" heart. Under the hood it toggles the LIKE_EMOJI
// reaction (an existing palette member), so it rides the same toggle_reaction
// RPC with no schema change. Optimistic so the fill + count respond instantly;
// the server round-trip + refresh reconciles.
export function KudosButton({
  sessionId,
  count,
  likedByMe,
}: {
  sessionId: string;
  count: number;
  likedByMe: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setLiked] = useOptimistic(
    { count, liked: likedByMe },
    (_state, liked: boolean) => ({
      liked,
      // `count` already includes the viewer's own like when likedByMe, so shift
      // relative to that baseline.
      count: count + (liked ? 1 : 0) - (likedByMe ? 1 : 0),
    })
  );

  function toggle() {
    const next = !optimistic.liked;
    startTransition(async () => {
      setLiked(next);
      const r = await toggleReaction(sessionId, LIKE_EMOJI);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={optimistic.liked}
      aria-label={optimistic.liked ? "Remove kudos" : "Give kudos"}
      className={cn(
        "flex items-center gap-1 rounded-full px-2 py-[3px] text-[11px] font-semibold tabular-nums transition-transform active:scale-90 disabled:opacity-60",
        optimistic.liked ? "text-brand" : "text-disabled hover:text-brand"
      )}
    >
      <HeartIcon
        className={cn("size-[13px]", optimistic.liked && "fill-current")}
      />
      {optimistic.count > 0 && optimistic.count}
    </button>
  );
}
