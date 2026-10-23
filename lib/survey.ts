// The in-app survey: questions asked one at a time, on load, until every one is
// answered. There is no skip, by the owner's decision (2026-10-20).
//
// Authored here rather than in a DB table, like lib/patch-notes.ts: the copy
// ships in the same deploy as the modal that shows it.
//
// Storage (.claude/plans/survey.sql):
//   survey_answers          one row per (user, survey, question), the option's
//                           KEY, never its label. Write-once: a retry or a stale
//                           tab can't change an answer already given.
//   profiles.survey_done    the id of the last survey this member finished,
//                           stamped by answerSurvey once every question has a
//                           row. It is what makes the gate free on every load.
//
// To run a NEW survey, define it under a new `id` and point SURVEY at it:
// everyone whose survey_done isn't that id is asked again. Once a survey has
// shipped, its `id`, question ids and option ids are FROZEN, because they are
// the keys the dashboard groups by. Labels can be reworded freely.
//
// SURVEY is what's being ASKED; null asks nobody. LATEST_SURVEY is the last one
// defined, kept after it stops being asked so the dashboard can still label
// its results.
//
// Pure, so lib/survey.test.ts pins every case.

export type SurveyOption = {
  id: string;
  // What the member reads.
  label: string;
  // What the dashboard's bars read: the chart's axis is ~118px wide.
  short: string;
};

export type SurveyQuestion = {
  id: string;
  prompt: string;
  options: readonly SurveyOption[];
};

export type Survey = {
  id: string;
  title: string;
  intro: string;
  questions: readonly SurveyQuestion[];
};

export const LATEST_SURVEY: Survey = {
  id: "2026-10-pricing-social",
  title: "Help shape Progra",
  intro: "Three quick questions. Pick the answer that fits you best.",
  questions: [
    {
      id: "pricing",
      prompt:
        "Progra costs money to run, and eventually it will need to make money by charging users. Which of these options would you most likely be willing to pay for?",
      options: [
        {
          id: "flat_subscription",
          label: "A flat subscription for Progra, around $3–$5 a month",
          short: "Flat $3–5/mo",
        },
        {
          id: "pro_tier",
          label:
            "Progra PRO, around $10–$12 a month: new features, stronger analytics on your productivity, and calendar syncing that recommends the best times to work towards your goals or relax. Normal Progra would still be free",
          short: "PRO $10–12/mo",
        },
        {
          id: "would_stop",
          label:
            "Although I love Progra, if it ever cost money to use in its current state, I would probably stop using it",
          short: "Would stop",
        },
      ],
    },
    {
      id: "friend_hook",
      prompt:
        "We've seen that the biggest reason people don't invite their friends to Progra is that their friends don't seem interested. Which of these do you think would get your friends to join you?",
      options: [
        {
          id: "joint_sessions",
          label: "Joint clock-in sessions (clock in with friends)",
          short: "Joint sessions",
        },
        {
          id: "challenges",
          label:
            "Challenges: see which of your friends can put the most time into a category or goal",
          short: "Challenges",
        },
        {
          id: "daily_streaks",
          label:
            "Daily streaks: every day you clock in or check off a habit adds to your streak, and you can see your friends' streaks",
          short: "Daily streaks",
        },
        {
          id: "share_progress",
          label:
            "Sharing your progress or profile: show your friends how many hours you've clocked in, to flex on them",
          short: "Share progress",
        },
      ],
    },
    {
      id: "daily_notifications",
      prompt:
        "How do you feel about Progra sending you daily notifications to help you stay on track with your goals and habits (like Duolingo)?",
      options: [
        {
          id: "appreciate",
          label:
            "I'd appreciate it! I want to use Progra and I forget a lot, so notifications would help me remember",
          short: "Would appreciate",
        },
        {
          id: "tiresome",
          label:
            "I do want to use Progra, but daily notifications would get tiresome and I'd ignore them",
          short: "Tiresome",
        },
        {
          id: "none",
          label: "I don't want any notifications from Progra",
          short: "None at all",
        },
      ],
    },
  ],
};

// Switched off 2026-10-22 at the owner's request: nobody is asked any more,
// including anyone who hadn't finished. Their partial answers stay in
// survey_answers and still count on the dashboard.
export const SURVEY: Survey | null = null;

// What the gate reads off the profile. Optional for the reason uw_prompt is on
// Profile: before the SQL runs PostgREST leaves survey_done out.
export type SurveyProfile = {
  onboarded_at?: string | null;
  survey_done?: string | null;
};

// Whether this member still owes the current survey.
//
// FAILS CLOSED like patch_notes_seen_version, and it matters more here because
// this modal has no way out: an absent survey_done key means the column (and so
// the table) doesn't exist yet, every answer would fail, and treating it as
// "not done" would trap every member behind a dialog they can't finish. Strict
// `=== undefined` shows nothing.
export function surveyOwed(
  profile: SurveyProfile | null | undefined,
  survey: Survey | null = SURVEY,
): boolean {
  if (!survey || !profile) return false;
  if (profile.onboarded_at == null) return false;
  const done = profile.survey_done;
  if (done === undefined) return false;
  return done !== survey.id;
}

// Where to pick up: the index of the first unanswered question, or null when
// every question already has an answer. A member who closed the app halfway
// resumes there, and one whose finishing stamp failed is not asked again.
export function firstUnanswered(
  answered: readonly string[],
  survey: Survey,
): number | null {
  const seen = new Set(answered);
  const i = survey.questions.findIndex((q) => !seen.has(q.id));
  return i === -1 ? null : i;
}

// The action's validation: the question exists in the CURRENT survey and the
// option is one of its own. Anything else never reaches the database.
export function isValidAnswer(
  surveyId: string,
  questionId: string,
  optionId: string,
  survey: Survey | null = SURVEY,
): boolean {
  if (!survey || survey.id !== surveyId) return false;
  const q = survey.questions.find((x) => x.id === questionId);
  return q?.options.some((o) => o.id === optionId) ?? false;
}

// Whether a set of answered question ids covers the whole survey.
export function isComplete(answered: readonly string[], survey: Survey): boolean {
  return firstUnanswered(answered, survey) === null;
}
