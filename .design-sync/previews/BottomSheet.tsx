import { BottomSheet, BottomSheetContent, MenuRow, PrimaryButton } from "progra";

const noop = () => {};
const marker = (color: string) => (
  <span aria-hidden className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: color }} />
);

// The redesign's only modal surface for choices and forms: rises from the
// bottom, grab handle, serif title + right-aligned caption, hairline rows,
// PrimaryButton at the foot.
export function Open() {
  return (
    <BottomSheet open>
      <BottomSheetContent title="Nudge Maya" meta="3 of 4 left today">
        <p className="text-caption pb-2 text-[13px]">
          Pick a goal — Maya gets a push to clock in to it.
        </p>
        <div className="flex flex-col">
          <MenuRow label="Thesis" meta="4h of 10h" marker={marker("#395AA0")} onClick={noop} />
          <MenuRow label="Spanish" meta="1h of 3h" marker={marker("#E07042")} onClick={noop} />
          <MenuRow label="Gym" meta="2h of 4h" marker={marker("#2E8B50")} onClick={noop} />
        </div>
        <div className="pt-4">
          <PrimaryButton>Send nudge</PrimaryButton>
        </div>
      </BottomSheetContent>
    </BottomSheet>
  );
}
