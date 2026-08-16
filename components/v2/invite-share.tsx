"use client";

import { toast } from "sonner";

import { track } from "@/lib/analytics";

// The Web Share API isn't on every navigator at the TS lib level.
type ShareCapableNavigator = Navigator & {
  share?: (data: {
    title?: string;
    text?: string;
    url?: string;
  }) => Promise<void>;
};

// Canonical host for the DISPLAYED link. The actual shared/copied URL is built
// from window.location.origin at click time, so it's environment-correct
// (localhost in dev, the real host in prod) without any render-time window read.
const SITE_HOST = "progra.world";
const SHARE_TEXT =
  "Join me on Progra — we track our study time and keep each other honest.";

// Share/copy the current user's own invite link (/i/{username}). Used by the
// onboarding invite step and the empty-feed state. No state/effect: the button
// reads window only inside click handlers, so it's hydration-safe.
export function InviteShare({
  username,
  message,
}: {
  username: string;
  // Onboarding personalises this ("My goal this week is to spend 5 hours on
  // …"); everywhere else falls back to the generic line.
  message?: string;
}) {
  const text = message ?? SHARE_TEXT;
  const linkFor = () =>
    typeof window !== "undefined"
      ? `${window.location.origin}/i/${username}`
      : `https://${SITE_HOST}/i/${username}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${text}\n${linkFor()}`);
      toast.success("Invite link copied");
    } catch {
      toast.error("Couldn't copy — long-press the link to copy it.");
    }
  }

  async function share() {
    const nav = navigator as ShareCapableNavigator;
    if (typeof nav.share === "function") {
      try {
        await nav.share({ title: "Progra", text, url: linkFor() });
        // Only after the sheet resolves — an AbortError below means the user
        // dismissed it, which isn't an invite.
        track("invite_sent", { method: "share_sheet" });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return; // user dismissed the sheet
        // any other failure → fall through to copy
      }
    }
    copy();
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
