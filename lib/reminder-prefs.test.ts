import { describe, expect, it } from "vitest";

import { remindersEnabledFor } from "@/lib/reminder-prefs";

// The stored value is the session id reminders are OFF for. Everything below is
// a consequence of that one representation choice — most importantly the free
// reset, which is the whole reason it isn't a boolean.
describe("remindersEnabledFor", () => {
  it("defaults to on when nothing has been stored", () => {
    expect(remindersEnabledFor(null, "session-1")).toBe(true);
  });

  it("is off only for the exact session it was turned off for", () => {
    expect(remindersEnabledFor("session-1", "session-1")).toBe(false);
  });

  // The property the whole design rests on: turning reminders off for one
  // session must not silence the next one. A boolean would have needed explicit
  // clearing on clock-out — a path that could be missed, exactly like the six
  // mutation call sites SyncClockReminders exists to avoid.
  it("is back on for a different session, with no cleanup step", () => {
    expect(remindersEnabledFor("session-1", "session-2")).toBe(true);
  });

  it("is on with no active session, whatever is stored", () => {
    expect(remindersEnabledFor("session-1", null)).toBe(true);
    expect(remindersEnabledFor(null, null)).toBe(true);
  });
});
