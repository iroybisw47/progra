import type { Instrumentation } from "next";

// Server-side error capture. Next calls `onRequestError` whenever the server
// catches an exception — Server Component render, Route Handler, or Server
// Action. Without it, PostHog only ever saw React's client-side placeholder
// ("the specific message is omitted in production builds") and never the real
// message, stack, or the `digest` React attaches, so server crashes were
// undiagnosable.
//
// This reports directly to PostHog's ingestion API (the same host the client
// snippet proxies through `/ingest`), rather than pulling in posthog-node.
// Analytics must never break a request: the hook swallows its own errors and
// stays silent when the key is unset.

// Real ingestion host. The browser posts to a same-origin `/ingest` rewrite
// (see next.config.ts) to dodge tracking blockers; the server has no such proxy
// and calls the host directly.
const CAPTURE_URL = "https://us.i.posthog.com/i/v0/e/";

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return; // Analytics off in this environment.

  const err = error as { digest?: string } & Error;

  try {
    await fetch(CAPTURE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        event: "$exception",
        // Server errors are not tied to a person here, so don't mint a profile.
        distinct_id: "server",
        properties: {
          $process_person_profile: false,
          // Shapes the event into an Error Tracking issue with a real title and
          // message instead of React's production placeholder.
          $exception_list: [
            {
              type: err.name,
              value: err.message,
              mechanism: { handled: false, synthetic: false },
            },
          ],
          // The React `digest` maps this event back to the client-side crash.
          $exception_digest: err.digest,
          $exception_stack_trace_raw: err.stack,
          // Where it happened, so the same message on two routes stays legible.
          path: request.path,
          method: request.method,
          route_path: context.routePath,
          route_type: context.routeType,
          render_source: context.renderSource,
        },
      }),
    });
  } catch {
    // Reporting the error must never itself throw.
  }
};
