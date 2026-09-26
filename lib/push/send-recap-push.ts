import "server-only";

import { weekWindow } from "@/lib/dates";
import { RECAP_PUSH } from "@/lib/flags";
import { sendApnsAlert } from "@/lib/push/apns";
import {
  composeRecapPush,
  recapCollapseId,
  recapDedupeKey,
} from "@/lib/push/recap-push";
import { createAdminClient } from "@/lib/supabase/admin";

// The weekly-recap push orchestrator. Called ONLY from the cron route handler
// (app/api/cron/recap-ready/route.ts), and it NEVER throws — one user's dead
// token must not stop the fan-out for everyone behind them.
//
// AUTHORIZATION PRECONDITION (why the service-role reads below are safe, and
// the third sanctioned use of the admin client). The other two senders derive
// their warrant from a write that already succeeded under RLS. This one has NO
// CALLER AT ALL — nobody asked for it, a clock did — so the warrant is instead:
//
//   1. the route handler matched CRON_SECRET before calling this, and
//   2. recap_push_candidates() is a SECURITY DEFINER function, revoked from
//      anon and authenticated, that decides entirely on its own which users are
//      due. Every field this sender acts on comes from that function's row.
//
// What is NOT trusted: nothing here reads a user id off a request. The route
// handler passes through exactly what the RPC returned, and this function
// re-checks the opt-out itself rather than assuming the RPC did.
//
// The admin client is needed for the same reason as the other two: device
// tokens and the push opt-out are owner-only under RLS, and there is no
// session to read them under.

export async function sendRecapPush(candidate: {
  userId: string;
  // IANA name from profiles.timezone, as the RPC read it.
  timezone: string;
  // YYYY-MM-DD Monday of the week whose recap just unlocked.
  weekMonday: string;
}): Promise<"sent" | "skipped"> {
  try {
    if (!RECAP_PUSH) return "skipped";
    const admin = createAdminClient();

    // The RPC returns the Monday as a DATE and this is where it becomes epoch
    // ms — through weekWindow, the one source of truth every other recap
    // surface uses. Deriving it from SQL arithmetic instead could drift a
    // millisecond from what recap_views and the dedupe key assume.
    const { weekStartISO, weekStartMs } = weekWindow(
      candidate.timezone,
      candidate.weekMonday
    );

    // Re-checked here, not taken on trust from the RPC: this is the one switch
    // standing between a user and a buzz, and it costs one indexed read.
    // Opt-OUT polarity — null means on, only `false` suppresses.
    const { data: prefRow, error: prefErr } = await admin
      .from("profiles")
      .select("social_pushes_enabled")
      .eq("id", candidate.userId)
      .maybeSingle();
    if (prefErr) {
      console.error("[push] recap opt-out read failed:", prefErr.message);
      return "skipped";
    }
    if (
      (prefRow as { social_pushes_enabled: boolean | null } | null)
        ?.social_pushes_enabled === false
    ) {
      return "skipped";
    }

    // At-most-once per user per week. This is what makes the hourly cron safe:
    // the candidate query matches the WHOLE of Sunday evening local, so the
    // same user is returned by up to six consecutive runs and every run after
    // the first loses this claim. A failed send burns the slot on purpose —
    // better a missed recap than a repeat buzz every hour until midnight.
    const key = recapDedupeKey(candidate.userId, weekStartMs);
    const { data: claimed, error: claimErr } = await admin
      .from("push_log")
      .upsert(
        { key, user_id: candidate.userId },
        { onConflict: "key", ignoreDuplicates: true }
      )
      .select("key");
    if (claimErr) {
      console.error("[push] recap dedupe claim failed:", claimErr.message);
      return "skipped";
    }
    if (!claimed || claimed.length === 0) return "skipped";

    const { data: tokenRows } = await admin
      .from("device_tokens")
      .select("token")
      .eq("user_id", candidate.userId);
    const tokens = (tokenRows ?? []).map((r) => (r as { token: string }).token);
    if (tokens.length === 0) return "skipped";

    const content = composeRecapPush({ weekStartISO });

    for (const token of tokens) {
      const result = await sendApnsAlert(token, {
        ...content,
        collapseId: recapCollapseId(weekStartMs),
        // A recap is about the evening it lands in, but a phone that is off
        // overnight should still show it at breakfast. Longer than the nudge's
        // 4h, short of APNs' 24h default.
        ttlSeconds: 12 * 60 * 60,
      });
      if (result === "gone") {
        await admin
          .from("device_tokens")
          .delete()
          .eq("user_id", candidate.userId)
          .eq("token", token);
      }
    }
    return "sent";
  } catch (err) {
    console.error("[push] recap push failed:", err);
    return "skipped";
  }
}
