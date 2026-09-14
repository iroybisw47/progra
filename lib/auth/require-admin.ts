import "server-only";

import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

// Page gate for /admin/*. Signed-out → /login (via requireUser); signed-in but
// not the admin → 404, so the route's existence isn't confirmed to anyone else.
//
// Called per page, never from a layout: layouts don't re-render on client-side
// navigation, so a check there isn't re-run on every route change (Next's auth
// guide, "Layouts and auth checks"). And this is UX, not the security boundary —
// every admin_* RPC re-checks is_admin() itself, and that's what actually
// protects the data.
//
// Not to be confused with the private requireAdmin in app/actions/admin.ts,
// which returns a Result for server actions instead of 404ing a page.
export async function requireAdmin() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) notFound();
  return user;
}
