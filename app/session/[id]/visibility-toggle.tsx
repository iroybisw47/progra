"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { updateSession } from "@/app/actions/sessions";
import { cn } from "@/lib/utils";

// Private | Shared, as a two-segment rail — and the only way to publish a
// session that ended up private and stayed that way. Clocking out through the
// live timer saves the row draft-private (clockOut({ draft: true }), see
// app/actions/sessions.ts:232), so a dismissed /clock/finish leaves a session
// stranded on /me tagged "· private" with no exit but finding it again in
// /clock's day strip — and once it scrolls out of that strip, nothing.
//
// `is_private` IS the whole of visibility, so this is one boolean and no SQL:
// comments, reactions and the photo storage policy all read it through
// can_see_session / can_see_session_photo, and flipping it propagates everywhere.
// Rides updateSession as-is — already owner-scoped (.eq("user_id", user.id) plus
// a returned-row-count check) and already calls revalidateSessionSurfaces(), so
// the POST response re-renders this page and /me with no router.refresh().
//
// The track and chip metrics are the history scope toggle's, to the pixel
// (app/history/history-client.tsx ScopeChip + its rail). That toggle is itself a
// hand-rolled copy of components/v2/period-chips.tsx rather than an import — the
// constants there are scoped to the Today/Week/History switcher they document, so
// a third segmented control follows the second's lead and keeps its own chip.
//
// Optimistic: the lit segment moves on tap and the revalidation reconciles —
// which is also what swaps the kudos heart in beside it. No confirm dialog,
// because the choice is reversible by the next tap and publishing is SILENT:
// pushes fire only from reactions/comments, and the feed is a 7-day window
// ordered by ended_at, so an old session neither notifies anyone nor jumps to the
// top of anything.
const SEG =
  "rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.06em] uppercase transition-colors";
const SEG_ON = "bg-brand text-primary-foreground";
const SEG_OFF = "text-faint hover:text-body";

export function VisibilityToggle({
  sessionId,
  isPrivate,
  hasPhoto,
}: {
  sessionId: string;
  isPrivate: boolean;
  // Named in the success toast only. Publishing a session that already carries a
  // photo makes the photo friend-visible too (can_see_session_photo requires NOT
  // is_private), which is the one consequence a two-word rail can't show. Same
  // wording the finish screen uses for the same fact, so it reads as a repeat
  // rather than news.
  hasPhoto: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [optimisticPrivate, setPrivate] = useOptimistic(
    isPrivate,
    (_state, next: boolean) => next
  );

  function choose(next: boolean) {
    // Tapping the lit segment is a no-op, not a round-trip. A segmented control
    // states the current value, so re-picking it is how people confirm what they
    // are looking at.
    if (next === optimisticPrivate) return;
    startTransition(async () => {
      setPrivate(next);
      const r = await updateSession(sessionId, { isPrivate: next });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(
        next
          ? "Back to private — only you can see this"
          : hasPhoto
            ? "Shared with friends, photo included"
            : "Shared with friends"
      );
    });
  }

  return (
    <div
      role="group"
      aria-label="Who can see this session"
      className="bg-track flex gap-0.5 rounded-full p-[3px]"
    >
      <button
        type="button"
        onClick={() => choose(true)}
        disabled={pending}
        aria-pressed={optimisticPrivate}
        className={cn(SEG, optimisticPrivate ? SEG_ON : SEG_OFF)}
      >
        Private
      </button>
      <button
        type="button"
        onClick={() => choose(false)}
        disabled={pending}
        aria-pressed={!optimisticPrivate}
        className={cn(SEG, optimisticPrivate ? SEG_OFF : SEG_ON)}
      >
        Shared
      </button>
    </div>
  );
}
