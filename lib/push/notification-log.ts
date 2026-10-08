import "server-only";

import { randomUUID } from "node:crypto";

import { ANALYTICS } from "@/lib/flags";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { NotificationType } from "@/lib/telemetry/events";

type AdminClient = ReturnType<typeof createAdminClient>;

// One notification_log row per remote push, written by the sender that holds
// the admin client (exception kinds 2 and 3 in lib/supabase/admin.ts) AFTER
// APNs answered. The id is minted BEFORE the send so the payload can carry it
// (`nid`) and a tap can come back to exactly this row. The key is the
// push_log dedupe key, so the two tables line up one to one.
//
// Never throws, never blocks a push: a missing table (SQL not run) is logged
// and forgotten. Off entirely while ANALYTICS is off.

export function newNotificationId(): string {
  return randomUUID();
}

export async function logRemoteNotification(
  admin: AdminClient,
  row: {
    id: string;
    key: string;
    userId: string;
    type: NotificationType;
    status: "sent" | "failed";
    relatedKind?: string | null;
    relatedId?: string | null;
  }
): Promise<void> {
  if (!ANALYTICS) return;
  try {
    const { error } = await admin.from("notification_log").upsert(
      {
        id: row.id,
        key: row.key,
        user_id: row.userId,
        type: row.type,
        channel: "remote",
        status: row.status,
        sent_at: new Date().toISOString(),
        related_kind: row.relatedKind ?? null,
        related_id: row.relatedId ?? null,
      },
      { onConflict: "key", ignoreDuplicates: true }
    );
    if (error) {
      console.error("[push] notification_log write failed (SQL run?):", error.message);
    }
  } catch (err) {
    console.error("[push] notification_log write threw:", err);
  }
}
