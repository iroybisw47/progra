"use client";

import { useState } from "react";
import { toast } from "sonner";

import { RallyButton } from "@/app/profile/[username]/rally-button";
import { AvatarInitials } from "@/components/avatar-initials";
import { rallyPreview, type RallyPreviewFixture } from "@/lib/rally-preview";

// The preview's body: /profile/[username]'s identity row with the real chip.
// Markup and classes copied from that page so the screenshot is honest.
export function RallyPreviewClient({
  fixture,
  sheet,
}: {
  fixture: RallyPreviewFixture;
  sheet: boolean;
}) {
  // Read once, on mount: a fixture's cooldown counts down from page load.
  const [now] = useState(() => Date.now());
  const state = rallyPreview(fixture, now);

  return (
    <div className="flex flex-1 flex-col items-center pt-7 pb-28">
      <main className="flex w-full max-w-md flex-col">
        <header className="flex items-center justify-between px-5">
          <span className="section-label">Profile</span>
          <span className="text-faint text-[11px]">preview · {fixture}</span>
        </header>
        <div className="flex items-start gap-3.5 px-5 pt-4">
          <AvatarInitials name="Maya Chen" username="maya" className="size-[58px] shrink-0 text-xl" />
          <div className="flex min-w-0 flex-1 flex-col pt-1">
            <h1 className="text-ink font-serif text-[22px] leading-[1.2] font-medium tracking-[-0.015em] text-balance">
              Maya Chen
            </h1>
            <span className="text-faint truncate text-[13px]">@maya</span>
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-1.5">
            <RallyButton
              state={state}
              recipientId="00000000-0000-4000-8000-000000000000"
              name="Maya Chen"
              initialOpen={sheet && state.status === "ok"}
              onSend={async ({ kind, preset }) => {
                toast(`Preview — not sent (${kind}, ${preset})`);
              }}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
