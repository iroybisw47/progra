import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { SOCIAL_PUSH } from "@/lib/flags";
import { sendApnsAlert } from "@/lib/push/apns";
import {
  commentDedupeKey,
  composeSocialPush,
  likeDedupeKey,
  planReplyPushes,
  replyDedupeKey,
  type SocialPushContent,
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
//
// Recipients always come from DB rows, never from the caller: the session's
// owner, and — for a reply — the reply_to_author_id the thread-guard trigger
// stamped on the stored comment from the row it answered.

type AdminClient = ReturnType<typeof createAdminClient>;

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
    }
  | { kind: "reply"; sessionId: string; actorId: string; commentId: string; body: string };

type SessionRow = { user_id: string; task_name: string; is_private: boolean };

export async function sendSocialPush(event: SocialPushEvent): Promise<void> {
  try {
    if (!SOCIAL_PUSH) return;
    const admin = createAdminClient();

    // Recipient + label from the session row, resolved HERE rather than in the
    // action, so the action adds zero pre-response work.
    const { data: sessionData, error: sessionErr } = await admin
      .from("sessions")
      .select("user_id, task_name, is_private")
      .eq("id", event.sessionId)
      .maybeSingle();
    if (sessionErr) {
      console.error("[push] session read failed:", sessionErr.message);
      return;
    }
    const session = sessionData as SessionRow | null;
    if (!session) {
      console.error(`[push] session ${event.sessionId} not found`);
      return;
    }
    const taskName = session.task_name ?? "your session";

    // Read at most once, and only once a send is actually going ahead.
    let actorName: Promise<string> | null = null;
    const getActorName = () => (actorName ??= readActorName(admin, event.actorId));

    if (event.kind === "reply") {
      await sendReplyPushes(admin, event, session, taskName, getActorName);
      return;
    }

    const recipient = session.user_id;
    if (recipient === event.actorId) {
      console.log("[push] self-event, skipping");
      return;
    }

    // Claim key: likes once per (actor, session), comments once per comment.
    const key =
      event.kind === "like"
        ? likeDedupeKey(event.actorId, event.sessionId)
        : event.commentId !== null
          ? commentDedupeKey(event.commentId)
          : // Degraded: no comment id, fall back to once-per-session.
            `comment:${event.actorId}:${event.sessionId}`;

    await deliver(admin, recipient, key, event.kind, async () =>
      composeSocialPush({
        kind: event.kind,
        actorName: await getActorName(),
        emoji: event.kind === "like" ? event.emoji : undefined,
        sessionId: event.sessionId,
        taskName,
        commentBody: event.kind === "comment" ? event.body : undefined,
        commentId: event.kind === "comment" ? (event.commentId ?? undefined) : undefined,
      })
    );
  } catch (err) {
    // A push may never break anything — including the after() callback.
    console.error("[push] sendSocialPush failed:", err);
  }
}

// A reply can notify two people: whoever was replied to ("replied to you")
// and the post owner ("commented on", as for any comment) — see
// planReplyPushes for who gets which.
async function sendReplyPushes(
  admin: AdminClient,
  event: Extract<SocialPushEvent, { kind: "reply" }>,
  session: SessionRow,
  taskName: string,
  getActorName: () => Promise<string>
): Promise<void> {
  // The stored row is the authority on who was replied to. It must be the
  // actor's own comment on this session — the same check the nudge sender
  // makes — so a caller can't point this at someone else's comment.
  const { data: rowData, error: rowErr } = await admin
    .from("session_comments")
    .select("session_id, author_id, reply_to_author_id")
    .eq("id", event.commentId)
    .maybeSingle();
  const row = rowData as {
    session_id: string;
    author_id: string;
    reply_to_author_id: string | null;
  } | null;
  if (rowErr || !row) {
    console.error("[push] reply read failed:", rowErr?.message ?? "not found");
    return;
  }
  if (row.author_id !== event.actorId || row.session_id !== event.sessionId) {
    console.error(`[push] reply ${event.commentId} doesn't match its event, skipping`);
    return;
  }

  const plan = planReplyPushes({
    actorId: event.actorId,
    ownerId: session.user_id,
    replyToAuthorId: row.reply_to_author_id,
  });

  for (const { recipient, kind } of plan) {
    if (kind === "reply") {
      // Re-checked at send time, because the reply text rides in the push:
      // someone who commented and has since been unfriended (or blocked)
      // must not be sent a reply they can no longer see.
      if (!(await canStillSee(admin, recipient, session, event.actorId))) {
        console.log("[push] replied-to user can't see this session any more, skipping");
        continue;
      }
    }
    await deliver(
      admin,
      recipient,
      kind === "reply" ? replyDedupeKey(event.commentId) : commentDedupeKey(event.commentId),
      kind,
      async () =>
        composeSocialPush({
          kind,
          actorName: await getActorName(),
          sessionId: event.sessionId,
          taskName,
          commentBody: event.body,
          commentId: event.commentId,
        })
    );
  }
}

// The session-visibility rule (can_see_session) for someone who isn't the
// caller, plus no block between them and the actor.
async function canStillSee(
  admin: AdminClient,
  recipient: string,
  session: SessionRow,
  actorId: string
): Promise<boolean> {
  const { data: blocked, error: blockErr } = await admin.rpc("are_blocked", {
    a: actorId,
    b: recipient,
  });
  if (blockErr || blocked !== false) return false;
  if (recipient === session.user_id) return true;
  if (session.is_private) return false;
  const { data: friends, error: friendErr } = await admin.rpc("are_friends", {
    a: session.user_id,
    b: recipient,
  });
  return !friendErr && friends === true;
}

async function readActorName(admin: AdminClient, actorId: string): Promise<string> {
  const { data } = await admin
    .from("profiles")
    .select("display_name, username")
    .eq("id", actorId)
    .maybeSingle();
  const actor = data as { display_name: string | null; username: string | null } | null;
  return actor?.display_name ?? actor?.username ?? "A friend";
}

// One recipient: opt-out → dedupe claim → tokens → APNs → prune dead tokens.
async function deliver(
  admin: AdminClient,
  recipient: string,
  key: string,
  label: string,
  compose: () => Promise<SocialPushContent>
): Promise<void> {
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
  const { data: claimed, error: claimErr } = await admin
    .from("push_log")
    .upsert({ key, user_id: recipient }, { onConflict: "key", ignoreDuplicates: true })
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

  const content = await compose();
  console.log(`[push] sending ${label} to ${tokens.length} device(s) for ${recipient}`);
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
}
