"use server";

import { getCurrentUser } from "@/lib/auth/require-user";
import { requireSeat } from "@/lib/auth/require-seat";
import { revalidateSurveySurfaces } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import { SURVEY, cleanText, isComplete, isValidAnswer } from "@/lib/survey";

type Result = { ok: true; done: boolean } | { error: string };

// Records one answer to the in-app survey (lib/survey.ts) and, once every
// question has one, stamps profiles.survey_done so the modal never opens again.
//
// Write-once: there is no update policy on survey_answers, and the insert is
// ON CONFLICT DO NOTHING, so a double tap or a second tab keeps the first
// answer and still returns ok. `done` comes from the stored rows rather than
// from the question being the last one, so a member whose earlier answer
// failed is not stamped finished.
//
// The stamp is its own statement, best-effort: if it fails, every answer is
// still stored, and the layout sees the complete set and shows nothing.
//
// `text` is a free-text question's words, sent only with TEXT_ANSWERED; it is
// trimmed here, and text_answer is left out of every other insert.
export async function answerSurvey(
  surveyId: string,
  questionId: string,
  optionId: string,
  text?: string | null
): Promise<Result> {
  const words = cleanText(text);
  if (!SURVEY || !isValidAnswer(surveyId, questionId, optionId, words)) {
    return { error: "Couldn't save that answer." };
  }
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const seat = await requireSeat();
  if ("error" in seat) return seat;

  const supabase = await createClient();
  const { error } = await supabase.from("survey_answers").upsert(
    {
      user_id: user.id,
      survey_id: surveyId,
      question_id: questionId,
      answer: optionId,
      ...(words !== null && { text_answer: words }),
    },
    { onConflict: "user_id,survey_id,question_id", ignoreDuplicates: true }
  );
  if (error) return { error: "Couldn't save that answer. Try again." };

  const { data } = await supabase
    .from("survey_answers")
    .select("question_id")
    .eq("user_id", user.id)
    .eq("survey_id", surveyId);
  const done = isComplete(
    (data ?? []).map((r) => r.question_id as string),
    SURVEY
  );
  if (done) {
    await supabase
      .from("profiles")
      .update({ survey_done: surveyId })
      .eq("id", user.id);
  }

  revalidateSurveySurfaces();
  return { ok: true, done };
}
