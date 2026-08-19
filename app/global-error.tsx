"use client"; // Error boundaries must be Client Components.

import { useEffect } from "react";

import "./globals.css";

// Catches errors thrown by the root layout itself, which `app/error.tsx` sits
// below and cannot handle. This replaces the root layout when active, so it
// must render its own <html> and <body>. Kept dependency-free (no shared
// components) so it still renders when the layout is the thing that failed.
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="bg-card fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 px-8 text-center">
          <div className="flex flex-col gap-2">
            <h2 className="text-body text-lg font-semibold">
              Something went wrong
            </h2>
            <p className="text-faint max-w-[300px] text-sm leading-relaxed">
              The app hit an unexpected error. Reloading the page usually fixes
              it.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="bg-brand text-primary-foreground h-11 rounded-2xl px-6 text-[15px] font-semibold active:scale-[.97]"
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
