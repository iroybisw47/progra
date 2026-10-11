// The UW cohort's matching vocabulary: the major and interest lists, the text
// normalization the SQL mirrors, and the cleaners every stored value goes
// through on its way to the DB.
//
// Pure and dependency-free on purpose. list_uw_peers (uw-cohort.sql STEP 5)
// buckets a peer by `uw_norm` EQUALITY of a major or an interest, and this file
// holds the app's half of that rule — so the normalization that decides whether
// two strings "match" exists in exactly one place per side. The buckets
// themselves, and the rows the RPC returns, are lib/uw-peers.ts.
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

// Onboarding v3's limits (handoff README R:85, R:87; plan D3): up to three
// majors for a double or triple major, up to six interests. Defined here
// rather than in the wizard because the STEP 5 CHECKs
// (profiles_uw_majors_shape / _interests_shape, plan §4.2) re-assert the same
// two numbers, and cleanMajors/cleanInterests below must agree with the UI's
// chip limit.
export const MAX_UW_MAJORS = 3;
export const MAX_UW_INTERESTS = 6;

// Per-interest length. Like the clubs CHECK, profiles_uw_interests_shape can
// only bound the array's TOTAL text (300 chars, joined with commas), so this is
// what stops one absurd entry — and it is sized so a full list always fits:
// six of these plus five commas is 293. A longer cap would let six long
// interests that each passed here fail the CHECK as a whole. Majors need no
// separate number: three MAJOR_MAX entries plus two commas is 242, inside
// profiles_uw_majors_shape's 245.
export const INTEREST_MAX = 48;

// The "Other" sentinel. NOT a stored value — picking it reveals a free-text
// field, and what the student types is what lands in profiles.uw_major. Kept
// out of UW_MAJORS so a student can never match another on the literal string
// "Other".
export const OTHER_MAJOR = "Other";
const OTHER_KEY = OTHER_MAJOR.toLowerCase();

// ~40 of UW's largest undergraduate programs, newest-student-first in practice
// rather than alphabetical — a short list beats a complete one here, because
// anything missing can be typed as free text, and a free-text major still
// matches another student who typed the same words.
//
// Onboarding v3's list (R:86) is a subset of this one apart from two entries,
// Design and Environmental Science, which are added here rather than kept as a
// second list (plan D3): one list is what canonicalizes a typed major, and what
// isListedMajor() checks before a stranger is shown one.
//
// Editing this list is a deploy, not a migration: the DB bounds length only.
// Adding an entry is safe. REMOVING one is not quite: a student who picked it
// still matches, but "More at UW" stops showing it, as for any free text.
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
  "Design",
  "Music",
  "Education",
  "Environmental Science",
  "Environmental Studies",
  "Undeclared",
];

// The shared normalization for every equality match — majors, interests, and
// goal titles in the old uw_peers: `lower(btrim())` plus collapsed inner
// whitespace, mirroring public.uw_norm in SQL. Majors and interests are
// compared whole — two students are in the same major or they aren't — while
// clubs and goals go through the token matchers further down.
export function normalizeMatchText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

// At most `max` characters, counted in code points, with no trailing space left
// by the cut. Code points because that is what the DB's char_length() counts,
// so the CHECKs above see the same number this does — and a cut by UTF-16 unit
// could split an emoji's surrogate pair, which PostgREST would refuse to store.
function capCodePoints(value: string, max: number): string {
  const points = Array.from(value);
  return points.length <= max ? value : points.slice(0, max).join("").trimEnd();
}

// Trimmed, inner whitespace collapsed. What every free-text value is stored as:
// tidy, but with the student's own casing, because it is also what displays.
function tidy(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

// Each list entry under its normalized form, so canonicalizing and the
// is-it-listed check are one lookup rather than a scan per call.
const MAJOR_BY_KEY: ReadonlyMap<string, string> = new Map(
  UW_MAJORS.map((m) => [normalizeMatchText(m), m])
);

// The list's own spelling of `value`, or null when it isn't on the list.
// "computer   science" → "Computer Science"; "Comparative History of Ideas" →
// null. Total over any input, because its caller holds rows from the database.
export function listedMajor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return MAJOR_BY_KEY.get(normalizeMatchText(value)) ?? null;
}

// Whether a major may be shown to a stranger: on the list, case-insensitively.
// "More at UW" renders a peer's major only when this holds (plan D3), so a
// free-text major still matches a student who typed the same words, but the
// app never renders what someone typed into a free field to everyone at UW.
// That is the app's half only: list_uw_peers returns the raw first major, so a
// caller who invokes the RPC directly through PostgREST can still read it
// (uw-cohort.sql STEP 5, "WHAT THIS WIDENS"). Closing that is a SQL change.
export function isListedMajor(value: unknown): boolean {
  return listedMajor(value) !== null;
}

// Validate a major on its way to the DB. Returns the value to store, or null for
// "no major", which is a legitimate state — the student skipped the field.
//
// A list entry is stored in the list's spelling so two students who picked it
// match exactly and it displays the same for both. Free text is tidied and
// capped; it is NOT lowercased, because this is also what the profile displays.
// Matching happens on normalizeMatchText at read time.
export function cleanMajor(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const collapsed = tidy(value);
  // The sentinel in any casing: v3 has no "Other" option, so "other" can only
  // arrive typed, and two students who typed it would match on it.
  if (!collapsed || normalizeMatchText(collapsed) === OTHER_KEY) return null;
  return listedMajor(collapsed) ?? capCodePoints(collapsed, MAJOR_MAX);
}

// Onboarding v3's interest suggestions (R:87), in the README's order. Unlike
// UW_MAJORS this is NOT a canonical list: an interest is stored as typed
// (tidied), and these are only the chips offered under the field. Matching is
// list_uw_peers' `uw_norm` equality, so "ai" and "AI" still find each other.
export const UW_INTERESTS: readonly string[] = [
  "Startups",
  "Investing",
  "Running",
  "Lifting",
  "Climbing",
  "Hiking",
  "Design",
  "AI",
  "Music",
  "Photography",
  "Pre-med",
  "Writing",
  "Chess",
  "Cooking",
  "Film",
];

// The shared shape of both list cleaners: tidy each entry, drop blanks and
// anything that isn't a string, dedupe on the normalized form (so "Economics"
// and "economics" are one entry, the first spelling kept), stop at the cap.
// Total over any input: an action can be POSTed with anything.
function cleanList(
  values: unknown,
  max: number,
  clean: (value: string) => string | null
): string[] {
  if (!Array.isArray(values)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    if (out.length >= max) break;
    if (typeof raw !== "string") continue;
    const value = clean(raw);
    if (!value) continue;
    const key = normalizeMatchText(value);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

// A student's majors on their way to profiles.uw_majors: each through
// cleanMajor (so a list entry is canonicalized to its spelling, and free text
// kept), deduped after canonicalizing — "computer science" and "Computer
// Science" are one major — and capped at MAX_UW_MAJORS, keeping the first.
export function cleanMajors(values: unknown): string[] {
  return cleanList(values, MAX_UW_MAJORS, cleanMajor);
}

// A student's interests on their way to profiles.uw_interests: tidied, capped
// at INTEREST_MAX each, deduped case-insensitively, at most MAX_UW_INTERESTS.
// Kept in the student's own spelling (R:87): there is no canonical list.
export function cleanInterests(values: unknown): string[] {
  return cleanList(values, MAX_UW_INTERESTS, (raw) =>
    capCodePoints(tidy(raw), INTEREST_MAX) || null
  );
}

// What setUwProfile is called with: v3's Screen 1 (P9c) and the Settings block.
// `majors`, `interests` and `listed` only mean anything on a join, so a "No"
// is just `{ isUw: false }`.
export type UwProfileInput = {
  isUw: boolean;
  majors?: readonly string[] | null;
  interests?: readonly string[] | null;
  // Whether this student appears in other students' UW groups (plan D2). Set
  // true only next to the disclosure that says what it shows. Anything but
  // `true` reads as false: the column fails closed, and so does this.
  listed?: boolean;
};

// The profiles UPDATE setUwProfile sends. EVERY UW column is named on both
// paths, so neither can leave a stale value behind from an older shape.
export type UwProfilePayload = {
  is_uw: boolean;
  uw_majors: string[] | null;
  uw_interests: string[] | null;
  uw_listed: boolean;
  // Goal titles are never shared with UW peers any more (plan D3), and STEP 5
  // makes false the column's default. Written on every save anyway, so no row
  // can keep a `true` from before.
  uw_share_goals: false;
  // v2's single major and its clubs. Retired (D3): nothing writes them but
  // this null, and clubs are never moved into interests.
  uw_major: null;
  uw_clubs: null;
};

// The payload for one setUwProfile call, or null when the input isn't one —
// pure, so the join/leave rule is pinned by lib/uw.test.ts.
//
//   Join: the cleaned majors and interests (null when there are none, so "no
//   majors" has one spelling in the DB), the listing opt-in, and the two
//   retired columns nulled.
//   Leave: every UW field cleared, uw_listed false included. Leaving the cohort
//   takes its data with it — a stale major on a profile that is no longer
//   `is_uw` is data nothing can show and nobody asked us to keep.
export function uwProfilePayload(input: unknown): UwProfilePayload | null {
  if (typeof input !== "object" || input === null) return null;
  const { isUw, majors, interests, listed } = input as Record<string, unknown>;
  if (typeof isUw !== "boolean") return null;
  const retired = { uw_share_goals: false, uw_major: null, uw_clubs: null } as const;
  if (!isUw) {
    return {
      is_uw: false,
      uw_majors: null,
      uw_interests: null,
      uw_listed: false,
      ...retired,
    };
  }
  const cleanedMajors = cleanMajors(majors);
  const cleanedInterests = cleanInterests(interests);
  return {
    is_uw: true,
    uw_majors: cleanedMajors.length > 0 ? cleanedMajors : null,
    uw_interests: cleanedInterests.length > 0 ? cleanedInterests : null,
    uw_listed: listed === true,
    ...retired,
  };
}

// Whether saving `next` would store anything other than what `saved` already
// stores: their payloads compared, so a re-spelling the cleaners undo ("economics"
// for "Economics", a stray space) is no change. Settings → Edit profile skips
// setUwProfile when this is false, so a bio-only save from a stale tab or a
// second device never re-asserts cohort membership or the listing opt-in from
// its page-load snapshot after the student left or unlisted elsewhere.
export function isUwProfileChange(saved: UwProfileInput, next: UwProfileInput): boolean {
  const a = uwProfilePayload(saved);
  const b = uwProfilePayload(next);
  if (!a || !b) return a !== b;
  // The payload spells "none" as null, so null against null is the only way
  // two empty lists meet.
  const sameList = (x: string[] | null, y: string[] | null) =>
    x === null || y === null ? x === y : x.length === y.length && x.every((v, i) => v === y[i]);
  return (
    a.is_uw !== b.is_uw ||
    a.uw_listed !== b.uw_listed ||
    !sameList(a.uw_majors, b.uw_majors) ||
    !sameList(a.uw_interests, b.uw_interests)
  );
}

// Words that carry no signal in a UW club name. "UW Robotics Club" and "Husky
// Robotics" are the same room; what makes them the same is `robotics`, and
// every other word in both is furniture. Dropping these is what lets two
// students who typed different names for one org still match — and, just as
// importantly, stops "Husky Sailing" matching "Husky Marching Band" on the
// mascot.
//
// A club whose every word is in here normalizes to nothing and matches nobody,
// which is correct: "Student Union" is too generic to connect two people.
//
// Clubs, and the club and goal matchers below, belong to v2's cohort and the
// old uw_peers, which STEP 5 revokes (plan D3). Nothing stores a club any more.
// They stay until STEP 6 drops the SQL they mirror (P11). The Settings
// block has no clubs field: its interests run on cleanInterests (lib/uw-fields.ts).
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
