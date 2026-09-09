"use client";

import { useId, useState } from "react";
import { toast } from "sonner";

import { signInWithPassword } from "@/app/actions/password-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  disabled = false,
}: {
  next?: string;
  // True until the terms checkbox is ticked. Guideline 1.2 governs this door
  // exactly as it governs the other two.
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const emailId = useId();
  const passwordId = useId();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
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
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="text-caption hover:text-foreground self-center text-xs underline underline-offset-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        Sign in with email
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-2.5">
      <label htmlFor={emailId} className="sr-only">
        Email
      </label>
      <Input
        id={emailId}
        type="email"
        className="h-11"
        placeholder="Email"
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="username"
        spellCheck={false}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={disabled || pending}
      />
      <label htmlFor={passwordId} className="sr-only">
        Password
      </label>
      <Input
        id={passwordId}
        type="password"
        className="h-11"
        placeholder="Password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={disabled || pending}
      />
      <Button
        type="submit"
        variant="outline"
        className="h-11 w-full text-base"
        disabled={disabled || pending}
      >
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
