"use client";

import Link from "next/link";
import { CheckIcon } from "lucide-react";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";

import { cn } from "@/lib/utils";

import { AppleSignInButton } from "./apple-sign-in-button";
import { EmailSignInForm } from "./email-sign-in-form";
import { GoogleSignInButton } from "./google-sign-in-button";

// How long the terms row shakes for; the animation itself is .4s.
const NUDGE_MS = 450;

// Every sign-in surface renders this rather than the individual buttons, so
// Apple's Guideline 4.8 "equal prominence" is decided in exactly one place.
// Guideline 1.2's "users must agree to terms before registering or logging in"
// now lives here for the same reason: `/`, `/login` and both `/i/[username]`
// branches inherit the gate without each having to remember it.
//
// The 2026-09-05 rejection was NOT about what /terms says — its Acceptable use
// section already carries the zero-tolerance sentence Apple asks for. It was
// about the terms never being presented as an *agreement*: a footer link on the
// landing page, and no footer at all on /login.
//
// An explicit tick, not a passive "by continuing you agree" line. Both readings
// pass with some reviewers; only the affirmative one answers "require that users
// agree", and a second rejection costs another review cycle.
//
// Until the box is ticked the buttons are dimmed but still TAKE the tap: it
// shakes the terms row, and nothing else happens — no SDK, no action, no
// redirect. A natively disabled button would swallow the tap and leave someone
// wondering why nothing works. Each button enforces the gate itself.
//
// Client component as of the 1.2 fix. Every caller is a Server Component
// passing plain strings, so the boundary costs nothing.
export function SignInButtons({
  next,
  referrer,
  googleLabel,
  entrance = false,
}: {
  next?: string;
  // Inviter's username (from /i/[username]). Carried through OAuth as `?ref=`.
  referrer?: string;
  googleLabel?: string;
  // Staggered rise-in, for the login page only.
  entrance?: boolean;
}) {
  const [agreed, setAgreed] = useState(false);
  const [nudging, setNudging] = useState(false);
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
    },
    []
  );

  function nudge() {
    if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
    setNudging(true);
    nudgeTimer.current = setTimeout(() => setNudging(false), NUDGE_MS);
  }

  // Not a hand-written constant: the description has to point at THIS
  // instance's checkbox, and useId is stable across the server/client render.
  const id = useId();
  const labelId = `${id}-label`;
  const locked = !agreed;

  return (
    // w-full is LOAD-BEARING. The signed-out landing in app/page.tsx puts
    // `items-center` on its flex column, so children shrink to their content
    // instead of stretching. Before this wrapper existed the button's own
    // w-full defeated that; without w-full here the wrapper collapses and the
    // button renders ~157px wide instead of filling the column.
    <div className="flex w-full flex-col gap-[22px]">
      {/* Two elements on purpose: the outer rises in once, the inner shakes.
          On one element, removing the shake class would replay the rise. */}
      <div
        className={cn(entrance && "rise")}
        style={entrance ? ({ "--rise-delay": ".46s" } as CSSProperties) : undefined}
      >
        {/* Deliberately a <div>, not a <label>. The consent text has to contain
            the two links, and clicking a link inside a label activates the
            label's control as well as following the href — so reading the terms
            would silently tick the box agreeing to them. aria-labelledby gives
            the checkbox its accessible name without that coupling. */}
        <div
          data-terms-row
          className={cn(
            "flex items-start gap-2.5",
            nudging && "motion-safe:animate-[nudge-x_.4s_ease]"
          )}
        >
          <button
            type="button"
            role="checkbox"
            aria-checked={agreed}
            aria-labelledby={labelId}
            onClick={() => setAgreed((v) => !v)}
            className={cn(
              // ::after widens the 16px box to a comfortable tap target.
              "relative mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] border-[1.5px] transition-colors duration-150 outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:ring-3 focus-visible:ring-brand/40",
              agreed ? "border-brand bg-brand text-white" : "border-disabled bg-white"
            )}
          >
            {agreed && <CheckIcon className="size-[11px]" strokeWidth={3.4} />}
          </button>
          <span
            id={labelId}
            className="text-caption text-left text-xs leading-[1.6]"
          >
            I agree to the{" "}
            <Link href="/terms" className="text-body underline underline-offset-2">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-body underline underline-offset-2">
              Privacy Policy
            </Link>
            . Progra has no tolerance for objectionable content or abusive users.
          </span>
        </div>
        <span role="status" aria-live="polite" className="sr-only">
          {nudging ? "Agree to the Terms of Service and Privacy Policy first." : ""}
        </span>
      </div>

      <div
        className={cn("flex flex-col gap-2.5", entrance && "rise")}
        style={entrance ? ({ "--rise-delay": ".58s" } as CSSProperties) : undefined}
      >
        <AppleSignInButton
          next={next}
          referrer={referrer}
          locked={locked}
          onLocked={nudge}
          describedBy={labelId}
        />
        <GoogleSignInButton
          next={next}
          referrer={referrer}
          label={googleLabel}
          locked={locked}
          onLocked={nudge}
          describedBy={labelId}
        />
        {/* Below both OAuth buttons, and after them in the DOM, so Guideline 4.8's
            "equal prominence" comparison stays between Apple and Google alone. */}
        <EmailSignInForm
          next={next}
          locked={locked}
          onLocked={nudge}
          describedBy={labelId}
        />
      </div>
    </div>
  );
}

