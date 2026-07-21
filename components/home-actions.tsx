"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { syncCalendar } from "@/app/actions/sync-calendar";
import { autoCategorizeEvents } from "@/app/actions/categorize-events";

// Two compact action rows for the home screen (above the profile card): a short
// explanation on the left, a small button on the right. Sync pulls Google
// Calendar events in; auto-categorize labels recent uncategorized ones. Both
// guard against double-submit via their pending state.
export function HomeActions() {
  const [syncing, setSyncing] = useState(false);
  const [categorizing, setCategorizing] = useState(false);

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

  async function handleCategorize() {
    setCategorizing(true);
    const r = await autoCategorizeEvents();
    setCategorizing(false);
    if ("error" in r) {
      toast.error(r.error);
      return;
    }
    const more = r.remaining ? ` — ${r.remaining} more, tap again` : "";
    toast.success(
      r.categorized === 0
        ? "Nothing new to categorize"
        : `Categorized ${r.categorized} event${r.categorized === 1 ? "" : "s"}${more}`
    );
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
      <Card>
        <CardContent className="flex items-center justify-between gap-3 px-5 py-4">
          <p className="text-muted-foreground text-xs leading-snug">
            Let AI sort recent uncategorized events into your categories.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={handleCategorize}
            disabled={categorizing}
          >
            {categorizing ? "Categorizing…" : "Auto-categorize"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
