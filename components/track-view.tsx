"use client";

import { useEffect } from "react";

import { track, type AnalyticsEvent } from "@/lib/analytics";

// Records one property-less event when a screen mounts — `feed_viewed`,
// `clock_in_screen_opened`, `landing_viewed`. A leaf rather than a hook so a
// SERVER page can drop it into its JSX without becoming a client component.
// Renders nothing.
export function TrackView({ event }: { event: AnalyticsEvent }) {
  useEffect(() => {
    track(event);
  }, [event]);
  return null;
}
