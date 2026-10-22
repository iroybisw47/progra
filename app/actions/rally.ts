"use server";

import { after } from "next/server";

import { getCurrentUser } from "@/lib/auth/require-user";
import { requireSeat } from "@/lib/auth/require-seat";
import { RALLY } from "@/lib/flags";
import { sendNudgePush } from "@/lib/push/send-nudge-push";
import { revalidateRallySurfaces } from "@/lib/revalidate";
import {
  isNudgePreset,
  isPraisePreset,
  parseSendNudgeResult,
  type NudgeRefusal,
} from "@/lib/social/nudges";
import { isRallyKind, rallyRejectionFallback } from "@/lib/social/rally";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validate";

type SendResult =
  | { ok: true; nudgeId: string; pushed: boolean }
  | ({ error: string } & NudgeRefusal);

const UNAVAILABLE = { reason: "unavailable", cooldownUntil: null, opensAt: null } as const;

// Cheer a friend on for one habit, or nudge them about a habit, a goal or
// their streak.
//
// The DB is the real gate: send_rally re-checks friendship, blocking, the
// opt-out and per-friend mute, the 09:00 floor, the mode and the target, and
// the shared 6-hour per-pair cooldown, under the same per-recipient lock as
// send_nudge. The checks here only save a round-trip. As with sendNudge, a bad
// TARGET is always the generic "unavailable", so this can't probe private rows.
export async function sendRally(input: {
  recipientId: string;
  kind: string;
  targetId: string | null;
  preset: string;
}): Promise<SendResult> {
  if (!RALLY) {
    return { error: "Rally isn't available.", ...UNAVAILABLE };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not authenticated", ...UNAVAILABLE };
  }
  const seat = await requireSeat();
  if ("error" in seat) {
    return { ...seat, ...UNAVAILABLE };
  }

  const { recipientId, kind, targetId, preset } = input;
  if (
    !isUuid(recipientId) ||
    !isRallyKind(kind) ||
    !(isNudgePreset(preset) || isPraisePreset(preset)) ||
    (kind === "streak" ? targetId !== null : !isUuid(targetId))
  ) {
    return { error: "Couldn't send that rally.", ...UNAVAILABLE };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("send_rally", {
    p_recipient: recipientId,
    p_kind: kind,
    p_target: targetId,
    p_preset: preset,
  });
  if (error) {
    return { error: "Couldn't send that rally.", ...UNAVAILABLE };
  }

  // send_rally answers in send_nudge's shape, so its parser serves both.
  const result = parseSendNudgeResult(data);
  if (!result.ok) {
    return {
      error: rallyRejectionFallback(result),
      reason: result.reason,
      cooldownUntil: result.cooldownUntil,
      opensAt: result.opensAt,
    };
  }

  // A rally is a nudges row, so the nudge push sender handles it as is.
  after(() =>
    sendNudgePush({
      nudgeId: result.nudgeId,
      actorId: user.id,
      coalescedWith: result.pushed ? null : coalescedWith(data),
    })
  );

  revalidateRallySurfaces();
  return { ok: true, nudgeId: result.nudgeId, pushed: result.pushed };
}

// Mute or unmute one friend's rallies. Plain RLS on rally_mutes: the row's
// muter must be the caller, and the muted friend can never read it.
export async function setRallyMuted(input: {
  userId: string;
  muted: boolean;
}): Promise<{ ok: true } | { error: string }> {
  if (!RALLY) return { error: "Rally isn't available." };
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(input.userId) || input.userId === user.id) {
    return { error: "Couldn't save — try again." };
  }

  const supabase = await createClient();
  const { error } = input.muted
    ? await supabase
        .from("rally_mutes")
        .upsert(
          { muter_id: user.id, muted_id: input.userId },
          { onConflict: "muter_id,muted_id", ignoreDuplicates: true }
        )
    : await supabase
        .from("rally_mutes")
        .delete()
        .eq("muter_id", user.id)
        .eq("muted_id", input.userId);
  if (error) return { error: "Couldn't save — try again." };

  revalidateRallySurfaces();
  return { ok: true };
}

// The anchor of the 60-minute push window this rally fell into; see
// app/actions/nudges.ts.
function coalescedWith(raw: unknown): string | null {
  if (typeof raw !== "object" || raw === null) return null;
  const value = (raw as Record<string, unknown>).coalesced_with;
  return typeof value === "string" ? value : null;
}
