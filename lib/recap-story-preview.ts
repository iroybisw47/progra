import { SLIDE_IDS, type RecapPerson, type RecapStoryInput, type SlideId } from "@/lib/recap-story";

// Fixtures for the weekly review's dev preview (/dev/recap-story), built from
// the handoff prototype's own sample data (design_handoff_weekly_recap/
// RecapSlide.dc.html) so every frame on its board can be photographed and set
// beside the handoff's screenshots — plus the states the design left open.
// Pure, client-safe, and run through the real buildRecapStory.

const H = 60 * 60 * 1000;
const MIN = 60 * 1000;
const ORANGE = "#E07042";
const LIGHT_BLUE = "#77B7C6";
const GREEN = "#2E8B50";

export const RECAP_PREVIEW_FIXTURES = [
  // The board's states. "above" is the prototype's default: above-average
  // hours, goals at 86%, every habit on the best day, top three.
  "above",
  "lighter",
  "goals-100",
  "goals-62",
  "best-partial",
  "outside",
  "few",
  // The states the design didn't draw (plan defaults).
  "first-week",
  "no-goals",
  "no-habits",
  "solo",
  "quiet",
  "crowd",
] as const;
export type RecapPreviewFixture = (typeof RECAP_PREVIEW_FIXTURES)[number];

function person(name: string, username: string): RecapPerson {
  return { userId: username, username, displayName: name, avatarUrl: null };
}

const ME = person("Rae Kim", "raek");

// [name, username, minutes, goals] — the prototype's two leaderboards.
const BOARD_TOP: [string, string, number, number][] = [
  ["Maya Chen", "mayac", 1120, 4],
  ["You", "raek", 690, 3],
  ["Sam Rivera", "samr", 665, 2],
  ["Jordan Lee", "jordanl", 640, 3],
  ["Priya Natarajan", "priyan", 590, 1],
  ["Theo Brooks", "theob", 515, 2],
  ["Ana Souza", "anas", 475, 0],
  ["Leo Park", "leop", 345, 1],
];
const BOARD_OUT: [string, string, number, number][] = [
  ["Maya Chen", "mayac", 1120, 4],
  ["Sam Rivera", "samr", 905, 2],
  ["Jordan Lee", "jordanl", 800, 3],
  ["Priya Natarajan", "priyan", 730, 1],
  ["You", "raek", 690, 3],
  ["Theo Brooks", "theob", 395, 2],
  ["Ana Souza", "anas", 295, 0],
  ["Leo Park", "leop", 105, 1],
];

function circleOf(board: [string, string, number, number][]): RecapStoryInput["circle"] {
  return board.map(([name, username, minutes, goalCount], i) => ({
    user: username === ME.username ? ME : person(name, username),
    isMe: username === ME.username,
    rank: i + 1,
    totalMs: minutes * MIN,
    goalCount,
  }));
}

function friendsOf(circle: RecapStoryInput["circle"]): RecapPerson[] {
  return circle.filter((r) => !r.isMe).map((r) => r.user);
}

type Habit = [string, string, string, number[]];
const HABITS_ALL: Habit[] = [
  ["Flashcards", "f", "#D6A728", [1, 1, 1, 1, 1, 0, 1]],
  ["Sleep by 11", "s", "#6F4E93", [1, 0, 1, 1, 0, 1, 1]],
  ["Gym", "g", "#7CBE6D", [1, 0, 1, 0, 1, 1, 0]],
  ["Read 20 min", "r", "#D06DA1", [0, 1, 1, 0, 1, 0, 0]],
];
const HABITS_PARTIAL: Habit[] = [
  ["Flashcards", "f", "#D6A728", [1, 1, 1, 0, 1, 0, 1]],
  ["Sleep by 11", "s", "#6F4E93", [0, 1, 1, 1, 0, 1, 0]],
  ["Read 20 min", "r", "#D06DA1", [1, 1, 0, 1, 0, 0, 1]],
  ["Gym", "g", "#7CBE6D", [1, 1, 0, 0, 1, 0, 0]],
  ["Journal", "j", "#395AA0", [0, 0, 1, 0, 0, 1, 0]],
];

const WEEK = "2026-10-05";
const DATES = ["05", "06", "07", "08", "09", "10", "11"].map((d) => `2026-10-${d}`);

function habitsOf(list: Habit[]) {
  return {
    habits: list.map(([name, id, color]) => ({ id, name, color })),
    completions: list.flatMap(([, id, , days]) =>
      days.flatMap((done, i) => (done ? [{ habitId: id, completedOn: DATES[i] }] : []))
    ),
  };
}

// [title, color, quota, actual hours]
type Goal = [string, string, number, number];
const GOALS: Record<"100" | "86" | "62", Goal[]> = {
  "100": [["Thesis", ORANGE, 6, 6.2], ["Spanish", LIGHT_BLUE, 2, 2.3], ["Reading", GREEN, 2, 2.1]],
  "86": [["Thesis", ORANGE, 6, 5.0], ["Spanish", LIGHT_BLUE, 2, 1.6], ["Reading", GREEN, 2, 2.0]],
  "62": [["Thesis", ORANGE, 6, 2.8], ["Spanish", LIGHT_BLUE, 2, 1.4], ["Reading", GREEN, 2, 2.0]],
};
function goalsOf(list: Goal[]): RecapStoryInput["goals"] {
  return list.map(([title, color, quotaHours, actual]) => ({
    id: title.toLowerCase(),
    title,
    color,
    quotaHours,
    actualMs: actual * H,
  }));
}

// The prototype's five categories, scaled to the week's total.
function categoriesFor(totalMs: number): RecapStoryInput["categories"] {
  const base: [string | null, string, string | null, number][] = [
    ["goal:thesis", "Thesis", ORANGE, 5.0],
    ["goal:reading", "Reading", GREEN, 2.0],
    ["goal:spanish", "Spanish", LIGHT_BLUE, 1.6],
    ["class", "Class", "#A084B3", 1.6],
    [null, "Uncategorized", null, 1.3],
  ];
  const scale = totalMs / (11.5 * H);
  return base.map(([id, name, color, h]) => ({ id, name, color, ms: h * H * scale }));
}

function base(): RecapStoryInput {
  const circle = circleOf(BOARD_TOP);
  return {
    weekStartISO: WEEK,
    totalTrackedMs: 11.5 * H,
    weeklyAverageMs: 8.2 * H,
    categories: categoriesFor(11.5 * H),
    goals: goalsOf(GOALS["86"]),
    ...habitsOf(HABITS_ALL),
    circle,
    friends: friendsOf(circle),
    likesGiven: [{ userId: "samr", count: 12, lastMs: 2 }],
    likesReceived: [{ userId: "jordanl", count: 5, lastMs: 3 }],
  };
}

export function recapPreviewInput(fixture: RecapPreviewFixture): RecapStoryInput {
  const b = base();
  switch (fixture) {
    case "above":
      return b;
    case "lighter":
      return { ...b, totalTrackedMs: 6.4 * H, categories: categoriesFor(6.4 * H) };
    case "goals-100":
      return { ...b, goals: goalsOf(GOALS["100"]) };
    case "goals-62":
      return { ...b, goals: goalsOf(GOALS["62"]) };
    case "best-partial":
      return { ...b, ...habitsOf(HABITS_PARTIAL) };
    case "outside": {
      const circle = circleOf(BOARD_OUT);
      return { ...b, circle, friends: friendsOf(circle) };
    }
    case "few": {
      // Two active friends: 19 hours between the three of you.
      const circle = circleOf([
        ["You", "raek", 690, 3],
        ["Sam Rivera", "samr", 300, 2],
        ["Jordan Lee", "jordanl", 150, 1],
      ]);
      return { ...b, circle, friends: friendsOf(circle) };
    }
    case "first-week":
      return { ...b, weeklyAverageMs: null };
    case "no-goals":
      return { ...b, goals: [] };
    case "no-habits":
      return { ...b, habits: [], completions: [] };
    case "solo":
      return {
        ...b,
        circle: circleOf([["You", "raek", 690, 3]]),
        friends: [],
        likesGiven: [],
        likesReceived: [],
      };
    case "quiet":
      return {
        ...b,
        totalTrackedMs: 0,
        categories: [],
        goals: goalsOf(GOALS["62"]).map((g) => ({ ...g, actualMs: 0 })),
        completions: [],
        // Nothing clocked: last in the circle, as rankLeaderboard keeps you.
        circle: circleOf([...BOARD_TOP.filter(([, u]) => u !== "raek"), ["You", "raek", 0, 0]]),
        likesGiven: [],
        likesReceived: [],
      };
    case "crowd": {
      // Past what the design was drawn for: nine habits, six goals, fourteen
      // friends, long names — the slides scroll rather than clip.
      const many: Habit[] = [
        ...HABITS_PARTIAL,
        ["Meditate for ten whole minutes before breakfast", "m", "#8E3A44", [1, 1, 1, 1, 1, 1, 1]],
        ["Stretch", "t", "#DE5148", [0, 0, 0, 0, 0, 0, 0]],
        ["Duolingo", "d", "#7CBE6D", [1, 0, 1, 0, 1, 0, 1]],
        ["No phone after 10", "p", "#A084B3", [1, 1, 0, 0, 1, 1, 0]],
      ];
      const circle = circleOf([
        ...BOARD_TOP,
        ["Alexandria Montgomery-Whitfield", "alexmw", 300, 5],
        ["Ben Ito", "beni", 280, 1],
        ["Cleo Diaz", "cleod", 240, 0],
        ["Dev Patel", "devp", 200, 2],
        ["Eli Novak", "elin", 150, 1],
        ["Fatima Khan", "fatk", 90, 1],
        ["Gus Moreau", "gusm", 30, 0],
      ]);
      return {
        ...b,
        goals: [
          ...goalsOf(GOALS["86"]),
          ...goalsOf([
            ["Portfolio site with a much longer goal name than usual", "#395AA0", 4, 4.5],
            ["Piano", "#D06DA1", 3, 1],
            ["Taxes", "#8E3A44", 1, 0],
          ]),
        ],
        ...habitsOf(many),
        circle,
        friends: friendsOf(circle),
      };
    }
  }
}

type Params = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// `?fixture=` (unknown → "above"), `?slide=<slide id>` to open on a slide,
// `?still=1` for the settled frame, `?inset=<px>` to stand in for the device's
// top safe area (59 for the handoff's iPhone 16 Pro; the bottom is then 34),
// `?welcome=1` for a first review (any fixture; `slide=welcome` implies it),
// `?posted=1` to open Share on a week already posted, `?fail=1` to make the
// fake post fail.
export function parseRecapPreviewParams(params: Params): {
  fixture: RecapPreviewFixture;
  slide: SlideId;
  still: boolean;
  welcome: boolean;
  posted: boolean;
  fail: boolean;
  insets: { top: number; bottom: number } | undefined;
} {
  const rawFixture = first(params.fixture) ?? "";
  const fixture = (RECAP_PREVIEW_FIXTURES as readonly string[]).includes(rawFixture)
    ? (rawFixture as RecapPreviewFixture)
    : "above";
  const rawSlide = first(params.slide) ?? "";
  const slide = (SLIDE_IDS as readonly string[]).includes(rawSlide) ? (rawSlide as SlideId) : "loading";
  const still = first(params.still) === "1";
  const inset = Number(first(params.inset));
  const insets =
    Number.isFinite(inset) && inset > 0 ? { top: Math.round(inset), bottom: 34 } : undefined;
  const welcome = first(params.welcome) === "1" || slide === "welcome";
  const posted = first(params.posted) === "1";
  const fail = first(params.fail) === "1";
  return { fixture, slide, still, welcome, posted, fail, insets };
}
