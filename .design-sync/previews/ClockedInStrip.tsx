import { ClockedInStrip } from "progra";

const MIN = 60_000;
const user = (userId: string, displayName: string | null, username: string) => ({
  userId, displayName, username, bio: null, avatarUrl: null,
});

// Read once at load, not during render: live timers count up from here.
const now = Date.now();

// Top of the Feed: friends who are clocked in right now, with live timers.
export function TwoLive() {
  return (
    <div className="w-full" style={{ maxWidth: 390 }}>
      <ClockedInStrip
        serverNow={now}
        items={[
          { sessionId: "a", author: user("u2", "Jordan Lee", "jlee"), label: "Startup", isGoal: true,
            startedAt: now - 47 * MIN, pausedMs: 0, pausedSince: null },
          { sessionId: "b", author: user("u3", "Priya Raman", "priyar"), label: "MCAT", isGoal: true,
            startedAt: now - 95 * MIN, pausedMs: 10 * MIN, pausedSince: now - 4 * MIN },
        ]}
      />
    </div>
  );
}
