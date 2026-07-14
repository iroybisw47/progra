import { notFound } from "next/navigation";

import { Dashboard } from "@/components/dashboard";
import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { SOCIAL_ENABLED } from "@/lib/flags";

// The "You" tab: the personal dashboard (this week's time, goals, habits,
// recap/history, profile) that lived on Home before the social feed took it
// over. Only exists when social is on; in the beta the dashboard is still Home.
export default async function MePage() {
  if (!SOCIAL_ENABLED) notFound();
  const user = await requireUser();
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  return <Dashboard email={user.email ?? ""} isAdmin={isAdmin === true} />;
}
