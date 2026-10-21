// The survey tab of /admin/analytics: admin_survey_results()'s keys
// (.claude/plans/survey.sql), turned into the questions and labels of
// lib/survey.ts. Pure, so lib/survey-results.test.ts pins it.

import type { Survey } from "@/lib/survey";

export type SurveyResultsRow = {
  generated_at: string;
  eligible: number;
  counts: { question_id: string; answer: string; n: number }[];
  respondents: {
    id: string;
    username: string | null;
    display_name: string | null;
    segment: string;
    answers: Record<string, string>;
    answered: number;
    last_answered_at: string;
  }[];
};

export type SurveyOptionResult = {
  id: string;
  label: string;
  short: string;
  n: number;
  // Share of this question's answers, rounded; null when nobody answered.
  pct: number | null;
};

export type SurveyQuestionResult = {
  id: string;
  prompt: string;
  answered: number;
  options: SurveyOptionResult[];
};

export type SurveyRespondent = {
  id: string;
  name: string;
  segment: string;
  complete: boolean;
  lastAnsweredAt: string;
  // One `short` label per question, in question order; null = not answered yet.
  answers: (string | null)[];
};

export type SurveyResults = {
  generatedAt: string;
  eligible: number;
  started: number;
  completed: number;
  questions: SurveyQuestionResult[];
  respondents: SurveyRespondent[];
};

// Options keep the survey's own order, which is the order members read them
// in. A key the survey no longer lists (an option removed after it shipped,
// which the freeze rule in lib/survey.ts forbids) still counts, under its key,
// so the bars always add up to `answered`.
export function shapeSurveyResults(row: SurveyResultsRow, survey: Survey): SurveyResults {
  const questions = survey.questions.map((q): SurveyQuestionResult => {
    const counts = row.counts.filter((c) => c.question_id === q.id);
    const answered = counts.reduce((n, c) => n + c.n, 0);
    const pct = (n: number) => (answered === 0 ? null : Math.round((n / answered) * 100));
    const known = new Set(q.options.map((o) => o.id));
    const options = [
      ...q.options.map((o) => {
        const n = counts.find((c) => c.answer === o.id)?.n ?? 0;
        return { id: o.id, label: o.label, short: o.short, n, pct: pct(n) };
      }),
      ...counts
        .filter((c) => !known.has(c.answer))
        .map((c) => ({ id: c.answer, label: c.answer, short: c.answer, n: c.n, pct: pct(c.n) })),
    ];
    return { id: q.id, prompt: q.prompt, answered, options };
  });

  const shortFor = (questionId: string, optionId: string | undefined): string | null => {
    if (optionId === undefined) return null;
    const q = survey.questions.find((x) => x.id === questionId);
    return q?.options.find((o) => o.id === optionId)?.short ?? optionId;
  };
  const respondents = row.respondents.map((r): SurveyRespondent => {
    const answers = survey.questions.map((q) => shortFor(q.id, r.answers[q.id]));
    return {
      id: r.id,
      name: r.display_name || (r.username ? `@${r.username}` : "Unnamed"),
      segment: r.segment,
      complete: answers.every((a) => a !== null),
      lastAnsweredAt: r.last_answered_at,
      answers,
    };
  });

  return {
    generatedAt: row.generated_at,
    eligible: row.eligible,
    started: respondents.length,
    completed: respondents.filter((r) => r.complete).length,
    questions,
    respondents,
  };
}
