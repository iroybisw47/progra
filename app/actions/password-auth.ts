"use server";

import { safeNextPath } from "@/lib/auth/safe-next";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true; next: string } | { error: string };

// Email + password sign-in. EXISTS FOR APP REVIEW, not as a product feature.
//
// Apple rejected the 2026-09-09 submission under Guideline 2.1(a): reviewers
// need credentials they can type into App Store Connect, and every other way in
// here borrows an identity from Google or Apple, which leaves nothing to hand
// over. There is deliberately no sign-up, no password reset and no email
// confirmation to match — the one account this serves is provisioned by hand in
// the Supabase dashboard.
//
// Server-side for the same reason native-auth.ts is: the Supabase SERVER client
// writes the session as a real Set-Cookie response header, which WebKit commits
// immediately, whereas the browser client writes via document.cookie, which
// WKWebView flushes lazily and can drop. Every page here is server-rendered
// from that cookie.
export async function signInWithPassword(input: {
  email: string;
  password: string;
  next?: string;
}): Promise<Result> {
  const email = input.email.trim();
  if (!email || !input.password) {
    return { error: "Enter an email and password." };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: input.password,
  });

  if (error) {
    // Deliberately not echoed verbatim. Supabase distinguishes "user not found"
    // from "wrong password", and repeating that back turns this form into an
    // oracle for which addresses hold accounts.
    return { error: "That email and password don't match an account." };
  }

  // Resolved server-side rather than trusted from the client, matching
  // native-auth.ts and app/auth/callback/route.ts.
  return { ok: true, next: safeNextPath(input.next) };
}
