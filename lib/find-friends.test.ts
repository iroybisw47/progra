import { describe, expect, it } from "vitest";

import {
  ADD_FAILED,
  INVITE_COPY,
  SEARCH_BLUR_DEBOUNCE_MS,
  SEARCH_COPY,
  SEARCH_INPUT_MAX,
  NO_RELATIONS,
  acceptedToast,
  addedCount,
  addsFromOutgoing,
  inviteTileSub,
  inviteToast,
  isAdded,
  isSearchMode,
  nextAddCall,
  rowRelation,
  searchAnnouncement,
  searchView,
  settleAddCall,
  shouldBreathe,
  startAddCall,
  toggleAdd,
  type AddCall,
  type AddCallResult,
  type FriendAdds,
  type SearchAnswer,
} from "@/lib/find-friends";
import { SEARCH_QUERY_MIN, SEARCH_RESULTS_MAX } from "@/lib/social/username";

describe("search copy (R:134)", () => {
  it("is the README's, exactly", () => {
    expect(SEARCH_COPY.placeholder).toBe("Search by username");
    expect(SEARCH_COPY.cancel).toBe("Cancel");
    expect(SEARCH_COPY.results).toBe("Results");
    expect(SEARCH_COPY.hint).toBe("Type a username, like “priya” or “zack”.");
    expect(SEARCH_COPY.noHits).toBe("No one with that username yet. Send them your link instead.");
  });

  it("keeps the prototype's field cap and blur grace", () => {
    expect(SEARCH_INPUT_MAX).toBe(30);
    expect(SEARCH_BLUR_DEBOUNCE_MS).toBe(120);
  });
});

describe("isSearchMode (R:134: focused or non-empty)", () => {
  it("is on while focused, even empty", () => {
    expect(isSearchMode(true, "")).toBe(true);
  });

  it("is on while there's a query, focused or not", () => {
    expect(isSearchMode(false, "p")).toBe(true);
    expect(isSearchMode(false, "@")).toBe(true);
  });

  it("is off blurred and empty, and whitespace isn't a query", () => {
    expect(isSearchMode(false, "")).toBe(false);
    expect(isSearchMode(false, "   ")).toBe(false);
  });
});

type Row = { username: string };
const rows = (...names: string[]): Row[] => names.map((username) => ({ username }));

describe("searchView", () => {
  it("hints under two characters, after stripping '@' (D10)", () => {
    expect(searchView("", null)).toEqual({ kind: "hint" });
    expect(searchView("p", null)).toEqual({ kind: "hint" });
    expect(searchView("@p", null)).toEqual({ kind: "hint" });
    expect(searchView("  @p  ", null)).toEqual({ kind: "hint" });
    expect(SEARCH_QUERY_MIN).toBe(2);
  });

  it("matches an answer by the normalized query, so '@Pr' is 'pr'", () => {
    const last: SearchAnswer<Row> = { q: "pr", rows: rows("priya") };
    expect(searchView("@Pr", last)).toEqual({ kind: "results", rows: rows("priya"), stale: false });
    expect(searchView(" pr ", last)).toEqual({ kind: "results", rows: rows("priya"), stale: false });
  });

  it("lists at most five rows, whatever the search returned", () => {
    const last = { q: "pr", rows: rows("a", "b", "c", "d", "e", "f", "g") };
    const view = searchView("pr", last);
    expect(view.kind === "results" && view.rows).toEqual(rows("a", "b", "c", "d", "e"));
    expect(SEARCH_RESULTS_MAX).toBe(5);
  });

  it("says no one for an empty answer, and passes an error through", () => {
    expect(searchView("quinn", { q: "quinn", rows: [] })).toEqual({ kind: "none" });
    expect(searchView("quinn", { q: "quinn", error: "Couldn't search right now." })).toEqual({
      kind: "error",
      message: "Couldn't search right now.",
    });
  });

  it("is searching before the first answer", () => {
    expect(searchView("pr", null)).toEqual({ kind: "searching" });
  });

  it("keeps a related query's rows up while the new one is out", () => {
    const pri = { q: "pri", rows: rows("priya", "priyanka") };
    // Typed on from it…
    expect(searchView("priy", pri)).toEqual({ kind: "results", rows: pri.rows, stale: true });
    // …or backspaced to a shorter one.
    expect(searchView("pr", pri)).toEqual({ kind: "results", rows: pri.rows, stale: true });
  });

  it("never shows an unrelated, empty or failed old answer under a new query", () => {
    expect(searchView("za", { q: "pri", rows: rows("priya") })).toEqual({ kind: "searching" });
    expect(searchView("priy", { q: "pri", rows: [] })).toEqual({ kind: "searching" });
    expect(searchView("priy", { q: "pri", error: "x" })).toEqual({ kind: "searching" });
  });
});

describe("searchAnnouncement", () => {
  it("counts results, singular and plural", () => {
    expect(searchAnnouncement({ kind: "results", rows: rows("a"), stale: false })).toBe("1 result");
    expect(searchAnnouncement({ kind: "results", rows: rows("a", "b"), stale: false })).toBe(
      "2 results"
    );
  });

  it("reads out no one and failures, and stays quiet otherwise", () => {
    expect(searchAnnouncement({ kind: "none" })).toBe(SEARCH_COPY.noHits);
    expect(searchAnnouncement({ kind: "error", message: "Nope" })).toBe("Nope");
    expect(searchAnnouncement({ kind: "hint" })).toBe("");
    expect(searchAnnouncement({ kind: "searching" })).toBe("");
    expect(searchAnnouncement({ kind: "results", rows: rows("a"), stale: true })).toBe("");
  });
});

// ---- Add → "✓ Added" -----------------------------------------------------------

const PRIYA = { username: "priya", userId: "u-priya" };
const LEO = { username: "leo", userId: "u-leo" };

// Plays `call` to its end with `result`, as useFriendAdds does: mark it in
// flight, then settle it.
function run(adds: FriendAdds, call: AddCall, result: AddCallResult) {
  return settleAddCall(startAddCall(adds, call), call, result);
}

describe("the Add toggle (R:140, D13)", () => {
  it("shows Added on the tap, before the server answers, and sends a request", () => {
    const adds = toggleAdd({}, PRIYA);
    expect(isAdded(adds, "priya")).toBe(true);
    expect(addedCount(adds)).toBe(1);
    expect(nextAddCall(adds, "priya")).toEqual({ username: "priya", kind: "send", userId: "u-priya" });
  });

  it("keeps the request id, so a second tap undoes that exact row", () => {
    const tapped = toggleAdd({}, PRIYA);
    const { adds, failed } = run(tapped, nextAddCall(tapped, "priya")!, { ok: true, requestId: "r1" });
    expect(failed).toBe(false);
    expect(adds.priya).toEqual({ userId: "u-priya", want: true, requestId: "r1", busy: false });
    expect(nextAddCall(adds, "priya")).toBeNull();

    const undo = toggleAdd(adds, PRIYA);
    expect(isAdded(undo, "priya")).toBe(false);
    expect(addedCount(undo)).toBe(0);
    expect(nextAddCall(undo, "priya")).toEqual({ username: "priya", kind: "remove", requestId: "r1" });
    const after = run(undo, nextAddCall(undo, "priya")!, { ok: true });
    expect(after.adds.priya).toMatchObject({ want: false, requestId: null, busy: false });
    expect(nextAddCall(after.adds, "priya")).toBeNull();
  });

  it("re-adding after an undo sends a fresh request", () => {
    let adds = toggleAdd({}, PRIYA);
    adds = run(adds, nextAddCall(adds, "priya")!, { ok: true, requestId: "r1" }).adds;
    adds = toggleAdd(adds, PRIYA);
    adds = run(adds, nextAddCall(adds, "priya")!, { ok: true }).adds;
    adds = toggleAdd(adds, PRIYA);
    expect(nextAddCall(adds, "priya")).toEqual({ username: "priya", kind: "send", userId: "u-priya" });
  });

  it("sends nothing while a call for that person is still out", () => {
    const tapped = toggleAdd({}, PRIYA);
    const inFlight = startAddCall(tapped, nextAddCall(tapped, "priya")!);
    expect(inFlight.priya.busy).toBe(true);
    expect(nextAddCall(inFlight, "priya")).toBeNull();
    // A second tap still flips the button…
    const undone = toggleAdd(inFlight, PRIYA);
    expect(isAdded(undone, "priya")).toBe(false);
    expect(nextAddCall(undone, "priya")).toBeNull();
  });

  it("undoes a tap made while its send was out, once the send lands", () => {
    const tapped = toggleAdd({}, PRIYA);
    const send = nextAddCall(tapped, "priya")!;
    const undone = toggleAdd(startAddCall(tapped, send), PRIYA);
    const { adds, failed } = settleAddCall(undone, send, { ok: true, requestId: "r1" });
    expect(failed).toBe(false);
    expect(nextAddCall(adds, "priya")).toEqual({ username: "priya", kind: "remove", requestId: "r1" });
  });

  it("reverts a failed send to Add, and says so", () => {
    const tapped = toggleAdd({}, PRIYA);
    const { adds, failed } = run(tapped, nextAddCall(tapped, "priya")!, {
      error: "Couldn't send request.",
    });
    expect(failed).toBe(true);
    expect(adds.priya).toMatchObject({ want: false, requestId: null, busy: false });
    expect(addedCount(adds)).toBe(0);
    expect(nextAddCall(adds, "priya")).toBeNull();
  });

  it("doesn't report a failed send the person had already taken back", () => {
    const tapped = toggleAdd({}, PRIYA);
    const send = nextAddCall(tapped, "priya")!;
    const undone = toggleAdd(startAddCall(tapped, send), PRIYA);
    const { adds, failed } = settleAddCall(undone, send, { error: ADD_FAILED });
    expect(failed).toBe(false);
    expect(adds.priya).toMatchObject({ want: false, requestId: null });
  });

  it("reverts a failed undo to Added, keeping the request it couldn't delete", () => {
    let adds = toggleAdd({}, PRIYA);
    adds = run(adds, nextAddCall(adds, "priya")!, { ok: true, requestId: "r1" }).adds;
    adds = toggleAdd(adds, PRIYA);
    const r = run(adds, nextAddCall(adds, "priya")!, { error: "Couldn't update that friendship." });
    expect(r.failed).toBe(true);
    expect(r.adds.priya).toMatchObject({ want: true, requestId: "r1", busy: false });
    expect(addedCount(r.adds)).toBe(1);
  });

  it("treats a send that comes back without an id as failed (it couldn't be undone)", () => {
    const tapped = toggleAdd({}, PRIYA);
    const { adds, failed } = run(tapped, nextAddCall(tapped, "priya")!, { ok: true });
    expect(failed).toBe(true);
    expect(isAdded(adds, "priya")).toBe(false);
  });

  it("keeps each person's toggle separate, and counts only those showing Added", () => {
    let adds = toggleAdd(toggleAdd({}, PRIYA), LEO);
    expect(addedCount(adds)).toBe(2);
    adds = toggleAdd(adds, LEO);
    expect(addedCount(adds)).toBe(1);
    expect(isAdded(adds, "priya")).toBe(true);
    expect(isAdded(adds, "leo")).toBe(false);
    expect(isAdded(adds, "nobody")).toBe(false);
  });

  it("ignores a settle or start for someone it doesn't know", () => {
    const adds = toggleAdd({}, PRIYA);
    const stray: AddCall = { username: "ghost", kind: "send", userId: "u" };
    expect(startAddCall(adds, stray)).toBe(adds);
    expect(settleAddCall(adds, stray, { ok: true, requestId: "r" })).toEqual({ adds, failed: false });
    expect(nextAddCall(adds, "ghost")).toBeNull();
  });

  it("never mutates the map it's given", () => {
    const before = toggleAdd({}, PRIYA);
    const frozen = Object.freeze({ ...before, priya: Object.freeze({ ...before.priya }) });
    expect(() => toggleAdd(frozen, PRIYA)).not.toThrow();
    expect(() => startAddCall(frozen, nextAddCall(frozen, "priya")!)).not.toThrow();
    expect(frozen.priya.want).toBe(true);
  });
});

// ---- Who the viewer already knows ------------------------------------------------

describe("relations (D12)", () => {
  const relations = {
    friendIds: ["u-friend"],
    outgoing: [{ requestId: "r-out", userId: "u-asked", username: "asked" }],
    incoming: [{ requestId: "r-in", userId: "u-asking" }],
  };

  it("starts requests already out as Added, with the row an undo takes back", () => {
    const adds = addsFromOutgoing(relations.outgoing);
    expect(adds).toEqual({ asked: { userId: "u-asked", want: true, requestId: "r-out", busy: false } });
    expect(addedCount(adds)).toBe(1);
    expect(nextAddCall(adds, "asked")).toBeNull();
    expect(nextAddCall(toggleAdd(adds, { username: "asked", userId: "u-asked" }), "asked")).toEqual({
      username: "asked",
      kind: "remove",
      requestId: "r-out",
    });
    expect(addsFromOutgoing(NO_RELATIONS.outgoing)).toEqual({});
  });

  it("offers Friends, Accept or Add, never an Add that can only fail", () => {
    expect(rowRelation(relations, "u-friend")).toEqual({ kind: "friends" });
    expect(rowRelation(relations, "u-asking")).toEqual({ kind: "accept", requestId: "r-in" });
    expect(rowRelation(relations, "u-asked")).toEqual({ kind: "add" });
    expect(rowRelation(relations, "u-stranger")).toEqual({ kind: "add" });
    expect(rowRelation(NO_RELATIONS, "u-friend")).toEqual({ kind: "add" });
  });

  it("shows a request accepted from the row as Friends", () => {
    expect(rowRelation(relations, "u-asking", new Set(["u-asking"]))).toEqual({ kind: "friends" });
  });

  it("names the new friend by first name, or by handle", () => {
    expect(acceptedToast({ displayName: "Priya Raman", username: "priyaraman" })).toBe(
      "You and Priya are now friends"
    );
    expect(acceptedToast({ displayName: "  ", username: "zack" })).toBe("You and @zack are now friends");
    expect(acceptedToast({ displayName: null, username: "zack" })).toBe("You and @zack are now friends");
  });
});

// ---- The invite tile ---------------------------------------------------------------

describe("the invite tile (R:133, D9)", () => {
  it("drops the link in the group chat, and says sent after a share without naming a chat", () => {
    expect(INVITE_COPY.title).toBe("Invite your friends");
    expect(inviteTileSub(false)).toBe("Drop your link in the group chat");
    expect(inviteTileSub(true)).toBe("Sent. Send it to another chat");
  });

  it("toasts a share and a copy, and nothing for a dismissal or a failure", () => {
    expect(inviteToast("shared")).toBe("Invite shared");
    expect(inviteToast("copied")).toBe("Invite link copied");
    expect(inviteToast("dismissed")).toBeNull();
    expect(inviteToast("failed")).toBeNull();
  });

  it("breathes only on screen, visible, wanted, and never under reduced motion", () => {
    const on = { on: true, reduced: false, inView: true, hidden: false };
    expect(shouldBreathe(on)).toBe(true);
    expect(shouldBreathe({ ...on, on: false })).toBe(false); // searching, or off screen 5
    expect(shouldBreathe({ ...on, reduced: true })).toBe(false);
    expect(shouldBreathe({ ...on, inView: false })).toBe(false);
    expect(shouldBreathe({ ...on, hidden: true })).toBe(false);
  });
});
