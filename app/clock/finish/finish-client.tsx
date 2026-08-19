"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CameraIcon, CheckIcon, TimerOffIcon } from "lucide-react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ToggleSwitch } from "@/components/v2/toggle-switch";
import {
  deleteSession,
  markAutoEndReviewed,
  updateSession,
} from "@/app/actions/sessions";
import { formatDuration } from "@/lib/duration";
import type { Attribution } from "@/lib/session-attribution";
import { cn } from "@/lib/utils";

// Lazy chunk — the photo step only matters after a click.
const SessionPhotoStep = dynamic(
  () =>
    import("@/components/session-photo-step").then((m) => m.SessionPhotoStep),
  { ssr: false }
);

type Props = {
  sessionId: string;
  label: string;
  initialNotes: string;
  attribution: Attribution;
  workedMs: number;
  photoUrl: string | null;
  // True when the 10-hour cap ended this session rather than the user. Adds a
  // banner explaining the duration wasn't their choice, and marks the review
  // done on Post/Delete so the Progress nudge clears.
  autoEnded: boolean;
};

export function FinishClient({
  sessionId,
  label,
  initialNotes,
  attribution,
  workedMs,
  photoUrl,
  autoEnded,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // The session arrives draft-private (held back from friends until Post), so
  // the toggle deliberately doesn't seed from the DB — default is to post.
  const [priv, setPriv] = useState(false);
  const [notes, setNotes] = useState(initialNotes);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handlePost() {
    startTransition(async () => {
      const r = await updateSession(sessionId, {
        isPrivate: priv,
        description: notes,
      });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      // Best-effort, like RecapNudge: the session is posted either way; a failed
      // stamp just means the nudge returns on the next load.
      if (autoEnded) await markAutoEndReviewed(sessionId);
      toast.success(
        priv
          ? `Saved ${formatDuration(workedMs)} privately`
          : `Posted ${formatDuration(workedMs)}`
      );
      router.push("/");
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const r = await deleteSession(sessionId);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success("Session deleted");
      router.push("/clock");
    });
  }

  return (
    <div className="bg-card fixed inset-0 z-50 flex flex-col overflow-y-auto overscroll-contain animate-[fade-up_.35s_cubic-bezier(.2,.8,.2,1)_both]">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-[18px] px-6 pb-[max(env(safe-area-inset-bottom),28px)] pt-[max(env(safe-area-inset-top),40px)]">
        {/* Confirmation */}
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="bg-brand/10 flex size-13 items-center justify-center rounded-full">
            <CheckIcon className="text-brand size-6" strokeWidth={3} />
          </span>
          <div>
            <div className="text-[22px] font-bold">Session complete</div>
            <div className="text-caption mt-1 text-sm">{label}</div>
          </div>
          <div className="font-mono text-[42px] font-bold tabular-nums tracking-[-0.02em]">
            {formatDuration(workedMs)}
          </div>
          <span
            className={cn(
              "rounded-full px-3 py-[5px] text-[11.5px] font-bold",
              attribution.isGoal ? "bg-brand/10 text-brand" : "bg-track text-body"
            )}
          >
            {attribution.isGoal ? `Goal · ${attribution.text}` : attribution.text}
          </span>
        </div>

        {/* 10-hour cap notice. The duration here wasn't the user's choice, so
            say so plainly and point at the only real correction: the finish
            screen can't edit times, so a wrong session is deleted and re-added. */}
        {autoEnded && (
          <div className="border-hairline flex flex-col gap-1.5 rounded-[18px] border p-4">
            <div className="flex items-center gap-2">
              <TimerOffIcon className="text-caption size-4 shrink-0" />
              <span className="text-[12.5px] font-bold">
                Clocked out automatically at 10 hours
              </span>
            </div>
            <p className="text-caption text-[12.5px] leading-snug">
              This session hit Progra&apos;s 10-hour limit, so we stopped it and
              saved it privately. Because the limit means a clock-out was missed,
              it counts as <strong className="font-bold">0 hours</strong> — it
              won&apos;t affect your goals, recap or the leaderboard. To get the
              time back, delete this and add a past session with the real hours.
            </p>
          </div>
        )}

        {/* Notes — still editable here; posted with the session. */}
        <div className="border-hairline flex flex-col gap-3 rounded-[18px] border p-4">
          <div className="text-[12.5px] font-bold">Notes</div>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="How did it go?"
            rows={4}
            maxLength={1000}
            disabled={pending}
          />
        </div>

        {/* Photo — read-only once attached (one photo per session); otherwise a
            photo can still be added here, safely: the session is draft-private,
            so nothing is friend-visible until Post. */}
        {photoUrl ? (
          <div className="border-hairline flex flex-col gap-3 rounded-[18px] border p-4">
            <div className="text-[12.5px] font-bold">Photo</div>
            <div className="aspect-square w-full overflow-hidden rounded-[14px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl}
                alt="Session photo"
                loading="lazy"
                decoding="async"
                className="size-full object-cover"
              />
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPhotoOpen(true)}
            disabled={pending}
            className="border-hairline text-caption hover:text-ink flex items-center justify-center gap-2 rounded-[18px] border px-4 py-3.5 text-[13.5px] font-bold active:scale-[.98]"
          >
            <CameraIcon className="size-4" />
            Add photo
          </button>
        )}

        {/* Privacy */}
        <div className="border-hairline flex items-center gap-3 rounded-[18px] border px-4 py-3.5">
          <div className="flex-1">
            <div className="text-[13.5px] font-bold">Private session</div>
            <div className="text-faint mt-0.5 text-[11.5px]">
              Hidden from friends and your profile{photoUrl ? ", photo included" : ""}
            </div>
          </div>
          <ToggleSwitch
            ariaLabel="Private session"
            checked={priv}
            onCheckedChange={setPriv}
          />
        </div>

        <div className="flex-1" />

        <button
          type="button"
          onClick={handlePost}
          disabled={pending}
          className="bg-brand w-full rounded-[18px] py-4 text-[15px] font-bold text-primary-foreground shadow-[0_10px_24px_rgba(28,58,94,.3)] active:scale-[.98] disabled:opacity-60"
        >
          {pending ? "Saving…" : priv ? "Save privately" : "Post"}
        </button>

        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          disabled={pending}
          className="text-destructive mx-auto -mt-1 px-3 py-1 text-xs font-medium disabled:opacity-60"
        >
          Delete session
        </button>
      </div>

      <SessionPhotoStep
        open={photoOpen}
        onOpenChange={setPhotoOpen}
        sessionId={sessionId}
        // Re-fetch the server-signed photo URL after an upload (a skip just
        // refreshes redundantly — harmless).
        onComplete={() => router.refresh()}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this session?</AlertDialogTitle>
            <AlertDialogDescription>
              The tracked time{photoUrl ? " and photo" : ""} will be removed.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={pending}
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
