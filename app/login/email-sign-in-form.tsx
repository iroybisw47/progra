"use client";

import { useId, useState } from "react";
import { toast } from "sonner";

import { signInWithPassword } from "@/app/actions/password-auth";

const INPUT =
  "text-ink h-11 w-full rounded-[13px] border-[1.5px] border-control-border bg-transparent px-3.5 text-[15px] outline-none placeholder:text-disabled focus:border-brand disabled:opacity-50";

// The App Review sign-in door. Collapsed to a single line of text until asked
// for, because it exists for Apple's reviewers rather than for users — every
// real account here arrives through Google or Apple.
//
// Rendered on every sign-in surface rather than only in the native shell. The
// shell has no address bar, so a hidden entry point cannot be reached by URL,
// and a reviewer who fails to find the door files another rejection. One quiet
// line is the cheaper side of that trade.
export function EmailSignInForm({
  next,
  locked = false,
  onLocked,
  describedBy,
}: {
  next?: string;
  // True until the terms checkbox is ticked. Guideline 1.2 governs this door
  // exactly as it governs the other two: opening the form and submitting it
  // both stop at the gate (the box can be unticked after the form is open).
  locked?: boolean;
  onLocked?: () => void;
  describedBy?: string;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const emailId = useId();
  const passwordId = useId();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (locked) {
      onLocked?.();
      return;
    }
    if (pending) return;
    setPending(true);

    const out = await signInWithPassword({ email, password, next });
    if ("error" in out) {
      setPending(false);
      toast.error(out.error);
      return;
    }

    // Hard navigation so the server re-reads the session cookie the action just
    // wrote — same reason the OAuth buttons do it. Pending stays on through it.
    window.location.assign(out.next);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => (locked ? onLocked?.() : setOpen(true))}
        aria-disabled={locked || undefined}
        aria-describedby={locked ? describedBy : undefined}
        className="text-caption hover:text-body self-center p-1 text-xs underline underline-offset-2 transition-[color,opacity] duration-200 aria-disabled:cursor-not-allowed aria-disabled:opacity-45"
      >
        Sign in with email
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex w-full flex-col gap-2.5"
      style={{ animation: "rise 0.35s cubic-bezier(0.22,1,0.36,1) both" }}
    >
      <label htmlFor={emailId} className="sr-only">
        Email
      </label>
      <input
        id={emailId}
        type="email"
        className={INPUT}
        placeholder="Email"
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="username"
        spellCheck={false}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={pending}
      />
      <label htmlFor={passwordId} className="sr-only">
        Password
      </label>
      <input
        id={passwordId}
        type="password"
        className={INPUT}
        placeholder="Password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={pending}
      />
      <button
        type="submit"
        disabled={pending}
        aria-disabled={locked || undefined}
        aria-describedby={locked ? describedBy : undefined}
        className="text-body hover:border-brand h-11 w-full rounded-[13px] border-[1.5px] border-control-border bg-white text-sm font-semibold transition-[transform,opacity,border-color] duration-200 active:scale-[.98] aria-disabled:cursor-not-allowed aria-disabled:opacity-45 disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
