"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckIcon } from "lucide-react";

import { ToggleSwitch } from "@/components/v2/toggle-switch";
import { updateSession } from "@/app/actions/sessions";
import { formatDuration } from "@/lib/duration";
import type { Attribution } from "@/lib/session-attribution";
import { cn } from "@/lib/utils";

type Props = {
  sessionId: string;
  label: string;
  description: string | null;
  attribution: Attribution;
  workedMs: number;
  isPrivate: boolean;
  photoUrl: string | null;
};

export function FinishClient({
  sessionId,
  label,
  description,
  attribution,
  workedMs,
  isPrivate: initialPrivate,
  photoUrl,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [priv, setPriv] = useState(initialPrivate);

  function handleSave() {
    startTransition(async () => {
      const r = await updateSession(sessionId, { isPrivate: priv });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(`Saved ${formatDuration(workedMs)}`);
      router.push("/");
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

        {/* Photo — read-only. Capture happens during the session, so there's
            nothing to add here; the block is omitted entirely when there's no
            photo rather than showing a slot you can't act on. */}
        {photoUrl && (
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
          onClick={handleSave}
          disabled={pending}
          className="bg-brand w-full rounded-[18px] py-4 text-[15px] font-bold text-primary-foreground shadow-[0_10px_24px_rgba(28,58,94,.3)] active:scale-[.98] disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save session"}
        </button>
      </div>
    </div>
  );
}
