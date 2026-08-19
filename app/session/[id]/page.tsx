import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/require-user";
import { REDESIGN } from "@/lib/flags";
import { getSessionForViewer } from "@/lib/db/session-detail";
import { listCommentsForSessions } from "@/lib/db/comments";
import { listReactionsForSessions } from "@/lib/db/reactions";
import { LIKE_EMOJI } from "@/lib/social/reactions";

import { SessionDetailView } from "./session-view";

// A single session's detail page (redesign only): the post in full, plus the
// comment thread. Visibility is enforced by RLS in getSessionForViewer, so a
// session the viewer can't see 404s.
//
// Loading only — the screen itself is SessionDetailView, which takes plain
// props and can therefore be rendered without a database.
export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!REDESIGN) notFound();
  await requireUser();
  const { id } = await params;

  const detail = await getSessionForViewer(id);
  if (!detail) notFound();

  const [commentsBySession, reactionsBySession] = await Promise.all([
    listCommentsForSessions([detail.sessionId]),
    listReactionsForSessions([detail.sessionId]),
  ]);
  const comments = commentsBySession.get(detail.sessionId) ?? [];
  // The post carries one like rather than the emoji palette, so only the
  // LIKE_EMOJI row of the reaction summary matters here — the same derivation
  // the feed and the You tab do.
  const like = (reactionsBySession.get(detail.sessionId) ?? []).find(
    (r) => r.emoji === LIKE_EMOJI
  );
  // Read once here rather than inline in the JSX: every relative timestamp on
  // the screen is measured from the same instant, and the lint rule that bans
  // impure calls in render props is right that they don't belong there.
  const now = Date.now();

  return (
    <SessionDetailView
      detail={detail}
      comments={comments}
      kudos={{ count: like?.count ?? 0, mine: like?.mine ?? false }}
      now={now}
    />
  );
}
