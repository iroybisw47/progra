// The fixed reaction palette. Kept out of the "use server" action file (which
// may only export async functions) and shared by the action, the reader, and
// the UI so all three agree on the allowed set + order. The DB RPC enforces the
// same set server-side.
export const REACTION_EMOJIS = ["👍", "🔥", "💪", "👏", "🎯"] as const;

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export function isReactionEmoji(value: string): value is ReactionEmoji {
  return (REACTION_EMOJIS as readonly string[]).includes(value);
}
