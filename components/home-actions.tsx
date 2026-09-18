"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { syncCalendar } from "@/app/actions/sync-calendar";

// One compact action row for the home screen (above the profile card): a short
// explanation on the left, a small button on the right. Sync pulls Google
// Calendar events in. Guards against double-submit via its pending state.
//
// This is the pre-REDESIGN home; the live Progress screen doesn't render it.
export function HomeActions() {
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    setSyncing(true);
    const r = await syncCalendar();
    setSyncing(false);
    if ("error" in r) {
      toast.error(r.error);
      return;
    }
    toast.success(`Synced ${r.count} event${r.count === 1 ? "" : "s"}`);
  }

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardContent className="flex items-center justify-between gap-3 px-5 py-4">
          <p className="text-muted-foreground text-xs leading-snug">
            Pull your Google Calendar events into Progra.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? "Syncing…" : "Sync Google Cal"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
