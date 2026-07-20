// The fixed reaction palette. Kept out of the "use server" action file (which
// may only export async functions) and shared by the action, the reader, and
// the UI so all three agree on the allowed set + order. The DB RPC enforces the
// same set server-side.
export const REACTION_EMOJIS = ["👍", "🔥", "💪", "👏", "🎯"] as const;

// The feed's single "kudos" heart stores this emoji under the hood — it's an
// existing palette member, so the toggle_reaction RPC + CHECK constraint accept
// it with no DB change. The heart is only the button's appearance.
export const LIKE_EMOJI = "👍";

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export function isReactionEmoji(value: string): value is ReactionEmoji {
  return (REACTION_EMOJIS as readonly string[]).includes(value);
}
