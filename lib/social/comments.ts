// Shared comment constants. Kept out of the "use server" action file, which may
// only export async functions.
export const COMMENT_MAX_LENGTH = 500;

// Trim + length-check a comment or reply body. The DB CHECK (1–500 after
// btrim) is the real authority; this gives the friendly error first.
export function validateCommentBody(
  body: string,
  noun: "Comment" | "Reply"
): { body: string } | { error: string } {
  const trimmed = body.trim();
  if (!trimmed) return { error: `${noun} can't be empty.` };
  if (trimmed.length > COMMENT_MAX_LENGTH) {
    return { error: `${noun} must be ${COMMENT_MAX_LENGTH} characters or fewer.` };
  }
  return { body: trimmed };
}
