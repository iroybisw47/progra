import { ingest } from "@/lib/telemetry/ingest-server";

// The event ingest endpoint for lib/telemetry/client.ts. Always 204, whatever
// happened: the client treats any 2xx as "sent", any 5xx as "retry" and any
// 4xx as "never send this again", and nothing here is worth a retry — a bad
// batch is dropped, a good one is stored, and the client cannot do better by
// knowing which. Diagnostics go to the server log.
//
// Excluded from proxy.ts's matcher on purpose; see the comment there and in
// lib/telemetry/ingest-server.ts.

// The Supabase and http2-free admin client are Node modules; and never
// prerendered — it reads the request.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await ingest(request);
  } catch (e) {
    console.error("[analytics] ingest threw:", (e as Error).message);
  }
  return new Response(null, { status: 204 });
}
