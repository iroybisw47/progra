"use client";

import { useState } from "react";

import { SurveyModal, type SurveyAnswerFn } from "@/components/v2/survey-modal";
// The latest survey, previewed even now that nobody is being asked it.
import { LATEST_SURVEY as SURVEY } from "@/lib/survey";

// The client half of the survey's dev preview (page.tsx says what it's for).
// `anywhere` lifts the modal's "/" allowlist, the one thing this can't show.
export function SurveyPreviewClient({ fail, at }: { fail: boolean; at: number }) {
  const [log, setLog] = useState<string[]>([]);
  const [answered] = useState(() => SURVEY?.questions.slice(0, at).map((q) => q.id) ?? []);
  // Boxed: useState would call a bare function value as its initializer.
  const [{ submit }] = useState<{ submit: SurveyAnswerFn }>(() => {
    const seen = new Set(answered);
    const submit: SurveyAnswerFn = async (surveyId, questionId, optionId, text) => {
      await new Promise((r) => setTimeout(r, 150));
      const words = text ? `, ${JSON.stringify(text)}` : "";
      setLog((l) => [...l, `${fail ? "FAILED " : ""}answerSurvey("${surveyId}", "${questionId}", "${optionId}"${words})`]);
      if (fail) return { error: "Couldn't save that answer. Try again." };
      seen.add(questionId);
      return { ok: true, done: SURVEY?.questions.every((q) => seen.has(q.id)) ?? true };
    };
    return { submit };
  });

  if (!SURVEY) return <p className="p-5 text-sm">SURVEY is null.</p>;
  return (
    <div className="flex flex-1 flex-col items-center pt-7 pb-28">
      <main className="flex w-full max-w-md flex-col gap-2 px-5">
        <span className="section-label">Survey (preview)</span>
        {log.map((l, i) => (
          <code key={i} className="text-caption text-[11px]">{l}</code>
        ))}
      </main>
      <SurveyModal survey={SURVEY} answered={answered} submit={submit} anywhere />
    </div>
  );
}
