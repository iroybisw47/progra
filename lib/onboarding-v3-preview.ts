// The dev-only screenshot harness for onboarding v3 (app/dev/onboarding-v3):
// which screen and which fixture a URL asks for, the fake profile each
// fixture starts from, and fake services that stand in for every server
// action (lib/onboarding-v3-services.ts says why the wizard takes them as an
// object). Nothing here reaches a database or the network.
//
// Only the harness imports this. The route itself 404s in production, so
// none of it can serve there even though it is bundled.

import type { FriendRelations } from "@/lib/find-friends";
import {
  INTRO_BEATS,
  SCREEN,
  SCREEN_COUNT,
  goalColor,
  type UwChoice,
} from "@/lib/onboarding-v3";
import type { AccountGoal, AccountHabit } from "@/lib/onboarding-v3-goals-habits";
import type { WeekSeg } from "@/lib/onboarding-v3-intro";
import type { OnboardingV3Services, SearchedUser } from "@/lib/onboarding-v3-services";
import { PALETTE } from "@/lib/palette";
import {
  SEARCH_QUERY_MIN,
  SEARCH_RESULTS_MAX,
  USERNAME_TAKEN_ERROR,
  checkUsername,
  normalizeSearchQuery,
  orderSearchMatches,
} from "@/lib/social/username";
import { cleanInterests, cleanMajors, uwProfilePayload } from "@/lib/uw";
import type { SavedUw } from "@/lib/uw-fields";
import { emptyUwPeerGroups, isUwBucket, parseUwCursor } from "@/lib/uw-peers";
import {
  PREVIEW_UW_CALLER,
  PREVIEW_UW_COHORT,
  fakeUwPeerGroups,
  fakeUwPeerPage,
  type PreviewUwCaller,
  type PreviewUwStudent,
} from "@/lib/uw-peers-preview";

// welcome         Screen 1, the welcome (OWNER-FIX-3): a first run, nothing
//                 entered yet, so Continue is disabled
// welcome-filled  the welcome with a name and a typed handle that passes v2's
//                 check, so Continue is live, and saves it
// taken           the welcome with a typed handle the fake setUsername
//                 refuses as taken: Continue shows "That username is taken."
//                 under Username (the 23505 path) and stays
// replay          an onboarded user replaying, with their saved name and
//                 handle, and the replay ✕
// goals         Screen 2 with two goals added (10 and 4 hours a week) and a
//               third being typed
// goals-full    Screen 2 at the cap: three goals at 10, 4 and 6 hours a
//               week, nothing typed, so every row's hours box shows
// habits        Screen 3 with Drink water and Stretch selected
// habit-custom  Screen 3 with "Your own" open and something typed in it
// tracked       a replayer who has tracked time this week, so Screen 4's
//               Beat 2 draws their own week instead of the sample
// friends-search  Screen 5 searching "pri", with three people found
// friends-added   the same search with a request to Priya Raman already out,
//                 so she shows "✓ Added" and the CTA reads "Continue · 1 added"
// friends-known   the same search where Priya Shah is a friend and Priyanka
//                 Das has asked, so their rows read "Friends" and "Accept"
// friends-nohits  Screen 5 searching for someone who isn't on Progra
// ready         Screen 6 with nobody added: "It lands in your feed..."
// ready-added   Screen 6 with one request out: "The 1 friend you added will
//               see it once they accept." (D13)
// uw-sheet      the welcome, filled in, with the UW sheet up on its tiles
// uw-page       the UW page (OWNER-FIX-4): Yes, the quick-add holding one
//               major and two interests, as a student already in the cohort
//               has it (a replayer, or a first run reloaded after Yes), whom
//               the welcome's Continue takes straight there
// uw-sheet-no   the sheet up with the No tile selected, held there (nothing
//               was tapped, so nothing saves or advances)
// uw-groups     Screen 5 for a UW student (two majors, two interests): all
//               three groups, "More at UW" long enough to load a second page
// uw-early      Screen 5 for a UW student with nobody from UW listed yet:
//               "You're early" over the invite preview (R:141)
//
// The uw-* fixtures render the UW variant whatever NEXT_PUBLIC_UW says, as
// `uw=1` does for any fixture (parsePreviewParams). With `uw=0` the sheet
// fixtures are just the welcome, since there's no sheet to raise.
//
// The "habits" fixture on Screen 4 is a first run's intro: two goals, a first
// habit for Daniel's card, and the sample week.
export const PREVIEW_FIXTURES = [
  "welcome",
  "welcome-filled",
  "taken",
  "replay",
  "goals",
  "goals-full",
  "habits",
  "habit-custom",
  "tracked",
  "friends-search",
  "friends-added",
  "friends-known",
  "friends-nohits",
  "ready",
  "ready-added",
  "uw-sheet",
  "uw-page",
  "uw-sheet-no",
  "uw-groups",
  "uw-early",
] as const;
export type PreviewFixture = (typeof PREVIEW_FIXTURES)[number];

// The wizard's props a fixture sets (OnboardingClientV3's, minus services).
export type PreviewProfile = {
  initialDisplayName: string | null;
  initialUsername: string;
  avatarUrl: string | null;
  replay: boolean;
  existingGoals: AccountGoal[];
  existingHabits: AccountHabit[];
  weekSegments?: WeekSeg[];
  // The welcome's username, typed and not yet saved (a first run's).
  usernameDraft?: string;
  goalDraft?: string;
  habitDraft?: string;
  searchDraft?: string;
  relations?: FriendRelations;
  // The profile's UW columns, as the pages pass them with UW on.
  savedUw?: SavedUw;
  // The UW sheet starts up over the welcome (the uw-sheet ones)...
  uwSheet?: boolean;
  // ...with this tile already selected (uw-sheet-no).
  uwSelected?: UwChoice;
  // The UW page in front on Screen 1, Yes answered (uw-page).
  uwPage?: boolean;
};

const MAYA = {
  initialDisplayName: "Maya Chen",
  initialUsername: "mayachen",
  avatarUrl: null,
  replay: false,
};

const NOTHING_YET = { existingGoals: [], existingHabits: [] };

// The two goals the later fixtures have added, in the colors Screen 2 gives
// the first two (R:95). They reach the wizard the way goals saved before a
// reload do, as the account's, so the screen starts with them listed. Their
// hours aren't the 5h default, so a screenshot shows the boxes starting from
// what was saved (OWNER-FIX-2).
export const TWO_GOALS: AccountGoal[] = [
  {
    id: "preview-goal-a",
    title: "Launch my side project",
    color: goalColor(0).fill,
    quotaHours: 10,
  },
  { id: "preview-goal-b", title: "Get stronger", color: goalColor(1).fill, quotaHours: 4 },
];

// Screen 2 at the cap: the two above and the "goals" fixture's typed third,
// in the third color.
const THREE_GOALS: AccountGoal[] = [
  ...TWO_GOALS,
  { id: "preview-goal-c", title: "Learn Spanish", color: goalColor(2).fill, quotaHours: 6 },
];

const TWO_HABITS: AccountHabit[] = [
  { id: "preview-habit-a", name: "Drink water" },
  { id: "preview-habit-b", name: "Stretch" },
];

// A week as getWeekCategorySegs (lib/db/progress.ts) hands it over: two
// made-up categories and a goal row named the way buildCategoryBreakdown
// names one, largest first. Its shape differs from the sample's on purpose (three
// segments, no Gym or Reading split), so a screenshot shows which one drew.
const HOUR = 3_600_000;
const TRACKED_WEEK: WeekSeg[] = [
  { id: "preview-cat-school", name: "Schoolwork", color: PALETTE[9].fill, ms: 4.5 * HOUR },
  {
    id: "goal:preview-goal-a",
    name: `Goal: ${TWO_GOALS[0].title}`,
    color: TWO_GOALS[0].color ?? goalColor(0).fill,
    ms: 2.75 * HOUR,
  },
  { id: "preview-cat-reading", name: "Reading", color: PALETTE[3].fill, ms: 0.75 * HOUR },
];

// The people the fake search knows (fakeSearchUsers). Made up, like the
// intro's: handles that pass checkUsername and match no one real. Three start
// "pri", so the README's own example ("priya", R:134) lists more than one.
export const PREVIEW_PEOPLE: readonly SearchedUser[] = (
  [
    ["priyaraman", "Priya Raman"],
    ["priya_shah", "Priya Shah"],
    ["priyankad", "Priyanka Das"],
    ["zackmoore", "Zack Moore"],
    ["leomartins", "Leo Martins"],
    ["ninak", "Nina Kowalski"],
    ["marcuslee", "Marcus Lee"],
  ] as const
).map(([username, displayName]) => ({
  userId: `preview-user-${username}`,
  username,
  displayName,
  bio: null,
  avatarUrl: null,
}));

// A Screen 5 fixture: a first run with two goals and two habits saved, so the
// invite names goal 1, searching `searchDraft`.
const FINDING = {
  ...MAYA,
  existingGoals: TWO_GOALS,
  existingHabits: TWO_HABITS,
};

// A UW student who said Yes on Screen 1: PREVIEW_UW_CALLER's answer, listed.
const UW_STUDENT: SavedUw = {
  isUw: true,
  majors: PREVIEW_UW_CALLER.majors,
  interests: PREVIEW_UW_CALLER.interests,
  listed: true,
};

const PROFILES: Record<PreviewFixture, PreviewProfile> = {
  welcome: {
    initialDisplayName: null,
    initialUsername: "",
    avatarUrl: null,
    replay: false,
    ...NOTHING_YET,
  },
  // A first run as it usually arrives (the name from the sign-in, no handle
  // saved yet) with a handle typed: well formed, so v2's check passes and
  // Continue is live, and not one the fake setUsername refuses. Continue
  // writes it.
  "welcome-filled": { ...MAYA, initialUsername: "", usernameDraft: "mayachen", ...NOTHING_YET },
  // The same with a handle that passes v2's check but contains "taken",
  // which the fake setUsername refuses as the unique index would
  // (fakeSetUsername).
  taken: { ...MAYA, initialUsername: "", usernameDraft: "mayataken", ...NOTHING_YET },
  replay: { ...MAYA, replay: true, ...NOTHING_YET },
  goals: { ...MAYA, existingGoals: TWO_GOALS, existingHabits: [], goalDraft: "Learn Spanish" },
  "goals-full": { ...MAYA, existingGoals: THREE_GOALS, existingHabits: [] },
  habits: { ...MAYA, existingGoals: TWO_GOALS, existingHabits: TWO_HABITS },
  // Typed, not empty: "Your own" closes when it loses focus while empty
  // (R:102), and a screenshot tool may well take the focus.
  "habit-custom": {
    ...MAYA,
    existingGoals: TWO_GOALS,
    existingHabits: TWO_HABITS,
    habitDraft: "Read before bed",
  },
  tracked: {
    ...MAYA,
    replay: true,
    existingGoals: TWO_GOALS,
    existingHabits: TWO_HABITS,
    weekSegments: TRACKED_WEEK,
  },
  "friends-search": { ...FINDING, searchDraft: "pri" },
  // A request already out, as getFriendRelations reads one back: what a tap
  // leaves once the server has answered, or a reload after it.
  "friends-added": {
    ...FINDING,
    searchDraft: "pri",
    relations: {
      friendIds: [],
      outgoing: [
        { requestId: "preview-request-0", userId: "preview-user-priyaraman", username: "priyaraman" },
      ],
      incoming: [],
    },
  },
  "friends-known": {
    ...FINDING,
    searchDraft: "pri",
    relations: {
      friendIds: ["preview-user-priya_shah"],
      outgoing: [],
      incoming: [{ requestId: "preview-request-in", userId: "preview-user-priyankad" }],
    },
  },
  "friends-nohits": { ...FINDING, searchDraft: "quinn" },
  // The welcome filled in and Continue already pressed: its identity saved,
  // the sheet up over it.
  "uw-sheet": { ...MAYA, ...NOTHING_YET, uwSheet: true },
  "uw-page": {
    ...MAYA,
    ...NOTHING_YET,
    uwPage: true,
    savedUw: {
      isUw: true,
      majors: ["Economics"],
      interests: ["Startups", "Running"],
      listed: true,
    },
  },
  "uw-sheet-no": { ...MAYA, ...NOTHING_YET, uwSheet: true, uwSelected: "no" },
  // Past Screen 1 with Yes saved, as the wizard reaches Screen 5 after it:
  // the profile's answer starts the wizard on it (uwStartState), and the
  // fake fetch builds the groups from it.
  "uw-groups": { ...FINDING, savedUw: { ...UW_STUDENT } },
  "uw-early": { ...FINDING, savedUw: { ...UW_STUDENT } },
  ready: FINDING,
  // Screen 6 counts Screen 5's adds, which a request already out starts as.
  "ready-added": {
    ...FINDING,
    relations: {
      friendIds: [],
      outgoing: [
        { requestId: "preview-request-0", userId: "preview-user-priyaraman", username: "priyaraman" },
      ],
      incoming: [],
    },
  },
};

export function previewProfile(fixture: PreviewFixture): PreviewProfile {
  return PROFILES[fixture];
}

// The screen a fixture is about, for a URL that names no screen.
const FIXTURE_SCREEN: Partial<Record<PreviewFixture, number>> = {
  goals: SCREEN.goal,
  "goals-full": SCREEN.goal,
  habits: SCREEN.habits,
  "habit-custom": SCREEN.habits,
  tracked: SCREEN.intro,
  "friends-search": SCREEN.friends,
  "friends-added": SCREEN.friends,
  "friends-known": SCREEN.friends,
  "friends-nohits": SCREEN.friends,
  ready: SCREEN.ready,
  "ready-added": SCREEN.ready,
  "uw-groups": SCREEN.friends,
  "uw-early": SCREEN.friends,
};

// Likewise the beat (0-based), for a URL that names none: "tracked" is about
// Beat 2.
const FIXTURE_BEAT: Partial<Record<PreviewFixture, number>> = {
  tracked: 1,
};

// The fixtures that are about the UW variant, so they render it without a
// `uw=1`.
const UW_FIXTURES: ReadonlySet<PreviewFixture> = new Set([
  "uw-sheet",
  "uw-page",
  "uw-sheet-no",
  "uw-groups",
  "uw-early",
]);

type Params = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

// `?screen=1..6&fixture=<one of PREVIEW_FIXTURES>&beat=1..3&q=<search>`. The
// screen and the beat are 1-based, as the README numbers them, and come back
// as the wizard's 0-based indexes. A missing or unknown screen falls back to
// the fixture's own screen (Screen 2 for the goals ones, Screen 3 for the habit
// ones, Screen 4 for "tracked", Screen 5 for the friends ones, Screen 6 for
// the ready ones) or Screen 1, a
// missing beat to the fixture's own or beat 1, and an unknown fixture to
// "welcome", rather than erroring, since this is a tool for taking pictures. The
// beat only matters on Screen 4. `q` types into Screen 5's search in place of
// the fixture's own (any search: "zz" for no one, "nina" for one row), and is
// undefined when absent.
//
// `uw=1` renders the UW variant (the welcome's Continue raises the UW sheet,
// and Screen 5 shows a student who said Yes their groups), whatever
// NEXT_PUBLIC_UW says, and `uw=0` the variant without it. With neither, a uw-* fixture renders it, and anything else leaves `uw`
// undefined for the page to take the flag.
export function parsePreviewParams(params: Params): {
  screen: number;
  fixture: PreviewFixture;
  beat: number;
  query?: string;
  uw?: boolean;
} {
  const raw = first(params.fixture);
  const fixture = (PREVIEW_FIXTURES as readonly string[]).includes(raw ?? "")
    ? (raw as PreviewFixture)
    : "welcome";
  const n = Number.parseInt(first(params.screen) ?? "", 10);
  const screen = Number.isFinite(n)
    ? Math.min(Math.max(n, 1), SCREEN_COUNT) - 1
    : (FIXTURE_SCREEN[fixture] ?? 0);
  const b = Number.parseInt(first(params.beat) ?? "", 10);
  const beat = Number.isFinite(b)
    ? Math.min(Math.max(b, 1), INTRO_BEATS) - 1
    : (FIXTURE_BEAT[fixture] ?? 0);
  const u = first(params.uw);
  const uw = u === "1" ? true : u === "0" ? false : UW_FIXTURES.has(fixture) ? true : undefined;
  return { screen, fixture, beat, query: first(params.q), uw };
}

// setUsername's answer, faked: checkUsername's refusal word for word, as the
// action returns it, then the unique index's, for any handle containing
// "taken" (the 23505 path, USERNAME_TAKEN_ERROR), and the normalized handle
// for everything else. Stores nothing.
export function fakeSetUsername(input: string): { ok: true; username: string } | { error: string } {
  const check = checkUsername(input);
  if (!check.ok) return { error: check.error };
  if (check.username.includes("taken")) return { error: USERNAME_TAKEN_ERROR };
  return { ok: true, username: check.username };
}

// The fake search: searchUsers' contract over PREVIEW_PEOPLE. The query is
// normalized as the action normalizes it ("@" ignored), too short or not a
// string finds no one, and a match is a handle or display name that starts
// with it, the live search_users' prefix rule (D10 accepts it). Rows come back
// in the action's match order and capped at five, as the action returns them.
export function fakeSearchUsers(query: unknown): { results: SearchedUser[] } {
  if (typeof query !== "string") return { results: [] };
  const q = normalizeSearchQuery(query);
  if (q.length < SEARCH_QUERY_MIN) return { results: [] };
  const found = PREVIEW_PEOPLE.filter(
    (p) => p.username.startsWith(q) || (p.displayName ?? "").toLowerCase().startsWith(q)
  );
  return { results: orderSearchMatches(found, q).slice(0, SEARCH_RESULTS_MAX) };
}

// setUwProfile's answer, faked: success for anything the real payload builder
// accepts, and the action's own error, word for word, for anything it would
// refuse (app/actions/uw.ts). Stores nothing.
export function fakeSetUwProfile(input: unknown): { ok: true } | { error: string } {
  return uwProfilePayload(input) ? { ok: true } : { error: "Couldn't save your UW details." };
}

// The UW cohort a fixture's fake list_uw_peers lists: nobody for uw-early
// (R:141's "You're early"), the made-up cohort for everything else.
export function previewUwCohort(fixture: PreviewFixture): readonly PreviewUwStudent[] {
  return fixture === "uw-early" ? [] : PREVIEW_UW_COHORT;
}

// What the fake's "profile" holds for the UW answer: a fixture's savedUw to
// start with, then whatever the fake setUwProfile last stored, so a Yes on
// Screen 1 shapes Screen 5's groups as the real save does. Null is not in
// the cohort, whom the RPC answers with no rows.
function uwCallerFrom(saved: SavedUw | undefined): PreviewUwCaller | null {
  if (saved?.isUw !== true) return null;
  return { majors: cleanMajors(saved.majors), interests: cleanInterests(saved.interests) };
}

// fetchMoreUwPeers' refusal, word for word, for a bucket or cursor it would
// refuse (app/actions/uw.ts).
const MORE_REFUSED = "Couldn't load more UW students.";

// About a fast network's round-trip, so the spinner and the check pop are
// visible in a screenshot without slowing the harness down.
export const PREVIEW_LATENCY_MS = 150;

function after<T>(ms: number, value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

// Services that answer like the real ones, after `latencyMs`, and write
// nothing anywhere. Every write succeeds, apart from setUsername on a handle
// containing "taken", which it refuses as taken (fakeSetUsername), so the
// welcome's 23505 path can be seen. A goal or habit "created" gets a fresh
// fake id, so Back and Continue again exercise the same update and archive
// paths as production, and so does a friend request, so "✓ Added" undoes
// one. Accept always lands. Search answers from PREVIEW_PEOPLE
// (fakeSearchUsers), and a share always "went through", with no sheet. The
// photo's upload and Remove never read or touch anything; the welcome shows
// the cropped square from a local URL. The analytics calls do nothing.
//
// The UW save answers as setUwProfile would (fakeSetUwProfile), and is the
// one write that's remembered: it's what the UW groups are built from. Those
// come from a fake list_uw_peers over `uw.cohort` (lib/uw-peers-preview.ts),
// for the answer the fixture starts with (`uw.saved`) or the last one saved,
// leaving out anyone a request has gone to and not been taken back, as the
// RPC leaves out any friendship row.
export function createPreviewServices(
  latencyMs = PREVIEW_LATENCY_MS,
  uw: { saved?: SavedUw; cohort?: readonly PreviewUwStudent[] } = {}
): OnboardingV3Services {
  let created = 0;
  const ok = () => after(latencyMs, { ok: true as const });
  const id = (kind: string) =>
    after(latencyMs, { ok: true as const, id: `preview-${kind}-${++created}` });
  const cohort = uw.cohort ?? PREVIEW_UW_COHORT;
  let caller = uwCallerFrom(uw.saved);
  // Requests out, by request id, so an undo puts the person back.
  const requested = new Map<string, string>();
  const asked = () => new Set(requested.values());
  return {
    setUsername: (input) => after(latencyMs, fakeSetUsername(input)),
    setProfileIdentity: ok,
    setUwProfile: (input) => {
      const answer = fakeSetUwProfile(input);
      const payload = uwProfilePayload(input);
      if ("ok" in answer && payload) {
        caller = payload.is_uw
          ? { majors: payload.uw_majors ?? [], interests: payload.uw_interests ?? [] }
          : null;
      }
      return after(latencyMs, answer);
    },
    uploadAvatar: ok,
    removeAvatar: ok,
    createGoal: () => id("goal"),
    updateGoal: ok,
    archiveGoal: ok,
    createHabit: () => id("habit"),
    archiveHabit: ok,
    searchUsers: (query) => after(latencyMs, fakeSearchUsers(query)),
    sendFriendRequest: (userId) => {
      const requestId = `preview-request-${++created}`;
      requested.set(requestId, userId);
      return after(latencyMs, { ok: true as const, requestId });
    },
    cancelFriendRequest: (requestId) => {
      requested.delete(requestId);
      return ok();
    },
    acceptFriendRequest: ok,
    fetchUwPeerGroups: () =>
      after(latencyMs, {
        groups: caller ? fakeUwPeerGroups(cohort, caller, asked()) : emptyUwPeerGroups(),
      }),
    fetchMoreUwPeers: (bucket, cursor) => {
      const from = parseUwCursor(cursor);
      if (!isUwBucket(bucket) || !from) return after(latencyMs, { error: MORE_REFUSED });
      return after(latencyMs, {
        page: caller
          ? fakeUwPeerPage(cohort, caller, bucket, from, asked())
          : { peers: [], total: null, cursor: null },
      });
    },
    shareInvite: () => after(latencyMs, "shared" as const),
    // As if iOS's dialog came up and was answered Allow.
    askNotifications: () => after(latencyMs, "granted" as const),
    recordStep: () => {},
    track: () => {},
  };
}
