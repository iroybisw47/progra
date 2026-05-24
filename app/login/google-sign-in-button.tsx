"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function GoogleSignInButton({ next }: { next?: string }) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    const supabase = createClient();
    const redirectTo = new URL("/auth/callback", window.location.origin);
    if (next) redirectTo.searchParams.set("next", next);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo.toString() },
    });

    if (error) {
      setLoading(false);
      toast.error(error.message);
    }
    // On success the browser is redirected to Google; no further action.
  }

  return (
    <Button
      className="h-11 w-full text-base"
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? "Redirecting…" : "Continue with Google"}
    </Button>
  );
}
