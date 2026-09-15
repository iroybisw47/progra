"use client";

import { toast } from "sonner";

import {
  DEFAULT_INVITE_TEXT,
  SITE_HOST,
  copyInvite,
  shareInvite,
} from "@/lib/invite-share";

// Share/copy the current user's own invite link (/i/{username}). Used by the
// empty-feed state (and, before the 2026-09-15 redesign, the onboarding invite
// step). No state/effect: the buttons read window only inside click handlers,
// so it's hydration-safe.
export function InviteShare({
  username,
  message,
}: {
  username: string;
  message?: string;
}) {
  const text = message ?? DEFAULT_INVITE_TEXT;

  async function copy() {
    if (await copyInvite(text, username)) toast.success("Invite link copied");
    else toast.error("Couldn't copy — long-press the link to copy it.");
  }

  async function share() {
    const outcome = await shareInvite(text, username);
    if (outcome === "copied") toast.success("Invite link copied");
    if (outcome === "failed") toast.error("Couldn't copy — long-press the link to copy it.");
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
        {SITE_HOST}/i/{username}
      </span>
    </div>
  );
}
