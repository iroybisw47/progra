// Runs a server action and turns a thrown transport error into the same
// `{ error }` shape the actions already return. Every action's return type is a
// union with `{ error: string }`, so a caller that does `if ("error" in r)`
// already handles the failure — this just makes a rejected POST take that same
// path instead of escaping as an uncaught error.
//
// Why this is needed: an action's POST can reject rather than resolve — most
// often deploy skew, where a tab open across a deploy posts an action id the
// new build no longer knows and Next answers with a non-RSC response. On
// /clock/live that left the running session on a dead screen with no error
// boundary to catch it, so the fix is to catch the rejection here and let the
// caller show a toast.
export async function runAction<T>(
  action: Promise<T>
): Promise<T | { error: string }> {
  try {
    return await action;
  } catch {
    return {
      error: "Couldn't reach the server. Reload the page and try again.",
    };
  }
}
