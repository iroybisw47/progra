"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Keeps the feed roughly live without Supabase Realtime: re-runs the server read
// on an interval so new clock-ins / clock-outs / pause changes surface. Pauses
// while the tab is hidden and refreshes immediately on refocus. Renders nothing;
// always mounted (so a first clock-in appears even when the strip is empty).
export function FeedLivePoll({ intervalMs = 30_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    let id: ReturnType<typeof setInterval> | undefined;

    const start = () => {
      if (id === undefined) id = setInterval(() => router.refresh(), intervalMs);
    };
    const stop = () => {
      if (id !== undefined) {
        clearInterval(id);
        id = undefined;
      }
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        router.refresh();
        start();
      }
    };

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, intervalMs]);

  return null;
}
