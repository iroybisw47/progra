import { useState } from "react";
import { ToggleSwitch } from "progra";

export function On() {
  return <ToggleSwitch checked onCheckedChange={() => {}} ariaLabel="Share to feed" />;
}

export function Off() {
  return <ToggleSwitch checked={false} onCheckedChange={() => {}} ariaLabel="Share to feed" />;
}

// No Disabled cell: `disabled` blocks taps and is announced to screen readers,
// but the switch doesn't dim, so it would photograph identically to Off.

// The Settings row recipe it usually sits in.
export function InSettingsRow() {
  const [on, setOn] = useState(true);
  return (
    <div className="w-full" style={{ maxWidth: 390 }}>
      <div className="border-divider flex items-center gap-3 border-t px-5 py-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-body text-[13.5px] font-medium">Friend activity</span>
          <span className="text-caption text-xs">Likes and comments on your sessions</span>
        </div>
        <ToggleSwitch checked={on} onCheckedChange={setOn} ariaLabel="Friend activity" />
      </div>
    </div>
  );
}
