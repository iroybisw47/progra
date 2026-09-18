"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { GoalQuotaRows } from "@/components/v2/goal-quota-rows";
import { SectionHeader } from "@/components/v2/section-header";
import type { ManageGoal } from "@/components/v2/manage-goals";

// Same treatment the Progress tab gives it: the goals manager only matters
// after tapping the header, so it loads as a lazy chunk rather than riding in
// the You tab's critical bundle.
const ManageGoals = dynamic(
  () => import("@/components/v2/manage-goals").then((m) => m.ManageGoals),
  { ssr: false }
);

// The You tab's "Goal quotas" section. Read-only rows plus the same tap-header-
// to-manage affordance Progress has, so a goal can be renamed, requotaed,
// recolored or deleted without bouncing to another tab.
export function GoalsSection({ goals }: { goals: ManageGoal[] }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="flex flex-col">
      <SectionHeader
        label="Goal quotas"
        meta={`${goals.length} active`}
        onClick={() => setOpen(true)}
        ariaLabel="Manage goals"
        className="px-5 pt-4 pb-2"
      />
      <div className="px-5">
        {goals.length === 0 ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-caption text-left text-[13px]"
          >
            No goals yet — tap to add one.
          </button>
        ) : (
          <GoalQuotaRows goals={goals} />
        )}
      </div>
      <div className="bg-hairline mx-5 mt-4 h-px" />

      <ManageGoals open={open} onOpenChange={setOpen} goals={goals} />
    </section>
  );
}
