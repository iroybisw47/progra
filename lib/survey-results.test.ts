import { describe, expect, it } from "vitest";

import { textQuestion, type Survey } from "@/lib/survey";
import { shapeSurveyResults, type SurveyResultsRow } from "@/lib/survey-results";

const S: Survey = {
  id: "s",
  title: "T",
  intro: "I",
  questions: [
    { id: "a", prompt: "A?", options: [{ id: "x", label: "Ex", short: "X" }, { id: "y", label: "Why", short: "Y" }] },
    { id: "b", prompt: "B?", options: [{ id: "z", label: "Zed", short: "Z" }] },
    textQuestion("c", "C?", "Type"),
  ],
};

const row: SurveyResultsRow = {
  generated_at: "2026-10-20T12:00:00Z",
  eligible: 10,
  counts: [
    { question_id: "a", answer: "x", n: 2 },
    { question_id: "a", answer: "y", n: 1 },
    { question_id: "b", answer: "z", n: 2 },
    { question_id: "c", answer: "answered", n: 1 },
    { question_id: "c", answer: "skipped", n: 1 },
  ],
  respondents: [
    { id: "1", username: "al", display_name: "Al", segment: "uw", answers: { a: "x", b: "z", c: "answered" }, texts: { c: "Joint sessions" }, answered: 3, last_answered_at: "2026-10-20T11:00:00Z" },
    { id: "2", username: "bo", display_name: null, segment: "non_uw", answers: { a: "x", b: "z", c: "skipped" }, texts: {}, answered: 3, last_answered_at: "2026-10-20T10:00:00Z" },
    { id: "3", username: null, display_name: null, segment: "non_uw", answers: { a: "y" }, answered: 1, last_answered_at: "2026-10-20T09:00:00Z" },
  ],
};

describe("shapeSurveyResults", () => {
  const r = shapeSurveyResults(row, S);

  it("counts started and finished from the respondents", () => {
    expect([r.eligible, r.started, r.completed]).toEqual([10, 3, 2]);
  });

  it("keeps the survey's option order, with zeroes and rounded shares", () => {
    expect(r.questions[0].options.map((o) => [o.short, o.n, o.pct])).toEqual([
      ["X", 2, 67],
      ["Y", 1, 33],
    ]);
    expect(r.questions[0].answered).toBe(3);
  });

  it("gives a share of null when nobody answered", () => {
    const empty = shapeSurveyResults({ ...row, counts: [], respondents: [] }, S);
    expect(empty.questions[1].options[0]).toMatchObject({ n: 0, pct: null });
  });

  it("still counts a key the survey no longer lists, under its key", () => {
    const odd = shapeSurveyResults({ ...row, counts: [...row.counts, { question_id: "b", answer: "old", n: 1 }] }, S);
    expect(odd.questions[1].options.map((o) => o.short)).toEqual(["Z", "old"]);
    expect(odd.questions[1].answered).toBe(3);
  });

  it("lays each respondent's answers out in question order, null where unanswered", () => {
    expect(r.respondents.map((p) => [p.name, p.answers, p.complete])).toEqual([
      ["Al", ["X", "Z", "Answered"], true],
      ["@bo", ["X", "Z", "Skipped"], true],
      ["Unnamed", ["Y", null, null], false],
    ]);
  });

  it("collects a free-text question's words, and none for a choice question", () => {
    expect(r.questions[2].texts).toEqual([
      { respondentId: "1", name: "Al", text: "Joint sessions", answeredAt: "2026-10-20T11:00:00Z" },
    ]);
    expect(r.questions[0].texts).toEqual([]);
  });

  it("reads a row from before survey-text.sql, with no texts at all", () => {
    const old = shapeSurveyResults(
      { ...row, respondents: row.respondents.map((p) => ({ ...p, texts: undefined })) },
      S
    );
    expect(old.questions[2].texts).toEqual([]);
  });
});
