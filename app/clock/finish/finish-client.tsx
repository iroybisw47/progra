"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CameraIcon, CheckIcon } from "lucide-react";

import { SessionPhotoStep } from "@/components/session-photo-step";
import { ToggleSwitch } from "@/components/v2/toggle-switch";
import { updateSession } from "@/app/actions/sessions";
import { formatDuration } from "@/lib/duration";
import type { Attribution } from "@/lib/session-attribution";
import { cn } from "@/lib/utils";

// Must match AFTER_TOLERANCE_MS in app/actions/session-photos.ts — after that
// window the server rejects an after photo, so we present the slot read-only.
const AFTER_TOLERANCE_MS = 10 * 60 * 1000;

type Props = {
  sessionId: string;
  label: string;
  description: string | null;
  attribution: Attribution;
  workedMs: number;
  endedAt: number;
  isPrivate: boolean;
  beforeUrl: string | null;
  afterUrl: string | null;
};

export function FinishClient({
  sessionId,
  label,
  description,
  attribution,
  workedMs,
  endedAt,
  isPrivate: initialPrivate,
  beforeUrl,
  afterUrl,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [priv, setPriv] = useState(initialPrivate);
  const [afterOpen, setAfterOpen] = useState(false);

  // An after photo only means "taken at clock-out", so it's addable only within
  // the upload window (seeded once so it doesn't flip mid-session).
  const [canAddAfter] = useState(
    () => Date.now() - endedAt < AFTER_TOLERANCE_MS
  );

  function handleSave() {
    startTransition(async () => {
      const r = await updateSession(sessionId, { isPrivate: priv });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(`Saved ${formatDuration(workedMs)}`);
      router.push("/");
      router.refresh();
    });
  }

  return (
    <div className="bg-card fixed inset-0 z-50 flex flex-col overflow-y-auto animate-[fade-up_.35s_cubic-bezier(.2,.8,.2,1)_both]">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-[18px] px-6 pb-[max(env(safe-area-inset-bottom),28px)] pt-[max(env(safe-area-inset-top),40px)]">
        {/* Confirmation */}
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="bg-brand/10 flex size-13 items-center justify-center rounded-full">
            <CheckIcon className="text-brand size-6" strokeWidth={3} />
          </span>
          <div>
            <div className="text-[22px] font-bold">Session complete</div>
            <div className="text-caption mt-1 text-sm">{label}</div>
            {description && (
              <p className="text-faint mx-auto mt-1 max-w-[280px] text-xs leading-relaxed">
                {description}
              </p>
            )}
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

        {/* Photos */}
        <div className="border-hairline flex flex-col gap-3 rounded-[18px] border p-4">
          <div className="text-[12.5px] font-bold">
            Photos <span className="text-faint font-semibold">· optional</span>
          </div>
          <div className="flex gap-2.5">
            <PhotoSlot kind="Before" url={beforeUrl} />
            {canAddAfter && !afterUrl ? (
              <button
                type="button"
                onClick={() => setAfterOpen(true)}
                className="border-hairline text-caption hover:border-brand/60 flex aspect-square flex-1 flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed transition-colors"
              >
                <CameraIcon className="size-5" />
                <span className="text-[11px] font-medium">Add after</span>
              </button>
            ) : (
              <PhotoSlot kind="After" url={afterUrl} />
            )}
          </div>
          <p className="text-faint text-[11.5px] leading-relaxed">
            {beforeUrl && afterUrl
              ? "A before + after pair shows up as a story on your profile."
              : "Add a before and after photo for a session to appear on your profile."}
          </p>
        </div>

        {/* Privacy */}
        <div className="border-hairline flex items-center gap-3 rounded-[18px] border px-4 py-3.5">
          <div className="flex-1">
            <div className="text-[13.5px] font-bold">Private session</div>
            <div className="text-faint mt-0.5 text-[11.5px]">
              Hidden from friends and your profile
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
          onClick={handleSave}
          disabled={pending}
          className="bg-brand w-full rounded-[18px] py-4 text-[15px] font-bold text-primary-foreground shadow-[0_10px_24px_rgba(28,58,94,.3)] active:scale-[.98] disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save session"}
        </button>
      </div>

      <SessionPhotoStep
        open={afterOpen}
        onOpenChange={setAfterOpen}
        sessionId={sessionId}
        kind="after"
        showProfileHint={beforeUrl != null}
        onComplete={() => router.refresh()}
      />
    </div>
  );
}

function PhotoSlot({ kind, url }: { kind: "Before" | "After"; url: string | null }) {
  if (url) {
    return (
      <div className="relative aspect-square flex-1 overflow-hidden rounded-[14px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={kind} className="size-full object-cover" />
        <span className="absolute bottom-1.5 left-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
          {kind} ✓
        </span>
      </div>
    );
  }
  return (
    <div className="border-hairline text-faint flex aspect-square flex-1 flex-col items-center justify-center gap-1.5 rounded-[14px] border">
      <CameraIcon className="size-5" />
      <span className="text-[11px]">No {kind.toLowerCase()}</span>
    </div>
  );
}
