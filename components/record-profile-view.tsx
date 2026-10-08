"use client";

import { useEffect } from "react";

import { recordProfileView } from "@/app/actions/telemetry";
import { getAppSessionId } from "@/lib/telemetry/client";

// One row in profile_views per visit to someone else's profile. The RPC
// refuses a self-view and collapses the same pair inside 30 minutes, so a
// remount or a back-and-forth cannot double count. Fire-and-forget: the
// result is deliberately ignored, as with every telemetry writer.
export function RecordProfileView({ viewedId }: { viewedId: string }) {
  useEffect(() => {
    void recordProfileView(viewedId, getAppSessionId());
  }, [viewedId]);
  return null;
}
