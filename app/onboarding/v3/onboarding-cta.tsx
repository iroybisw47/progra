"use client";

import Link from "next/link";
import { useImperativeHandle, useLayoutEffect, useRef, type Ref } from "react";

import { PrimaryButton, primaryButtonClass } from "@/components/v2/primary-button";
import { useKeyboardInset } from "@/lib/hooks";
import { TRAVEL, motion, play, transition } from "@/lib/motion";
import { cn } from "@/lib/utils";

import { CTA_REST_BOTTOM, KEYBOARD_LIFT as LIFT } from "./frame";

// What the CTA shows for the screen in front. The primary is the navy
// PrimaryButton; the secondary is the outlined "Skip for now" (R:38). Null
// hides it.
//
// `href` makes the primary a <Link> to it, drawn the same (Screen 6's "Start
// session", plan D7). Its navigation is cancelled (onNavigate's
// preventDefault) and `onPress` runs instead, so the screen's exit can play
// before it goes. `prefetch` turns on its full prefetch (prefetch={true}):
// mounted in view, it fetches the page in production, data and all, so it's
// already here when the handoff navigates. Without it it's prefetch={false},
// which fetches nothing at all. Screen 6's is on from the start, since the
// screen writes nothing that would purge it. Flipping the prop would keep the
// same <a>, where swapping a button for a link would drop the focus of
// whoever is on it.
export type CtaSpec = {
  label: string;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  busy?: boolean;
  href?: string;
  prefetch?: boolean;
  onPress: () => void;
} | null;

// The one CTA every screen shares (R:38): 52px tall, full width inside the
// 20px gutters, its bottom at CTA_REST_BOTTOM. It rides above the keyboard by
// `transform` alone, on the KB easing (plan §6), so nothing reflows while the
// keyboard opens. Primary and secondary are stacked and crossfade over 180ms
// linear, the inactive one out of the tab order.
//
// pointerdown is prevented on the whole thing so pressing Continue doesn't
// first blur the focused field and drop the keyboard (P:486, plan §6). The
// click still fires. Whether iOS honours that in the WebView is a P0 device
// question.
//
// Busy (a save in flight) is aria-disabled with the press ignored, not the
// `disabled` attribute: disabling the focused button would drop a keyboard
// user's focus to the page in Safari and Chrome.
//
// `pulseRing()` flashes a 2px --brand ring out from it once (R:143,
// MOTION.firstAddRing): Screen 5 calls it on the first person added, as the
// CTA turns primary. Imperative, like the pill toast, because it's a moment
// rather than a state. The ring sits under both buttons and rests invisible.
// Under reduced motion it doesn't play (motion() gives null; play() skips).
export type OnboardingCtaHandle = { pulseRing: () => void };

// The outlined secondary ("Skip for now", R:38), which the UW sheet's own CTA
// draws too (uw-sheet.tsx).
export const SECONDARY_CTA =
  "border-control-border text-body h-[52px] w-full rounded-[15px] border-[1.5px] bg-white text-base font-semibold transition-transform active:scale-[.98]";

export function OnboardingCta({
  ref,
  spec,
  reduced,
}: {
  ref?: Ref<OnboardingCtaHandle>;
  spec: CtaSpec;
  reduced: boolean;
}) {
  const ringRef = useRef<HTMLSpanElement>(null);
  useImperativeHandle(
    ref,
    () => ({
      pulseRing: () => {
        play(ringRef.current, motion("firstAddRing", reduced));
      },
    }),
    [reduced]
  );
  const shown = spec !== null;
  const secondary = spec?.variant === "secondary";
  const disabled = !spec || spec.disabled;
  const busy = spec?.busy === true;
  const press = () => {
    if (!busy) spec?.onPress();
  };
  const fade = "opacity 180ms linear";
  // Hiding (a null spec) slides it down 28px, except under reduced motion,
  // where nothing travels (R:54) and it only fades.
  const hidden = reduced ? LIFT : `${LIFT} translateY(28px)`;
  return (
    <div
      // Lets the shell tell when the CTA has the focus (onboarding-client-v3.tsx).
      data-onboarding-cta=""
      className="absolute inset-x-5 z-10 h-[52px]"
      onPointerDown={(e) => e.preventDefault()}
      style={{
        bottom: CTA_REST_BOTTOM,
        transform: shown ? LIFT : hidden,
        opacity: shown ? 1 : 0,
        pointerEvents: shown ? "auto" : "none",
        transition: `${transition(reduced ? TRAVEL.keyboard.reduced : TRAVEL.keyboard.normal)}, opacity 200ms linear`,
      }}
    >
      <span
        ref={ringRef}
        aria-hidden
        className="border-brand pointer-events-none absolute inset-0 rounded-[15px] border-2 opacity-0"
      />
      <div
        className="absolute inset-0"
        style={{ opacity: shown && !secondary ? 1 : 0, transition: fade }}
        aria-hidden={secondary || !shown || undefined}
      >
        {spec?.href && !secondary && !disabled && !busy ? (
          // Default navigation only: a modified click (a new tab) skips
          // onNavigate and opens the page as an ordinary link.
          <Link
            href={spec.href}
            prefetch={spec.prefetch === true}
            tabIndex={shown ? undefined : -1}
            onNavigate={(e) => {
              e.preventDefault();
              press();
            }}
            className={primaryButtonClass("screen")}
          >
            {spec.label}
          </Link>
        ) : (
          <PrimaryButton
            size="screen"
            disabled={disabled || secondary}
            aria-disabled={busy || undefined}
            aria-busy={busy || undefined}
            tabIndex={secondary || !shown ? -1 : undefined}
            onClick={press}
            className="aria-disabled:opacity-50 aria-disabled:shadow-none"
          >
            {spec && !secondary ? spec.label : "Continue"}
          </PrimaryButton>
        )}
      </div>
      <button
        type="button"
        disabled={disabled || !secondary}
        aria-disabled={(secondary && busy) || undefined}
        aria-busy={(secondary && busy) || undefined}
        tabIndex={secondary && shown ? undefined : -1}
        aria-hidden={!secondary || !shown || undefined}
        onClick={press}
        className={cn("absolute inset-0", SECONDARY_CTA, !secondary && "pointer-events-none")}
        style={{ opacity: shown && secondary ? 1 : 0, transition: `${fade}, transform 150ms ease` }}
      >
        {secondary ? spec.label : ""}
      </button>
    </div>
  );
}

// Writes the keyboard's height to --kb-inset on the element it's rendered in
// (the v3 root), for the CTA's LIFT above. A leaf on purpose: useKeyboardInset
// re-renders whatever calls it on every keyboard open, close and pan, and the
// wizard keeps six screens mounted, so calling it in the shell would re-render
// all of them each time (lib/hooks.ts says the same). This re-renders nothing
// else and only sets a property, so the CSS transition does the moving.
//
// It finds that element through a hidden span of its own rather than a ref to
// the parent: React attaches a parent's ref only after its children's layout
// effects have run, so on the first commit a parent ref would still be null.
export function KeyboardInsetVar() {
  const inset = useKeyboardInset();
  const anchor = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    anchor.current?.parentElement?.style.setProperty("--kb-inset", `${inset}px`);
  }, [inset]);
  return <span ref={anchor} hidden />;
}
