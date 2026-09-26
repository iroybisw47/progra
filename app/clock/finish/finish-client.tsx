"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CameraIcon, CheckIcon, ChevronDownIcon } from "lucide-react";

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
import type { FocusRating, PhoneLevel } from "@/lib/john/instrumentation";
import type { Attribution } from "@/lib/session-attribution";
import { cn } from "@/lib/utils";

// Lazy chunk — cohort-only, so the other ~50 users never download it.
const SessionDebriefCard = dynamic(
  () =>
    import("@/components/john/session-debrief-card").then(
      (m) => m.SessionDebriefCard
    ),
  { ssr: false }
);

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
  // John cohort (two users). Adds the debrief card and requires the two
  // one-taps before Post. Everyone else renders exactly what they always have.
  john: boolean;
  // What they typed at clock-in, echoed in the card. Null when John is off, or
  // when they clocked in without saying.
  intention: string | null;
};

export function FinishClient({
  sessionId,
  label,
  initialNotes,
  attribution,
  workedMs,
  photoUrl,
  autoEnded,
  john,
  intention,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // The session arrives draft-private (held back from friends until Post), so
  // the toggle deliberately doesn't seed from the DB — default is to post.
  //
  // An auto-ended session is the exception: it counts as 0 hours everywhere, so
  // there is nothing to share, and the row below renders disabled.
  const [priv, setPriv] = useState(autoEnded);
  const [notes, setNotes] = useState(initialNotes);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // John debrief. An auto-ended session gets no card at all — it is worth 0
  // hours and nobody was present, so "how focused were you?" asks about
  // something that didn't happen. Same reasoning as the disabled privacy row.
  const debrief = john && !autoEnded;
  const [outcome, setOutcome] = useState("");
  const [focus, setFocus] = useState<FocusRating | null>(null);
  const [phone, setPhone] = useState<PhoneLevel | null>(null);
  // The two one-taps are required; the two typed fields are not. Requiring a
  // tap AFTER the work is done costs ~2s and cannot discourage the work itself,
  // which is exactly what requiring something at clock-in would do.
  const debriefMissing = debrief && (focus === null || phone === null);

  function handlePost() {
    startTransition(async () => {
      const r = await updateSession(sessionId, {
        isPrivate: priv,
        description: notes,
        ...(debrief
          ? { outcome, focusRating: focus, phoneDistraction: phone }
          : {}),
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

  // Leaving without posting is a real outcome, not an escape hatch: the
  // session is already saved, just private (see the comment in page.tsx). Until
  // now there was no way to take it — this screen is `fixed inset-0` over the
  // nav, so Post and Delete were the only exits, and someone who didn't want to
  // share had to delete work they'd actually done.
  //
  // Deliberately does NOT markAutoEndReviewed: an auto-ended session that was
  // dismissed rather than reviewed should keep its nudge on Progress.
  function handleDismiss() {
    const leave = () => {
      toast.success(
        `Saved ${formatDuration(workedMs)} privately — post it later by editing the session`
      );
      router.push("/");
    };

    // John: leaving via the chevron is a legitimate exit, but it used to write
    // nothing — which for a cohort user who filled the card in means silently
    // throwing their answers away. Save them first, WITHOUT an isPrivate key so
    // the row keeps its draft-private state and Post stays the thing that
    // publishes.
    //
    // NOTE the asymmetry: notes typed and then dismissed are still lost, as
    // they always have been. Changing that is a separate product decision, not
    // this test's to make.
    const filled =
      debrief && (outcome.trim() !== "" || focus !== null || phone !== null);
    if (!filled) {
      leave();
      return;
    }

    startTransition(async () => {
      const r = await updateSession(sessionId, {
        outcome,
        focusRating: focus,
        phoneDistraction: phone,
      });
      // Stay put on failure rather than navigating away from unsaved answers —
      // being briefly stuck beats losing what they typed.
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      leave();
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
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-6 pb-[max(env(safe-area-inset-bottom),28px)] pt-[max(env(safe-area-inset-top),40px)]">
        {/* Dismiss sits in the same row as the check, so the badge reads as the
            screen's mark rather than the first item in a stack. Chevron-down
            rather than back: this is a sheet over the app, the same gesture the
            live timer's minimize uses. */}
        <header className="relative flex items-center">
          <button
            type="button"
            aria-label="Close without posting"
            disabled={pending}
            onClick={handleDismiss}
            className="border-hairline text-caption hover:border-brand flex size-9 shrink-0 items-center justify-center rounded-[13px] border-[1.5px] disabled:opacity-50"
          >
            <ChevronDownIcon className="size-4" strokeWidth={2} />
          </button>
          <span className="bg-brand/10 absolute left-1/2 flex size-[52px] -translate-x-1/2 items-center justify-center rounded-full">
            <CheckIcon className="text-brand size-6" strokeWidth={3} />
          </span>
        </header>

        {/* Confirmation */}
        <div className="flex flex-col items-center gap-2 pt-1 text-center">
          <div className="text-[30px] font-bold leading-tight tracking-[-0.02em]">
            Session complete
          </div>
          <div className="text-caption text-[17px]">{label}</div>
          <div className="pt-1 text-[52px] font-bold leading-none tabular-nums tracking-[-0.03em]">
            {formatDuration(workedMs)}
          </div>
          <span
            className={cn(
              "mt-2 rounded-full px-4 py-2 text-[15px] font-bold",
              attribution.isGoal ? "bg-brand/10 text-brand" : "bg-track text-body"
            )}
          >
            {attribution.isGoal ? `Goal · ${attribution.text}` : attribution.text}
          </span>
        </div>

        {debrief && (
          <SessionDebriefCard
            intention={intention}
            outcome={outcome}
            onOutcomeChange={setOutcome}
            focus={focus}
            onFocusChange={setFocus}
            phone={phone}
            onPhoneChange={setPhone}
            disabled={pending}
          />
        )}

        {/* 10-hour cap notice. The duration here wasn't the user's choice, so
            say so plainly and point at the only real correction: the finish
            screen can't edit times, so a wrong session is deleted and re-added. */}
        {autoEnded && (
          <div className="border-hairline flex flex-col gap-2 rounded-[22px] border p-5">
            <span className="text-[15px] font-bold">
              Clocked out automatically at 10 hours
            </span>
            <p className="text-caption text-[15px] leading-relaxed">
              This session hit Progra&apos;s 10-hour limit, so we stopped it and
              saved it privately. Because the limit means a clock-out was missed,
              it counts as <strong className="text-ink font-bold">0 hours</strong>{" "}
              — it won&apos;t affect your goals, recap or the leaderboard. To get
              the time back, delete this and add a past session with the real
              hours.
            </p>
          </div>
        )}

        {/* Notes and photo share one card: they're the two things you attach to
            the session, and the header says who will see them. That label is
            the only place the screen states its OWN consequence — the row is
            already private, and Post is what publishes it. */}
        <div className="border-hairline flex flex-col gap-3 rounded-[22px] border p-5">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="finish-notes" className="text-[15px] font-bold">
              Notes
            </label>
            <span className="text-caption text-[15px]">
              {priv ? "Only you" : "Shared with friends"}
            </span>
          </div>
          <Textarea
            id="finish-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="How did it go?"
            rows={3}
            maxLength={1000}
            disabled={pending}
            className="bg-inset rounded-[16px] text-[15px]"
          />

          {photoUrl ? (
            <div className="aspect-square w-full overflow-hidden rounded-[16px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl}
                alt="Session photo"
                loading="lazy"
                decoding="async"
                className="size-full object-cover"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setPhotoOpen(true)}
              disabled={pending}
              className="border-control-border text-brand flex items-center gap-3 rounded-[16px] border-[1.5px] border-dashed px-3 py-2.5 text-[15px] font-bold active:scale-[.99] disabled:opacity-50"
            >
              <span className="bg-inset flex size-9 shrink-0 items-center justify-center rounded-[11px]">
                <CameraIcon className="size-4" strokeWidth={2} />
              </span>
              Add photo
            </button>
          )}
        </div>

        {/* Privacy. Disabled when the cap ended the session: it's worth 0 hours,
            so there is nothing to share and the choice would be a lie. */}
        <div
          className={cn(
            "border-hairline flex items-center gap-3 rounded-[22px] border px-5 py-4",
            autoEnded && "opacity-55"
          )}
        >
          <div className="flex-1">
            <div className="text-[15px] font-bold">Private session</div>
            <div className="text-caption mt-0.5 text-[13px]">
              Hidden from friends and your profile{photoUrl ? ", photo included" : ""}
            </div>
          </div>
          <ToggleSwitch
            ariaLabel="Private session"
            checked={priv}
            disabled={autoEnded || pending}
            onCheckedChange={setPriv}
          />
        </div>

        <div className="flex-1" />

        <button
          type="button"
          onClick={handlePost}
          disabled={pending || debriefMissing}
          className="bg-brand w-full rounded-[24px] py-[18px] text-[17px] font-bold text-primary-foreground shadow-[0_10px_24px_rgba(28,58,94,.3)] active:scale-[.98] disabled:opacity-60"
        >
          {pending ? "Saving…" : priv ? "Save privately" : "Post"}
        </button>

        {/* Say why the button is dim. A disabled control with no explanation
            reads as a bug, and the escapes below still work regardless. */}
        {debriefMissing && !pending && (
          <p className="text-caption -mt-2 text-center text-[13px]">
            Pick a focus and a phone answer to post
          </p>
        )}

        {/* Muted, not destructive red: deleting here is an ordinary way out of
            a mistyped session, not an alarm. The confirm dialog carries the
            weight. */}
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          disabled={pending}
          className="text-caption mx-auto px-3 py-1 text-[15px] font-medium disabled:opacity-60"
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
