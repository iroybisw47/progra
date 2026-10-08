"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { backfillGoalCategories } from "@/app/actions/admin";

// Labels every active, non-private goal without a category — one Haiku call
// per goal, server-side, never a private title. The action revalidates the
// dashboard, so the table below refreshes in the same POST.
export function CategorizeButton({ unlabeled }: { unlabeled: number }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending || unlabeled === 0}
      onClick={() =>
        startTransition(async () => {
          const r = await backfillGoalCategories();
          if ("error" in r) {
            toast.error(r.error);
            return;
          }
          toast.success(`Labelled ${r.labeled} goal${r.labeled === 1 ? "" : "s"}${r.skipped ? `, ${r.skipped} skipped` : ""}`);
        })
      }
      className="border-hairline rounded-md border px-2.5 py-1 text-xs font-semibold disabled:opacity-50"
    >
      {pending ? "Labelling…" : unlabeled === 0 ? "All labelled" : `Categorize ${unlabeled} goal${unlabeled === 1 ? "" : "s"}`}
    </button>
  );
}
