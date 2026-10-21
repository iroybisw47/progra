"use client";

import { ChevronLeftIcon, XIcon } from "lucide-react";

import { AvatarInitials } from "@/components/avatar-initials";
import { SCREEN, SCREEN_COUNT } from "@/lib/onboarding-v3";
import { EASING, HANDOFF_FADE, TOP_ROW_IN, TRAVEL, transition } from "@/lib/motion";

import { CLOSE_SLOT, PROGRESS_TRACK, V3_TOP_ROW } from "./frame";

// The wizard's top row (R:35-37): Back, the progress bar, and the 28px avatar
// on Screens 2-6. There is no "Step x of y" text.
//
// Screen 1 is v2's welcome screen since OWNER-FIX-3, which had none of them,
// so on it all three are hidden. They keep their places in the row, so the
// welcome sits where it does in v2, under a header's worth of room. From
// Screen 2 they fade in: Back fades in over 260ms and scales up over 460ms on
// E, and the progress bar and the avatar fade in on Back's opacity timing
// (TOP_ROW_IN). Under reduced motion they only fade. The avatar no longer
// travels from a slot on Screen 1: the welcome's photo is its own picker, and
// this is just the result, the photo or the initials, shown small.
//
// The progress bar fills to scaleX((at + 1) / of) over 760ms on E (R:36),
// or 200ms linear under reduced motion (TRAVEL.progress). `at` and `of` are
// the screen and the count as this run has them (progressFor): seven with
// the notifications screen last, six where it isn't shown.
//
// Back and the ✕ are drawn at 32px (R:35) and each carries an invisible
// 6px margin of hit area (`before:`), so the target is 44px.
//
// `onClose` is the replay-only exit (plan D6): a quiet ✕ at the end of the
// row, on every screen, the welcome included. Screen 2 needs a goal, so
// without it a replayer could only leave by creating one. First-run users
// never get it. The avatar moves left to make room.
//
// `leaving` is the last screen handing off to the Clock tab (plan P7, R:152): the
// whole row fades out, opacity only (HANDOFF_FADE), and stops taking taps.

// 32px + 6px each side.
const HIT_44 = "relative before:absolute before:-inset-1.5 before:content-['']";

export function WizardChrome({
  screen,
  welcome = screen === SCREEN.identity,
  reduced,
  onBack,
  onClose,
  avatar,
  leaving = false,
  progress = { at: screen, of: SCREEN_COUNT },
}: {
  screen: number;
  // The welcome form is in front: no top row but a replayer's ✕. Screen 1
  // unless the UW page is in front there (OWNER-FIX-4), which has the row.
  welcome?: boolean;
  reduced: boolean;
  onBack: () => void;
  onClose?: () => void;
  // Who the welcome saved: the initials' name and the handle their color is
  // keyed on, and the photo if there is one.
  avatar: { name: string; colorKey: string; photoUrl: string | null };
  leaving?: boolean;
  progress?: { at: number; of: number };
}) {
  const step = Math.min(progress.at + 1, progress.of);
  const fill = (step / progress.of).toFixed(4);
  const backMotion = reduced
    ? "opacity 200ms linear"
    : `opacity 260ms ${EASING.E}, transform 460ms ${EASING.E}`;
  const rowIn = transition(reduced ? TOP_ROW_IN.reduced : TOP_ROW_IN.normal);

  return (
    <div
      className={V3_TOP_ROW}
      style={
        leaving
          ? {
              opacity: 0,
              pointerEvents: "none",
              transition: transition(reduced ? HANDOFF_FADE.reduced : HANDOFF_FADE.normal),
            }
          : undefined
      }
    >
      <button
        type="button"
        aria-label="Back"
        onClick={onBack}
        disabled={welcome}
        aria-hidden={welcome || undefined}
        className={`border-hairline text-caption hover:border-brand flex size-8 shrink-0 items-center justify-center rounded-[11px] border-[1.5px] bg-white ${HIT_44}`}
        style={{
          opacity: welcome ? 0 : 1,
          transform: welcome && !reduced ? "scale(0.6)" : "none",
          transition: `${backMotion}, border-color 150ms ease`,
          pointerEvents: welcome ? "none" : "auto",
        }}
      >
        <ChevronLeftIcon className="size-[15px]" strokeWidth={2} />
      </button>

      <div
        role="progressbar"
        aria-label="Onboarding progress"
        aria-valuemin={1}
        aria-valuemax={progress.of}
        aria-valuenow={step}
        aria-valuetext={`Step ${step} of ${progress.of}`}
        aria-hidden={welcome || undefined}
        className={PROGRESS_TRACK}
        style={{ opacity: welcome ? 0 : 1, transition: rowIn }}
      >
        <div
          className="bg-brand h-full w-full origin-left rounded-full"
          style={{
            transform: `scaleX(${fill})`,
            transition: transition(reduced ? TRAVEL.progress.reduced : TRAVEL.progress.normal),
          }}
        />
      </div>

      {/* The avatar: decoration (AvatarInitials hides itself from assistive
          tech), the welcome's photo or initials. */}
      <span
        className="size-7 shrink-0"
        style={{ opacity: welcome ? 0 : 1, transition: rowIn }}
      >
        <AvatarInitials
          name={avatar.name.trim() || null}
          username={avatar.colorKey}
          avatarUrl={avatar.photoUrl}
          className="size-7 text-[11px]"
        />
      </span>

      {onClose && (
        <button
          type="button"
          aria-label="Close and go back to Progra"
          onClick={onClose}
          className={`text-caption hover:text-ink flex items-center justify-center rounded-full transition-colors ${CLOSE_SLOT} ${HIT_44}`}
        >
          <XIcon className="size-4" strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
