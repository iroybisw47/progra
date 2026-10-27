import { SessionCard } from "progra";

const NOW = Date.UTC(2026, 9, 8, 20, 0);
const MIN = 60_000;
const user = (userId: string, displayName: string | null, username: string) => ({
  userId, displayName, username, bio: null, avatarUrl: null,
});
const comment = (id: string, who: ReturnType<typeof user>, body: string) => ({
  id, author: who, body, createdAt: NOW - 30 * MIN, canDelete: false,
  parentId: null, replyToId: null, replyTo: null,
});

const base = {
  sessionId: "s1",
  title: "Finished the methods section",
  attribution: { text: "Thesis", isGoal: true, color: "#395AA0" },
  description:
    "Finally got the sampling procedure written up. Two more figures and this chapter is done.",
  workedMs: 135 * MIN,
  startedAt: NOW - 3 * 60 * MIN,
  endedAt: NOW - 42 * MIN,
  photoUrl: null,
  isPrivate: false,
};

// The Feed post: full-bleed, hairline below, px-5 py-4. Serif title, the
// duration pill washed in the session's own color, comments + kudos pill.
export function FeedPost() {
  return (
    <div className="w-full" style={{ maxWidth: 390 }}>
      <SessionCard
        item={base}
        now={NOW}
        author={user("u1", "Maya Chen", "mayac")}
        comments={[
          comment("c1", user("u2", "Jordan Lee", "jlee"), "chapter 3 era 🔥"),
          comment("c2", user("u3", "Priya Raman", "priyar"), "so close!!"),
        ]}
        kudos={{ count: 4, mine: true }}
      />
    </div>
  );
}

// No author row: the You tab / a profile, where whose page it is is obvious.
export function OnProfile() {
  return (
    <div className="w-full" style={{ maxWidth: 390 }}>
      <SessionCard
        item={{ ...base, sessionId: "s2", title: "Leg day", description: null, workedMs: 55 * MIN,
          attribution: { text: "Gym", isGoal: true, color: "#2E8B50" } }}
        now={NOW}
        comments={[]}
        kudos={{ count: 0, mine: false }}
      />
    </div>
  );
}

// Your own private session: a Private chip replaces the social row.
export function Private() {
  return (
    <div className="w-full" style={{ maxWidth: 390 }}>
      <SessionCard
        item={{ ...base, sessionId: "s3", title: "Applications", description: null, isPrivate: true,
          workedMs: 70 * MIN, attribution: { text: "Admin", isGoal: false, color: "#D6A728" } }}
        now={NOW}
        comments={[]}
        kudos={{ count: 0, mine: false }}
      />
    </div>
  );
}
