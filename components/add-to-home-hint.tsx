"use client";

import { useEffect, useState } from "react";

import { shouldShowIosInstallHint } from "@/lib/pwa-install";

// iOS-Safari-only nudge to install Progra as a PWA. Renders nothing on the
// server and on any non-iOS-Safari / already-installed client, so it's safe to
// drop onto the sign-in surfaces unconditionally.
export function AddToHomeHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    setShow(
      shouldShowIosInstallHint({
        userAgent: nav.userAgent,
        maxTouchPoints: nav.maxTouchPoints,
        navigatorStandalone: nav.standalone,
        displayModeStandalone: window.matchMedia(
          "(display-mode: standalone)"
        ).matches,
      })
    );
  }, []);

  if (!show) return null;

  return (
    <div className="bg-muted/40 text-muted-foreground flex items-start gap-3 rounded-xl border p-3 text-left text-sm">
      {/* iOS share glyph (square with up-arrow) — no exact lucide equivalent. */}
      <svg
        aria-hidden
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-brand mt-0.5 shrink-0"
      >
        <path d="M12 15V3" />
        <path d="m8 7 4-4 4 4" />
        <path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7" />
      </svg>
      <p className="leading-snug">
        For the full Progra experience, add it to your Home Screen: tap the{" "}
        <span className="text-foreground font-medium">Share</span> button below,
        then{" "}
        <span className="text-foreground font-medium">Add to Home Screen</span>.
      </p>
    </div>
  );
}
