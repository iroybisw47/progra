import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { RECAP_PUSH } from "@/lib/flags";
import { sendRecapPush } from "@/lib/push/send-recap-push";
import { createAdminClient } from "@/lib/supabase/admin";

// The weekly-recap fan-out. THE FIRST SCHEDULED JOB IN THIS REPO — everything
// else time-based is lazy (<EnsureSessionCap/> and friends fire on the next
// page load), which cannot work here: the entire point is reaching someone who
// is NOT opening the app.
//
// Triggered hourly by Supabase pg_cron + pg_net (see .claude/plans/
// recap-push.sql), not by Vercel Cron — the Hobby plan allows 2 daily jobs, and
// Sunday 6pm local spans ~27 hours of UTC offsets.
//
// Hourly rather than exact because local 18:00 lands at ~27 distinct UTC
// instants and the :30/:45 zones (India, Nepal, Chatham) never align to the
// hour at all. So recap_push_candidates() matches the whole of Sunday evening
// local and push_log's primary key makes the overlap a no-op — which doubles as
// a catch-up window if a run fails.

// node:http2 in lib/push/apns.ts — Edge has no such module, and the default
// would silently change if this project ever set a global runtime.
export const runtime = "nodejs";
// Never prerendered, never cached: it reads the clock.
export const dynamic = "force-dynamic";

type Candidate = {
  user_id: string;
  timezone: string;
  week_monday: string;
};

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // No secret configured = closed, not open. An unset env var on a bad deploy
  // must not turn this into a public push button.
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  // Same length first — timingSafeEqual throws on a mismatch, and the length
  // itself is not a secret.
  if (header.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Flag off = the schedule can be created and watched in production (pg_net
  // logs every response to net._http_response) without a single buzz reaching
  // anyone. Note this returns 200: a no-op is a success, and a 401-vs-500
  // distinction in the pg_net log is more useful if "off" isn't a third state.
  if (!RECAP_PUSH) {
    return NextResponse.json({ due: 0, sent: 0, skipped: 0, flag: "off" });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("recap_push_candidates");
  if (error) {
    console.error("[cron] recap candidates failed (SQL run?):", error.message);
    return NextResponse.json({ error: "candidates_failed" }, { status: 500 });
  }

  const candidates = (data ?? []) as Candidate[];
  let sent = 0;
  let skipped = 0;

  // Serial, like the per-token loop in every sender: this runs at most a few
  // dozen times an hour against a 250-seat beta, and a burst of parallel APNs
  // HTTP/2 sessions buys nothing worth the thundering herd.
  for (const row of candidates) {
    const result = await sendRecapPush({
      userId: row.user_id,
      timezone: row.timezone,
      weekMonday: row.week_monday,
    });
    if (result === "sent") sent += 1;
    else skipped += 1;
  }

  return NextResponse.json({ due: candidates.length, sent, skipped });
}
