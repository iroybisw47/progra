import { describe, expect, it } from "vitest";

import { STEPS } from "@/lib/onboarding";
import {
  EVENTS,
  EVENT_NAMES,
  SIGNED_OUT_EVENTS,
  isSignedOutEvent,
  normalizeRoute,
  validateEvent,
} from "@/lib/telemetry/events";

const UUID = "0b9a4c2e-6f1d-4a3b-9c8e-1f2a3b4c5d6e";

describe("validateEvent — the allowlist", () => {
  it("rejects an event that is not in the table", () => {
    expect(validateEvent("pageview", {})).toEqual({ ok: false, reason: "unknown event" });
    expect(validateEvent("", {})).toMatchObject({ ok: false });
    expect(validateEvent(undefined, {})).toMatchObject({ ok: false });
    expect(validateEvent(42, {})).toMatchObject({ ok: false });
  });

  it("accepts every declared event with no properties", () => {
    for (const name of EVENT_NAMES) {
      expect(validateEvent(name, undefined)).toEqual({ ok: true, name, props: {} });
      expect(validateEvent(name, null)).toEqual({ ok: true, name, props: {} });
    }
  });

  it("rejects the WHOLE event on an unknown key, not just the key", () => {
    const r = validateEvent("goal_created", { goal_id: UUID, title: "Thesis" });
    expect(r).toEqual({ ok: false, reason: 'unknown property "title"' });
  });

  it("rejects props that are not a plain object", () => {
    expect(validateEvent("feed_viewed", [])).toMatchObject({ ok: false });
    expect(validateEvent("feed_viewed", "x")).toMatchObject({ ok: false });
  });
});

describe("validateEvent — no free text can pass", () => {
  it("a uuid property takes only a uuid, and lowercases it", () => {
    expect(validateEvent("goal_created", { goal_id: UUID.toUpperCase() })).toEqual({
      ok: true,
      name: "goal_created",
      props: { goal_id: UUID },
    });
    expect(validateEvent("goal_created", { goal_id: "Write my thesis" })).toMatchObject({
      ok: false,
      reason: 'bad value for "goal_id"',
    });
    expect(validateEvent("goal_created", { goal_id: 12 })).toMatchObject({ ok: false });
  });

  it("an enum property takes only a member", () => {
    expect(validateEvent("friend_added", { from: "friends_tab" })).toMatchObject({ ok: true });
    expect(validateEvent("friend_added", { from: "maya's profile" })).toMatchObject({
      ok: false,
    });
    // A step name is the onboarding machine's own list, not a free label.
    for (const step of STEPS) {
      expect(validateEvent("onboarding_step_viewed", { step_name: step })).toMatchObject({
        ok: true,
      });
    }
    expect(
      validateEvent("onboarding_step_viewed", { step_name: "Welcome to Progra" })
    ).toMatchObject({ ok: false });
  });

  it("an int property takes only a bounded integer", () => {
    expect(validateEvent("suggestion_submitted", { length: 120 })).toMatchObject({ ok: true });
    expect(validateEvent("suggestion_submitted", { length: 1.5 })).toMatchObject({ ok: false });
    expect(validateEvent("suggestion_submitted", { length: "120" })).toMatchObject({ ok: false });
    expect(validateEvent("suggestion_submitted", { length: Number.NaN })).toMatchObject({
      ok: false,
    });
    expect(validateEvent("suggestion_submitted", { length: 2 ** 50 })).toMatchObject({
      ok: false,
    });
  });

  it("a bool property takes only a boolean", () => {
    expect(validateEvent("nudges_toggled", { enabled: true })).toMatchObject({ ok: true });
    expect(validateEvent("nudges_toggled", { enabled: "true" })).toMatchObject({ ok: false });
    expect(validateEvent("nudges_toggled", { enabled: 1 })).toMatchObject({ ok: false });
  });

  it("a clock time is HH:MM, 24h", () => {
    expect(validateEvent("habit_reminder_time_changed", { time: "18:00" })).toMatchObject({
      ok: true,
    });
    expect(validateEvent("habit_reminder_time_changed", { time: "6pm" })).toMatchObject({
      ok: false,
    });
    expect(validateEvent("habit_reminder_time_changed", { time: "24:00" })).toMatchObject({
      ok: false,
    });
  });

  it("a local notification key has exactly the reserved shape", () => {
    expect(
      validateEvent("notification_cancelled", { key: "local:9101:1759876543210" })
    ).toMatchObject({ ok: true });
    expect(validateEvent("notification_cancelled", { key: "local:habit:now" })).toMatchObject({
      ok: false,
    });
    expect(validateEvent("notification_cancelled", { key: "like:x:y" })).toMatchObject({
      ok: false,
    });
  });

  it("drops null and undefined values instead of rejecting the event", () => {
    expect(
      validateEvent("session_clocked_in", {
        session_ref: UUID,
        goal_id: null,
        category_id: undefined,
        timed: false,
      })
    ).toEqual({
      ok: true,
      name: "session_clocked_in",
      props: { session_ref: UUID, timed: false },
    });
  });

  // The guarantee the whole file exists for, stated as a property over the
  // table itself: no event has a property type that would accept arbitrary
  // text.
  it("no declared property type accepts an arbitrary string", () => {
    const text = "I want to finish my thesis by June";
    for (const [name, schema] of Object.entries(EVENTS)) {
      for (const key of Object.keys(schema)) {
        expect(validateEvent(name, { [key]: text }), `${name}.${key}`).toMatchObject({
          ok: false,
        });
      }
    }
  });
});

describe("signed-out events", () => {
  it("are exactly the two landing-page events", () => {
    expect([...SIGNED_OUT_EVENTS].sort()).toEqual(["landing_viewed", "sign_in_started"]);
    expect(isSignedOutEvent("landing_viewed")).toBe(true);
    expect(isSignedOutEvent("app_opened")).toBe(false);
  });
});

describe("normalizeRoute", () => {
  it("maps dynamic segments to their template so no handle or id leaves the device", () => {
    expect(normalizeRoute("/profile/maya")).toBe("/profile/[username]");
    expect(normalizeRoute("/session/" + UUID)).toBe("/session/[id]");
    expect(normalizeRoute("/recap/2026-09-28")).toBe("/recap/[weekStart]");
    expect(normalizeRoute("/recap/2026-09-28/card")).toBe("/recap/[weekStart]/card");
    expect(normalizeRoute("/i/zack")).toBe("/i/[username]");
  });

  it("keeps known static routes and strips query and hash", () => {
    expect(normalizeRoute("/clock/live?la=pause#x")).toBe("/clock/live");
    expect(normalizeRoute("/")).toBe("/");
    expect(normalizeRoute("/settings/")).toBe("/settings");
  });

  it("collapses anything unknown to /other", () => {
    expect(normalizeRoute("/profile/maya/photos")).toBe("/other");
    expect(normalizeRoute("/wp-admin")).toBe("/other");
  });

  it("is itself a valid bug_report_submitted route", () => {
    expect(
      validateEvent("bug_report_submitted", { route: normalizeRoute("/profile/maya") })
    ).toMatchObject({ ok: true });
  });
});
