"use client";

import { toast } from "sonner";
import { CopyIcon, Share2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";

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
export function InviteShare({ username }: { username: string }) {
  const linkFor = () =>
    typeof window !== "undefined"
      ? `${window.location.origin}/i/${username}`
      : `https://${SITE_HOST}/i/${username}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(linkFor());
      toast.success("Invite link copied");
    } catch {
      toast.error("Couldn't copy — long-press the link to copy it.");
    }
  }

  async function share() {
    const nav = navigator as ShareCapableNavigator;
    if (typeof nav.share === "function") {
      try {
        await nav.share({ title: "Progra", text: SHARE_TEXT, url: linkFor() });
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
      <Button onClick={share} className="h-11 w-full text-base">
        <Share2Icon className="size-4" /> Share invite link
      </Button>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy invite link"
        className="border-hairline hover:bg-muted/30 flex items-center gap-2 rounded-xl border px-4 py-3 text-left transition-colors active:scale-[.99]"
      >
        <span className="min-w-0 flex-1 truncate font-mono text-sm">
          {SITE_HOST}/i/{username}
        </span>
        <CopyIcon className="text-faint size-4 shrink-0" />
      </button>
    </div>
  );
}
