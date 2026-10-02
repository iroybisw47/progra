"use client";

import { useEffect } from "react";

import { recordError } from "@/lib/error-log";

// The app's first error boundary. Until now there was none anywhere in `app/`,
// so every throw fell through to Next's built-in `DefaultGlobalError` — "This
// page couldn't load", two unlabelled buttons, and no way to find out what
// actually happened.
//
// Two jobs, and the second is the one that matters:
//
// 1. Say something a user can act on, in the product's own voice.
// 2. WRITE THE ERROR DOWN. Next clears this boundary as soon as the router's
//    pathname changes, and a document navigation clears the console at the same
//    time — which is exactly why the cold-open flash in buglist.md went three
//    weeks without a cause. recordError() survives both.
//
// Covers every segment below the root layout. A throw inside the root layout
// itself needs global-error.tsx, which this intentionally is not: errors there
// would also take out this component's own styling.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    recordError(error);
    // Also logged, for the case where someone IS watching with preserve-log on.
    console.error("[progra] client error boundary", error);
  }, [error]);

  // A digest is only set for errors thrown on the server, so its absence tells
  // you which half of the app failed. Shown rather than hidden: this is a
  // ~50-user beta, and the person reading it is usually the one who can fix it.
  const where = error.digest ? "server" : "client";

  return (
    <div className="flex flex-1 flex-col items-center px-5">
      <main className="my-auto flex w-full max-w-sm flex-col items-center gap-6 pt-16 text-center">
        <header className="flex flex-col gap-2">
          <h1 className="text-4xl font-semibold tracking-tight">Progra</h1>
          <p className="text-secondary-ink text-sm">Something broke.</p>
        </header>

        <p className="text-secondary-ink text-sm leading-relaxed">
          That one&apos;s on us, not on you — nothing you tracked was lost. Try
          again, and if it keeps happening send it to us from Settings → Help.
        </p>

        <button
          type="button"
          onClick={reset}
          className="border-control-border text-body h-12 w-full rounded-[15px] border-[1.5px] text-sm font-semibold transition-transform active:scale-[.98]"
        >
          Try again
        </button>

        <p className="text-faint font-mono text-[11px] break-words">
          {where}
          {error.digest ? ` · ${error.digest}` : ""}
          {error.message ? ` · ${error.message}` : ""}
        </p>
      </main>

      <footer className="text-secondary-ink pt-6 pb-[max(env(safe-area-inset-bottom),24px)] text-xs">
        © 2026 Progra
      </footer>
    </div>
  );
}
