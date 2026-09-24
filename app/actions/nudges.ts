"use server";

import { after } from "next/server";

import { getCurrentUser } from "@/lib/auth/require-user";
import { requireSeat } from "@/lib/auth/require-seat";
import { NUDGES } from "@/lib/flags";
import { sendNudgePush } from "@/lib/push/send-nudge-push";
import { revalidateNudgeSurfaces } from "@/lib/revalidate";
import {
  isNudgePreset,
  isNudgeTargetKind,
  isPraisePreset,
  nudgeRejectionFallback,
  parseSendNudgeResult,
  type NudgeRefusal,
} from "@/lib/social/nudges";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validate";

type SendResult = { ok: true; pushed: boolean } | ({ error: string } & NudgeRefusal);

const UNAVAILABLE = { reason: "unavailable", cooldownUntil: null, opensAt: null } as const;

// Nudge a friend about one goal, or about their habits.
//
// The DB is the real gate: send_nudge re-checks friendship, blocking, the
// recipient's opt-out, their 09:00 local floor, whether they're in a visible
// session, and the 6-hour per-pair cooldown, inside one transaction holding a
// per-recipient advisory lock. The checks here only save a round-trip.
//
// Its rejections come back as data, not exceptions, because the client branches
// on them. A locked recipient's refusal carries the same reason the chip shows;
// a bad TARGET is always the generic "unavailable", so this can't be used to
// probe a friend's private goals.
export async function sendNudge(input: {
  recipientId: string;
  kind: string;
  goalId: string | null;
  preset: string;
}): Promise<SendResult> {
  if (!NUDGES) {
    return { error: "Nudges aren't available.", ...UNAVAILABLE };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not authenticated", ...UNAVAILABLE };
  }
  const seat = await requireSeat();
  if ("error" in seat) {
    return { ...seat, ...UNAVAILABLE };
  }

  const { recipientId, kind, goalId, preset } = input;
  // Either half's presets are valid here; send_nudge decides which list the
  // target must appear in, so a praise preset can't be spent on a prod target.
  if (
    !isUuid(recipientId) ||
    !isNudgeTargetKind(kind) ||
    !(isNudgePreset(preset) || isPraisePreset(preset))
  ) {
    return { error: "Couldn't send that nudge.", ...UNAVAILABLE };
  }
  // The RPC enforces this too; mirroring it keeps the shapes honest here.
  if (kind === "goal" ? !isUuid(goalId) : goalId !== null) {
    return { error: "Couldn't send that nudge.", ...UNAVAILABLE };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("send_nudge", {
    p_recipient: recipientId,
    p_kind: kind,
    p_goal: goalId,
    p_preset: preset,
  });
  if (error) {
    return { error: "Couldn't send that nudge.", ...UNAVAILABLE };
  }

  const result = parseSendNudgeResult(data);
  if (!result.ok) {
    // `error` is deliberately name-free: this layer knows ids, not display
    // names. The sheet re-renders it with the friend's name and the exact wait.
    return {
      error: nudgeRejectionFallback(result),
      reason: result.reason,
      cooldownUntil: result.cooldownUntil,
      opensAt: result.opensAt,
    };
  }

  // Push AFTER the response — the send already succeeded, and a slow or dead
  // APNs must not hold up the sender's UI. sendNudgePush never throws.
  after(() =>
    sendNudgePush({
      nudgeId: result.nudgeId,
      actorId: user.id,
      coalescedWith: result.pushed ? null : coalescedWith(data),
    })
  );

  // Only the sender's view changes: their button flips to cooldown. The
  // recipient's dot arrives through BottomNav's own badge poll, so there is
  // nothing to revalidate on their side.
  revalidateNudgeSurfaces();
  return { ok: true, pushed: result.pushed };
}

// The anchor nudge whose 60-minute push window this one fell into. Only read
// when pushed is false, and only to count distinct senders for the replacement
// banner — parseSendNudgeResult deliberately keeps it out of the public shape.
function coalescedWith(raw: unknown): string | null {
  if (typeof raw !== "object" || raw === null) return null;
  const value = (raw as Record<string, unknown>).coalesced_with;
  return typeof value === "string" ? value : null;
}
