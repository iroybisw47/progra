import { PrimaryButton } from "progra";

// size="sheet" (default) — one control among several inside a bottom sheet.
export function Sheet() {
  return (
    <div className="w-full max-w-sm">
      <PrimaryButton>Save goal</PrimaryButton>
    </div>
  );
}

// size="screen" — the pinned CTA a whole screen exists to press. Taller,
// larger type, and the navy glow: the ONLY drop shadow in the app.
export function Screen() {
  return (
    <div className="w-full max-w-sm">
      <PrimaryButton size="screen">Clock in</PrimaryButton>
    </div>
  );
}

export function Disabled() {
  return (
    <div className="w-full max-w-sm">
      <PrimaryButton size="screen" disabled>
        Clock in
      </PrimaryButton>
    </div>
  );
}

// Beside a secondary action: the outline twin is hand-rolled in the app with
// exactly these classes (settings, sheets). PrimaryButton takes flex-1.
export function WithSecondary() {
  return (
    <div className="flex w-full max-w-sm gap-2.5">
      <button
        type="button"
        className="border-control-border text-body h-12 w-full flex-1 rounded-[15px] border-[1.5px] text-sm font-semibold"
      >
        Cancel
      </button>
      <PrimaryButton className="flex-1">Save</PrimaryButton>
    </div>
  );
}
