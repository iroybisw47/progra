import "server-only";

import { NUDGES, SOCIAL_PUSH } from "@/lib/flags";
import { sendApnsAlert } from "@/lib/push/apns";
import {
  composeNudgePush,
  nudgeCollapseId,
  nudgeDedupeKey,
} from "@/lib/push/nudge-push";
import { isNudgeTargetKind } from "@/lib/social/nudges";
import { createAdminClient } from "@/lib/supabase/admin";

// The nudge-push orchestrator. Called ONLY inside next/server's after(), so it
// can neither slow nor fail sendNudge — and it NEVER throws.
//
// AUTHORIZATION PRECONDITION (why the service-role reads below are safe, and
// the third sanctioned use of the admin client): this runs only after
// send_nudge returned ok. That definer re-checked friendship, blocking, the
// recipient's opt-out, their local 09:00 floor, mid-session state and the
// cooldown, then wrote the row — so the row's existence IS the proof the sender
// may nudge this person. Note what is NOT trusted: the recipient is read from
// the nudge row, never taken from the caller, and the caller's id must match
// the row's sender. The admin client is needed because the RECIPIENT's rows
// (device tokens, push opt-out) are owner-only under RLS, and the recipient is
// precisely not the caller.

type NudgeRow = {
  sender_id: string;
  recipient_id: string;
  target_kind: string;
  goal_id: string | null;
  target_label: string;
  pushed: boolean;
  created_at: string;
};

export async function sendNudgePush(event: {
  nudgeId: string;
  actorId: string;
  // The nudge this one was folded into, when send_nudge found an open window.
  coalescedWith: string | null;
}): Promise<void> {
  try {
    if (!SOCIAL_PUSH || !NUDGES) return;
    const admin = createAdminClient();

    const { data: row, error: rowErr } = await admin
      .from("nudges")
      .select("sender_id, recipient_id, target_kind, goal_id, target_label, pushed, created_at")
      .eq("id", event.nudgeId)
      .maybeSingle();
    if (rowErr) {
      console.error("[push] nudge read failed (SQL run?):", rowErr.message);
      return;
    }
    const nudge = row as NudgeRow | null;
    if (!nudge) {
      console.error(`[push] nudge ${event.nudgeId} not found`);
      return;
    }
    // The caller must be the row's sender. Cheap, and it means a stray call
    // with someone else's nudge id can't make their phone buzz.
    if (nudge.sender_id !== event.actorId) {
      console.error("[push] actor is not the nudge's sender, skipping");
      return;
    }

    const recipient = nudge.recipient_id;

    // Opt-out before the dedupe claim, so an opted-out user's slots aren't
    // burned. This is the same "Likes, comments & nudges" switch.
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
      // The nudge still shows in their notifications panel — only the buzz is
      // suppressed.
      console.log("[push] recipient opted out, skipping");
      return;
    }

    // At-most-once per nudge. The 6-hour cooldown already bounds how often one
    // sender can reach one person, so every nudge here is genuinely new.
    const key = nudgeDedupeKey(event.nudgeId);
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
    const senderName = actor?.display_name ?? actor?.username ?? "A friend";

    // Coalesced: replace the banner already on the lock screen rather than add
    // a second buzz. The anchor's id is the shared collapse id, and the count
    // is of DISTINCT senders in the window — three nudges from one friend is
    // still one person caring.
    let content;
    let collapseAnchor = event.nudgeId;
    if (!nudge.pushed && event.coalescedWith) {
      const { data: anchorRow } = await admin
        .from("nudges")
        .select("created_at")
        .eq("id", event.coalescedWith)
        .maybeSingle();
      const since = (anchorRow as { created_at: string } | null)?.created_at;
      const { data: windowRows } = await admin
        .from("nudges")
        .select("sender_id")
        .eq("recipient_id", recipient)
        .gte("created_at", since ?? nudge.created_at)
        .lte("created_at", nudge.created_at);
      const senders = new Set(
        (windowRows ?? []).map((r) => (r as { sender_id: string }).sender_id)
      );
      const others = senders.size - 1;
      collapseAnchor = event.coalescedWith;
      content =
        others > 0
          ? composeNudgePush({ mode: "coalesced", senderName, othersCount: others })
          : // Only one distinct sender after all — the plain copy is truer.
            composeNudgePush({
              mode: "single",
              senderName,
              targetKind: isNudgeTargetKind(nudge.target_kind) ? nudge.target_kind : "habits",
              targetLabel: nudge.target_label,
              goalId: nudge.goal_id,
            });
    } else {
      content = composeNudgePush({
        mode: "single",
        senderName,
        targetKind: isNudgeTargetKind(nudge.target_kind) ? nudge.target_kind : "habits",
        targetLabel: nudge.target_label,
        goalId: nudge.goal_id,
      });
    }

    for (const token of tokens) {
      const result = await sendApnsAlert(token, {
        ...content,
        collapseId: nudgeCollapseId(collapseAnchor),
        silent: !nudge.pushed,
        // A nudge is about today. Don't deliver it tomorrow.
        ttlSeconds: 4 * 60 * 60,
      });
      if (result === "gone") {
        await admin.from("device_tokens").delete().eq("user_id", recipient).eq("token", token);
      }
    }
  } catch (err) {
    console.error("[push] nudge push failed:", err);
  }
}
