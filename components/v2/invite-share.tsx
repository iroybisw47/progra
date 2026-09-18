"use client";

import { toast } from "sonner";

import { APP_STORE_DISPLAY } from "@/lib/app-store";
import { DEFAULT_INVITE_TEXT, copyInvite, shareInvite } from "@/lib/invite-share";

// Share/copy an invite to Progra. Used by the empty-feed state and /refer (and,
// before the 2026-09-15 redesign, the onboarding invite step). Takes no
// username: since 2026-09-17 every invite carries the App Store link, which is
// the same for everyone. A call site that wants the inviter's handle in the
// invite puts it in `message` — it already knows the handle, the lib doesn't
// need to. No state/effect: the buttons read navigator only inside click
// handlers, so it's hydration-safe.
export function InviteShare({ message }: { message?: string }) {
  const text = message ?? DEFAULT_INVITE_TEXT;

  async function copy() {
    if (await copyInvite(text)) toast.success("Invite copied");
    else toast.error("Couldn't copy — try Share invite instead.");
  }

  async function share() {
    const outcome = await shareInvite(text);
    if (outcome === "copied") toast.success("Invite copied");
    if (outcome === "failed") toast.error("Couldn't share the invite. Try again.");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={copy}
          className="border-hairline text-body h-12 flex-1 rounded-[15px] border-[1.5px] text-sm font-semibold transition-transform active:scale-[.97]"
        >
          Copy message
        </button>
        <button
          type="button"
          onClick={share}
          className="bg-brand text-primary-foreground h-12 flex-1 rounded-[15px] text-sm font-semibold shadow-[0_10px_22px_-10px_rgba(28,58,94,.55)] transition-transform active:scale-[.97]"
        >
          Share invite
        </button>
      </div>
      <span className="text-faint truncate text-center text-[11px]">
        {APP_STORE_DISPLAY}
      </span>
    </div>
  );
}
