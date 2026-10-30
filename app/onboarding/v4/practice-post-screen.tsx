"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, ImageIcon, XIcon } from "lucide-react";

import { themedColor } from "@/lib/colors";
import { itemStyle, type ItemPhase } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { initialsFor } from "@/lib/onboarding";
import { practiceName, type FirstGoal } from "@/lib/onboarding-v4";

import { CARD, UNDERLINE_INPUT } from "../onboarding-ui";

// Screen 06, "Show your work." (R:125-128): v2's practice post in the v3
// shell. The session just clocked, a photo, a line, and "Post to feed", which
// posts nothing and says so. The CTA is the shell's: "Post above to continue"
// until then, "Continue" after, which raises the UW question over this screen
// (UW on) or goes on to find your friends.
//
// The photo is a real pick from the device's library or camera (R:127), shown
// as a thumbnail from a local object URL. It never leaves the device: there
// is no upload, and the URL is revoked when it's replaced or the wizard goes.
export function PracticePostScreen({
  phase,
  reduced,
  eyebrow,
  name,
  username,
  sessionName,
  goal,
  posted,
  onPost,
}: {
  phase: ItemPhase;
  reduced: boolean;
  // "Step 6 of 8 · Practice" (lib/onboarding-v4.ts, stepEyebrow).
  eyebrow: string;
  // The welcome's name and handle, for the initials.
  name: string;
  username: string;
  // As the practice clock-in took it; "Practice" if it never ran.
  sessionName: string;
  goal: FirstGoal;
  posted: boolean;
  onPost: () => void;
}) {
  const [photo, setPhoto] = useState<{ url: string; name: string } | null>(null);
  const [caption, setCaption] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // The preview's object URL goes with it.
  useEffect(() => {
    if (!photo) return;
    return () => URL.revokeObjectURL(photo.url);
  }, [photo]);

  function pick(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    setPhoto({ url: URL.createObjectURL(file), name: file.name });
  }

  return (
    <div className="absolute inset-x-0 top-0 bottom-[108px] overflow-y-auto overscroll-contain px-6">
      <div className="mx-auto flex max-w-[420px] flex-col gap-[18px] pt-[18px] pb-6">
        <span className="section-label" style={itemStyle(phase, 0, reduced)}>
          {eyebrow}
        </span>
        <h2
          className="text-ink font-serif text-[30px] leading-[1.12] font-medium tracking-[-0.02em]"
          style={itemStyle(phase, 1, reduced)}
        >
          Show your work.
        </h2>
        <p
          className="text-secondary-ink text-[14px] leading-[1.6] text-pretty"
          style={itemStyle(phase, 2, reduced)}
        >
          Clock out, snap what you did, and post it to your friends.{" "}
          <strong className="text-body font-semibold">
            This one&apos;s practice, so don&apos;t worry - nothing gets posted.
          </strong>
        </p>

        <div className={`${CARD} flex flex-col gap-3 p-4`} style={itemStyle(phase, 3, reduced)}>
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="text-brand flex size-[34px] shrink-0 items-center justify-center rounded-full bg-[rgba(28,58,94,.1)] text-[12px] font-semibold"
            >
              {initialsFor(name, username)}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-body truncate text-[13px] font-semibold">
                {practiceName(sessionName)}
              </span>
              <span className="text-faint truncate text-[11px]">25m · {goal.title}</span>
            </div>
            <span
              aria-hidden
              className="size-[9px] shrink-0 rounded-[2px]"
              style={{ backgroundColor: themedColor(goal.color) }}
            />
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            tabIndex={-1}
            onChange={(e) => {
              pick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {photo ? (
            <div className="check-pop relative h-[76px] overflow-hidden rounded-[12px]">
              {/* eslint-disable-next-line @next/next/no-img-element -- a local blob preview */}
              <img src={photo.url} alt={`${photo.name} attached`} className="size-full object-cover" />
              {!posted && (
                <button
                  type="button"
                  aria-label="Remove photo"
                  onClick={() => setPhoto(null)}
                  className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-black/45 text-white"
                >
                  <XIcon className="size-3.5" strokeWidth={2.4} />
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              disabled={posted}
              onClick={() => fileRef.current?.click()}
              className="text-caption border-dash hover:border-brand bg-inset-2 flex h-[76px] w-full items-center justify-center gap-2 rounded-[12px] border-[1.5px] border-dashed text-[12.5px] font-semibold transition-colors"
            >
              <ImageIcon className="size-4" strokeWidth={2} />
              Add a photo
            </button>
          )}
          <input
            aria-label="Caption"
            className={cn(UNDERLINE_INPUT, "text-[14px] font-normal tracking-normal")}
            placeholder="Say something about it…"
            value={caption}
            readOnly={posted}
            maxLength={200}
            onChange={(e) => setCaption(e.target.value)}
          />
          {posted ? (
            <div className="check-pop flex items-center gap-2 pt-0.5" role="status">
              <CheckIcon className="text-done size-4" strokeWidth={2.4} />
              <span className="text-done text-[13px] font-semibold">
                Don&apos;t worry, nothing was posted.
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                (document.activeElement as HTMLElement | null)?.blur?.();
                onPost();
              }}
              className="bg-brand text-primary-foreground h-[46px] w-full rounded-[13px] text-[14px] font-semibold transition-transform active:scale-[.98]"
            >
              Post to feed
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
