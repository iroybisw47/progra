"use client";

import { useOptimistic, useTransition } from "react";
import { HeartIcon } from "lucide-react";
import { toast } from "sonner";

import { toggleHabitKudos } from "@/app/actions/habit-social";
import { cn } from "@/lib/utils";

// Kudos heart for a habit check-off — the habit analogue of RecapKudosButton.
// Optimistic fill + count; the toggle_habit_reaction RPC + revalidation
// reconcile. Rendered at size-3.5 rather than size-4 to sit inside the compact
// card without stretching its single line.
export function HabitKudosButton({
  completionId,
  count,
  likedByMe,
}: {
  completionId: string;
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
      const r = await toggleHabitKudos(completionId);
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
        "flex shrink-0 items-center gap-1 text-xs font-medium transition-colors active:scale-90 disabled:opacity-60",
        optimistic.liked ? "text-brand" : "text-caption hover:text-body"
      )}
    >
      <HeartIcon
        className={cn("size-3.5", optimistic.liked && "fill-current")}
      />
      {optimistic.count > 0 && (
        <span className="tabular-nums">{optimistic.count}</span>
      )}
    </button>
  );
}
