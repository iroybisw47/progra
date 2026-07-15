import { notFound } from "next/navigation";

import { FeedV2 } from "@/components/v2/feed-v2";
import { requireUser } from "@/lib/auth/require-user";
import { REDESIGN } from "@/lib/flags";

// The Feed tab (redesign only). In the pre-redesign social build the feed lives
// on Home; here Home is the Progress tab and the feed gets its own route.
export default async function FeedPage() {
  if (!REDESIGN) notFound();
  await requireUser();
  return <FeedV2 />;
}
