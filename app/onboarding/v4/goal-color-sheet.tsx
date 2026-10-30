"use client";

import { ColorSwatches } from "@/components/color-swatches";
import { BottomSheet, BottomSheetContent, BottomSheetTitle } from "@/components/v2/bottom-sheet";
import { themedColor } from "@/lib/colors";

// How long a picked swatch shows its check before the sheet closes (R:85).
const CLOSE_AFTER_MS = 240;

// The goal color sheet (R:82-85), opened by a goal row's color button on
// Screen 02: "Goal color", the goal with a bar in its color, the eleven
// swatches and a line on what the color is for. Picking a swatch sets the
// color, then closes a beat later; tapping the one already picked, the
// backdrop, Escape or a drag down closes it without changing anything.
//
// The app's BottomSheet, with its title row swapped for this layout and its
// timing set to the handoff's: 440ms up, 320ms down, on the sheet easing. It
// portals out of the wizard, so the shell loads it lazily (next/dynamic), as
// AGENTS.md asks of dialogs.
export function GoalColorSheet({
  open,
  title,
  color,
  onPick,
  onClose,
}: {
  open: boolean;
  // The goal being colored, as listed, and its color now (a fill hex).
  title: string;
  color: string;
  onPick: (color: string) => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <BottomSheetContent
        title={title}
        className="ease-[cubic-bezier(0.32,0.72,0,1)] data-closed:duration-[320ms] data-open:duration-[440ms]"
        header={
          <div className="flex-none">
            <div className="section-label">Goal color</div>
            <div className="mt-[9px] flex min-w-0 items-center gap-2.5">
              <span
                aria-hidden
                className="h-[22px] w-[3px] shrink-0 rounded-[2px] transition-colors duration-200"
                style={{ background: themedColor(color) }}
              />
              <BottomSheetTitle className="text-ink min-w-0 truncate font-serif text-[21px] leading-[1.2] font-medium tracking-[-0.015em]">
                {title}
              </BottomSheetTitle>
            </div>
          </div>
        }
      >
        <div className="pb-6">
          <div className="mt-[18px]">
            <ColorSwatches
              value={color}
              onChange={(next) => {
                // The swatch already picked hands back null: close as it is.
                if (!next) {
                  onClose();
                  return;
                }
                onPick(next);
                setTimeout(onClose, CLOSE_AFTER_MS);
              }}
            />
          </div>
          <p className="text-caption mt-3 text-[12px] leading-[1.45]">
            It marks this goal everywhere — your sessions, your week and your friends’ feed.
          </p>
        </div>
      </BottomSheetContent>
    </BottomSheet>
  );
}
