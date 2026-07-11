"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { SparklesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { autoCategorizeEvents } from "@/app/actions/categorize-events";

export function CategorizeEventsButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    const result = await autoCategorizeEvents();
    setPending(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    if (result.categorized === 0) {
      toast.success("Nothing new to categorize");
    } else {
      const more = result.remaining
        ? ` — ${result.remaining} more, tap again`
        : "";
      toast.success(
        `Categorized ${result.categorized} event${result.categorized === 1 ? "" : "s"}${more}`
      );
    }
    router.refresh();
  }

  return (
    <Button
      variant="outline"
      className="h-11 w-full text-base"
      onClick={handleClick}
      disabled={pending}
    >
      <SparklesIcon /> {pending ? "Categorizing…" : "Auto-categorize events"}
    </Button>
  );
}
