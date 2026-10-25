import { describe, expect, it } from "vitest";

import {
  LATEST_SURVEY,
  PRICING_SURVEY,
  SURVEY,
  SURVEYS,
  VALUE_SURVEY,
  surveyById,
  firstUnanswered,
  isComplete,
  isValidAnswer,
  surveyOwed,
  type Survey,
} from "@/lib/survey";

const S: Survey = {
  id: "test-survey",
  title: "T",
  intro: "I",
  questions: [
    { id: "a", prompt: "A?", options: [{ id: "x", label: "X", short: "X" }, { id: "y", label: "Y", short: "Y" }] },
    { id: "b", prompt: "B?", options: [{ id: "z", label: "Z", short: "Z" }] },
  ],
};
const onboarded = "2026-09-01T00:00:00Z";

describe("surveyOwed", () => {
  it("asks an onboarded member who has never finished one", () => {
    expect(surveyOwed({ onboarded_at: onboarded, survey_done: null }, S)).toBe(true);
  });

  it("asks a member who finished an OLDER survey", () => {
    expect(surveyOwed({ onboarded_at: onboarded, survey_done: "older" }, S)).toBe(true);
  });

  it("doesn't ask a member who finished this one", () => {
    expect(surveyOwed({ onboarded_at: onboarded, survey_done: "test-survey" }, S)).toBe(false);
  });

  it("fails CLOSED when the column doesn't exist yet (undefined, not null)", () => {
    expect(surveyOwed({ onboarded_at: onboarded }, S)).toBe(false);
  });

  it("never interrupts onboarding", () => {
    expect(surveyOwed({ onboarded_at: null, survey_done: null }, S)).toBe(false);
  });

  it("shows nothing signed out or with no survey", () => {
    expect(surveyOwed(null, S)).toBe(false);
    expect(surveyOwed({ onboarded_at: onboarded, survey_done: null }, null)).toBe(false);
  });
});

describe("firstUnanswered / isComplete", () => {
  it("starts at the first question", () => {
    expect(firstUnanswered([], S)).toBe(0);
  });

  it("resumes at the first gap, in question order", () => {
    expect(firstUnanswered(["a"], S)).toBe(1);
    expect(firstUnanswered(["b"], S)).toBe(0);
  });

  it("is null once every question has an answer, whatever else is stored", () => {
    expect(firstUnanswered(["b", "a", "gone"], S)).toBeNull();
    expect(isComplete(["a", "b"], S)).toBe(true);
    expect(isComplete(["a"], S)).toBe(false);
  });
});

describe("isValidAnswer", () => {
  it("accepts one of the question's own options", () => {
    expect(isValidAnswer("test-survey", "a", "y", S)).toBe(true);
  });

  it("refuses another question's option, an unknown question, or another survey", () => {
    expect(isValidAnswer("test-survey", "a", "z", S)).toBe(false);
    expect(isValidAnswer("test-survey", "nope", "x", S)).toBe(false);
    expect(isValidAnswer("other", "a", "x", S)).toBe(false);
    expect(isValidAnswer("test-survey", "a", "x", null)).toBe(false);
  });
});

// A survey's keys are what survey.sql's CHECK admits and what the dashboard
// groups by, whether or not it's still being asked.
describe("SURVEYS", () => {
  it("asks the value survey, the newest", () => {
    expect(SURVEY).toBe(VALUE_SURVEY);
    expect(LATEST_SURVEY).toBe(VALUE_SURVEY);
  });

  it("has unique ids, and finds each by id", () => {
    const ids = SURVEYS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SURVEYS) expect(surveyById(s.id)).toBe(s);
    expect(surveyById("nope")).toBeNull();
    expect(surveyById(undefined)).toBeNull();
  });

  it("has keys the database accepts, and no duplicates", () => {
    for (const survey of SURVEYS) {
      expect(survey.id).toMatch(/^[a-z0-9_-]{1,60}$/);
      const qids = survey.questions.map((q) => q.id);
      expect(new Set(qids).size).toBe(qids.length);
      for (const q of survey.questions) {
        expect(q.id).toMatch(/^[a-z0-9_]{1,40}$/);
        const oids = q.options.map((o) => o.id);
        expect(new Set(oids).size).toBe(oids.length);
        for (const o of q.options) {
          expect(o.id).toMatch(/^[a-z0-9_]{1,40}$/);
          expect(o.short.length).toBeLessThanOrEqual(18);
        }
      }
    }
  });

  it("pins the shipped keys (they are frozen once live)", () => {
    expect(PRICING_SURVEY.id).toBe("2026-10-pricing-social");
    expect(PRICING_SURVEY.questions.map((q) => [q.id, q.options.map((o) => o.id)])).toEqual([
      ["pricing", ["flat_subscription", "pro_tier", "would_stop"]],
      ["friend_hook", ["joint_sessions", "challenges", "daily_streaks", "share_progress"]],
      ["daily_notifications", ["appreciate", "tiresome", "none"]],
    ]);
    expect(VALUE_SURVEY.id).toBe("2026-10-value");
    expect(VALUE_SURVEY.questions.map((q) => [q.id, q.options.map((o) => o.id)])).toEqual([
      ["most_valued", ["clock_in", "friends_feed", "nudges", "streaks_recap"]],
      ["time_impact", ["more_time", "helped", "tracking_only", "not_sure"]],
      ["noticed", ["often", "a_few_times", "rarely", "never"]],
      ["disappointment", ["very", "somewhat", "not", "not_sure"]],
    ]);
  });
});
