// DEBUG TOOL — added 2026-08-05 alongside the push-notification fix. Safe to
// delete once push is confirmed working end to end.
//
// Dumps public.device_tokens so you can check whether registration actually
// wrote a row, without opening the Supabase dashboard.
//
//   node --env-file=.env.local scripts/check-device-tokens.mjs
//
// --env-file is Node's built-in loader (this repo has no `dotenv` of its own —
// the copy in node_modules is transitive and could vanish on a clean install).
//
// Two things this deliberately does NOT do:
//   * import lib/supabase/admin.ts — that module is `import "server-only"` and
//     uses the bundler-only "@/" alias, so it cannot load in a bare node
//     process. The client below is the same shape, inlined.
//   * select `id` or `created_at` — device_tokens has NEITHER. Its PK is the
//     composite (user_id, token) and its only other column is updated_at.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Run with: node --env-file=.env.local scripts/check-device-tokens.mjs"
  );
  process.exit(1);
}

// Service role bypasses RLS — this is the one legitimate use for it here, the
// same exception uploadSessionPhoto makes. Never ship this key to a client.
const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: tokens, error } = await supabase
  .from("device_tokens")
  .select("user_id, token, updated_at")
  .order("updated_at", { ascending: false });

if (error) {
  console.error("Query failed:", error.message);
  process.exit(1);
}

if (!tokens.length) {
  console.log("device_tokens: 0 rows.\n");
  console.log(
    "Expected BEFORE the AppDelegate fix ships in a native build — the\n" +
      "`registration` event never fired, so nothing was ever saved.\n" +
      "After rebuilding: launch the app, grant the prompt, then re-run this."
  );
  process.exit(0);
}

// Resolve user ids to something readable. Separate query because device_tokens
// has no FK join set up in PostgREST.
const ids = [...new Set(tokens.map((t) => t.user_id))];
const { data: profiles } = await supabase
  .from("profiles")
  .select("id, username")
  .in("id", ids);
const nameById = new Map((profiles ?? []).map((p) => [p.id, p.username]));

console.log(`device_tokens: ${tokens.length} row(s)\n`);
for (const t of tokens) {
  const who = nameById.get(t.user_id) ?? t.user_id;
  // Truncated: a device token is a credential, and full ones make this
  // unreadable anyway. 64 hex chars = APNs, ~163 = FCM.
  const preview = `${t.token.slice(0, 16)}…`;
  console.log(
    `  ${who.padEnd(20)} ${preview.padEnd(20)} ${t.token.length} chars   updated ${t.updated_at}`
  );
}
