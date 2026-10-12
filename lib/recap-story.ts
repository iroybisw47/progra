import { aggregateRange } from "@/lib/aggregate";
import { entityColor, entityOnDark, goalColorOf } from "@/lib/colors";
import { addDaysISO, weekWindow, type WeekWindow } from "@/lib/dates";
import { formatDuration } from "@/lib/duration";
import { quoteForWeek, type RecapQuote } from "@/lib/recap-quotes";
import type { DayEvent } from "@/lib/db/calendar-events";
import type { Session } from "@/lib/storage";

// The weekly review's RULES (RECAP_V2, design_handoff_weekly_recap): every
// number, line of copy and skipped slide, decided once from plain data. Pure,
// so it's tested directly, and so the server (lib/db/recap-story.ts) and the
// dev preview (fixtures) build the story the same way. The client components
// only draw what comes out of buildRecapStory.
//
// Copy is the handoff's, word for word, apostrophes and all; where the handoff
// says nothing (a solo user, a week with no habits ticked), the plan's defaults
// apply — .claude/plans/recap-v2.md lists them.

const HOUR_MS = 60 * 60 * 1000;

export const SLIDE_IDS = [
  "loading",
  "welcome",
  "hours",
  "where",
  "goals",
  "habits",
  "friends",
  "rank",
  "share",
  "closing",
] as const;
export type SlideId = (typeof SLIDE_IDS)[number];

// The handoff's Uncategorized grey (--disabled), not entityColor's fallback.
export const UNCATEGORIZED_FILL = "#c3c8ce";
// The closing headline's colour when no goal had time: --sand, the other
// accent the design explored.
export const CLOSING_FALLBACK_ACCENT = "var(--sand)";
// Leaderboards (the rank slide, the top-three line) need this many friends who
// tracked time that week.
export const MIN_ACTIVE_FRIENDS = 3;
// Category rows listed under the donut (the ring still shows every one) —
// CategoryDonut's own cap.
export const MAX_CATEGORY_ROWS = 8;

export type RecapPerson = {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export type LikeTally = { userId: string; count: number; lastMs: number };

export type RecapStoryInput = {
  weekStartISO: string;
  // Sessions + calendar events, as computeWeekRecap counts it.
  totalTrackedMs: number;
  weeklyAverageMs: number | null;
  categories: { id: string | null; name: string; color: string | null; ms: number }[];
  // In display order. Goals without a quota still count for the closing accent.
  goals: { id: string; title: string; color: string | null; quotaHours: number; actualMs: number }[];
  habits: { id: string; name: string; color: string | null }[];
  completions: { habitId: string; completedOn: string }[];
  // The ranked circle (rankLeaderboard): you plus friends who clocked time.
  circle: { user: RecapPerson; isMe: boolean; rank: number; totalMs: number; goalCount: number }[];
  // Every accepted friend, active that week or not.
  friends: RecapPerson[];
  likesGiven: LikeTally[];
  likesReceived: LikeTally[];
  quote?: RecapQuote;
  // True until the person has closed a weekly review once: the story then
  // opens with the welcome slide, which says what this is and when it comes.
  firstReview?: boolean;
  // The Share slide (owner, 2026-10-12): offered only when posting this week
  // would succeed (its review is out and the account existed that week).
  // `posted` is this week's post when there already is one.
  share?: { postable: boolean; posted: { id: string; caption: string | null } | null };
};

export type WhereView = {
  totalLabel: string;
  countLabel: string;
  // Every category, in draw order; shares sum to 1.
  segments: { color: string; share: number }[];
  rows: { key: string; name: string; color: string; meta: string; widthPct: number }[];
};

export type GoalsView = {
  pct: number;
  complete: boolean;
  meta: string;
  caption: string;
  message: string;
  doneCopy: string | null;
  rows: {
    id: string;
    title: string;
    color: string;
    actual: string;
    quota: string;
    widthPct: number;
    done: boolean;
  }[];
};

export type HabitsView = {
  meta: string;
  // `summary` is what a screen reader hears for the row's seven cells.
  rows: { id: string; name: string; color: string; days: boolean[]; pct: number; summary: string }[];
  best: { index: number; count: number; total: number; all: boolean; copy: string } | null;
};

export type LikeRow = { person: RecapPerson; text: string; countLabel: string | null };

export type FriendsView = {
  meta: string;
  groupHours: number | null;
  groupUnit: "hour" | "hours";
  likedByYou: LikeRow | null;
  likedYou: LikeRow | null;
  top3: { rank: number; of: string } | null;
  invite: string | null;
};

export type RankView = {
  hero: string;
  of: string;
  rows: {
    userId: string;
    rank: number;
    isMe: boolean;
    label: string;
    person: RecapPerson;
    sub: string;
    duration: string;
  }[];
};

// The first review's welcome (owner, 2026-10-12: "a welcome to your weekly
// recap page. Every Monday at 6am you will see how your past week went").
export type WelcomeView = { title: string; line: string; hint: string };

export const WELCOME: WelcomeView = {
  title: "Welcome to your weekly recap",
  line: "Every Monday at 6am, you will see how your past week went.",
  // The story is tap-through with no buttons; a first-timer is told how once.
  hint: "Tap the right side to keep going, and the left side to go back.",
};

// What a posted weekly review shows: hours tracked, % towards goals, % of
// habits done. A null percentage is a week with no goals (or no habits).
export type ReviewPostSummary = {
  totalTrackedMs: number;
  goalPct: number | null;
  goalCount: number;
  habitPct: number | null;
  habitCount: number;
};

export type ShareView = {
  summary: ReviewPostSummary;
  // "solo": no friends yet, so nobody else will see it for now.
  audience: "friends" | "solo";
  posted: { id: string; caption: string | null } | null;
};

export type RecapStoryView = {
  weekStartISO: string;
  weekOfLabel: string;
  weekSpanLabel: string;
  slides: SlideId[];
  welcome: WelcomeView | null;
  hours: { value: number; text: string; large: boolean; line: string | null };
  where: WhereView | null;
  goals: GoalsView | null;
  habits: HabitsView | null;
  friends: FriendsView;
  rank: RankView | null;
  share: ShareView | null;
  closing: { accent: string; quote: RecapQuote };
};

// --- words ------------------------------------------------------------------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

export function numberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

export function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

// "A", "A and B", "A, B and C" — the handoff's list, no Oxford comma.
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

// "Sam" from "Sam Rivera"; "@samr" with no name, the app's way of naming a
// handle.
export function firstName(p: Pick<RecapPerson, "displayName" | "username">): string {
  return p.displayName?.trim().split(/\s+/)[0] || `@${p.username}`;
}

// Built from the ISO date's own digits with a fixed month table — never
// toLocaleDateString, whose output differs between the server and the device.
function monthDay(iso: string): { month: string; day: number } {
  const [, m, d] = iso.split("-").map(Number);
  return { month: MONTHS[m - 1], day: d };
}

// "Week of Oct 5"
export function weekOfLabel(weekStartISO: string): string {
  const { month, day } = monthDay(weekStartISO);
  return `Week of ${month} ${day}`;
}

// "Week of Oct 5 – 11", or "Week of Sep 28 – Oct 4" across a month.
export function weekSpanLabel(weekStartISO: string): string {
  const start = monthDay(weekStartISO);
  const end = monthDay(addDaysISO(weekStartISO, 6));
  const tail = end.month === start.month ? `${end.day}` : `${end.month} ${end.day}`;
  return `Week of ${start.month} ${start.day} – ${tail}`;
}

function hoursText(ms: number): string {
  return (ms / HOUR_MS).toFixed(1);
}

// A quota as typed: "6h", "2.5h".
function quotaText(hours: number): string {
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

// --- slides -----------------------------------------------------------------

export function hoursSlide(totalMs: number, averageMs: number | null): RecapStoryView["hours"] {
  const text = hoursText(totalMs);
  const value = Number(text);
  let line: string | null = null;
  // An average that reads 0.0 compares with nothing worth saying.
  if (averageMs !== null && Number(hoursText(averageMs)) > 0) {
    const avg = hoursText(averageMs);
    // Compared as shown, so "8.2 hrs" is never "above" an average of 8.2.
    line =
      value > Number(avg)
        ? `Above your weekly average of ${avg} hrs.`
        : `Your weekly average is ${avg} hrs.`;
  }
  return { value, text, large: value >= 100, line };
}

export function whereSlide(categories: RecapStoryInput["categories"]): WhereView | null {
  const withTime = categories.filter((c) => c.ms > 0);
  if (withTime.length === 0) return null;
  // Every uncategorized row is one bucket (the loader sends time from a
  // since-deleted category here too), drawn last whatever its size.
  const loose = withTime.filter((c) => c.id === null);
  const uncategorized = loose.length
    ? [{ id: null, name: "Uncategorized", color: null, ms: loose.reduce((s, c) => s + c.ms, 0) }]
    : [];
  const ordered = [
    ...withTime.filter((c) => c.id !== null).sort((a, b) => b.ms - a.ms),
    ...uncategorized,
  ];
  const total = ordered.reduce((s, c) => s + c.ms, 0);
  const colorOf = (c: (typeof ordered)[number]) =>
    c.id === null ? UNCATEGORIZED_FILL : entityColor(c.color);
  return {
    totalLabel: formatDuration(total),
    countLabel: `${ordered.length} ${plural(ordered.length, "category", "categories")}`,
    segments: ordered.map((c) => ({ color: colorOf(c), share: c.ms / total })),
    // Capped for the list (the ring shows everything), keeping Uncategorized
    // as the last row rather than cutting it.
    rows: (ordered.length <= MAX_CATEGORY_ROWS
      ? ordered
      : [...ordered.slice(0, MAX_CATEGORY_ROWS - uncategorized.length), ...uncategorized]
    ).map((c) => {
      const pct = Math.round((c.ms / total) * 100);
      return {
        key: c.id ?? "uncategorized",
        name: c.name,
        color: colorOf(c),
        meta: `${hoursText(c.ms)}h · ${pct}%`,
        widthPct: Math.max(2, pct),
      };
    }),
  };
}

export function goalsSlide(goals: RecapStoryInput["goals"]): GoalsView | null {
  const list = goals.filter((g) => g.quotaHours > 0);
  if (list.length === 0) return null;
  const n = list.length;
  const met = (g: (typeof list)[number]) => g.actualMs >= g.quotaHours * HOUR_MS;

  // Each goal capped at its own quota, so one over-achieved goal can't hide
  // another that fell short.
  const quota = list.reduce((s, g) => s + g.quotaHours, 0);
  const capped = list.reduce((s, g) => s + Math.min(g.actualMs / HOUR_MS, g.quotaHours), 0);
  const complete = list.every(met);
  // 100 only when every goal met its quota; otherwise never rounds up to it.
  const pct = complete ? 100 : Math.min(99, Math.round((capped / quota) * 100));

  let message: string;
  if (complete) {
    message = n === 1 ? "Goal complete. Want to raise it?" : "Goals complete. Want to raise them?";
  } else if (pct >= 80) {
    message = `${pct}% done. Great job! Let’s aim for 100 next week.`;
  } else {
    message =
      n === 1
        ? `You were ${pct}% done with your weekly goal. Let’s try and hit it next week!`
        : `You were ${pct}% done with your weekly goals. Let’s try and hit them next week!`;
  }

  const done = list.filter(met);
  let doneCopy: string | null = null;
  if (done.length > 0) {
    if (done.length === n && n === 2) doneCopy = "You did 100% of both goals, good job!!";
    else if (done.length === n && n > 2)
      doneCopy = `You did 100% of all ${numberWord(n)} goals, good job!!`;
    else doneCopy = `You did 100% of your ${joinNames(done.map((g) => g.title))}, good job!!`;
  }

  return {
    pct,
    complete,
    meta: `${capped.toFixed(1)}h of ${quotaText(quota)}`,
    caption: n === 1 ? "weekly goal" : `across ${n} goals`,
    message,
    doneCopy,
    rows: list.map((g) => ({
      id: g.id,
      title: g.title,
      color: goalColorOf(g),
      actual: `${hoursText(g.actualMs)}h`,
      quota: quotaText(g.quotaHours),
      widthPct: Math.max(2, Math.min(100, (g.actualMs / (g.quotaHours * HOUR_MS)) * 100)),
      done: met(g),
    })),
  };
}

export function habitsSlide(
  weekStartISO: string,
  habits: RecapStoryInput["habits"],
  completions: RecapStoryInput["completions"]
): HabitsView | null {
  if (habits.length === 0) return null;
  const dates = Array.from({ length: 7 }, (_, i) => addDaysISO(weekStartISO, i));
  const doneKeys = new Set(completions.map((c) => `${c.habitId}|${c.completedOn}`));

  const rows = habits.map((h) => {
    const days = dates.map((d) => doneKeys.has(`${h.id}|${d}`));
    const count = days.filter(Boolean).length;
    const doneDays = WEEKDAYS.filter((_, i) => days[i]);
    return {
      id: h.id,
      name: h.name,
      color: entityColor(h.color),
      days,
      summary: `Done on ${count} of 7 days${doneDays.length ? `: ${doneDays.join(", ")}` : ""}.`,
      // Habits carry no schedule: every one is daily, so the week is seven days.
      pct: Math.round((count / 7) * 100),
    };
  });

  const perDay = dates.map((_, i) => rows.filter((r) => r.days[i]).length);
  const max = Math.max(...perDay);
  let best: HabitsView["best"] = null;
  if (max > 0) {
    // Ties go to the earliest day.
    const index = perDay.indexOf(max);
    const all = max === habits.length;
    const day = WEEKDAYS[index];
    const copy = all
      ? habits.length === 1
        ? `Your best day was ${day}, when you completed your habit.`
        : `Your best day was ${day}, when you completed every habit.`
      : `Your best day was ${day}, with ${max} of ${habits.length} habits done.`;
    best = { index, count: max, total: habits.length, all, copy };
  }

  return {
    meta: `${habits.length} ${plural(habits.length, "habit", "habits")} this week`,
    rows,
    best,
  };
}

// Most likes, ties to the most recent — among current friends only, so someone
// since unfriended or blocked never surfaces.
function topTally(tallies: LikeTally[], friendsById: Map<string, RecapPerson>): LikeTally | null {
  let top: LikeTally | null = null;
  for (const t of tallies) {
    if (t.count <= 0 || !friendsById.has(t.userId)) continue;
    if (!top || t.count > top.count || (t.count === top.count && t.lastMs > top.lastMs)) top = t;
  }
  return top;
}

export function friendsSlide(input: RecapStoryInput): FriendsView {
  const activeFriends = input.circle.filter((r) => !r.isMe).length;
  const me = input.circle.find((r) => r.isMe) ?? null;
  const friendsById = new Map(input.friends.map((f) => [f.userId, f]));

  // The circle's hours together — but not for someone with no friends, and
  // not when it would read "0 hours".
  const groupHours = Math.round(input.circle.reduce((s, r) => s + r.totalMs, 0) / HOUR_MS);
  const showGroup = input.friends.length > 0 && groupHours > 0;

  const given = topTally(input.likesGiven, friendsById);
  const received = topTally(input.likesReceived, friendsById);

  const leaderboard = activeFriends >= MIN_ACTIVE_FRIENDS;
  return {
    meta: leaderboard
      ? `${input.circle.length} in your circle`
      : input.friends.length === 0
        ? "No friends yet"
        : `${activeFriends} active ${plural(activeFriends, "friend", "friends")}`,
    groupHours: showGroup ? groupHours : null,
    groupUnit: groupHours === 1 ? "hour" : "hours",
    likedByYou: given
      ? {
          person: friendsById.get(given.userId)!,
          text: `You liked ${firstName(friendsById.get(given.userId)!)}’s posts the most`,
          countLabel: `${given.count} ${plural(given.count, "like", "likes")}`,
        }
      : null,
    likedYou: received
      ? {
          person: friendsById.get(received.userId)!,
          text: `${firstName(friendsById.get(received.userId)!)} liked your posts the most.`,
          countLabel: null,
        }
      : null,
    top3:
      leaderboard && me && me.rank <= 3
        ? { rank: me.rank, of: `of ${input.circle.length} in your circle` }
        : null,
    invite: leaderboard
      ? null
      : `Leaderboards start at three active friends — invite ${numberWord(
          MIN_ACTIVE_FRIENDS - activeFriends
        )} more and you’ll see how your weeks stack up.`,
  };
}

export function rankSlide(circle: RecapStoryInput["circle"]): RankView | null {
  const active = circle.filter((r) => !r.isMe).length;
  const me = circle.find((r) => r.isMe);
  if (active < MIN_ACTIVE_FRIENDS || !me) return null;
  return {
    hero: `#${me.rank}`,
    of: `of ${circle.length} in your circle`,
    rows: circle.map((r) => ({
      userId: r.user.userId,
      rank: r.rank,
      isMe: r.isMe,
      label: r.isMe ? "You" : r.user.displayName || `@${r.user.username}`,
      person: r.user,
      sub:
        r.goalCount > 0
          ? `${r.goalCount} ${plural(r.goalCount, "goal", "goals")} this week`
          : r.totalMs > 0
            ? "Tracked outside goals"
            : "Nothing tracked this week",
      duration: r.totalMs < 60_000 ? "0m" : formatDuration(r.totalMs),
    })),
  };
}

// The week's habit completion: every tick over every habit-day, exactly (not
// an average of the rounded per-habit figures). Null with no habits.
export function habitWeekPct(rows: { days: boolean[] }[]): number | null {
  if (rows.length === 0) return null;
  const done = rows.reduce((s, r) => s + r.days.filter(Boolean).length, 0);
  return Math.round((100 * done) / (7 * rows.length));
}

// A post's numbers, from the same slides the story draws, so the post can't
// disagree with what the person just watched: goal % is the Weekly goals
// ring's (each goal capped at its quota; 100 only when every one was met).
export function reviewPostSummary(
  input: Pick<RecapStoryInput, "weekStartISO" | "totalTrackedMs" | "goals" | "habits" | "completions">
): ReviewPostSummary {
  const goals = goalsSlide(input.goals);
  const habits = habitsSlide(input.weekStartISO, input.habits, input.completions);
  return {
    totalTrackedMs: input.totalTrackedMs,
    goalPct: goals?.pct ?? null,
    goalCount: goals?.rows.length ?? 0,
    habitPct: habits ? habitWeekPct(habits.rows) : null,
    habitCount: habits?.rows.length ?? 0,
  };
}

// The closing headline: the top goal's colour (most hours this week), lifted
// for navy the way the Live Activity lifts it.
export function closingAccent(goals: RecapStoryInput["goals"]): string {
  let top: RecapStoryInput["goals"][number] | null = null;
  for (const g of goals) if (g.actualMs > 0 && (!top || g.actualMs > top.actualMs)) top = g;
  return top ? entityOnDark(goalColorOf(top)) : CLOSING_FALLBACK_ACCENT;
}

export function buildRecapStory(input: RecapStoryInput): RecapStoryView {
  const where = whereSlide(input.categories);
  const goals = goalsSlide(input.goals);
  const habits = habitsSlide(input.weekStartISO, input.habits, input.completions);
  const rank = rankSlide(input.circle);

  const slides: SlideId[] = ["loading"];
  if (input.firstReview) slides.push("welcome");
  slides.push("hours");
  if (where) slides.push("where");
  if (goals) slides.push("goals");
  if (habits) slides.push("habits");
  slides.push("friends");
  if (rank) slides.push("rank");
  const share: ShareView | null = input.share?.postable
    ? {
        summary: reviewPostSummary(input),
        audience: input.friends.length > 0 ? "friends" : "solo",
        posted: input.share.posted,
      }
    : null;
  if (share) slides.push("share");
  slides.push("closing");

  return {
    weekStartISO: input.weekStartISO,
    weekOfLabel: weekOfLabel(input.weekStartISO),
    weekSpanLabel: weekSpanLabel(input.weekStartISO),
    slides,
    welcome: input.firstReview ? WELCOME : null,
    hours: hoursSlide(input.totalTrackedMs, input.weeklyAverageMs),
    where,
    goals,
    habits,
    friends: friendsSlide(input),
    rank,
    share,
    closing: {
      accent: closingAccent(input.goals),
      quote: input.quote ?? quoteForWeek(input.weekStartISO),
    },
  };
}

// --- server-side helpers (pure; lib/db/recap-story.ts feeds them) -----------

// The weeks "your weekly average" is taken over: the `weeks` completed weeks
// before the reviewed one, minus any that ended before the account existed.
// Quiet weeks stay in (they count as 0) — owner's call, 2026-10-11.
export function averageWindows(
  weekStartISO: string,
  tz: string,
  createdMs: number,
  weeks = 8
): WeekWindow[] {
  const out: WeekWindow[] = [];
  for (let k = 1; k <= weeks; k++) {
    const w = weekWindow(tz, addDaysISO(weekStartISO, -7 * k));
    if (w.weekEndMs >= createdMs) out.push(w);
  }
  return out;
}

// Mean tracked time over `windows`, each week through aggregateRange — the
// same attribution every recap uses, so each week's figure is the one its own
// review would show. Null with no weeks (a first week has no average).
export function weeklyAverageMs(
  sessions: Session[],
  events: DayEvent[],
  windows: Pick<WeekWindow, "weekStartMs" | "weekEndMs">[],
  nowMs: number
): number | null {
  if (windows.length === 0) return null;
  let sum = 0;
  for (const w of windows) {
    sum += aggregateRange(sessions, events, w.weekStartMs, w.weekEndMs, Math.min(nowMs, w.weekEndMs)).total;
  }
  return sum / windows.length;
}

// Likes grouped by the other person: how many, and the latest one's instant.
export function tallyLikes(rows: { userId: string; createdMs: number }[]): LikeTally[] {
  const by = new Map<string, LikeTally>();
  for (const r of rows) {
    const t = by.get(r.userId) ?? { userId: r.userId, count: 0, lastMs: 0 };
    t.count += 1;
    t.lastMs = Math.max(t.lastMs, r.createdMs);
    by.set(r.userId, t);
  }
  return [...by.values()];
}
