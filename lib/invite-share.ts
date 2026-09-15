// Sharing your own invite link (/i/{username}). Client-side only — reads
// window and navigator — but a plain module, so the onboarding footer CTA and
// the InviteShare buttons call the same function and send the same text.

import { track } from "@/lib/analytics";

// The Web Share API isn't on every navigator at the TS lib level.
type ShareCapableNavigator = Navigator & {
  share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
};

// Canonical host for DISPLAYING the link. The shared/copied URL is built from
// window.location.origin at call time, so it's environment-correct (localhost
// in dev, the real host in prod) without any render-time window read.
export const SITE_HOST = "progra.world";

export const DEFAULT_INVITE_TEXT =
  "Join me on Progra — we track our study time and keep each other honest.";

export function inviteLink(username: string): string {
  return typeof window !== "undefined"
    ? `${window.location.origin}/i/${username}`
    : `https://${SITE_HOST}/i/${username}`;
}

// Message AND link, as one block. Every share path sends exactly this, so what
// gets pasted into a chat can't depend on which button was tapped.
export function inviteBody(text: string, username: string): string {
  return `${text}\n${inviteLink(username)}`;
}

export type ShareOutcome = "shared" | "copied" | "dismissed" | "failed";

export async function copyInvite(text: string, username: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(inviteBody(text, username));
    return true;
  } catch {
    return false;
  }
}

// Native share sheet where there is one, clipboard otherwise. Only a share
// that RESOLVED counts as an invite sent; dismissing the sheet does not.
export async function shareInvite(text: string, username: string): Promise<ShareOutcome> {
  const nav = navigator as ShareCapableNavigator;
  if (typeof nav.share === "function") {
    try {
      // The link rides inside `text` rather than in `url`. Share targets pick
      // and choose between the two fields — several of the ones people
      // actually invite through take the text and drop the url, which sent
      // an invite with no way to accept it. Passing both instead would print
      // the link twice wherever a target honours both.
      await nav.share({ title: "Progra", text: inviteBody(text, username) });
      track("invite_sent", { method: "share_sheet" });
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "dismissed";
      // any other failure → fall through to copy
    }
  }
  return (await copyInvite(text, username)) ? "copied" : "failed";
}
