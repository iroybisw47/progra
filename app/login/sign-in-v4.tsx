"use client";

import Image from "next/image";
import Link from "next/link";
import { CheckIcon, HeartIcon } from "lucide-react";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";

import { AvatarInitials } from "@/components/avatar-initials";
import { entityColor, entityInk, tint } from "@/lib/colors";
import { EASING } from "@/lib/motion";
import { PALETTE } from "@/lib/palette";
import { cn } from "@/lib/utils";

import { AppleSignInButton } from "./apple-sign-in-button";
import { EmailSignInForm } from "./email-sign-in-form";
import { GoogleSignInButton } from "./google-sign-in-button";

// Onboarding v4's sign-in, "live feed" (design_handoff_onboarding_v4 R:42-71),
// behind ONBOARDING_V4: the signed-out landing at `/` and /login both render
// it. A feed of made-up sessions drifts down under the status bar; under it
// the brand, the headline, and the three ways in.
//
// The terms stay an explicit agreement, as SignInButtons has them (the
// owner's call, 2026-10-28, against the handoff's "by continuing" line): the
// 2026-09-05 rejection under Guideline 1.2 was the terms never being
// presented as an agreement, and a second costs another review cycle. So the
// buttons are dimmed but take the tap until the box is ticked, and a tap
// before then shakes the terms row and goes no further. sign-in-buttons.tsx
// has the full reasoning; this is the same gate in the new layout.
//
// `data-login` scopes the reduced-motion rule in globals.css, which stills
// the rise-ins and runs the drift once, instantly, leaving the feed still.

type FeedPost = {
  name: string;
  username: string;
  goal: string;
  palette: number;
  duration: string;
  title: string;
  kudos: number;
  when: string;
};

// The feed's six posts (R:53-58). Illustrative people, not real accounts.
const FEED: readonly FeedPost[] = [
  { name: "Priya Raman", username: "priya.r", goal: "Ace organic chem", palette: 9, duration: "2h 05m", title: "Library, top floor", kudos: 4, when: "12m" },
  { name: "Marcus Lee", username: "marcuslee", goal: "Launch my side project", palette: 2, duration: "1h 30m", title: "Shipped the onboarding", kudos: 6, when: "38m" },
  { name: "Sofia Alvarez", username: "sofia.alv", goal: "Train for a half marathon", palette: 5, duration: "45m", title: "Tempo run, 8k", kudos: 3, when: "1h" },
  { name: "Daniel Kim", username: "dkim", goal: "Finish my thesis", palette: 7, duration: "3h 10m", title: "Chapter 3 draft done", kudos: 9, when: "2h" },
  { name: "Nina Kowalski", username: "ninak", goal: "Learn Spanish", palette: 3, duration: "35m", title: "Podcast and flashcards", kudos: 2, when: "3h" },
  { name: "Leo Martins", username: "leo.m", goal: "Get stronger", palette: 6, duration: "1h 05m", title: "Push day", kudos: 5, when: "4h" },
];

// The feed's height, and while the email form is open (R:46).
const FEED_PX = 380;
const FEED_EMAIL_PX = 252;
const FEED_MASK = "linear-gradient(to bottom, transparent 0, #000 26%, #000 74%, transparent 100%)";

// How long the terms row shakes for; the animation itself is .4s.
const NUDGE_MS = 450;

const rise = (delay: string): CSSProperties => ({ "--rise-delay": delay }) as CSSProperties;

function Post({ post }: { post: FeedPost }) {
  const fill = PALETTE[post.palette].fill;
  return (
    <div className="mb-2.5 flex flex-col gap-2 rounded-[16px] bg-card px-[15px] py-[13px]">
      <div className="flex items-center gap-2.5">
        <div className="size-[30px] shrink-0 text-[11px]">
          <AvatarInitials name={post.name} username={post.username} className="size-full" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-body truncate text-[12.5px] leading-[1.25] font-semibold">{post.name}</span>
          <span className="text-caption flex min-w-0 items-center gap-1 text-[11.5px]">
            clocked into
            <span className="size-[7px] shrink-0 rounded-[2px]" style={{ background: entityColor(fill) }} />
            <span className="text-body truncate font-medium">{post.goal}</span>
          </span>
        </div>
        <span className="text-faint shrink-0 text-[11px]">{post.when}</span>
      </div>
      <span className="text-ink font-serif text-[16px] font-medium tracking-[-0.01em]">{post.title}</span>
      <div className="flex items-center">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11px] font-semibold tabular-nums"
          style={{ background: tint(fill, 0.14), color: entityInk(fill) }}
        >
          <span className="size-1.5 rounded-[2px]" style={{ background: entityColor(fill) }} />
          {post.duration}
        </span>
        <span className="flex-1" />
        <span className="border-hairline text-brand inline-flex items-center gap-1 rounded-full border px-[9px] py-[3px] text-[11px] font-semibold">
          <HeartIcon className="size-3" strokeWidth={2} fill="currentColor" />
          {post.kudos}
        </span>
      </div>
    </div>
  );
}

export function SignInV4({
  next,
  error,
  deleted = false,
}: {
  next?: string;
  // /login's ?error= and ?deleted=, shown above the buttons.
  error?: string;
  deleted?: boolean;
}) {
  const [emailOpen, setEmailOpen] = useState(false);
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
  const id = useId();
  const labelId = `${id}-terms`;
  const locked = !agreed;
  const button = "h-[52px] rounded-[15px] text-base gap-2";

  return (
    <div data-login className="bg-screen fixed inset-0 z-50 flex flex-col overflow-hidden">
      {/* The feed (R:46-58): drifting down, new posts arriving from the top,
          faded out at both edges. Decoration, hidden from assistive tech. */}
      <div
        aria-hidden
        className="bg-inset relative w-full shrink overflow-hidden"
        style={{
          height: emailOpen ? FEED_EMAIL_PX : FEED_PX,
          minHeight: 120,
          maskImage: FEED_MASK,
          WebkitMaskImage: FEED_MASK,
          transition: `height 420ms ${EASING.E}`,
        }}
      >
        <div
          className="mx-auto max-w-[430px] px-[18px]"
          style={{ animation: "feed-drift 48s linear infinite" }}
        >
          {[...FEED, ...FEED].map((post, i) => (
            <Post key={i} post={post} />
          ))}
        </div>
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-[430px] flex-1 flex-col overflow-y-auto px-6 pb-[max(env(safe-area-inset-bottom),34px)]">
        <div className="rise flex items-center gap-2.5" style={rise(".10s")}>
          <Image src="/progra-logo.png" alt="" width={30} height={30} className="size-[30px] rounded-[8px]" />
          <span className="text-ink font-serif text-[21px] font-medium tracking-[-0.02em]">Progra</span>
        </div>
        <h1
          className="text-ink rise mt-[18px] font-serif text-[36px] leading-[1.06] font-medium tracking-[-0.025em] text-balance"
          style={rise(".18s")}
        >
          The social network built around self improvement
        </h1>
        <p className="text-secondary-ink rise mt-2.5 text-[15px] leading-[1.55]" style={rise(".26s")}>
          Put in real hours towards your goals with your friends
        </p>

        <div className="min-h-4 flex-1" />

        <div className="rise flex flex-col gap-2.5" style={rise(".38s")}>
          {deleted && (
            <p className="border-hairline text-caption rounded-xl border px-4 py-3 text-center text-sm">
              Your account was deleted. Sign in again any time to start fresh.
            </p>
          )}
          <AppleSignInButton
            next={next}
            label="Continue with Apple"
            locked={locked}
            onLocked={nudge}
            describedBy={labelId}
            className={cn(button, "[&>svg]:size-4")}
          />
          <GoogleSignInButton
            next={next}
            label="Continue with Google"
            locked={locked}
            onLocked={nudge}
            describedBy={labelId}
            className={button}
          />
          <EmailSignInForm
            next={next}
            locked={locked}
            onLocked={nudge}
            describedBy={labelId}
            variant="v4"
            onOpenChange={setEmailOpen}
          />
          {error && <p className="text-destructive text-center text-sm">{error}</p>}

          {/* The terms (R:68), as an agreement to tick. A <div>, not a
              <label>, so following a link inside it never ticks the box
              (sign-in-buttons.tsx). */}
          <div
            className={cn(
              "mt-1 flex items-start justify-center gap-2",
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
                "relative mt-[2px] flex size-[14px] shrink-0 items-center justify-center rounded-[4px] border-[1.5px] transition-colors duration-150 outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:ring-3 focus-visible:ring-brand/40",
                agreed ? "border-brand bg-brand text-primary-foreground" : "border-disabled bg-card"
              )}
            >
              {agreed && <CheckIcon className="size-[10px]" strokeWidth={3.4} />}
            </button>
            <span id={labelId} className="text-caption text-left text-[11px] leading-[1.55]">
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
      </div>
    </div>
  );
}
