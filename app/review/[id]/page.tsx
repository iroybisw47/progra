import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/require-user";
import { RECAP_V2 } from "@/lib/flags";
import { listRecapComments, listRecapKudos } from "@/lib/db/recap-social";
import { getRecapPost } from "@/lib/db/weekly-reviews";
import { nowTs } from "@/lib/duration";

import { ReviewView } from "./review-view";

// One posted weekly review (RECAP_V2): the post in full, its likes and the
// whole comment thread. Where the feed card, the You and profile rows, the
// notifications panel and a like/comment push all land. Visibility is RLS's
// (owner or accepted friend): a post the viewer can't see 404s.
export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  if (!RECAP_V2) notFound();
  await requireUser();
  const { id } = await params;

  const post = await getRecapPost(id);
  if (!post) notFound();

  const [kudosById, commentsById] = await Promise.all([
    listRecapKudos([post.id]),
    // The owner can delete anyone's comment on their own post.
    listRecapComments([post.id], post.isOwn ? new Set([post.id]) : undefined),
  ]);
  // One instant for every relative time on the screen.
  const now = nowTs();

  return (
    <ReviewView
      post={post}
      kudos={kudosById.get(post.id) ?? { count: 0, mine: false }}
      comments={commentsById.get(post.id) ?? []}
      now={now}
    />
  );
}
