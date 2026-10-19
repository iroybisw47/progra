import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { addedCount, addsFromOutgoing, isAdded, nextAddCall, rowRelation } from "@/lib/find-friends";
import {
  MAX_GOALS,
  SCREEN,
  SCREEN_COUNT,
  friendsCta,
  goalExamplesFor,
  initialWizardState,
  readyNote,
} from "@/lib/onboarding-v3";
import { prefillWizard } from "@/lib/onboarding-v3-goals-habits";
import {
  PREVIEW_FIXTURES,
  PREVIEW_LATENCY_MS,
  PREVIEW_PEOPLE,
  createPreviewServices,
  fakeSearchUsers,
  fakeSetUsername,
  fakeSetUwProfile,
  parsePreviewParams,
  previewProfile,
  previewUwCohort,
} from "@/lib/onboarding-v3-preview";
import { identityWrites, welcomeHandle } from "@/lib/onboarding-v3-identity";
import { uwPageCta, uwStartState } from "@/lib/onboarding-v3-uw";
import { USERNAME_TAKEN_ERROR, checkUsername } from "@/lib/social/username";
import { findFriendsView, uwFetchKey, uwSections } from "@/lib/uw-groups";
import { PREVIEW_UW_COHORT } from "@/lib/uw-peers-preview";

describe("parsePreviewParams", () => {
  it("reads a 1-based screen into the wizard's 0-based index", () => {
    expect(parsePreviewParams({ screen: "1", fixture: "welcome-filled" })).toEqual({
      screen: 0,
      fixture: "welcome-filled",
      demo: "intro",
    });
    expect(parsePreviewParams({ screen: "6" }).screen).toBe(SCREEN_COUNT - 2);
    expect(parsePreviewParams({ screen: "7" }).screen).toBe(SCREEN_COUNT - 1);
  });

  it("clamps out-of-range screens and falls back on junk", () => {
    expect(parsePreviewParams({ screen: "0" }).screen).toBe(0);
    expect(parsePreviewParams({ screen: "99" }).screen).toBe(SCREEN_COUNT - 1);
    expect(parsePreviewParams({ screen: "abc", fixture: "nope" })).toEqual({
      screen: 0,
      fixture: "welcome",
      demo: "intro",
    });
    expect(parsePreviewParams({})).toEqual({ screen: 0, fixture: "welcome", demo: "intro" });
    // The old Screen 1 fixtures are gone, so they fall back too.
    for (const old of ["empty", "filled", "uw-choose", "uw-open", "uw-no"]) {
      expect(parsePreviewParams({ fixture: old }).fixture).toBe("welcome");
    }
  });

  it("opens a screen's own fixture on that screen unless the URL names one", () => {
    expect(parsePreviewParams({ fixture: "goals" })).toEqual({
      screen: SCREEN.goal,
      fixture: "goals",
      demo: "intro",
    });
    expect(parsePreviewParams({ fixture: "habits" }).screen).toBe(SCREEN.habits);
    expect(parsePreviewParams({ fixture: "habit-custom", screen: "junk" }).screen).toBe(
      SCREEN.habits
    );
    expect(parsePreviewParams({ fixture: "goals", screen: "1" }).screen).toBe(0);
    expect(parsePreviewParams({ fixture: "replay" }).screen).toBe(0);
  });

  it("takes the first of a repeated param", () => {
    expect(
      parsePreviewParams({ screen: ["3", "5"], fixture: ["taken", "replay"], demo: ["post", "ready"] })
    ).toEqual({
      screen: 2,
      fixture: "taken",
      demo: "post",
    });
  });

  it("reads Screen 4's practice phase, and falls back to its intro", () => {
    expect(parsePreviewParams({ screen: "4", demo: "posted" }).demo).toBe("posted");
    expect(parsePreviewParams({ screen: "4", demo: "ended" }).demo).toBe("ended");
    expect(parsePreviewParams({ screen: "4", demo: "nope" }).demo).toBe("intro");
    // The run only starts from Clock in, so "running" opens on ready.
    expect(parsePreviewParams({ screen: "4", demo: "running" }).demo).toBe("ready");
    expect(parsePreviewParams({ fixture: "practice" })).toEqual({
      screen: SCREEN.intro,
      fixture: "practice",
      demo: "intro",
    });
  });

});

describe("parsePreviewParams: UW", () => {
  it("forces the UW variant with uw=1, and off with uw=0", () => {
    expect(parsePreviewParams({ uw: "1" }).uw).toBe(true);
    expect(parsePreviewParams({ fixture: "welcome-filled", uw: "1" }).uw).toBe(true);
    expect(parsePreviewParams({ fixture: "uw-page", uw: "0" }).uw).toBe(false);
  });

  it("turns it on for the uw-* fixtures, and leaves the flag to decide otherwise", () => {
    for (const fixture of ["uw-sheet", "uw-sheet-no", "uw-page"] as const) {
      expect(parsePreviewParams({ fixture })).toMatchObject({ fixture, screen: SCREEN.identity, uw: true });
    }
    expect(parsePreviewParams({ fixture: "welcome-filled" }).uw).toBeUndefined();
    expect(parsePreviewParams({ uw: "yes" }).uw).toBeUndefined();
  });
});

describe("previewProfile: the welcome (OWNER-FIX-3)", () => {
  it("welcome is a first run with nothing entered, so Continue is disabled", () => {
    const p = previewProfile("welcome");
    expect(p).toMatchObject({ initialDisplayName: null, initialUsername: "", replay: false });
    expect(welcomeHandle(p.initialUsername).valid).toBe(false);
  });

  it("welcome-filled has a name and a typed handle v2's check passes, which Continue saves", () => {
    const p = previewProfile("welcome-filled");
    expect(p.initialDisplayName?.trim()).toBeTruthy();
    expect(p.initialUsername).toBe("");
    const typed = p.usernameDraft ?? "";
    expect(welcomeHandle(typed).valid).toBe(true);
    expect(identityWrites({ username: p.initialUsername, displayName: p.initialDisplayName }, {
      username: typed,
      name: p.initialDisplayName ?? "",
    })).toEqual({ username: typed, displayName: undefined });
    expect(fakeSetUsername(typed)).toEqual({ ok: true, username: typed });
  });

  it("taken has a typed handle v2's check passes and the fake setUsername refuses as taken", () => {
    const p = previewProfile("taken");
    const typed = p.usernameDraft ?? "";
    expect(p.initialUsername).toBe("");
    expect(welcomeHandle(typed).valid).toBe(true);
    expect(fakeSetUsername(typed)).toEqual({ error: USERNAME_TAKEN_ERROR });
    // Refused, it holds under the field until the handle changes.
    expect(welcomeHandle(typed, typed).error).toBe(USERNAME_TAKEN_ERROR);
    expect(previewProfile("replay").initialUsername).not.toContain("taken");
  });

  it("types a handle only into the two welcome fixtures that need one", () => {
    for (const f of PREVIEW_FIXTURES) {
      const typed = previewProfile(f).usernameDraft;
      expect(typed === undefined, f).toBe(f !== "welcome-filled" && f !== "taken");
    }
  });
});

describe("previewProfile: the UW sheet", () => {
  it("uw-sheet has the welcome filled in and the sheet up on its tiles", () => {
    const p = previewProfile("uw-sheet");
    expect(p.uwSheet).toBe(true);
    expect(welcomeHandle(p.initialUsername).valid).toBe(true);
    expect(p.savedUw).toBeUndefined();
    expect(p.uwSelected).toBeUndefined();
    expect(uwStartState(p.savedUw, true).uwPhase).toBe("choose");
  });

  it("uw-page opens on the UW page with one major and two interests, listed", () => {
    const p = previewProfile("uw-page");
    expect(p.uwPage).toBe(true);
    expect(p.uwSheet).toBeUndefined();
    const start = uwStartState(p.savedUw, true);
    expect(start).toMatchObject({ uw: "yes", uwPhase: "open", uwListed: true });
    expect(start.majors).toHaveLength(1);
    expect(start.interests).toHaveLength(2);
    expect(uwPageCta({ uwPhase: start.uwPhase, hasUwInput: true })?.label).toBe("Continue");
  });

  it("uw-sheet-no has it up with the No tile selected", () => {
    const p = previewProfile("uw-sheet-no");
    expect(p).toMatchObject({ uwSheet: true, uwSelected: "no" });
    expect(p.savedUw).toBeUndefined();
  });

  it("gives every other fixture no sheet and no UW data", () => {
    for (const f of PREVIEW_FIXTURES) {
      if (f.startsWith("uw-")) continue;
      expect(previewProfile(f).savedUw).toBeUndefined();
      expect(previewProfile(f).uwSelected).toBeUndefined();
      expect(previewProfile(f).uwSheet).toBeUndefined();
      expect(previewProfile(f).uwPage).toBeUndefined();
    }
    expect(previewProfile("uw-groups").uwSheet).toBeUndefined();
    expect(previewProfile("uw-early").uwSheet).toBeUndefined();
  });
});

describe("fakeSetUwProfile", () => {
  it("answers as setUwProfile would: ok for a real input, its error otherwise", () => {
    expect(fakeSetUwProfile({ isUw: false })).toEqual({ ok: true });
    expect(fakeSetUwProfile({ isUw: true, majors: ["Economics"], listed: true })).toEqual({ ok: true });
    expect(fakeSetUwProfile({ majors: ["Economics"] })).toEqual({
      error: "Couldn't save your UW details.",
    });
    expect(fakeSetUwProfile(null)).toEqual({ error: "Couldn't save your UW details." });
  });
});

describe("parsePreviewParams: Screen 5", () => {
  it("opens the ready fixtures on Screen 6", () => {
    for (const fixture of ["ready", "ready-added"] as const) {
      expect(parsePreviewParams({ fixture }).screen).toBe(SCREEN.ready);
    }
  });

  it("opens the friends fixtures on Screen 5", () => {
    for (const fixture of ["friends-search", "friends-added", "friends-known", "friends-nohits"] as const) {
      expect(parsePreviewParams({ fixture }).screen).toBe(SCREEN.friends);
    }
  });

  it("reads a search query, and leaves it out when there's none", () => {
    expect(parsePreviewParams({ screen: "5", q: "zz" }).query).toBe("zz");
    expect(parsePreviewParams({ screen: "5", q: ["nina", "leo"] }).query).toBe("nina");
    expect(parsePreviewParams({ screen: "5" }).query).toBeUndefined();
  });
});

describe("previewProfile: Screen 5", () => {
  it("searches 'pri' and finds people, with no one added yet", () => {
    const p = previewProfile("friends-search");
    expect(fakeSearchUsers(p.searchDraft).results.length).toBeGreaterThan(1);
    expect(p.relations).toBeUndefined();
    expect(friendsCta(0).label).toBe("Skip for now");
  });

  it("adds one person who's in the results, so the CTA reads 'Continue · 1 added'", () => {
    const p = previewProfile("friends-added");
    const adds = addsFromOutgoing(p.relations?.outgoing ?? []);
    expect(addedCount(adds)).toBe(1);
    expect(friendsCta(addedCount(adds)).label).toBe("Continue · 1 added");
    const found = fakeSearchUsers(p.searchDraft).results;
    const added = found.filter((u) => isAdded(adds, u.username));
    expect(added).toHaveLength(1);
    // Already answered by the server, so undo has a row to delete.
    expect(adds[added[0].username].userId).toBe(added[0].userId);
    expect(nextAddCall(adds, added[0].username)).toBeNull();
    expect(adds[added[0].username].requestId).toBeTruthy();
  });

  it("finds a friend and someone who's asked, among people with neither", () => {
    const p = previewProfile("friends-known");
    const relations = p.relations!;
    const found = fakeSearchUsers(p.searchDraft).results;
    const kinds = found.map((u) => rowRelation(relations, u.userId).kind);
    expect(kinds).toContain("friends");
    expect(kinds).toContain("accept");
    expect(kinds).toContain("add");
  });

  it("searches for someone who isn't there", () => {
    const p = previewProfile("friends-nohits");
    expect(p.searchDraft?.length).toBeGreaterThanOrEqual(2);
    expect(fakeSearchUsers(p.searchDraft).results).toEqual([]);
  });

  it("gives the friends fixtures a goal, so the invite names one", () => {
    for (const f of ["friends-search", "friends-added", "friends-known", "friends-nohits"] as const) {
      expect(previewProfile(f).existingGoals.length).toBeGreaterThan(0);
    }
  });
});

describe("fakeSearchUsers", () => {
  it("knows only made-up people with valid handles", () => {
    for (const p of PREVIEW_PEOPLE) {
      expect(checkUsername(p.username)).toEqual({ ok: true, username: p.username });
      expect(p.displayName).toBeTruthy();
    }
    expect(new Set(PREVIEW_PEOPLE.map((p) => p.userId)).size).toBe(PREVIEW_PEOPLE.length);
  });

  it("normalizes as the action does: '@' ignored, case folded, two characters minimum", () => {
    const names = (q: unknown) => fakeSearchUsers(q).results.map((r) => r.username);
    expect(names("@PRI")).toEqual(names("pri"));
    expect(names("p")).toEqual([]);
    expect(names("@p")).toEqual([]);
    expect(names(42)).toEqual([]);
  });

  it("matches a handle or a display name by prefix (the live rule, D10)", () => {
    const names = (q: string) => fakeSearchUsers(q).results.map((r) => r.username);
    expect(names("pri")).toEqual(["priyaraman", "priya_shah", "priyankad"]);
    expect(names("zack")).toEqual(["zackmoore"]);
    expect(names("nina")).toEqual(["ninak"]); // by display name
    expect(names("raman")).toEqual([]); // not a prefix of either
  });

  it("puts the handle typed in full first, and returns at most five", () => {
    expect(fakeSearchUsers("ninak").results[0].username).toBe("ninak");
    for (const q of ["pr", "ma", "le", "zz"]) {
      expect(fakeSearchUsers(q).results.length).toBeLessThanOrEqual(5);
    }
  });
});

describe("previewProfile", () => {
  it("covers every fixture, and only the replayers replay", () => {
    for (const f of PREVIEW_FIXTURES) {
      expect(previewProfile(f).replay).toBe(f === "replay");
    }
  });

  it("opens the practice run with two goals to pick from and two habits", () => {
    const practice = previewProfile("practice");
    const prefill = prefillWizard(practice.existingGoals, practice.existingHabits);
    expect(prefill.goals).toHaveLength(2);
    expect(prefill.habits).toHaveLength(2);
  });


  it("starts the goal and habit fixtures where their screenshots need them", () => {
    const goals = previewProfile("goals");
    const prefill = prefillWizard(goals.existingGoals, goals.existingHabits);
    expect(prefill.goals).toHaveLength(2);
    // Not the 5h default, so the boxes show they start from what was saved.
    expect(prefill.goalHours).toEqual([10, 4]);
    // Each on its own row, as goals saved before a reload are.
    expect(prefill.goalRowIds).toEqual(["preview-goal-a", "preview-goal-b"]);
    expect(goals.goalDraft?.trim()).toBeTruthy();

    const habits = previewProfile("habits");
    const state = {
      ...initialWizardState(),
      ...prefillWizard(habits.existingGoals, habits.existingHabits),
    };
    expect(state.habits).toEqual(["Drink water", "Stretch"]);
    expect(state.customHabits).toEqual([]);
    expect(habits.habitDraft).toBeUndefined();

    // Open, and typed in so a lost focus can't close it.
    expect(previewProfile("habit-custom").habitDraft?.trim()).toBeTruthy();
  });

  it("opens goals-full on Screen 2 at the cap, every row's hours box in view", () => {
    expect(parsePreviewParams({ fixture: "goals-full" })).toEqual({
      screen: SCREEN.goal,
      fixture: "goals-full",
      demo: "intro",
    });
    const full = previewProfile("goals-full");
    const prefill = prefillWizard(full.existingGoals, full.existingHabits);
    expect(prefill.goals).toHaveLength(MAX_GOALS);
    expect(prefill.goalHours).toEqual([10, 4, 6]);
    expect(prefill.goalRowIds).toEqual(["preview-goal-a", "preview-goal-b", "preview-goal-c"]);
    // At the cap there are no examples, and nothing is typed.
    expect(goalExamplesFor(prefill.goals)).toEqual([]);
    expect(full.goalDraft).toBeUndefined();
    expect(full.replay).toBe(false);
  });

  it("gives every fixture but the goal and habit ones nothing saved yet", () => {
    for (const f of ["welcome", "welcome-filled", "taken", "replay"] as const) {
      expect(previewProfile(f).existingGoals).toEqual([]);
      expect(previewProfile(f).existingHabits).toEqual([]);
    }
  });

  it("gives Screen 6 nobody added, or one request out (D13's two notes)", () => {
    const count = (f: "ready" | "ready-added") =>
      addedCount(addsFromOutgoing((previewProfile(f).relations ?? { outgoing: [] }).outgoing));
    expect(count("ready")).toBe(0);
    expect(count("ready-added")).toBe(1);
    expect(readyNote(count("ready"), count("ready"))).toBe(
      "It lands in your feed the moment you clock in."
    );
    expect(readyNote(count("ready-added"), count("ready-added"))).toBe(
      "The 1 friend you added will see it once they accept."
    );
  });
});

describe("fakeSetUsername", () => {
  it("refuses any handle containing 'taken' as the unique index would, word for word", () => {
    expect(fakeSetUsername("mayataken")).toEqual({ error: "That username is taken." });
    expect(fakeSetUsername("takenby")).toEqual({ error: USERNAME_TAKEN_ERROR });
  });

  it("refuses a malformed handle with checkUsername's words, as the action does", () => {
    for (const bad of ["ma", "_maya", "admin", "maya.chen"]) {
      const check = checkUsername(bad);
      expect(check.ok).toBe(false);
      expect(fakeSetUsername(bad)).toEqual({ error: check.ok ? "" : check.error });
    }
  });

  it("stores the rest normalized", () => {
    expect(fakeSetUsername(" Maya ")).toEqual({ ok: true, username: "maya" });
  });
});

describe("createPreviewServices", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("answers after the latency, not before", async () => {
    const services = createPreviewServices();
    let done = false;
    const pending = services.setUsername("maya").then((r) => {
      done = true;
      return r;
    });
    await vi.advanceTimersByTimeAsync(PREVIEW_LATENCY_MS - 1);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toEqual({ ok: true, username: "maya" });
  });

  it("succeeds at every write without doing anything", async () => {
    const services = createPreviewServices(0);
    const all = Promise.all([
      services.setUsername(" Maya "),
      services.setProfileIdentity({ displayName: "Maya" }),
      services.uploadAvatar(new FormData()),
      services.removeAvatar(),
      services.updateGoal("g", { title: "A" }),
      services.archiveGoal("g"),
      services.archiveHabit("h"),
      services.setUwProfile({ isUw: true, majors: ["Economics"], interests: [], listed: true }),
      services.setUwProfile({ isUw: false }),
    ]);
    await vi.runAllTimersAsync();
    expect(await all).toEqual([
      { ok: true, username: "maya" },
      { ok: true },
      { ok: true },
      { ok: true },
      { ok: true },
      { ok: true },
      { ok: true },
      { ok: true },
      { ok: true },
    ]);
    expect(() => services.recordStep("welcome")).not.toThrow();
    expect(() => services.track("onboarding_completed")).not.toThrow();
  });

  it("searches, sends, undoes, accepts and shares without touching anything", async () => {
    const services = createPreviewServices(0);
    const all = Promise.all([
      services.searchUsers("@zack"),
      services.sendFriendRequest("preview-user-zackmoore"),
      services.sendFriendRequest("preview-user-ninak"),
      services.cancelFriendRequest("preview-request-1"),
      services.acceptFriendRequest("preview-request-in"),
      services.shareInvite("hello"),
    ]);
    await vi.runAllTimersAsync();
    const [found, a, b, removed, accepted, shared] = await all;
    expect("results" in found && found.results.map((r) => r.username)).toEqual(["zackmoore"]);
    const ids = [a, b].map((r) => ("requestId" in r ? r.requestId : null));
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(2);
    expect(removed).toEqual({ ok: true });
    expect(accepted).toEqual({ ok: true });
    expect(shared).toBe("shared");
  });

  it("hands every created goal and habit its own id", async () => {
    const services = createPreviewServices(0);
    const all = Promise.all([
      services.createGoal({ title: "A", weeklyQuotaHours: 5 }),
      services.createGoal({ title: "B", weeklyQuotaHours: 5 }),
      services.createHabit("Floss"),
    ]);
    await vi.runAllTimersAsync();
    const ids = (await all).map((r) => ("id" in r ? r.id : null));
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(3);
  });
});

describe("Screen 5's UW fixtures (P9d)", () => {
  it("open on Screen 5 with UW on, as a student who said Yes", () => {
    for (const fixture of ["uw-groups", "uw-early"] as const) {
      expect(parsePreviewParams({ fixture })).toMatchObject({
        fixture,
        screen: SCREEN.friends,
        uw: true,
      });
      const start = uwStartState(previewProfile(fixture).savedUw, true);
      expect(start).toMatchObject({ uw: "yes", majors: ["Economics", "Computer Science"] });
      expect(uwFetchKey({ majors: start.majors, interests: start.interests })).not.toBeNull();
    }
  });

  it("list the made-up cohort, or nobody for uw-early", () => {
    expect(previewUwCohort("uw-groups")).toBe(PREVIEW_UW_COHORT);
    expect(previewUwCohort("uw-early")).toEqual([]);
  });
});

describe("createPreviewServices: the UW groups", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  async function settle<T>(p: Promise<T>): Promise<T> {
    await vi.runAllTimersAsync();
    return p;
  }

  it("builds uw-groups' three groups from the fixture's answer", async () => {
    const p = previewProfile("uw-groups");
    const services = createPreviewServices(0, { saved: p.savedUw, cohort: previewUwCohort("uw-groups") });
    const r = await settle(services.fetchUwPeerGroups());
    if (!("groups" in r)) throw new Error("expected groups");
    expect(findFriendsView({ status: "ready", groups: r.groups }).list).toBe("groups");
    const titles = uwSections({ groups: r.groups, majors: p.savedUw!.majors }).map((s) => s.title);
    expect(titles).toEqual(["In Economics & Computer Science", "Shares your interests", "More at UW"]);
  });

  it("finds nobody for uw-early: 'You're early'", async () => {
    const p = previewProfile("uw-early");
    const services = createPreviewServices(0, { saved: p.savedUw, cohort: previewUwCohort("uw-early") });
    const r = await settle(services.fetchUwPeerGroups());
    if (!("groups" in r)) throw new Error("expected groups");
    expect(findFriendsView({ status: "ready", groups: r.groups })).toMatchObject({
      list: "preview",
      note: "You’re early. No one from UW is on Progra yet. Send your link and they’ll show up here.",
    });
  });

  it("builds the groups from what Screen 1 last saved, and none after a No", async () => {
    const services = createPreviewServices(0);
    const none = await settle(services.fetchUwPeerGroups());
    expect("groups" in none && none.groups.rest).toEqual([]);
    await settle(services.setUwProfile({ isUw: true, majors: ["Biology"], interests: [], listed: true }));
    const bio = await settle(services.fetchUwPeerGroups());
    if (!("groups" in bio)) throw new Error("expected groups");
    expect(bio.groups.sameMajor.map((p) => p.username)).toEqual(["meitanaka", "noahbennett"]);
    await settle(services.setUwProfile({ isUw: false }));
    const left = await settle(services.fetchUwPeerGroups());
    expect("groups" in left && left.groups.sameMajor).toEqual([]);
  });

  it("leaves out someone a request went to, and puts them back on an undo", async () => {
    const p = previewProfile("uw-groups");
    const services = createPreviewServices(0, { saved: p.savedUw });
    const aisha = PREVIEW_UW_COHORT[0];
    const sent = await settle(services.sendFriendRequest(aisha.id));
    const after = await settle(services.fetchUwPeerGroups());
    expect("groups" in after && after.groups.sameMajor.some((x) => x.userId === aisha.id)).toBe(false);
    await settle(services.cancelFriendRequest("requestId" in sent ? sent.requestId : ""));
    const back = await settle(services.fetchUwPeerGroups());
    expect("groups" in back && back.groups.sameMajor.some((x) => x.userId === aisha.id)).toBe(true);
  });

  it("pages More at UW, and refuses what fetchMoreUwPeers refuses", async () => {
    const p = previewProfile("uw-groups");
    const services = createPreviewServices(0, { saved: p.savedUw });
    const first = await settle(services.fetchUwPeerGroups());
    if (!("groups" in first)) throw new Error("expected groups");
    const next = await settle(services.fetchMoreUwPeers("rest", first.groups.cursors.rest!));
    expect("page" in next && next.page.peers.length).toBeGreaterThan(0);
    const refused = { error: "Couldn't load more UW students." };
    expect(await settle(services.fetchMoreUwPeers("all" as never, first.groups.cursors.rest!))).toEqual(refused);
    expect(
      await settle(services.fetchMoreUwPeers("rest", { ts: "2026-10-01", id: "nope" }))
    ).toEqual(refused);
  });
});
