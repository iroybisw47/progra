"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { syncCalendar } from "@/app/actions/sync-calendar";

export function SyncCalendarButton() {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    const result = await syncCalendar();
    setPending(false);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success(`Synced ${result.count} event${result.count === 1 ? "" : "s"}`);
    }
  }

  return (
    <Button
      variant="secondary"
      className="h-11 w-full text-base"
      onClick={handleClick}
      disabled={pending}
    >
      {pending ? "Syncing…" : "Sync Google Calendar"}
    </Button>
  );
}
