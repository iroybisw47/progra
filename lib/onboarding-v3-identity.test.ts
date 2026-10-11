import { describe, expect, it } from "vitest";

import { SCREEN } from "@/lib/onboarding-v3";
import {
  IDENTITY_SAVE_FAILED,
  identityWrites,
  phaseFor,
  saveIdentity,
  usernameFailure,
  welcomeContinue,
  welcomeHandle,
  welcomeShown,
} from "@/lib/onboarding-v3-identity";
import { USERNAME_TAKEN_ERROR, checkUsername } from "@/lib/social/username";

// v2's rule, as onboarding-client-v2.tsx computes it inline: the welcome must
// let exactly the same handles through, with the same message under the field.
function v2(username: string) {
  const check = username.trim() ? checkUsername(username) : null;
  return {
    valid: !!check?.ok,
    error: check && !check.ok ? check.error : null,
  };
}

describe("welcomeHandle: v2's rules", () => {
  it("is no handle and no error while empty", () => {
    expect(welcomeHandle("")).toEqual({ valid: false, username: null, error: null });
    expect(welcomeHandle("   ")).toEqual({ valid: false, username: null, error: null });
  });

  it("lets a well-formed handle through, normalized as setUsername stores it", () => {
    expect(welcomeHandle("mayachen")).toEqual({ valid: true, username: "mayachen", error: null });
    expect(welcomeHandle("MayaChen")).toEqual({ valid: true, username: "mayachen", error: null });
    expect(welcomeHandle("maya_chen")).toEqual({ valid: true, username: "maya_chen", error: null });
  });

  it("shows checkUsername's own message for anything it refuses", () => {
    expect(welcomeHandle("ma")).toEqual({
      valid: false,
      username: null,
      error: "Username must be at least 3 characters.",
    });
    expect(welcomeHandle("maya.chen").error).toBe(
      "Use only lowercase letters, numbers, and underscores."
    );
    expect(welcomeHandle("_maya").error).toBe("Username can't start or end with an underscore.");
    expect(welcomeHandle("12345").error).toBe("Username must contain at least one letter.");
    expect(welcomeHandle("admin").error).toBe("That username is reserved.");
    expect(welcomeHandle("a".repeat(21)).error).toBe("Username must be 20 characters or fewer.");
  });

  it("matches v2's welcome exactly, and never needs a name", () => {
    const inputs = [
      "",
      " ",
      "ma",
      "may",
      "Maya",
      "maya chen",
      "maya.chen",
      "maya_",
      "_maya",
      "123",
      "progra",
      "settings",
      "m4ya",
      "a".repeat(20),
      "a".repeat(21),
      "MAYA_CHEN_99",
    ];
    for (const input of inputs) {
      const ours = welcomeHandle(input);
      expect({ valid: ours.valid, error: ours.error }, input).toEqual(v2(input));
    }
  });

  it("holds a handle setUsername refused as taken, with its words, until it changes", () => {
    const taken = welcomeHandle("mayachen", "mayachen");
    expect(taken).toEqual({ valid: false, username: null, error: USERNAME_TAKEN_ERROR });
    expect(USERNAME_TAKEN_ERROR).toBe("That username is taken.");
    // The same handle in another case is the same claim.
    expect(welcomeHandle("MayaChen", "mayachen").error).toBe(USERNAME_TAKEN_ERROR);
    // Any other handle is judged afresh.
    expect(welcomeHandle("mayachen2", "mayachen")).toEqual({
      valid: true,
      username: "mayachen2",
      error: null,
    });
    // A shape error still reads as itself.
    expect(welcomeHandle("ma", "mayachen").error).toBe("Username must be at least 3 characters.");
  });
});

describe("usernameFailure", () => {
  it("puts only the unique index's refusal under the field; the rest toast", () => {
    expect(usernameFailure(USERNAME_TAKEN_ERROR)).toBe("taken");
    expect(usernameFailure("Couldn't save your username.")).toBe("other");
    expect(usernameFailure("Not authenticated")).toBe("other");
    expect(usernameFailure("That username is reserved.")).toBe("other");
  });
});

describe("welcomeContinue: what the welcome's Continue does", () => {
  it("opens the UW sheet once the identity saves, with UW on", () => {
    expect(welcomeContinue({ uwEnabled: true, valid: true, saving: false })).toEqual({
      kind: "save",
      then: "uwSheet",
    });
  });

  it("goes straight to Screen 2 with UW off (D11)", () => {
    expect(welcomeContinue({ uwEnabled: false, valid: true, saving: false })).toEqual({
      kind: "save",
      then: "goal",
    });
  });

  it("does nothing until the handle is valid, or while a save is in flight", () => {
    for (const uwEnabled of [true, false]) {
      expect(welcomeContinue({ uwEnabled, valid: false, saving: false })).toEqual({
        kind: "ignore",
      });
      expect(welcomeContinue({ uwEnabled, valid: true, saving: true })).toEqual({
        kind: "ignore",
      });
    }
  });
});

describe("identityWrites", () => {
  const saved = { username: "mayachen", displayName: "Maya Chen" };

  it("writes nothing when nothing changed (a replayer clicking through)", () => {
    expect(identityWrites(saved, { username: "mayachen", name: "Maya Chen " })).toEqual({
      username: null,
      displayName: undefined,
    });
    // v2's field keeps what was typed, case and all; it's stored lowercased.
    expect(identityWrites(saved, { username: "MayaChen", name: "Maya Chen" }).username).toBeNull();
  });

  it("writes only what changed", () => {
    expect(identityWrites(saved, { username: "maya", name: "Maya Chen" })).toEqual({
      username: "maya",
      displayName: undefined,
    });
    expect(identityWrites(saved, { username: "mayachen", name: "Maya C" })).toEqual({
      username: null,
      displayName: "Maya C",
    });
  });

  it("writes both on a first run", () => {
    expect(
      identityWrites({ username: "", displayName: null }, { username: "mayachen", name: "Maya" })
    ).toEqual({ username: "mayachen", displayName: "Maya" });
  });

  it("treats the name as optional, as v2 does", () => {
    // A first run with no name writes only the handle.
    expect(
      identityWrites({ username: "", displayName: null }, { username: "mayachen", name: "  " })
    ).toEqual({ username: "mayachen", displayName: undefined });
    // A replayer who empties theirs has it cleared.
    expect(identityWrites(saved, { username: "mayachen", name: "" })).toEqual({
      username: null,
      displayName: null,
    });
  });
});

// Fake identity writes: each call recorded, each answer scripted in turn.
type Answer<T> = T | Error;
function fakeServices({
  username = [],
  name = [],
}: {
  username?: Answer<{ ok: true; username: string } | { error: string }>[];
  name?: Answer<{ ok: true } | { error: string }>[];
}) {
  const calls: string[] = [];
  const next = <T,>(queue: Answer<T>[]): Promise<T> => {
    const a = queue.shift();
    if (a === undefined) throw new Error("unexpected call");
    return a instanceof Error ? Promise.reject(a) : Promise.resolve(a);
  };
  return {
    calls,
    services: {
      setUsername(u: string) {
        calls.push(`username:${u}`);
        return next(username);
      },
      setProfileIdentity(input: { displayName: string | null }) {
        calls.push(`name:${input.displayName}`);
        return next(name);
      },
    },
  };
}

describe("saveIdentity", () => {
  const first = { username: "", displayName: null };

  it("writes the handle, then the name, and saves both", async () => {
    const f = fakeServices({ username: [{ ok: true, username: "mayachen" }], name: [{ ok: true }] });
    const out = await saveIdentity(f.services, first, { username: "mayachen", displayName: "Maya" });
    expect(f.calls).toEqual(["username:mayachen", "name:Maya"]);
    expect(out).toEqual({ kind: "saved", saved: { username: "mayachen", displayName: "Maya" } });
  });

  it("keeps the handle as the server stored it", async () => {
    const f = fakeServices({ username: [{ ok: true, username: "maya_c" }] });
    const out = await saveIdentity(f.services, first, { username: "maya_c", displayName: undefined });
    expect(out).toEqual({ kind: "saved", saved: { username: "maya_c", displayName: null } });
  });

  it("writes only the name when only the name changed", async () => {
    const f = fakeServices({ name: [{ ok: true }] });
    const saved = { username: "mayachen", displayName: "Maya" };
    const out = await saveIdentity(f.services, saved, { username: null, displayName: null });
    expect(f.calls).toEqual(["name:null"]);
    expect(out).toEqual({ kind: "saved", saved: { username: "mayachen", displayName: null } });
  });

  it("stops at a taken handle, writing nothing else", async () => {
    const f = fakeServices({ username: [{ error: USERNAME_TAKEN_ERROR }] });
    const out = await saveIdentity(f.services, first, { username: "maya", displayName: "Maya" });
    expect(f.calls).toEqual(["username:maya"]);
    expect(out).toEqual({ kind: "taken", saved: first, handle: "maya" });
  });

  it("passes any other refusal on to be toasted", async () => {
    const f = fakeServices({ username: [{ error: "Couldn't save your username." }] });
    const out = await saveIdentity(f.services, first, { username: "maya", displayName: "Maya" });
    expect(out).toEqual({ kind: "failed", saved: first, error: "Couldn't save your username." });
    expect(f.calls).toEqual(["username:maya"]);
  });

  it("keeps a saved handle when the name then fails, so the retry writes the name alone", async () => {
    const f = fakeServices({
      username: [{ ok: true, username: "mayachen" }],
      name: [{ error: "Couldn't save your profile." }, { ok: true }],
    });
    const typed = { username: "mayachen", name: "Maya" };
    const out = await saveIdentity(f.services, first, identityWrites(first, typed));
    expect(out).toEqual({
      kind: "failed",
      saved: { username: "mayachen", displayName: null },
      error: "Couldn't save your profile.",
    });
    const retry = identityWrites(out.saved, typed);
    expect(retry).toEqual({ username: null, displayName: "Maya" });
    const again = await saveIdentity(f.services, out.saved, retry);
    expect(again).toEqual({ kind: "saved", saved: { username: "mayachen", displayName: "Maya" } });
    expect(f.calls).toEqual(["username:mayachen", "name:Maya", "name:Maya"]);
  });

  it("never rejects: a dropped connection is a failure, with what got saved before it", async () => {
    const f = fakeServices({
      username: [{ ok: true, username: "mayachen" }],
      name: [new Error("network")],
    });
    const out = await saveIdentity(f.services, first, { username: "mayachen", displayName: "Maya" });
    expect(out).toEqual({
      kind: "failed",
      saved: { username: "mayachen", displayName: null },
      error: IDENTITY_SAVE_FAILED,
    });
    const g = fakeServices({ username: [new Error("network")] });
    expect(await saveIdentity(g.services, first, { username: "maya", displayName: undefined })).toEqual(
      { kind: "failed", saved: first, error: IDENTITY_SAVE_FAILED }
    );
  });
});

describe("welcomeShown", () => {
  it("is the name trimmed, and the color keyed by the handle as stored", () => {
    expect(welcomeShown("  Maya Chen ", "MayaChen")).toEqual({
      displayName: "Maya Chen",
      colorKey: "mayachen",
    });
  });

  it("has no name and a placeholder key before there's a handle", () => {
    expect(welcomeShown(null, "")).toEqual({ displayName: "", colorKey: "?" });
  });
});

describe("phaseFor", () => {
  it("is active on its own screen, past behind it and ahead of it", () => {
    expect(phaseFor(SCREEN.goal, SCREEN.goal)).toBe("active");
    expect(phaseFor(SCREEN.identity, SCREEN.goal)).toBe("past");
    expect(phaseFor(SCREEN.ready, SCREEN.goal)).toBe("ahead");
  });
});
