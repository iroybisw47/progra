"use client";

import { HABIT_PRESETS, type HabitPick } from "@/lib/onboarding";

import { CheckTile, Field, StepTemplate } from "../onboarding-ui";

// Step 3. Daily habits: four presets to tap, plus your own. A custom habit
// joins the grid as a tile of its own (the design adds them but never draws
// them; a habit you can't see is a habit you can't un-pick).
export function HabitStep({
  eyebrow,
  picked,
  onToggle,
  draft,
  onDraft,
  onAdd,
}: {
  eyebrow: string | null;
  picked: readonly HabitPick[];
  onToggle: (habit: HabitPick) => void;
  draft: string;
  onDraft: (v: string) => void;
  onAdd: () => void;
}) {
  const custom = picked.filter((h) => !HABIT_PRESETS.some((p) => p.name === h.name));
  return (
    <StepTemplate
      eyebrow={eyebrow}
      title="Add daily habits."
      body="Small daily habits compound. They keep you moving on the days you can't put in hours, and your friends see your streak right next to your goals."
    >
      <Field label="Pick a few">
        <div className="grid grid-cols-2 gap-2">
          {[...HABIT_PRESETS, ...custom].map((h) => (
            <CheckTile
              key={h.name}
              name={h.name}
              color={h.color}
              on={picked.some((p) => p.name === h.name)}
              onToggle={() => onToggle(h)}
            />
          ))}
        </div>
      </Field>
      <div className="flex items-end gap-2">
        <input
          className="text-ink min-w-0 flex-1 border-b-2 border-hairline bg-transparent pb-2 text-[15px] font-medium transition-colors outline-none placeholder:text-disabled focus:border-brand"
          placeholder="Or add your own…"
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd();
            }
          }}
        />
        <button
          type="button"
          onClick={onAdd}
          className="border-hairline text-brand hover:border-brand h-[34px] shrink-0 rounded-[11px] border-[1.5px] px-3 text-xs font-semibold transition-colors"
        >
          + Add
        </button>
      </div>
    </StepTemplate>
  );
}
