import { afterEach, describe, expect, it, vi } from "vitest";

import { entityChipInk } from "@/lib/colors";
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

// Real palette entries, with their on-white inks — the pairing the card relies
// on (fill for the marker, ink for the digits).
const GREEN = { fill: "#2E8B50", ink: "#175E33", onDark: "#8cbf9f" };
const ORANGE = { fill: "#E07042", ink: "#C24E14", onDark: "#eeb097" };

function snap(
  t: SessionTiming = timing(),
  p: Plan = plan(),
  capMs?: number
) {
  return liveActivitySnapshot("s1", "Calc problem set", "Math", GREEN, t, p, capMs);
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
    expect(liveActivitySnapshot(null, "x", "Math", null, timing(), plan())).toBeNull();
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
      liveActivitySnapshot("s1", "  Reading  ", "Books", null, timing(), plan())!.label
    ).toBe("Reading");
  });

  it("falls back to Untitled session, matching the live screen", () => {
    expect(
      liveActivitySnapshot("s1", "   ", "Books", null, timing(), plan())!.label
    ).toBe("Untitled session");
  });
});

describe("paths", () => {
  it("sends a tap to the live timer", () => {
    expect(snap()!.tapPath).toBe("/clock/live");
  });

  // End deep-links to the TIMER, not straight to the finish screen: the session
  // has to actually be clocked out first, and handleStop owns that plus the
  // session_completed event and the routing that follows.
  it("sends End to the timer with the end action", () => {
    expect(snap()!.endPath).toBe("/clock/live?la=end");
  });

  it("points the secondary button at the action for the current state", () => {
    expect(snap()!.secondaryPath).toBe("/clock/live?la=pause");
    expect(snap(timing({ pausedSince: HOUR }))!.secondaryPath).toBe(
      "/clock/live?la=resume"
    );
    expect(
      snap(
        timing({ pausedSince: HOUR }),
        plan({ plannedWorkMs: 2 * HOUR, breakMs: 5 * MIN, onBreak: true })
      )!.secondaryPath
    ).toBe("/clock/live?la=endBreak");
  });

  // The path and the label must name the SAME action, or the card offers one
  // thing and performs another.
  it("keeps secondaryPath and secondaryAction in agreement", () => {
    for (const s of [
      snap(),
      snap(timing({ pausedSince: HOUR })),
      snap(
        timing({ pausedSince: HOUR }),
        plan({ breakMs: 5 * MIN, onBreak: true })
      ),
    ]) {
      expect(s!.secondaryPath).toBe(`/clock/live?la=${s!.secondaryAction}`);
    }
  });
});

describe("attribution and colour", () => {
  it("carries the attribution text and accent through", () => {
    const s = snap()!;
    expect(s.attribution).toBe("Math");
    expect(s.accentColor).toBe(GREEN.fill);
    expect(s.accentInk).toBe(GREEN.ink);
    expect(s.accentOnDark).toBe(GREEN.onDark);
  });

  it("falls back to Uncategorized on blank attribution", () => {
    const s = liveActivitySnapshot("s1", "Reading", "   ",
      null,
      timing(),
      plan()
    )!;
    expect(s.attribution).toBe("Uncategorized");
    expect(s.accentColor).toBeNull();
    expect(s.accentInk).toBeNull();
    expect(s.accentOnDark).toBeNull();
  });
});

describe("the state label", () => {
  // Null while running, and that is what buys the sub-line its headroom: the
  // card renders ATTRIBUTION · STATE beside the clock in ~25 small-caps
  // characters, and "GOAL · WRITING · TRACKING" is exactly 25. A ticking clock
  // already says the session is tracking.
  it("is null while running, so the card drops the redundant word", () => {
    expect(snap()!.stateLabel).toBeNull();
    // A timed session too — its sub-line shows the target instant instead,
    // computed natively from targetEndMs.
    expect(snap(timing(), plan({ plannedWorkMs: 2 * HOUR }))!.stateLabel).toBeNull();
  });

  it("keeps the live screen's vocabulary when NOT running", () => {
    expect(snap(timing({ pausedSince: HOUR }))!.stateLabel).toBe("Paused");
    expect(
      snap(
        timing({ pausedSince: HOUR }),
        plan({ breakMs: 5 * MIN, onBreak: true })
      )!.stateLabel
    ).toBe("On a break");
  });

  // The paused and break words are the ones the card cannot do without — a
  // frozen clock looks identical to a stopped one otherwise.
  it("is non-null for every state that stops the clock", () => {
    for (const p of [plan(), plan({ breakMs: 5 * MIN, onBreak: true })]) {
      const s = snap(timing({ pausedSince: HOUR }), p)!;
      expect(s.state).not.toBe("running");
      expect(s.stateLabel).not.toBeNull();
    }
  });
});

describe("fingerprint field coverage", () => {
  // notification-sync.ts's title/body lesson, turned into a test: every input
  // that can change the card must move the fingerprint, or a transition gets
  // skipped as "unchanged".
  const base = liveActivityFingerprint(snap());

  const mutations: Array<[string, string]> = [
    ["sessionId", liveActivityFingerprint(liveActivitySnapshot("s2", "Calc problem set", "Math", GREEN, timing(), plan()))],
    ["label", liveActivityFingerprint(liveActivitySnapshot("s1", "Reading", "Math", GREEN, timing(), plan()))],
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
    [
      "attribution",
      liveActivityFingerprint(
        liveActivitySnapshot("s1", "Calc problem set", "Reading", GREEN, timing(), plan())
      ),
    ],
    [
      "accentColor",
      liveActivityFingerprint(
        liveActivitySnapshot("s1", "Calc problem set", "Math", ORANGE, timing(), plan())
      ),
    ],
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

describe("the chip", () => {
  // The chip shows the bare name of the thing — no "Goal · " prefix, which
  // the app's other surfaces (finish-client, live-timer-client) do add. The
  // card is deliberately plainer than they are.
  it("is the bare attribution, with no prefix", () => {
    expect(snapWith("Thesis").attribution).toBe("Thesis");
    expect(snapWith("Writing").attribution).toBe("Writing");
    expect(snapWith("Thesis").attribution).not.toContain("Goal");
    expect(snapWith("Thesis").attribution).not.toContain("\u00b7");
  });

  it("falls back to Uncategorized when there is nothing to name", () => {
    expect(snapWith("  ").attribution).toBe("Uncategorized");
  });

  // The ink must clear the chip's own 28% fill, so it is lifted FURTHER than
  // the bar and the digits are.
  it("lifts the ink past the on-dark accent", () => {
    const s = liveActivitySnapshot("s1", "x", "Math", GREEN, timing(), plan())!;
    expect(s.chipInk).toBe(entityChipInk(GREEN.fill));
    expect(s.chipInk).not.toBe(s.accentOnDark);
    // The fill stays raw: Swift washes it at 28%.
    expect(s.accentColor).toBe(GREEN.fill);
  });

  it("has no colour at all when the session has none", () => {
    const s = liveActivitySnapshot("s1", "x", "Math", null, timing(), plan())!;
    expect(s.chipInk).toBeNull();
    expect(s.accentColor).toBeNull();
  });
});

function snapWith(attribution: string) {
  return liveActivitySnapshot("s1", "x", attribution, GREEN, timing(), plan())!;
}
