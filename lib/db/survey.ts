import "server-only";

import { cache } from "react";

import { getCurrentUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

// The question ids the signed-in member has already answered in one survey
// (lib/survey.ts), so the modal resumes where they left off.
//
// Null on any error, never an empty list: the modal can't be skipped, so "no
// answers yet" would put up a dialog whose writes are failing too. The layout
// shows nothing on null. Only called while surveyOwed() says the survey is
// still owed, so a member who finished pays nothing.
export const listMySurveyAnswers = cache(
  async (surveyId: string): Promise<string[] | null> => {
    const user = await getCurrentUser();
    if (!user) return null;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("survey_answers")
      .select("question_id")
      .eq("user_id", user.id)
      .eq("survey_id", surveyId);
    if (error || !data) return null;
    return data.map((r) => r.question_id as string);
  }
);
