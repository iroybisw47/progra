import { FriendsLeaderboard } from "progra";

const H = 60 * 60 * 1000;
const user = (userId: string, displayName: string | null, username: string) => ({
  userId, displayName, username, bio: null, avatarUrl: null,
});

// Full-bleed rows (they carry their own px-5): rank, avatar, name, total;
// "you" is tinted with --tint-you. Rows expand to show goals.
export function ThisWeek() {
  return (
    <div className="w-full" style={{ maxWidth: 390 }}>
      <FriendsLeaderboard
        rows={[
          { user: user("u1", "Priya Raman", "priyar"), rank: 1, isMe: false, totalMs: 22.5 * H,
            goals: [{ id: "a", title: "MCAT", color: "#8E3A44", ms: 14 * H }, { id: "b", title: "Lab", color: "#77B7C6", ms: 6 * H }], otherMs: 2.5 * H },
          { user: user("u2", "Jordan Lee", "jlee"), rank: 2, isMe: false, totalMs: 18 * H,
            goals: [{ id: "c", title: "Startup", color: "#E07042", ms: 12 * H }], otherMs: 6 * H },
          { user: user("me", "Maya Chen", "mayac"), rank: 3, isMe: true, totalMs: 15.5 * H,
            goals: [{ id: "g1", title: "Thesis", color: "#395AA0", ms: 6.5 * H }, { id: "g3", title: "Gym", color: "#2E8B50", ms: 4.5 * H }], otherMs: 4.5 * H },
          { user: user("u4", "Sam", "samwrites"), rank: 4, isMe: false, totalMs: 6.25 * H,
            goals: [{ id: "d", title: "Novel", color: "#D06DA1", ms: 6.25 * H }], otherMs: 0 },
          { user: user("u5", null, "theo.k"), rank: 5, isMe: false, totalMs: 0, goals: [], otherMs: 0 },
        ]}
      />
    </div>
  );
}

// Only the viewer, at zero: an invitation instead of an empty table.
export function NobodyYet() {
  return (
    <div className="w-full" style={{ maxWidth: 390 }}>
      <FriendsLeaderboard
        rows={[{ user: user("me", "Maya Chen", "mayac"), rank: 1, isMe: true, totalMs: 0, goals: [], otherMs: 0 }]}
      />
    </div>
  );
}
