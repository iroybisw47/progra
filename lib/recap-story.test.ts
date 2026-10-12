import { describe, expect, it } from "vitest";

import { entityOnDark } from "@/lib/colors";
import { weekWindow } from "@/lib/dates";
import {
  averageWindows,
  buildRecapStory,
  closingAccent,
  firstName,
  friendsSlide,
  goalsSlide,
  habitsSlide,
  hoursSlide,
  joinNames,
  rankSlide,
  tallyLikes,
  weekOfLabel,
  weekSpanLabel,
  weeklyAverageMs,
  whereSlide,
  CLOSING_FALLBACK_ACCENT,
  UNCATEGORIZED_FILL,
  type RecapPerson,
  type RecapStoryInput,
} from "@/lib/recap-story";
import type { Session } from "@/lib/storage";

const H = 60 * 60 * 1000;
const ORANGE = "#E07042";

function person(id: string, displayName: string | null = null): RecapPerson {
  return { userId: id, username: id, displayName, avatarUrl: null };
}

function input(over: Partial<RecapStoryInput> = {}): RecapStoryInput {
  return {
    weekStartISO: "2026-10-05",
    totalTrackedMs: 11.5 * H,
    weeklyAverageMs: 8.2 * H,
    categories: [{ id: "c1", name: "Class", color: "#A084B3", ms: 11.5 * H }],
    goals: [],
    habits: [],
    completions: [],
    circle: [{ user: person("me", "Rae Kim"), isMe: true, rank: 1, totalMs: 5 * H, goalCount: 1 }],
    friends: [],
    likesGiven: [],
    likesReceived: [],
    ...over,
  };
}

describe("week labels", () => {
  it("names the Monday and the span, with an en dash", () => {
    expect(weekOfLabel("2026-10-05")).toBe("Week of Oct 5");
    expect(weekSpanLabel("2026-10-05")).toBe("Week of Oct 5 – 11");
  });
  it("spells both months across a month or a year", () => {
    expect(weekSpanLabel("2026-09-28")).toBe("Week of Sep 28 – Oct 4");
    expect(weekSpanLabel("2026-12-28")).toBe("Week of Dec 28 – Jan 3");
  });
});

describe("hoursSlide", () => {
  it("one decimal, and the neutral comparison either way", () => {
    expect(hoursSlide(11.5 * H, 8.2 * H)).toEqual({
      value: 11.5,
      text: "11.5",
      large: false,
      line: "Above your weekly average of 8.2 hrs.",
    });
    expect(hoursSlide(6.4 * H, 8.2 * H).line).toBe("Your weekly average is 8.2 hrs.");
  });
  it("compares the numbers as shown, so equal-looking is never 'above'", () => {
    expect(hoursSlide(8.24 * H, 8.2 * H).line).toBe("Your weekly average is 8.2 hrs.");
  });
  it("has no line in a first week, or against an average of nothing", () => {
    expect(hoursSlide(3 * H, null).line).toBeNull();
    expect(hoursSlide(3 * H, 0.04 * H).line).toBeNull();
  });
  it("steps the size down at 100", () => {
    expect(hoursSlide(99.9 * H, null).large).toBe(false);
    expect(hoursSlide(100 * H, null).large).toBe(true);
  });
});

describe("whereSlide", () => {
  it("orders by time with Uncategorized last, in its own grey", () => {
    const view = whereSlide([
      { id: null, name: "Uncategorized", color: null, ms: 6 * H },
      { id: "a", name: "Reading", color: "#2E8B50", ms: 2 * H },
      { id: "b", name: "Thesis", color: ORANGE, ms: 4 * H },
    ])!;
    expect(view.rows.map((r) => r.name)).toEqual(["Thesis", "Reading", "Uncategorized"]);
    expect(view.rows[2].color).toBe(UNCATEGORIZED_FILL);
    expect(view.rows[0]).toMatchObject({ meta: "4.0h · 33%", widthPct: 33 });
    expect(view.countLabel).toBe("3 categories");
    expect(view.totalLabel).toBe("12h");
    expect(view.segments.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1);
  });
  it("is skipped with nothing tracked, singular with one", () => {
    expect(whereSlide([])).toBeNull();
    expect(whereSlide([{ id: "a", name: "A", color: null, ms: 0 }])).toBeNull();
    expect(whereSlide([{ id: "a", name: "A", color: null, ms: H }])!.countLabel).toBe("1 category");
  });
  it("merges every uncategorized row and never caps it away", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      id: `c${i}`,
      name: `C${i}`,
      color: null,
      ms: (20 - i) * H,
    }));
    const view = whereSlide([
      ...many,
      { id: null, name: "Uncategorized", color: null, ms: H },
      { id: null, name: "Uncategorized", color: null, ms: H },
    ])!;
    expect(view.rows).toHaveLength(8);
    expect(view.rows[7]).toMatchObject({ name: "Uncategorized", meta: expect.stringMatching(/^2\.0h/) });
    expect(view.segments).toHaveLength(11);
    expect(view.countLabel).toBe("11 categories");
  });
  it("keeps a tiny share's bar visible", () => {
    const view = whereSlide([
      { id: "a", name: "A", color: null, ms: 1000 * H },
      { id: "b", name: "B", color: null, ms: H },
    ])!;
    expect(view.rows[1].widthPct).toBe(2);
  });
});

describe("goalsSlide", () => {
  const goal = (title: string, quotaHours: number, actualH: number) => ({
    id: title,
    title,
    color: ORANGE,
    quotaHours,
    actualMs: actualH * H,
  });

  it("caps each goal at its quota (the handoff's 86% state)", () => {
    const v = goalsSlide([goal("Thesis", 6, 5), goal("Spanish", 2, 1.6), goal("Reading", 2, 2)])!;
    expect(v.pct).toBe(86);
    expect(v.meta).toBe("8.6h of 10h");
    expect(v.caption).toBe("across 3 goals");
    expect(v.message).toBe("86% done. Great job! Let’s aim for 100 next week.");
    expect(v.doneCopy).toBe("You did 100% of your Reading, good job!!");
    expect(v.rows.map((r) => r.done)).toEqual([false, false, true]);
    expect(v.rows[0]).toMatchObject({ actual: "5.0h", quota: "6h" });
  });

  it("one over-achieved goal can't hide a shortfall, and never rounds up to 100", () => {
    const v = goalsSlide([goal("A", 10, 30), goal("B", 1, 0.99)])!;
    expect(v.complete).toBe(false);
    expect(v.pct).toBe(99);
  });

  it("complete only when every goal met its quota", () => {
    const v = goalsSlide([goal("Thesis", 6, 6.2), goal("Spanish", 2, 2.3), goal("Reading", 2, 2.1)])!;
    expect(v.complete).toBe(true);
    expect(v.pct).toBe(100);
    expect(v.message).toBe("Goals complete. Want to raise them?");
    expect(v.doneCopy).toBe("You did 100% of all three goals, good job!!");
  });

  it("under 80%, plural and singular", () => {
    expect(goalsSlide([goal("Thesis", 6, 2.8), goal("Spanish", 2, 1.4), goal("Reading", 2, 2)])!.message).toBe(
      "You were 62% done with your weekly goals. Let’s try and hit them next week!"
    );
    const one = goalsSlide([goal("Thesis", 10, 1)])!;
    expect(one.caption).toBe("weekly goal");
    expect(one.message).toBe(
      "You were 10% done with your weekly goal. Let’s try and hit it next week!"
    );
    expect(goalsSlide([goal("Thesis", 10, 11)])!.message).toBe("Goal complete. Want to raise it?");
  });

  it("names finished goals in the handoff's list style, and 'both' for two", () => {
    const v = goalsSlide([goal("A", 1, 1), goal("B", 1, 1), goal("C", 1, 1), goal("D", 9, 0)])!;
    expect(v.doneCopy).toBe("You did 100% of your A, B and C, good job!!");
    expect(goalsSlide([goal("A", 1, 1), goal("B", 1, 2)])!.doneCopy).toBe(
      "You did 100% of both goals, good job!!"
    );
    expect(goalsSlide([goal("A", 1, 0)])!.doneCopy).toBeNull();
  });

  it("ignores goals without a quota, and is skipped without any", () => {
    expect(goalsSlide([goal("A", 0, 3)])).toBeNull();
    expect(goalsSlide([goal("A", 0, 3), goal("B", 2, 1)])!.rows.map((r) => r.id)).toEqual(["B"]);
  });

  it("keeps fractional quotas readable", () => {
    expect(goalsSlide([goal("A", 2.5, 1)])!.meta).toBe("1.0h of 2.5h");
  });
});

describe("habitsSlide", () => {
  const habits = [
    { id: "f", name: "Flashcards", color: "#D6A728" },
    { id: "s", name: "Sleep by 11", color: "#6F4E93" },
  ];
  const done = (habitId: string, ...days: number[]) =>
    days.map((d) => ({ habitId, completedOn: `2026-10-${String(5 + d).padStart(2, "0")}` }));

  it("lays the week Monday to Sunday, ÷7", () => {
    const v = habitsSlide("2026-10-05", habits, [...done("f", 0, 1, 2, 3, 4, 6), ...done("s", 2)])!;
    expect(v.rows[0].days).toEqual([true, true, true, true, true, false, true]);
    expect(v.rows[0].pct).toBe(86);
    expect(v.rows[1].pct).toBe(14);
    expect(v.rows[1].summary).toBe("Done on 1 of 7 days: Wednesday.");
    expect(v.meta).toBe("2 habits this week");
  });

  it("best day: every habit", () => {
    const v = habitsSlide("2026-10-05", habits, [...done("f", 0, 2), ...done("s", 2)])!;
    expect(v.best).toEqual({
      index: 2,
      count: 2,
      total: 2,
      all: true,
      copy: "Your best day was Wednesday, when you completed every habit.",
    });
  });

  it("best day: partial, ties to the earliest day", () => {
    const three = [...habits, { id: "g", name: "Gym", color: null }];
    const v = habitsSlide("2026-10-05", three, [...done("f", 1, 3), ...done("s", 1, 3)])!;
    expect(v.best?.index).toBe(1);
    expect(v.best?.copy).toBe("Your best day was Tuesday, with 2 of 3 habits done.");
  });

  it("no best day with nothing ticked; skipped with no habits", () => {
    expect(habitsSlide("2026-10-05", habits, [])!.best).toBeNull();
    expect(habitsSlide("2026-10-05", [], [])).toBeNull();
  });

  it("ignores completions outside the week", () => {
    const v = habitsSlide("2026-10-05", habits, [{ habitId: "f", completedOn: "2026-10-12" }])!;
    expect(v.rows[0].pct).toBe(0);
  });
});

describe("friendsSlide + rankSlide", () => {
  const ranked = (n: number, meRank: number) => {
    const rows: RecapStoryInput["circle"] = [];
    for (let i = 1; i <= n; i++) {
      const isMe = i === meRank;
      rows.push({
        user: isMe ? person("me", "Rae Kim") : person(`f${i}`, `Friend ${i}`),
        isMe,
        rank: i,
        totalMs: (n - i + 1) * H,
        goalCount: i % 3,
      });
    }
    return rows;
  };
  const friendsOf = (rows: RecapStoryInput["circle"]) =>
    rows.filter((r) => !r.isMe).map((r) => r.user);

  it("top three: callout, circle meta, rank slide", () => {
    const circle = ranked(8, 2);
    const v = friendsSlide(input({ circle, friends: friendsOf(circle) }));
    expect(v.meta).toBe("8 in your circle");
    expect(v.top3).toEqual({ rank: 2, of: "of 8 in your circle" });
    expect(v.invite).toBeNull();
    // 8+7+…+1 = 36 hours.
    expect(v.groupHours).toBe(36);
    const r = rankSlide(circle)!;
    expect(r.hero).toBe("#2");
    expect(r.rows[1]).toMatchObject({ label: "You", isMe: true });
  });

  it("outside the top three: no callout", () => {
    const circle = ranked(8, 5);
    expect(friendsSlide(input({ circle, friends: friendsOf(circle) })).top3).toBeNull();
  });

  it("fewer than three active friends: invite instead, no rank slide", () => {
    const circle = ranked(3, 1); // two active friends
    const v = friendsSlide(input({ circle, friends: friendsOf(circle) }));
    expect(v.meta).toBe("2 active friends");
    expect(v.top3).toBeNull();
    expect(v.invite).toBe(
      "Leaderboards start at three active friends — invite one more and you’ll see how your weeks stack up."
    );
    expect(rankSlide(circle)).toBeNull();
  });

  it("one active friend is singular; none at all drops the group line", () => {
    const circle = ranked(2, 1);
    expect(friendsSlide(input({ circle, friends: friendsOf(circle) })).meta).toBe("1 active friend");
    const solo = friendsSlide(input());
    expect(solo.groupHours).toBeNull();
    expect(solo.meta).toBe("No friends yet");
    expect(solo.invite).toContain("invite three more");
    // Friends who logged next to nothing: no "0 hours" sentence.
    const quiet = friendsSlide(
      input({
        circle: [{ user: person("me"), isMe: true, rank: 1, totalMs: 60_000, goalCount: 0 }],
        friends: [person("a")],
      })
    );
    expect(quiet.groupHours).toBeNull();
  });

  it("likes: the most, ties to the latest, current friends only", () => {
    const sam = person("sam", "Sam Rivera");
    const jo = person("jo", "Jordan Lee");
    const v = friendsSlide(
      input({
        friends: [sam, jo],
        likesGiven: [
          { userId: "sam", count: 12, lastMs: 1 },
          { userId: "jo", count: 12, lastMs: 5 },
          { userId: "gone", count: 40, lastMs: 9 },
        ],
        likesReceived: [{ userId: "jo", count: 3, lastMs: 2 }],
      })
    );
    expect(v.likedByYou).toEqual({
      person: jo,
      text: "You liked Jordan’s posts the most",
      countLabel: "12 likes",
    });
    expect(v.likedYou?.text).toBe("Jordan liked your posts the most.");
    expect(friendsSlide(input({ friends: [sam] })).likedByYou).toBeNull();
  });

  it("rank rows: goal sublines and durations", () => {
    const circle = ranked(4, 1);
    circle[1].goalCount = 0;
    circle[3].goalCount = 0;
    circle[3].totalMs = 0;
    const rows = rankSlide(circle)!.rows;
    expect(rows[0].sub).toBe("1 goal this week");
    expect(rows[1].sub).toBe("Tracked outside goals");
    expect(rows[2].sub).toBe("Tracked outside goals");
    circle[2].goalCount = 4;
    expect(rankSlide(circle)!.rows[2].sub).toBe("4 goals this week");
    expect(rows[3]).toMatchObject({ sub: "Nothing tracked this week", duration: "0m" });
    expect(rows[0].duration).toBe("4h");
    expect(rows[1].label).toBe("Friend 2");
  });
});

describe("closingAccent", () => {
  it("lifts the top goal's colour for navy, else sand", () => {
    expect(
      closingAccent([
        { id: "a", title: "A", color: "#2E8B50", quotaHours: 1, actualMs: H },
        { id: "b", title: "B", color: ORANGE, quotaHours: 0, actualMs: 3 * H },
      ])
    ).toBe(entityOnDark(ORANGE));
    expect(entityOnDark(ORANGE)).toBe("#eeb097");
    expect(closingAccent([])).toBe(CLOSING_FALLBACK_ACCENT);
    expect(
      closingAccent([{ id: "a", title: "A", color: ORANGE, quotaHours: 1, actualMs: 0 }])
    ).toBe(CLOSING_FALLBACK_ACCENT);
  });
});

describe("buildRecapStory", () => {
  it("runs the full sequence when everything has something to show", () => {
    const circle = [1, 2, 3, 4].map((i) => ({
      user: i === 2 ? person("me") : person(`f${i}`),
      isMe: i === 2,
      rank: i,
      totalMs: H,
      goalCount: 0,
    }));
    const v = buildRecapStory(
      input({
        goals: [{ id: "g", title: "Thesis", color: ORANGE, quotaHours: 6, actualMs: 5 * H }],
        habits: [{ id: "h", name: "Gym", color: null }],
        circle,
        friends: circle.filter((r) => !r.isMe).map((r) => r.user),
      })
    );
    expect(v.slides).toEqual(["loading", "hours", "where", "goals", "habits", "friends", "rank", "closing"]);
    expect(v.weekSpanLabel).toBe("Week of Oct 5 – 11");
    expect(v.closing.quote.author).toBe("Thomas Edison");
  });

  it("opens a first review with the welcome, and only a first review", () => {
    const first = buildRecapStory(input({ firstReview: true }));
    expect(first.slides.slice(0, 3)).toEqual(["loading", "welcome", "hours"]);
    expect(first.welcome).toEqual({
      title: "Welcome to your weekly recap",
      line: "Every Monday at 6am, you will see how your past week went.",
      hint: "Tap the right side to keep going, and the left side to go back.",
    });
    const later = buildRecapStory(input());
    expect(later.slides).not.toContain("welcome");
    expect(later.welcome).toBeNull();
  });

  it("offers Share before Closing only when the week can be posted", () => {
    const circle = [1, 2, 3, 4].map((i) => ({
      user: i === 1 ? person("me") : person(`f${i}`),
      isMe: i === 1,
      rank: i,
      totalMs: H,
      goalCount: 0,
    }));
    const friends = circle.filter((r) => !r.isMe).map((r) => r.user);
    const v = buildRecapStory(input({ circle, friends, share: { postable: true, posted: null } }));
    expect(v.slides.slice(-3)).toEqual(["rank", "share", "closing"]);
    expect(v.share).toMatchObject({ audience: "friends", posted: null });
    expect(v.share?.summary.totalTrackedMs).toBe(11.5 * H);
    expect(buildRecapStory(input({ share: { postable: false, posted: null } })).slides).not.toContain("share");
    expect(buildRecapStory(input()).share).toBeNull();
    const solo = buildRecapStory(input({ share: { postable: true, posted: { id: "r1", caption: "hi" } } }));
    expect(solo.slides.slice(-3)).toEqual(["friends", "share", "closing"]);
    expect(solo.share).toMatchObject({ audience: "solo", posted: { id: "r1", caption: "hi" } });
  });

  it("skips what has nothing to show (a quiet, solo, goal-less week)", () => {
    const v = buildRecapStory(input({ totalTrackedMs: 0, categories: [], weeklyAverageMs: null }));
    expect(v.slides).toEqual(["loading", "hours", "friends", "closing"]);
    expect(v.hours.text).toBe("0.0");
  });

  it("is plain data, safe to pass to a client component", () => {
    const v = buildRecapStory(input());
    expect(JSON.parse(JSON.stringify(v))).toEqual(v);
  });
});

describe("weekly average", () => {
  const tz = "America/Los_Angeles";
  it("takes the 8 weeks before, minus pre-signup weeks", () => {
    const all = averageWindows("2026-10-05", tz, 0);
    expect(all).toHaveLength(8);
    expect(all[0]).toEqual(weekWindow(tz, "2026-09-28"));
    expect(all[7]).toEqual(weekWindow(tz, "2026-08-10"));
    // Signed up Wednesday 2026-09-16: that week and the two after it count.
    const recent = averageWindows("2026-10-05", tz, Date.UTC(2026, 8, 16, 18));
    expect(recent.map((w) => w.weekStartISO)).toEqual(["2026-09-28", "2026-09-21", "2026-09-14"]);
    expect(averageWindows("2026-10-05", tz, Date.UTC(2026, 9, 6))).toEqual([]);
  });

  it("averages per-week totals, quiet weeks as zero, by session end", () => {
    const w1 = weekWindow("UTC", "2026-09-28");
    const w2 = weekWindow("UTC", "2026-09-21");
    const session = (endMs: number, ms: number): Session =>
      ({
        id: String(endMs),
        categoryId: null,
        goalId: null,
        taskName: null,
        startedAt: endMs - ms,
        endedAt: endMs,
        pausedMs: 0,
        pausedSince: null,
      }) as unknown as Session;
    const sessions = [session(w1.weekStartMs + 5 * H, 4 * H), session(w1.weekEndMs + 5 * H, 9 * H)];
    expect(weeklyAverageMs(sessions, [], [w1, w2], Date.UTC(2026, 9, 12))).toBe(2 * H);
    expect(weeklyAverageMs(sessions, [], [], Date.UTC(2026, 9, 12))).toBeNull();
  });
});

describe("helpers", () => {
  it("joinNames, firstName, tallyLikes", () => {
    expect(joinNames(["A"])).toBe("A");
    expect(joinNames(["A", "B"])).toBe("A and B");
    expect(joinNames(["A", "B", "C"])).toBe("A, B and C");
    expect(firstName({ displayName: "  Sam Rivera ", username: "samr" })).toBe("Sam");
    expect(firstName({ displayName: null, username: "samr" })).toBe("@samr");
    expect(
      tallyLikes([
        { userId: "a", createdMs: 3 },
        { userId: "a", createdMs: 9 },
        { userId: "b", createdMs: 1 },
      ])
    ).toEqual([
      { userId: "a", count: 2, lastMs: 9 },
      { userId: "b", count: 1, lastMs: 1 },
    ]);
  });
});
