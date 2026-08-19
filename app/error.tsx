"use client"; // Error boundaries must be Client Components.

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

// The app had no error boundary, so any uncaught render or transition error —
// such as a rejected server action after a deploy — left the screen dead with
// no way back except a manual reload. This catches those errors below the root
// layout and offers a reload.
//
// Reload rather than Next's `unstable_retry`: the common cause is deploy skew,
// where an open tab holds assets and action ids the new build no longer knows.
// Only a fresh page load fetches the current build, which retrying the same
// segment can't do.
export default function Error({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="bg-card fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 px-8 text-center">
      <div className="flex flex-col gap-2">
        <h2 className="text-body text-lg font-semibold">Something went wrong</h2>
        <p className="text-faint max-w-[300px] text-sm leading-relaxed">
          The app hit an unexpected error. Reloading the page usually fixes it.
        </p>
      </div>
      <Button
        onClick={() => window.location.reload()}
        className="bg-brand text-primary-foreground h-11 rounded-2xl px-6 text-[15px] font-semibold active:scale-[.97]"
      >
        Reload
      </Button>
    </div>
  );
}
