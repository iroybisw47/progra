// The UW cohort's matching vocabulary: the two picker lists, the text
// normalization the SQL mirrors, and the one line a suggestion row shows.
//
// Pure and dependency-free on purpose. `uw_peers` scores a pair in SQL
// (same_major * 3 + shared_clubs * 2 + shared_goals * 2) and this file explains
// that score in words — so the two halves are testable apart, and the
// normalization that decides whether two strings "match" exists in exactly one
// place per side.
//
// Lives here rather than in app/actions/uw.ts because `"use server"` files may
// export only async functions.

// A major is stored as a list entry OR as free text from the "Other" option, so
// there is no whitelist to enforce — this cap and the matching
// `profiles_uw_major_len` CHECK are the only bound.
export const MAJOR_MAX = 80;

// Five is the cap the UI enforces and the `profiles_uw_clubs_shape` CHECK
// re-asserts. Five keeps a suggestion row's reason line honest: past that,
// "4 clubs in common" stops meaning anything.
export const MAX_UW_CLUBS = 5;

// Per-club length. The DB bounds the array's TOTAL text at 400 chars (a CHECK
// may not contain the subquery a per-element rule needs), so this is where a
// single absurd club name is actually stopped.
export const CLUB_MAX = 60;

// The "Other" sentinel. NOT a stored value — picking it reveals a free-text
// field, and what the student types is what lands in profiles.uw_major. Kept
// out of UW_MAJORS so a student can never match another on the literal string
// "Other".
export const OTHER_MAJOR = "Other";

// ~30 of UW's largest undergraduate programs, newest-student-first in practice
// rather than alphabetical — a short list beats a complete one here, because
// anything missing has the "Other" escape hatch and a free-text major still
// matches another student who typed the same words.
//
// Editing this list is a deploy, not a migration: the DB bounds length only.
export const UW_MAJORS: readonly string[] = [
  "Computer Science",
  "Informatics",
  "Electrical & Computer Engineering",
  "Mechanical Engineering",
  "Civil & Environmental Engineering",
  "Chemical Engineering",
  "Bioengineering",
  "Aeronautics & Astronautics",
  "Materials Science & Engineering",
  "Industrial & Systems Engineering",
  "Human Centered Design & Engineering",
  "Mathematics",
  "Statistics",
  "Physics",
  "Chemistry",
  "Biology",
  "Biochemistry",
  "Neuroscience",
  "Public Health",
  "Nursing",
  "Psychology",
  "Economics",
  "Business Administration",
  "Political Science",
  "Communication",
  "Sociology",
  "Anthropology",
  "English",
  "History",
  "Philosophy",
  "International Studies",
  "Law, Societies & Justice",
  "Geography",
  "Linguistics",
  "Architecture",
  "Art",
  "Music",
  "Education",
  "Environmental Studies",
  "Undeclared",
];

// One suggested peer, as `uw_peers` returns them. The three signal fields come
// back as their own columns rather than folded into the score, so the row can
// say WHY it is a suggestion — a bare "92% match" is not something a student
// can act on.
export type UwPeer = {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  major: string | null;
  clubs: readonly string[];
  // The peer's active, non-private goal titles, at most three — empty when they
  // turned `uw_share_goals` off. Filtered in SQL, so a private title never
  // leaves the database.
  goalTitles: readonly string[];
  sameMajor: boolean;
  sharedClubs: number;
  sharedGoals: number;
};

// Words that carry no signal in a UW club name. "UW Robotics Club" and "Husky
// Robotics" are the same room; what makes them the same is `robotics`, and
// every other word in both is furniture. Dropping these is what lets two
// students who typed different names for one org still match — and, just as
// importantly, stops "Husky Sailing" matching "Husky Marching Band" on the
// mascot.
//
// A club whose every word is in here normalizes to nothing and matches nobody,
// which is correct: "Student Union" is too generic to connect two people.
// The shared normalization for MAJORS and goal-title equality: `lower(btrim())`
// plus collapsed inner whitespace, mirroring public.uw_norm in SQL. Majors are
// still compared whole — two students are in the same major or they aren't —
// while clubs and goals go through the token matchers below.
export function normalizeMatchText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

// Validate a major on its way to the DB. Returns the value to store, or null for
// "no major", which is a legitimate state — the student skipped the field.
//
// A list entry is stored verbatim so two students who picked it match exactly.
// Free text from "Other" is trimmed, whitespace-collapsed and capped; it is NOT
// lowercased, because this is also what the profile displays. Matching happens
// on normalizeMatchText at read time.
export function cleanMajor(value: string | null | undefined): string | null {
  if (!value) return null;
  const collapsed = value.trim().replace(/\s+/g, " ");
  if (!collapsed || collapsed === OTHER_MAJOR) return null;
  const exact = UW_MAJORS.find(
    (m) => normalizeMatchText(m) === normalizeMatchText(collapsed)
  );
  return exact ?? collapsed.slice(0, MAJOR_MAX);
}

const CLUB_NOISE = new Set([
  "uw", "u", "w", "washington", "seattle", "husky", "huskies", "dawg", "dawgs",
  "club", "clubs", "society", "team", "teams", "association", "assoc",
  "organization", "org", "student", "students", "chapter", "group", "union",
  "council", "the", "of", "at", "in", "and", "a", "an", "for", "my", "is",
]);

// The same idea for GOALS. People write a goal as an instruction to themselves
// — "Study for CSE 143", "Read more", "3hr club apps" — so the words that carry
// the subject are buried in verbs, quantities and filler. Strip those and
// "Study for CSE 143" and "CSE 143 problem sets" both reduce to `cse`, while
// "Study physics" and "Study piano" no longer collide on `study`.
//
// `study`, `learn`, `work` and `practice` ARE in here, which is the whole
// trick: they are the most common words in the goal table and the least
// informative — "Study physics" and "Study piano" are not the same goal.
//
// `read` is deliberately NOT in here: reading is a goal in its own right, so
// "Read more" and "Read daily" should find each other.
const GOAL_NOISE = new Set([
  "study", "studying", "studies", "learn", "learning", "learned", "learnt",
  "work", "working", "practice", "practise",
  "practicing", "do", "doing", "done", "get", "getting", "go", "going", "make",
  "making", "finish", "finishing", "complete", "start", "starting", "keep",
  "spend", "spending", "put", "plan", "planning", "goal", "goals", "project",
  "projects", "time", "times", "more", "less", "better", "best", "new", "all",
  "some", "every", "each", "per", "daily", "weekly", "monthly", "day", "days",
  "week", "weeks", "month", "months", "year", "years", "hour", "hours", "hr",
  "hrs", "min", "mins", "minute", "minutes", "this", "that", "it", "my", "me",
  "i", "the", "a", "an", "of", "at", "in", "on", "to", "for", "and", "with",
  "be", "am", "is", "up", "out", "least",
]);

// A bare number carries no subject. "3hr", "30min", "5x" and plain "10" are how
// people write the SIZE of a goal, and two goals that merely share a size are
// not the same goal — "Read 10 books" and "Study 10 hours" must not match.
//
// This also drops a course number, so "CSE 143" reduces to `cse`. That is the
// right trade: the department word already carries the match, and it means
// CSE 143 and CSE 142 find each other, which two students one quarter apart
// would want. Digits INSIDE a word ("3d", "c4") survive.
function isQuantity(word: string): boolean {
  return /^[0-9]+(h|hr|hrs|hour|hours|m|min|mins|minute|minutes|x|k)?$/.test(word);
}

// The significant words of a name, deduped. Shared by clubs and goals so the
// splitting rules can't drift apart; only the stop list differs.
function significantWords(value: string, noise: Set<string>): string[] {
  const words = value
    .toLowerCase()
    // Hyphens, apostrophes and dots JOIN rather than split: "pre-med" has to
    // become one token, or it shares "pre" with "pre-law" and the two match.
    .replace(/['\u2019.\-\u2013\u2014]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ");
  return [
    ...new Set(
      words.filter((w) => w.length > 1 && !noise.has(w) && !isQuantity(w))
    ),
  ];
}

// Any shared significant word counts, and a word counts as shared when one is a
// prefix of the other from 4 characters up — which absorbs plurals and
// truncations ("robotic"/"robotics", "marathon"/"marathons") without needing
// pg_trgm (unavailable in the PGlite harness, so unprovable before prod).
//
// Deliberately generous: this feeds "people you may know", where a near miss
// costs a student one suggestion they shrug at, and a miss costs them someone
// they'd actually have worked alongside.
function anyWordShared(left: readonly string[], right: readonly string[]): boolean {
  return left.some((x) =>
    right.some(
      (y) => x === y || (x.length >= 4 && y.length >= 4 && (x.startsWith(y) || y.startsWith(x)))
    )
  );
}

// SQL mirrors: public.uw_club_tokens / uw_clubs_match and
// public.uw_goal_tokens / uw_goals_match. Keep each pair in step, or the app
// promises matches the database won't make.
export function clubTokens(value: string): string[] {
  return significantWords(value, CLUB_NOISE);
}

export function goalTokens(value: string): string[] {
  return significantWords(value, GOAL_NOISE);
}

export function clubsMatch(a: string, b: string): boolean {
  return anyWordShared(clubTokens(a), clubTokens(b));
}

export function goalsMatch(a: string, b: string): boolean {
  return anyWordShared(goalTokens(a), goalTokens(b));
}

// Clean a typed club list on its way to the DB: drop blanks, cap each entry's
// length, dedupe case-insensitively, cap the count.
//
// What the student typed is what gets stored, verbatim but tidied — there is no
// canonical list to snap to, and their own spelling is what their profile
// should read. Matching is clubsMatch's job, not storage's.
export function cleanClubs(values: readonly string[] | null | undefined): string[] {
  if (!values) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const collapsed = (raw ?? "").trim().replace(/\s+/g, " ").slice(0, CLUB_MAX);
    if (!collapsed) continue;
    const key = normalizeMatchText(collapsed);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(collapsed);
    if (out.length >= MAX_UW_CLUBS) break;
  }
  return out;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

// "Same major · 2 clubs in common". The one line under a suggestion's name.
//
// Total over every input, including the all-zero case: `uw_peers` filters to
// score > 0 so that row should never render, but a reason line is not the place
// to throw — an empty string would leave the row looking broken.
export function matchReason(peer: {
  sameMajor: boolean;
  sharedClubs: number;
  sharedGoals: number;
}): string {
  const parts: string[] = [];
  if (peer.sameMajor) parts.push("Same major");
  if (peer.sharedClubs > 0) {
    parts.push(`${plural(peer.sharedClubs, "club", "clubs")} in common`);
  }
  if (peer.sharedGoals > 0) {
    parts.push(`${plural(peer.sharedGoals, "goal", "goals")} in common`);
  }
  return parts.length > 0 ? parts.join(" · ") : "Also at UW";
}
