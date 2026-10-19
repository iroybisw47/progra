import { notFound } from "next/navigation";

import { ReviewView } from "@/app/review/[id]/review-view";
import { WeeklyReviewCard, WeeklyReviewsSection } from "@/components/v2/weekly-review-card";
import type { RecapFeedItem } from "@/lib/db/feed";
import type { RecapComment } from "@/lib/db/recap-social";
import { weekWindow } from "@/lib/dates";
import { nowTs } from "@/lib/duration";

// Dev-only look at where a posted weekly review shows (RECAP_V2): the feed
// card, the You/profile rows and /review/[id], on fixture posts.
//   /dev/weekly-review?view=feed|rows|post|old
// Taps on the heart or the composer call the REAL actions with fixture ids —
// they fail harmlessly (no such post), but don't use it signed in as a test
// of posting. 404s in production.
const H = 60 * 60 * 1000;
const sam = { userId: "s", username: "samr", displayName: "Sam Rivera", bio: null, avatarUrl: null };
const me = { userId: "m", username: "raek", displayName: "Rae Kim", bio: null, avatarUrl: null };

function post(over: Partial<RecapFeedItem>): RecapFeedItem {
  return {
    kind: "recap",
    id: "00000000-0000-4000-8000-000000000001",
    author: sam,
    weekStartMs: weekWindow("America/Los_Angeles", "2026-10-05").weekStartMs,
    caption: "Thesis chapter two is done. Spanish next.",
    totalTrackedMs: 11.5 * H,
    rank: 2,
    circleSize: 8,
    // The wheel as postSlices stores it (fill colors, Uncategorized last).
    categories: [
      { name: "Thesis", color: "#395AA0", ms: 4.5 * H },
      { name: "Spanish", color: "#E07042", ms: 3 * H },
      { name: "Gym", color: "#2E8B50", ms: 2 * H },
      { name: "Private goals", color: "#A084B3", ms: 1.25 * H },
      { name: "Uncategorized", color: "#c3c8ce", ms: 0.75 * H },
    ],
    postedAt: Date.UTC(2026, 9, 12, 15),
    goalPct: 86,
    goalCount: 3,
    habitPct: 64,
    habitCount: 4,
    ...over,
  };
}

const COMMENTS: RecapComment[] = [
  { id: "00000000-0000-4000-8000-0000000000c1", author: me, body: "Huge week!! 🔥", createdAt: Date.UTC(2026, 9, 12, 16), canDelete: true },
  { id: "00000000-0000-4000-8000-0000000000c2", author: sam, body: "Thanks — Spanish is next.", createdAt: Date.UTC(2026, 9, 12, 17), canDelete: false },
];

export default async function WeeklyReviewPreview({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { view } = await searchParams;
  const now = nowTs();
  if (view === "post") {
    return <ReviewView post={{ ...post({ author: me }), isOwn: true }} kudos={{ count: 3, mine: false }} comments={COMMENTS} now={now} />;
  }
  if (view === "rows") {
    const items = [
      post({ author: me }),
      post({ id: "00000000-0000-4000-8000-000000000002", author: me, caption: null, goalPct: null, goalCount: 0, weekStartMs: weekWindow("America/Los_Angeles", "2026-09-28").weekStartMs }),
      post({ id: "00000000-0000-4000-8000-000000000003", author: me, caption: null, goalPct: null, goalCount: null, habitPct: null, habitCount: null, totalTrackedMs: 6.2 * H, weekStartMs: weekWindow("America/Los_Angeles", "2026-09-21").weekStartMs }),
    ];
    return (
      <main className="mx-auto w-full max-w-md pt-6">
        <WeeklyReviewsSection
          title="Weekly reviews"
          items={items}
          kudos={new Map([[items[0].id, { count: 3, mine: false }]])}
          commentCounts={new Map([[items[0].id, 2]])}
        />
      </main>
    );
  }
  return (
    <main className="mx-auto w-full max-w-md pt-6">
      <WeeklyReviewCard entry={post({})} now={now} kudos={{ count: 4, mine: true }} commentCount={2} />
      <WeeklyReviewCard
        entry={post({ id: "00000000-0000-4000-8000-000000000004", caption: null, goalPct: null, goalCount: null, habitPct: null, habitCount: null, totalTrackedMs: 8 * H })}
        now={now}
        kudos={{ count: 0, mine: false }}
        commentCount={0}
      />
    </main>
  );
}
