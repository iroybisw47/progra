import "server-only";

import { SOCIAL_PUSH, STREAKS } from "@/lib/flags";
import { sendApnsAlert } from "@/lib/push/apns";
import { logRemoteNotification, newNotificationId } from "@/lib/push/notification-log";
import {
  composeStreakPush,
  streakCollapseId,
  streakDedupeKey,
  streakTtlSeconds,
  type StreakPushKind,
} from "@/lib/push/streak-push";
import { createAdminClient } from "@/lib/supabase/admin";

// The streak push orchestrator: the 7pm reminder and the "a freeze was used"
// note. Called ONLY from the cron route (app/api/cron/streaks/route.ts), and it
// NEVER throws — one user's dead token must not stop the fan-out.
//
// AUTHORIZATION PRECONDITION — the same warrant as the recap sender (kind 3 in
// lib/supabase/admin.ts), because this too has no caller, only a clock:
//
//   1. the route handler matched CRON_SECRET before calling this, and
//   2. streak_push_candidates() is a SECURITY DEFINER function, revoked from
//      anon and authenticated, that decides entirely on its own who is due,
//      in their own stored timezone, outside quiet hours. Every field this
//      sender acts on comes from that function's row.
//
// Nothing here reads a user id off a request, and the opt-out is re-checked
// here rather than taken on trust from the RPC.

export async function sendStreakPush(candidate: {
  userId: string;
  kind: StreakPushKind;
  // YYYY-MM-DD streak day: today for a reminder, the frozen day for a freeze.
  day: string;
  current: number;
}): Promise<"sent" | "skipped"> {
  try {
    if (!STREAKS || !SOCIAL_PUSH) return "skipped";
    const admin = createAdminClient();

    // The one switch between a person and a buzz. Opt-OUT polarity: null is
    // on, only `false` suppresses (the recap and social pushes share it).
    const { data: prefRow, error: prefErr } = await admin
      .from("profiles")
      .select("social_pushes_enabled")
      .eq("id", candidate.userId)
      .maybeSingle();
    if (prefErr) {
      console.error("[push] streak opt-out read failed:", prefErr.message);
      return "skipped";
    }
    if (
      (prefRow as { social_pushes_enabled: boolean | null } | null)
        ?.social_pushes_enabled === false
    ) {
      return "skipped";
    }

    // At most once per person per kind per day: the candidate windows span
    // several hourly runs, and every run after the first loses this claim. A
    // failed send burns the slot on purpose — better a missed reminder than a
    // repeat buzz every hour.
    const key = streakDedupeKey(candidate.kind, candidate.userId, candidate.day);
    const { data: claimed, error: claimErr } = await admin
      .from("push_log")
      .upsert(
        { key, user_id: candidate.userId },
        { onConflict: "key", ignoreDuplicates: true }
      )
      .select("key");
    if (claimErr) {
      console.error("[push] streak dedupe claim failed:", claimErr.message);
      return "skipped";
    }
    if (!claimed || claimed.length === 0) return "skipped";

    const { data: tokenRows } = await admin
      .from("device_tokens")
      .select("token")
      .eq("user_id", candidate.userId);
    const tokens = (tokenRows ?? []).map((r) => (r as { token: string }).token);
    if (tokens.length === 0) return "skipped";

    const content = composeStreakPush({
      kind: candidate.kind,
      current: candidate.current,
    });
    const type = candidate.kind === "reminder" ? "streak_reminder" : "streak_freeze";

    const nid = newNotificationId();
    let accepted = false;
    for (const token of tokens) {
      const result = await sendApnsAlert(token, {
        ...content,
        collapseId: streakCollapseId(candidate.kind, candidate.day),
        ttlSeconds: streakTtlSeconds(candidate.kind),
        nid,
        ntype: type,
      });
      if (result === "ok") accepted = true;
      if (result === "gone") {
        await admin
          .from("device_tokens")
          .delete()
          .eq("user_id", candidate.userId)
          .eq("token", token);
      }
    }
    await logRemoteNotification(admin, {
      id: nid,
      key,
      userId: candidate.userId,
      type,
      status: accepted ? "sent" : "failed",
      relatedKind: "streak_day",
    });
    return "sent";
  } catch (err) {
    console.error("[push] streak push failed:", err);
    return "skipped";
  }
}
