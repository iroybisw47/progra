import { RecapFeedCard } from "progra";

const H = 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 5, 2, 0);
const user = (userId: string, displayName: string | null, username: string) => ({
  userId, displayName, username, bio: null, avatarUrl: null,
});

// A friend's posted Sunday recap in the Feed.
export function Posted() {
  return (
    <div className="w-full" style={{ maxWidth: 390 }}>
      <RecapFeedCard
        now={NOW}
        entry={{
          kind: "recap",
          id: "r1",
          author: user("u3", "Priya Raman", "priyar"),
          weekStartMs: Date.UTC(2026, 8, 28, 12), // noon UTC: Monday in every US timezone
          caption: "MCAT block is brutal but the hours are there.",
          totalTrackedMs: 22.5 * H,
          rank: 1,
          circleSize: 6,
          categories: [
            { name: "MCAT", color: "#8E3A44", ms: 14 * H },
            { name: "Lab", color: "#77B7C6", ms: 6 * H },
            { name: "Run", color: "#2E8B50", ms: 2.5 * H },
          ],
          postedAt: NOW - 3 * H,
        }}
        kudos={{ count: 5, mine: false }}
        comments={[
          { id: "c1", author: user("u1", "Maya Chen", "mayac"), body: "carrying the leaderboard", createdAt: NOW - H, canDelete: false },
        ]}
      />
    </div>
  );
}
