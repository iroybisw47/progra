import "server-only";

import { cache } from "react";

import { RALLY } from "@/lib/flags";
import { RALLY_HIDDEN, parseRallyState, type RallyState } from "@/lib/social/rally";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validate";

// Everything the profile's Rally chip needs, in one call. An RPC for the same
// reasons as getNudgeState: the viewer can't read the friend's timezone or
// opt-out, and "today" has to be the FRIEND's day. get_rally_state shares one
// internal function with send_rally, so the chip and the send can't disagree.
//
// Returns hidden on anything unexpected, including the SQL not having run.
export const getRallyState = cache(
  async (recipientId: string): Promise<RallyState> => {
    if (!RALLY || !isUuid(recipientId)) return RALLY_HIDDEN;
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_rally_state", {
      p_recipient: recipientId,
    });
    if (error) return RALLY_HIDDEN;
    return parseRallyState(data);
  }
);

// Whether the viewer has muted `userId`'s rallies. rally_mutes' RLS returns
// only the viewer's own rows, so this can't see who muted the viewer.
export const getRallyMuted = cache(async (userId: string): Promise<boolean> => {
  if (!RALLY || !isUuid(userId)) return false;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rally_mutes")
    .select("muted_id")
    .eq("muted_id", userId)
    .maybeSingle();
  if (error) return false;
  return data !== null;
});
