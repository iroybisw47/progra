import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { SOCIAL_PUSH } from "@/lib/flags";
import { sendApnsAlert } from "@/lib/push/apns";
import {
  commentDedupeKey,
  composeSocialPush,
  likeDedupeKey,
} from "@/lib/push/social-push";

// The social-push orchestrator: who gets told, whether they already were, and
// the sends themselves. Called ONLY inside next/server's after(), so it can
// neither slow nor fail the like/comment action — and it NEVER throws.
//
// AUTHORIZATION PRECONDITION (why the service-role reads below are safe):
// callers invoke this only after the like/comment write itself succeeded under
// RLS / the toggle_reaction definer's can_see_session check. That success IS
// the proof the actor may see this session — established before the admin
// client touches anything, the same authenticate-then-admin discipline as
// uploadSessionPhoto (see lib/supabase/admin.ts). The admin client exists here
// because the RECIPIENT's rows (device tokens, opt-out) are owner-only under
// RLS, and the recipient is precisely not the caller.

export type SocialPushEvent =
  | { kind: "like"; sessionId: string; actorId: string; emoji: string }
  | {
      kind: "comment";
      sessionId: string;
      actorId: string;
      // Null when the insert's returning select came back empty (shouldn't
      // happen; degrades to once-per-session dedupe rather than none).
      commentId: string | null;
      body: string;
    };

export async function sendSocialPush(event: SocialPushEvent): Promise<void> {
  try {
    if (!SOCIAL_PUSH) return;
    const admin = createAdminClient();

    // Recipient + label from the session row, resolved HERE rather than in the
    // action, so the action adds zero pre-response work.
    const { data: session, error: sessionErr } = await admin
      .from("sessions")
      .select("user_id, task_name")
      .eq("id", event.sessionId)
      .maybeSingle();
    if (sessionErr) {
      console.error("[push] session read failed:", sessionErr.message);
      return;
    }
    const recipient = (session as { user_id: string; task_name: string } | null)
      ?.user_id;
    if (!recipient) {
      console.error(`[push] session ${event.sessionId} not found`);
      return;
    }
    if (recipient === event.actorId) {
      console.log("[push] self-event, skipping");
      return;
    }

    // Opt-out before the dedupe claim, so an opted-out user's slots aren't
    // burned — turning pushes on later still delivers a first-time like.
    const { data: prefRow, error: prefErr } = await admin
      .from("profiles")
      .select("social_pushes_enabled")
      .eq("id", recipient)
      .maybeSingle();
    if (prefErr) {
      // Most likely the column SQL hasn't been run — say so, loudly.
      console.error("[push] opt-out read failed (SQL run?):", prefErr.message);
      return;
    }
    if (
      (prefRow as { social_pushes_enabled: boolean | null } | null)
        ?.social_pushes_enabled === false
    ) {
      console.log("[push] recipient opted out, skipping");
      return;
    }

    // Claim the dedupe slot BEFORE sending: the upsert with ignoreDuplicates
    // returns the row only when THIS call inserted it, so concurrent toggles
    // race on the primary key, not on a read-then-write. At-most-once — a
    // failed send burns the slot, which is the right trade for a nicety.
    const key =
      event.kind === "like"
        ? likeDedupeKey(event.actorId, event.sessionId)
        : event.commentId !== null
          ? commentDedupeKey(event.commentId)
          : // Degraded: no comment id, fall back to once-per-session.
            `comment:${event.actorId}:${event.sessionId}`;
    const { data: claimed, error: claimErr } = await admin
      .from("push_log")
      .upsert(
        { key, user_id: recipient },
        { onConflict: "key", ignoreDuplicates: true }
      )
      .select("key");
    if (claimErr) {
      // A missing push_log table must not masquerade as "already sent".
      console.error("[push] dedupe claim failed (SQL run?):", claimErr.message);
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
      // The interesting failure mode while registration remains unverified in
      // prod — say so in the logs rather than vanish.
      console.error(`[push] no device tokens for recipient ${recipient}`);
      return;
    }

    const { data: actorRow } = await admin
      .from("profiles")
      .select("display_name, username")
      .eq("id", event.actorId)
      .maybeSingle();
    const actor = actorRow as {
      display_name: string | null;
      username: string | null;
    } | null;

    const content = composeSocialPush({
      kind: event.kind,
      actorName: actor?.display_name ?? actor?.username ?? "A friend",
      emoji: event.kind === "like" ? event.emoji : undefined,
      sessionId: event.sessionId,
      taskName:
        (session as { task_name: string } | null)?.task_name ?? "your session",
      commentBody: event.kind === "comment" ? event.body : undefined,
    });

    console.log(
      `[push] sending ${event.kind} to ${tokens.length} device(s) for ${recipient}`
    );
    for (const token of tokens) {
      const result = await sendApnsAlert(token, content);
      console.log(`[push] APNs result: ${result}`);
      if (result === "gone") {
        // Dead token (unregistered, or a sandbox token against the production
        // host) — delete so we stop paying for it. A live device re-registers
        // on next app open.
        await admin
          .from("device_tokens")
          .delete()
          .eq("user_id", recipient)
          .eq("token", token);
      }
    }
  } catch (err) {
    // A push may never break anything — including the after() callback.
    console.error("[push] sendSocialPush failed:", err);
  }
}
