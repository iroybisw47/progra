import "server-only";

import { getCurrentUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { REACTION_EMOJIS } from "@/lib/social/reactions";

export type ReactionSummary = {
  emoji: string;
  count: number;
  // Whether the current viewer is one of the reactors (drives the toggle UI).
  mine: boolean;
};

type ReactionRow = {
  session_id: string;
  emoji: string;
  user_id: string;
};

const EMOJI_ORDER = new Map(REACTION_EMOJIS.map((e, i) => [e as string, i]));

// Batch-load reactions for a set of feed sessions, grouped by session id and
// ordered by the fixed palette. RLS returns only reactions on sessions the
// viewer can see, so nothing here needs re-filtering.
export async function listReactionsForSessions(
  sessionIds: string[]
): Promise<Map<string, ReactionSummary[]>> {
  const grouped = new Map<string, ReactionSummary[]>();
  if (sessionIds.length === 0) return grouped;

  const me = await getCurrentUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("session_reactions")
    .select("session_id, emoji, user_id")
    .in("session_id", sessionIds);
  if (!data) return grouped;

  // session_id → emoji → { count, mine }
  const bySession = new Map<string, Map<string, { count: number; mine: boolean }>>();
  for (const row of data as ReactionRow[]) {
    let byEmoji = bySession.get(row.session_id);
    if (!byEmoji) {
      byEmoji = new Map();
      bySession.set(row.session_id, byEmoji);
    }
    const entry = byEmoji.get(row.emoji) ?? { count: 0, mine: false };
    entry.count += 1;
    if (me && row.user_id === me.id) entry.mine = true;
    byEmoji.set(row.emoji, entry);
  }

  for (const [sessionId, byEmoji] of bySession) {
    const summaries: ReactionSummary[] = [...byEmoji.entries()]
      .map(([emoji, { count, mine }]) => ({ emoji, count, mine }))
      .sort(
        (a, b) =>
          (EMOJI_ORDER.get(a.emoji) ?? 99) - (EMOJI_ORDER.get(b.emoji) ?? 99)
      );
    grouped.set(sessionId, summaries);
  }
  return grouped;
}
