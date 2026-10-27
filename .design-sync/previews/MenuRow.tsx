import { MenuRow } from "progra";

const noop = () => {};
const marker = (color: string) => (
  <span aria-hidden className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: color }} />
);

// Hairline-separated rows inside a bottom sheet (first row has no top rule).
export function GoalChoices() {
  return (
    <div className="flex w-full flex-col px-5" style={{ maxWidth: 390 }}>
      <MenuRow label="Thesis" meta="6.5h of 10h" marker={marker("#395AA0")} onClick={noop} />
      <MenuRow label="Spanish" meta="2h of 3h" marker={marker("#E07042")} onClick={noop} />
      <MenuRow label="Gym" meta="done this week" marker={marker("#2E8B50")} onClick={noop} disabled />
    </div>
  );
}

export function ProfileActions() {
  return (
    <div className="flex w-full flex-col px-5" style={{ maxWidth: 390 }}>
      <MenuRow label="Nudge Maya" onClick={noop} />
      <MenuRow label="Share profile" onClick={noop} />
      <MenuRow label="Remove friend" onClick={noop} destructive />
      <MenuRow label="Block" onClick={noop} destructive />
    </div>
  );
}
