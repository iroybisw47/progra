"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";

import { AppleSignInButton } from "./apple-sign-in-button";
import { EmailSignInForm } from "./email-sign-in-form";
import { GoogleSignInButton } from "./google-sign-in-button";

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
// Client component as of that fix. Every caller is a Server Component passing
// plain strings, so the boundary costs nothing.
export function SignInButtons({
  next,
  referrer,
  googleLabel,
}: {
  next?: string;
  // Inviter's username (from /i/[username]). Carried through OAuth as `?ref=`.
  referrer?: string;
  googleLabel?: string;
}) {
  const [agreed, setAgreed] = useState(false);

  // Not a hand-written constant: the description has to point at THIS
  // instance's checkbox, and useId is stable across the server/client render.
  const id = useId();
  const labelId = `${id}-label`;

  return (
    // w-full is LOAD-BEARING. The signed-out landing in app/page.tsx puts
    // `items-center` on its flex column, so children shrink to their content
    // instead of stretching. Before this wrapper existed the button's own
    // w-full defeated that; without w-full here the wrapper collapses and the
    // button renders ~157px wide instead of filling the column.
    <div className="flex w-full flex-col gap-3">
      {/* Deliberately a <div>, not a <label>. The consent text has to contain
          the two links, and clicking a link inside a label activates the
          label's control as well as following the href — so reading the terms
          would silently tick the box agreeing to them. aria-labelledby gives
          the checkbox its accessible name without that coupling; the
          primitive's ::after already widens the 16px hit area. */}
      <div className="flex items-start gap-2.5">
        <Checkbox
          id={id}
          aria-labelledby={labelId}
          checked={agreed}
          onCheckedChange={(v) => setAgreed(v === true)}
          className="mt-0.5 shrink-0"
        />
        <span
          id={labelId}
          className="text-caption text-left text-xs leading-relaxed"
        >
          I agree to the{" "}
          <Link
            href="/terms"
            className="text-foreground underline underline-offset-2"
          >
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            className="text-foreground underline underline-offset-2"
          >
            Privacy Policy
          </Link>
          . Progra has no tolerance for objectionable content or abusive users.
        </span>
      </div>

      <AppleSignInButton next={next} referrer={referrer} disabled={!agreed} />
      <GoogleSignInButton
        next={next}
        referrer={referrer}
        label={googleLabel}
        disabled={!agreed}
      />
      {/* Below both OAuth buttons, and after them in the DOM, so Guideline 4.8's
          "equal prominence" comparison stays between Apple and Google alone. */}
      <EmailSignInForm next={next} disabled={!agreed} />
    </div>
  );
}
