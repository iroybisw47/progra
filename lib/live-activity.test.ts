import { afterEach, describe, expect, it, vi } from "vitest";

import {
  LIVE_ACTIVITY_MAX_MS,
  liveActivityFingerprint,
  liveActivitySnapshot,
} from "@/lib/live-activity";
import {
  SESSION_CAP_MS,
  plannedEndMs,
  sessionWorkedMs,
  type SessionPlan,
  type SessionTiming,
} from "@/lib/session";

// Factories in the shape lib/clock-reminders.test.ts uses, so the two suites
// read the same way.
const MIN = 60_000;
const HOUR = 3_600_000;

function timing(over: Partial<SessionTiming> = {}): SessionTiming {
  return { startedAt: 0, endedAt: null, pausedMs: 0, pausedSince: null, ...over };
}

type Plan = Pick<SessionPlan, "plannedWorkMs" | "breakMs" | "onBreak">;

function plan(over: Partial<Plan> = {}): Plan {
  return { plannedWorkMs: null, breakMs: null, onBreak: false, ...over };
}

function snap(
  t: SessionTiming = timing(),
  p: Plan = plan(),
  capMs?: number
) {
  return liveActivitySnapshot("s1", "Calc problem set", t, p, capMs);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("now-independence", () => {
  // THE load-bearing property. If a Date.now() ever creeps in, the fingerprint
  // churns, the leaf syncs on every layout re-render, and ActivityKit throttles
  // the app's updates while visibly re-animating the Dynamic Island.
  it("returns byte-identical output an hour later", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T09:00:00Z"));
    const first = snap(timing({ startedAt: 1_000, pausedMs: 7 * MIN }));

    vi.setSystemTime(new Date("2026-10-05T10:00:00Z"));
    const second = snap(timing({ startedAt: 1_000, pausedMs: 7 * MIN }));

    expect(second).toEqual(first);
    expect(liveActivityFingerprint(second)).toBe(
      liveActivityFingerprint(first)
    );
  });

  it("is identical while paused too", () => {
    vi.useFakeTimers();
    const t = timing({ startedAt: 0, pausedMs: 5 * MIN, pausedSince: HOUR });
    vi.setSystemTime(new Date("2026-10-05T09:00:00Z"));
    const first = snap(t);
    vi.setSystemTime(new Date("2026-10-05T23:00:00Z"));
    expect(snap(t)).toEqual(first);
  });
});

describe("the anchor agrees with the rest of the app", () => {
  // The property that stops the Lock Screen and the on-screen countdown
  // disagreeing — the Live Activity analogue of clock-reminders.test.ts's
  // "puts each hourly mark exactly where plannedEndMs would".
  it("anchors at plannedEndMs(timing, 0)", () => {
    const t = timing({ startedAt: 1_234, pausedMs: 17 * MIN });
    expect(snap(t)!.timerAnchorMs).toBe(plannedEndMs(t, 0));
  });

  it("puts the target exactly plannedWorkMs past the anchor", () => {
    const t = timing({ startedAt: 500, pausedMs: 20 * MIN });
    const s = snap(t, plan({ plannedWorkMs: 2 * HOUR }))!;
    expect(s.targetEndMs).toBe(plannedEndMs(t, 2 * HOUR));
    expect(s.targetEndMs! - s.timerAnchorMs).toBe(2 * HOUR);
  });

  it("pushes the anchor later by exactly the paused time", () => {
    const clean = snap(timing())!;
    const paused = snap(timing({ pausedMs: 40 * MIN }))!;
    expect(paused.timerAnchorMs - clean.timerAnchorMs).toBe(40 * MIN);
  });

  it("has no target for an open-ended session", () => {
    const s = snap()!;
    expect(s.targetEndMs).toBeNull();
    expect(s.plannedWorkMs).toBeNull();
  });
});

describe("three states, no overlap", () => {
  it("reads running when not paused", () => {
    const s = snap()!;
    expect(s.state).toBe("running");
    expect(s.secondaryAction).toBe("pause");
    expect(s.secondaryLabel).toBe("Pause");
    expect(s.frozenWorkedMs).toBeNull();
  });

  it("reads paused for a manual pause", () => {
    const s = snap(timing({ pausedSince: HOUR }))!;
    expect(s.state).toBe("paused");
    expect(s.secondaryAction).toBe("resume");
    expect(s.secondaryLabel).toBe("Resume");
  });

  it("reads onBreak and offers End break, never Pause", () => {
    const s = snap(
      timing({ pausedSince: HOUR }),
      plan({ plannedWorkMs: 2 * HOUR, breakMs: 5 * MIN, onBreak: true })
    )!;
    expect(s.state).toBe("onBreak");
    expect(s.secondaryAction).toBe("endBreak");
    expect(s.secondaryLabel).toBe("End break");
  });

  // The client-side half of app/actions/sessions.ts:591-593. A Lock Screen
  // Pause during a break would hit that rejection with no way to show a toast,
  // so the button must never exist in that state.
  it("never offers pause while on a break", () => {
    for (const planned of [null, 2 * HOUR]) {
      const s = snap(
        timing({ pausedSince: HOUR }),
        plan({ plannedWorkMs: planned, breakMs: 5 * MIN, onBreak: true })
      )!;
      expect(s.secondaryAction).not.toBe("pause");
    }
  });

  it("reads running again once resumed, even with a stale onBreak flag", () => {
    const s = snap(
      timing({ pausedMs: 5 * MIN, pausedSince: null }),
      plan({ onBreak: true })
    )!;
    expect(s.state).toBe("running");
    expect(s.secondaryAction).toBe("pause");
  });
});

describe("frozen worked time", () => {
  it("equals sessionWorkedMs at the instant of pausing", () => {
    const t = timing({ startedAt: 0, pausedMs: 10 * MIN, pausedSince: 2 * HOUR });
    expect(snap(t)!.frozenWorkedMs).toBe(sessionWorkedMs(t, t.pausedSince!));
  });

  it("is null while running", () => {
    expect(snap(timing({ pausedMs: 10 * MIN }))!.frozenWorkedMs).toBeNull();
  });
});

describe("breakEndsAtMs", () => {
  it("is pausedSince + breakMs on a break", () => {
    const s = snap(
      timing({ pausedSince: 90 * MIN }),
      plan({ plannedWorkMs: 2 * HOUR, breakMs: 5 * MIN, onBreak: true })
    )!;
    expect(s.breakEndsAtMs).toBe(90 * MIN + 5 * MIN);
  });

  // The trap: pausedSince is set for a manual pause too, so a session that
  // merely HAS breakMs configured must not render a break countdown.
  it("is null for a manual pause on a session that has breakMs", () => {
    const s = snap(
      timing({ pausedSince: 90 * MIN }),
      plan({ plannedWorkMs: 2 * HOUR, breakMs: 5 * MIN, onBreak: false })
    )!;
    expect(s.state).toBe("paused");
    expect(s.breakEndsAtMs).toBeNull();
  });

  it("is null while running", () => {
    expect(snap()!.breakEndsAtMs).toBeNull();
  });
});

describe("nothing to show", () => {
  it("is null with no session", () => {
    expect(liveActivitySnapshot(null, "x", timing(), plan())).toBeNull();
  });

  it("is null for an ended session", () => {
    expect(snap(timing({ endedAt: 2 * HOUR }))).toBeNull();
  });

  it("fingerprints null distinctly from any snapshot", () => {
    expect(liveActivityFingerprint(null)).toBe("none");
    expect(liveActivityFingerprint(snap())).not.toBe("none");
  });
});

describe("the stale horizon", () => {
  it("is 8 hours in for an ordinary session", () => {
    expect(snap(timing({ startedAt: 1_000 }))!.staleAtMs).toBe(
      1_000 + LIVE_ACTIVITY_MAX_MS
    );
  });

  it("shifts with pausedMs only via the cap, never past it", () => {
    const s = snap(timing({ startedAt: 0, pausedMs: 3 * HOUR }))!;
    expect(s.capEndMs).toBe(SESSION_CAP_MS + 3 * HOUR);
    expect(s.staleAtMs).toBe(LIVE_ACTIVITY_MAX_MS);
  });

  // fast mode shortens the cap to 20 minutes; the horizon has to follow or the
  // card never goes stale in testing. Same shape as clock-reminders.test.ts's
  // injected-capMs assertions.
  it("honours an injected capMs shorter than the 8h limit", () => {
    const s = snap(timing({ startedAt: 0 }), plan(), 20 * MIN)!;
    expect(s.capEndMs).toBe(20 * MIN);
    expect(s.staleAtMs).toBe(20 * MIN);
  });
});

describe("the label", () => {
  it("trims", () => {
    expect(
      liveActivitySnapshot("s1", "  Reading  ", timing(), plan())!.label
    ).toBe("Reading");
  });

  it("falls back to Untitled session, matching the live screen", () => {
    expect(
      liveActivitySnapshot("s1", "   ", timing(), plan())!.label
    ).toBe("Untitled session");
  });
});

describe("paths", () => {
  it("sends End to the finish screen for this session", () => {
    expect(snap()!.endPath).toBe("/clock/finish?sid=s1");
  });

  it("sends a tap to the live timer", () => {
    expect(snap()!.tapPath).toBe("/clock/live");
  });
});

describe("fingerprint field coverage", () => {
  // notification-sync.ts's title/body lesson, turned into a test: every input
  // that can change the card must move the fingerprint, or a transition gets
  // skipped as "unchanged".
  const base = liveActivityFingerprint(snap());

  const mutations: Array<[string, string]> = [
    ["sessionId", liveActivityFingerprint(liveActivitySnapshot("s2", "Calc problem set", timing(), plan()))],
    ["label", liveActivityFingerprint(liveActivitySnapshot("s1", "Reading", timing(), plan()))],
    ["startedAt", liveActivityFingerprint(snap(timing({ startedAt: 99 })))],
    ["pausedMs", liveActivityFingerprint(snap(timing({ pausedMs: MIN })))],
    ["pausedSince", liveActivityFingerprint(snap(timing({ pausedSince: HOUR })))],
    ["plannedWorkMs", liveActivityFingerprint(snap(timing(), plan({ plannedWorkMs: HOUR })))],
    [
      "onBreak",
      liveActivityFingerprint(
        snap(timing({ pausedSince: HOUR }), plan({ breakMs: MIN, onBreak: true }))
      ),
    ],
    ["capMs", liveActivityFingerprint(snap(timing(), plan(), 20 * MIN))],
  ];

  for (const [field, fingerprint] of mutations) {
    it(`changes when ${field} changes`, () => {
      expect(fingerprint).not.toBe(base);
    });
  }

  it("is stable for identical input", () => {
    expect(liveActivityFingerprint(snap())).toBe(base);
  });
});
