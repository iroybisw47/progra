import { describe, expect, it } from "vitest";

import { normalizePermission } from "@/lib/notification-permission";

// Only the pure mapping is testable here — everything else in the module talks
// to window.Capacitor, which exists on device and nowhere else. Small, but this
// is the one place a plugin string can be silently mishandled, and the cost of
// getting it wrong is a permanently unaskable dialog.
describe("normalizePermission", () => {
  it("passes the three states the UI branches on straight through", () => {
    expect(normalizePermission("granted")).toBe("granted");
    expect(normalizePermission("denied")).toBe("denied");
    expect(normalizePermission("prompt")).toBe("prompt");
  });

  // Android's rationale variant still means "we can ask". Collapsing it to
  // "prompt" is what lets every caller branch on three states instead of four.
  it("treats prompt-with-rationale as prompt", () => {
    expect(normalizePermission("prompt-with-rationale")).toBe("prompt");
  });

  // Anything unrecognised is "we can't ask here", NOT "they said no". The
  // distinction matters: `denied` sends the user to iOS Settings, and showing
  // that to a website visitor — or on a plugin string we failed to parse —
  // would be nonsense advice.
  it("maps anything unknown to unavailable, never denied", () => {
    expect(normalizePermission("")).toBe("unavailable");
    expect(normalizePermission("limited")).toBe("unavailable");
    expect(normalizePermission("provisional")).toBe("unavailable");
  });
});
