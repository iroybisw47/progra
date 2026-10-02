"use client";

import { useEffect } from "react";

import { recordError } from "@/lib/error-log";

// The last resort: a throw in the ROOT LAYOUT itself, which app/error.tsx sits
// inside and therefore cannot catch. It exists for one reason — to make sure
// the error gets WRITTEN DOWN no matter where it came from. The root layout
// mounts about a dozen client leaves (EnsureProfileSync, PushRegistration,
// PostHogInit, LastSeenPing…), several of which only run on a cold open, and a
// cold-open crash is precisely the open bug in buglist.md.
//
// A global error replaces the entire document, so this has to render its own
// <html> and <body>, and it gets NONE of the app's styling or fonts — the
// layout that would have provided them is the thing that failed. Hence the
// inline styles: a plain, legible page is the point, not a designed one.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    recordError(error);
    console.error("[progra] global error boundary", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
          background: "#fff",
          color: "#1b2129",
          fontFamily: "system-ui, -apple-system, sans-serif",
          textAlign: "center",
        }}
      >
        <main style={{ maxWidth: 360 }}>
          <h1 style={{ fontSize: 28, fontWeight: 600, margin: "0 0 8px" }}>
            Progra
          </h1>
          <p style={{ fontSize: 14, color: "#4a5565", margin: "0 0 20px" }}>
            Something broke before the app could start. Nothing you tracked was
            lost.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              height: 48,
              width: "100%",
              borderRadius: 15,
              border: "1.5px solid #d9dde3",
              background: "#fff",
              font: "inherit",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Try again
          </button>
          <p
            style={{
              fontSize: 11,
              color: "#8a94a6",
              fontFamily: "ui-monospace, monospace",
              wordBreak: "break-word",
              marginTop: 20,
            }}
          >
            {error.digest ? `server · ${error.digest} · ` : "client · "}
            {error.message}
          </p>
        </main>
      </body>
    </html>
  );
}
