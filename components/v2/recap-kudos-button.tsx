"use client";

import { useOptimistic, useTransition } from "react";
import { HeartIcon } from "lucide-react";
import { toast } from "sonner";

import { toggleRecapKudos } from "@/app/actions/recap-social";
import { cn } from "@/lib/utils";

// Kudos heart for a recap post — the recap analogue of KudosButton. Optimistic
// fill + count; the toggle_recap_reaction RPC + revalidation reconcile.
export function RecapKudosButton({
  recapId,
  count,
  likedByMe,
}: {
  recapId: string;
  count: number;
  likedByMe: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setLiked] = useOptimistic(
    { count, liked: likedByMe },
    (_state, liked: boolean) => ({
      liked,
      count: count + (liked ? 1 : 0) - (likedByMe ? 1 : 0),
    })
  );

  function toggle() {
    const next = !optimistic.liked;
    startTransition(async () => {
      setLiked(next);
      const r = await toggleRecapKudos(recapId);
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
        "flex items-center gap-1.5 text-xs font-medium transition-colors active:scale-90 disabled:opacity-60",
        optimistic.liked ? "text-brand" : "text-caption hover:text-body"
      )}
    >
      <HeartIcon className={cn("size-4", optimistic.liked && "fill-current")} />
      {optimistic.count > 0 && (
        <span className="tabular-nums">{optimistic.count}</span>
      )}
    </button>
  );
}
