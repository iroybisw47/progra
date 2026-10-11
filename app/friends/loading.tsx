import { PageSkeleton } from "@/components/page-skeleton";
import { FRIENDS_V3 } from "@/lib/flags";

// The v3 tab has the invite button between the search and the first section,
// so it gets its own skeleton: the old one would shift every row ~84px down
// as the page streamed in.
export default function Loading() {
  return <PageSkeleton title="Friends" variant={FRIENDS_V3 ? "friends-v3" : "friends"} />;
}
