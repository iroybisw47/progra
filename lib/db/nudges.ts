import "server-only";

import { cache } from "react";

import { NUDGES } from "@/lib/flags";
import {
  NUDGE_HIDDEN,
  parseNudgeState,
  type NudgeState,
} from "@/lib/social/nudges";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validate";

// Everything the profile's Nudge button needs, in one call.
//
// It has to be an RPC rather than reads on this page's existing data: the
// profiles SELECT policy is owner-only, so the viewer cannot read the
// recipient's timezone, opt-out or onboarding state, and the page's own "today"
// is computed in the VIEWER's timezone. get_nudge_state is SECURITY DEFINER and
// resolves the day in the RECIPIENT's timezone, sharing one internal function
// with send_nudge so the button and the send can never disagree.
//
// Returns hidden on anything unexpected — the RPC is the authority, and a
// button that will be refused is worse than no button.
export const getNudgeState = cache(
  async (recipientId: string): Promise<NudgeState> => {
    if (!NUDGES || !isUuid(recipientId)) return NUDGE_HIDDEN;
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_nudge_state", {
      p_recipient: recipientId,
    });
    if (error) return NUDGE_HIDDEN;
    return parseNudgeState(data);
  }
);
