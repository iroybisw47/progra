import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { SOCIAL_PUSH, STREAKS } from "@/lib/flags";
import { sendStreakPush } from "@/lib/push/send-streak-push";
import type { StreakPushKind } from "@/lib/push/streak-push";
import { createAdminClient } from "@/lib/supabase/admin";

// The hourly streak job (.claude/plans/streaks.md, P5). The SECOND scheduled
// job in this repo, after recap-ready, and for the same reason: lazy
// enforcement on page load can't reach someone who isn't opening the app, and
// that's exactly who a 7pm "today's still open" reminder is for.
//
// Each run does two things:
//   1. settle_all_streaks() writes every member's closed days into the ledger,
//      so a missed day is decided (a freeze used, or the run ended) even for
//      someone who hasn't opened the app since.
//   2. streak_push_candidates() says who is due a push right now, in their own
//      stored timezone, outside 22:00–07:59; push_log makes each one at most
//      once a day.
//
// Triggered by Supabase pg_cron + pg_net at :05 past every hour (STEP 4 of
// .claude/plans/streaks.sql), not Vercel Cron, for recap-ready's reasons.

// node:http2 in lib/push/apns.ts — Edge has no such module.
export const runtime = "nodejs";
// Never prerendered, never cached: it reads the clock.
export const dynamic = "force-dynamic";

type Candidate = {
  user_id: string;
  kind: StreakPushKind;
  day: string;
  timezone: string;
  current: number;
};

// recap-ready's check, word for word: closed when the secret is unset, length
// first, then a constant-time compare.
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (header.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Flag off = a 200 no-op, so the schedule can be created and watched in
  // net._http_response before anything is settled or sent.
  if (!STREAKS) {
    return NextResponse.json({ settled: 0, due: 0, sent: 0, skipped: 0, flag: "off" });
  }

  const admin = createAdminClient();

  // Settling doesn't push anything, so it runs whether or not pushes are on.
  const { data: settled, error: settleErr } = await admin.rpc("settle_all_streaks");
  if (settleErr) {
    console.error("[cron] streak settle failed (SQL run?):", settleErr.message);
    return NextResponse.json({ error: "settle_failed" }, { status: 500 });
  }

  if (!SOCIAL_PUSH) {
    return NextResponse.json({ settled, due: 0, sent: 0, skipped: 0, push: "off" });
  }

  const { data, error } = await admin.rpc("streak_push_candidates");
  if (error) {
    console.error("[cron] streak candidates failed (SQL run?):", error.message);
    return NextResponse.json({ error: "candidates_failed" }, { status: 500 });
  }

  const candidates = (data ?? []) as Candidate[];
  let sent = 0;
  let skipped = 0;
  // Serial, like recap-ready: a few dozen a run at most.
  for (const row of candidates) {
    const result = await sendStreakPush({
      userId: row.user_id,
      kind: row.kind,
      day: row.day,
      current: row.current,
    });
    if (result === "sent") sent += 1;
    else skipped += 1;
  }

  return NextResponse.json({ settled, due: candidates.length, sent, skipped });
}
