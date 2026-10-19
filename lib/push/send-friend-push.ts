import "server-only";

import { SOCIAL_PUSH } from "@/lib/flags";
import { sendApnsAlert } from "@/lib/push/apns";
import {
  composeFriendAcceptedPush,
  composeFriendRequestPush,
  friendAcceptedKey,
  friendRequestKey,
} from "@/lib/push/friend-push";
import { logRemoteNotification, newNotificationId } from "@/lib/push/notification-log";
import { createAdminClient } from "@/lib/supabase/admin";

// The friend-push orchestrator: "X sent you a friend request" to the
// addressee, and "X accepted your friend request" to the requester. Called
// ONLY inside next/server's after(), so it can neither slow nor fail the
// action, and it NEVER throws.
//
// AUTHORIZATION PRECONDITION (why the service-role reads below are safe; the
// same warrant as send-nudge-push.ts): this runs only after the write it
// reports succeeded under RLS: sendFriendRequest's insert, or
// accept_friend_request, the definer that lets only a pending row's addressee
// accept. The recipient is read from the friendships row, never taken from
// the caller, and the caller must be the row's requester (request) or
// addressee (accepted). The row is re-read at send time and must still be in
// the state the push describes, so a request undone or blocked before this
// runs (onboarding v3's "✓ Added" toggle undoes in a tap) sends nothing. The
// admin client is needed because the RECIPIENT's rows (device tokens, push
// opt-out) are owner-only under RLS, and the recipient is precisely not the
// caller.

type FriendshipRow = {
  requester_id: string;
  addressee_id: string;
  status: string;
};

export async function sendFriendPush(event: {
  kind: "request" | "accepted";
  friendshipId: string;
  actorId: string;
}): Promise<void> {
  try {
    if (!SOCIAL_PUSH) return;
    const admin = createAdminClient();

    const { data: rowData, error: rowErr } = await admin
      .from("friendships")
      .select("requester_id, addressee_id, status")
      .eq("id", event.friendshipId)
      .maybeSingle();
    if (rowErr) {
      console.error("[push] friendship read failed:", rowErr.message);
      return;
    }
    const row = rowData as FriendshipRow | null;
    if (!row) {
      // Undone (cancelled or declined) before this ran.
      console.log(`[push] friendship ${event.friendshipId} gone, skipping`);
      return;
    }

    let recipient: string;
    if (event.kind === "request") {
      if (row.status !== "pending" || row.requester_id !== event.actorId) {
        console.log("[push] request no longer pending from this actor, skipping");
        return;
      }
      recipient = row.addressee_id;
    } else {
      if (row.status !== "accepted" || row.addressee_id !== event.actorId) {
        console.log("[push] friendship not accepted by this actor, skipping");
        return;
      }
      recipient = row.requester_id;
    }
    if (recipient === event.actorId) return;

    // Opt-out before the dedupe claim, so an opted-out user's slots aren't
    // burned. The same switch as likes, comments and nudges.
    const { data: prefRow, error: prefErr } = await admin
      .from("profiles")
      .select("social_pushes_enabled")
      .eq("id", recipient)
      .maybeSingle();
    if (prefErr) {
      console.error("[push] opt-out read failed:", prefErr.message);
      return;
    }
    if (
      (prefRow as { social_pushes_enabled: boolean | null } | null)
        ?.social_pushes_enabled === false
    ) {
      console.log("[push] recipient opted out, skipping");
      return;
    }

    // At most once per row and kind.
    const key =
      event.kind === "request"
        ? friendRequestKey(event.friendshipId)
        : friendAcceptedKey(event.friendshipId);
    const { data: claimed, error: claimErr } = await admin
      .from("push_log")
      .upsert({ key, user_id: recipient }, { onConflict: "key", ignoreDuplicates: true })
      .select("key");
    if (claimErr) {
      console.error("[push] dedupe claim failed:", claimErr.message);
      return;
    }
    if (!claimed || claimed.length === 0) {
      console.log(`[push] already sent (${key}), skipping`);
      return;
    }

    const { data: tokenRows } = await admin
      .from("device_tokens")
      .select("token")
      .eq("user_id", recipient);
    const tokens = (tokenRows ?? []).map((r) => (r as { token: string }).token);
    if (tokens.length === 0) {
      console.error(`[push] no device tokens for recipient ${recipient}`);
      return;
    }

    const { data: actorRow } = await admin
      .from("profiles")
      .select("display_name, username")
      .eq("id", event.actorId)
      .maybeSingle();
    const actor = actorRow as { display_name: string | null; username: string | null } | null;
    const actorName = actor?.display_name ?? actor?.username ?? "Someone";
    const content =
      event.kind === "request"
        ? composeFriendRequestPush(actorName)
        : composeFriendAcceptedPush(actorName, actor?.username ?? null);
    const type = event.kind === "request" ? "friend_request" : "friend_accepted";

    const nid = newNotificationId();
    let accepted = false;
    for (const token of tokens) {
      const result = await sendApnsAlert(token, { ...content, collapseId: key, nid, ntype: type });
      if (result === "ok") accepted = true;
      if (result === "gone") {
        await admin.from("device_tokens").delete().eq("user_id", recipient).eq("token", token);
      }
    }
    await logRemoteNotification(admin, {
      id: nid,
      key,
      userId: recipient,
      type,
      status: accepted ? "sent" : "failed",
      relatedKind: "friendship",
      relatedId: event.friendshipId,
    });
  } catch (err) {
    console.error("[push] friend push failed:", err);
  }
}
