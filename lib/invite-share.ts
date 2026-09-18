// Sharing an invite to Progra. Client-side only — reads navigator — but a plain
// module, so the onboarding footer CTA and the InviteShare buttons call the same
// function and send the same text.
//
// The shared URL is the APP STORE LISTING, not /i/{username} (2026-09-17).
// /i/{username} is still live for links already in the wild — it just isn't what
// a new share hands out. The knowing trade-off: an App Store install carries no
// referrer, so inviter and invitee are NOT auto-friended the way the /i/ path
// does it (that path rides ?ref= through OAuth into claim_invite), and
// profiles.referred_by stops filling for new installs. Copy that promised
// automatic friendship changed with this; the copy on /i/{username} itself did
// not, because that path still works.

import { track } from "@/lib/analytics";
import { APP_STORE_URL } from "@/lib/app-store";

// The Web Share API isn't on every navigator at the TS lib level.
type ShareCapableNavigator = Navigator & {
  share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
};

export const DEFAULT_INVITE_TEXT =
  "Join me on Progra — we track our study time and keep each other honest.";

// The Settings → "Share with friends" message. First person and asking for
// something, where DEFAULT_INVITE_TEXT describes the app — a share you go to
// Settings to send is aimed at people you already know. Ends mid-sentence on
// purpose: inviteBody() puts the App Store link on the next line, so the two
// read as one message ("...Join me at" / link).
export const ACCOUNTABILITY_INVITE_TEXT =
  "I'm getting 1% better every day on Progra, and I need you to hold me accountable! Join me at";

// Message AND link, as one block. Every share path sends exactly this, so what
// gets pasted into a chat can't depend on which button was tapped. Pure and
// window-free now that the link is a constant — hence unit-tested.
export function inviteBody(text: string): string {
  return `${text}\n${APP_STORE_URL}`;
}

export type ShareOutcome = "shared" | "copied" | "dismissed" | "failed";

export async function copyInvite(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(inviteBody(text));
    return true;
  } catch {
    return false;
  }
}

// Native share sheet where there is one, clipboard otherwise. Only a share
// that RESOLVED counts as an invite sent; dismissing the sheet does not.
export async function shareInvite(text: string): Promise<ShareOutcome> {
  const nav = navigator as ShareCapableNavigator;
  if (typeof nav.share === "function") {
    try {
      // The link rides inside `text` rather than in `url`. Share targets pick
      // and choose between the two fields — several of the ones people
      // actually invite through take the text and drop the url, which sent
      // an invite with no way to accept it. Passing both instead would print
      // the link twice wherever a target honours both.
      await nav.share({ title: "Progra", text: inviteBody(text) });
      track("invite_sent", { method: "share_sheet" });
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "dismissed";
      // any other failure → fall through to copy
    }
  }
  return (await copyInvite(text)) ? "copied" : "failed";
}
