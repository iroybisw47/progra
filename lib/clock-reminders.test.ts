import { describe, expect, it } from "vitest";

import {
  DURATION_END_ID,
  MAX_HOURLY_REMINDERS,
  allReminderIds,
  clockReminders,
  hourlyReminderId,
} from "@/lib/clock-reminders";
import {
  SESSION_CAP_MS,
  plannedEndMs,
  type SessionPlan,
  type SessionTiming,
} from "@/lib/session";

const MIN = 60_000;
const HOUR = 3_600_000;

function timing(over: Partial<SessionTiming> = {}): SessionTiming {
  return { startedAt: 0, endedAt: null, pausedMs: 0, pausedSince: null, ...over };
}

function plan(over: Partial<SessionPlan> = {}): SessionPlan {
  return {
    plannedWorkMs: null,
    workIntervalMs: null,
    breakMs: null,
    onBreak: false,
    breaksTaken: 0,
    ...over,
  };
}

describe("worked-time → wall-clock conversion", () => {
  // The load-bearing property: a reminder's instant must be the SAME instant
  // the rest of the app computes for that much worked time. If these ever
  // diverge, a notification contradicts the on-screen countdown.
  it("puts each hourly mark exactly where plannedEndMs would", () => {
    const t = timing({ startedAt: 1_000, pausedMs: 17 * MIN });
    const out = clockReminders(t, plan(), 0);
    for (const r of out) {
      const hour = r.id - hourlyReminderId(0);
      expect(r.at).toBe(plannedEndMs(t, hour * HOUR));
    }
  });

  it("pushes every mark later by exactly the paused time", () => {
    const clean = clockReminders(timing(), plan(), 0);
    const paused = clockReminders(timing({ pausedMs: 40 * MIN }), plan(), 0);
    expect(paused).toHaveLength(clean.length);
    paused.forEach((r, i) => {
      expect(r.at - clean[i].at).toBe(40 * MIN);
    });
  });

  it("places the timed alert at the target, not at wall-clock elapsed", () => {
    // 2h target with 20m of breaks banked → fires at 2h20m, matching the
    // on-screen countdown rather than the raw clock.
    const t = timing({ startedAt: 0, pausedMs: 20 * MIN });
    const [r] = clockReminders(t, plan({ plannedWorkMs: 2 * HOUR }), 0);
    expect(r.at).toBe(2 * HOUR + 20 * MIN);
  });
});

describe("paused sessions schedule nothing", () => {
  // Worked time is frozen, so every future instant depends on when the user
  // resumes — unknowable. Callers cancel on an empty list.
  it("returns nothing while paused, open-ended or timed", () => {
    const t = timing({ pausedSince: 30 * MIN });
    expect(clockReminders(t, plan(), 0)).toEqual([]);
    expect(clockReminders(t, plan({ plannedWorkMs: 2 * HOUR }), 0)).toEqual([]);
  });

  // A break IS a pause, so this covers breaks too — which is what stops a
  // "still clocked in" nudge landing while someone is deliberately resting.
  it("returns nothing during a break", () => {
    const t = timing({ pausedSince: 25 * MIN });
    expect(
      clockReminders(t, plan({ plannedWorkMs: 2 * HOUR, onBreak: true }), 0)
    ).toEqual([]);
  });

  it("returns nothing for an ended session", () => {
    expect(clockReminders(timing({ endedAt: HOUR }), plan(), 0)).toEqual([]);
  });
});

describe("the two modes are mutually exclusive", () => {
  // Stated as a test, not a comment: this is the rule that keeps a nudge from
  // firing mid-break and from doubling up with the on-screen countdown at the
  // target. A later change must not quietly reintroduce the overlap.
  it("a timed session gets one alert and zero hourly", () => {
    const out = clockReminders(timing(), plan({ plannedWorkMs: 2 * HOUR }), 0);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(DURATION_END_ID);
  });

  it("an open-ended session gets hourly and zero duration-end", () => {
    const out = clockReminders(timing(), plan(), 0);
    expect(out.length).toBeGreaterThan(0);
    expect(out.some((r) => r.id === DURATION_END_ID)).toBe(false);
  });
});

describe("bounds", () => {
  it("never schedules an hourly mark at or past the session cap", () => {
    const out = clockReminders(timing(), plan(), 0);
    expect(out).toHaveLength(MAX_HOURLY_REMINDERS);
    for (const r of out) expect(r.at).toBeLessThan(SESSION_CAP_MS);
  });

  it("drops marks already behind us", () => {
    // Opened just past three hours in: 1-3 have passed, 4 onwards remain.
    const out = clockReminders(timing(), plan(), 3 * HOUR + MIN);
    expect(out[0].id).toBe(hourlyReminderId(4));
    expect(out).toHaveLength(MAX_HOURLY_REMINDERS - 3);
  });

  // A mark landing exactly on `now` is dropped rather than kept: scheduling a
  // notification for the current instant can't usefully fire, and the plugin
  // would either drop it or deliver it late.
  it("drops a mark sitting exactly on now", () => {
    const out = clockReminders(timing(), plan(), 3 * HOUR);
    expect(out[0].id).toBe(hourlyReminderId(4));
  });

  it("drops a timed alert whose target already passed", () => {
    // The app ends the session on next open; a past-dated alert is useless.
    const out = clockReminders(timing(), plan({ plannedWorkMs: HOUR }), 2 * HOUR);
    expect(out).toEqual([]);
  });
});

describe("the hour interval is injectable (fast test mode)", () => {
  // The `fast` flag shortens an "hour" so the nudge is testable without waiting
  // a real one. The interval is an argument rather than a flag read inside this
  // module, which is what keeps these tests independent of the environment.
  it("places marks on the supplied interval", () => {
    const out = clockReminders(timing(), plan(), 0, 2 * MIN);
    expect(out[0].at).toBe(2 * MIN);
    expect(out[1].at).toBe(4 * MIN);
  });

  it("keeps the same count and copy regardless of interval", () => {
    const fast = clockReminders(timing(), plan(), 0, 2 * MIN);
    const real = clockReminders(timing(), plan(), 0);
    expect(fast).toHaveLength(real.length);
    expect(fast[0].body).toBe(real[0].body);
  });

  it("defaults to a real hour when omitted", () => {
    expect(clockReminders(timing(), plan(), 0)[0].at).toBe(HOUR);
  });
});

describe("ids", () => {
  it("never collide between the two kinds", () => {
    const ids = allReminderIds();
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(DURATION_END_ID);
  });

  // allReminderIds is what pass 3 cancels wholesale, so it must be a superset
  // of anything clockReminders can ever emit — otherwise a stale notification
  // from a previous session survives into the next one.
  it("cover every reminder the scheduler can emit", () => {
    const all = new Set(allReminderIds());
    for (const r of clockReminders(timing(), plan(), 0)) {
      expect(all.has(r.id)).toBe(true);
    }
    for (const r of clockReminders(timing(), plan({ plannedWorkMs: HOUR }), 0)) {
      expect(all.has(r.id)).toBe(true);
    }
  });
});
