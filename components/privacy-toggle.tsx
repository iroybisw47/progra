"use client";

import { Checkbox } from "@/components/ui/checkbox";

// Flag-gated private/shared control for goals, habits, and sessions (social v2).
// Checked = private (owner-only); unchecked = shared with accepted friends —
// enforced once the Aspect 4 RLS rewrite lands. Callers render this only when
// SOCIAL_ENABLED, so it never appears for current beta users.
export function PrivacyToggle({
  id,
  checked,
  onCheckedChange,
}: {
  id: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="border-border bg-muted/30 flex cursor-pointer items-start gap-2.5 rounded-lg border p-3"
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        className="mt-0.5"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">Private</span>
        <span className="text-muted-foreground text-xs">
          Only you can see this. Uncheck to share it with your friends.
        </span>
      </span>
    </label>
  );
}
