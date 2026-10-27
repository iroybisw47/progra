// The in-app survey: questions asked one at a time, on load, until every one is
// answered. A multiple-choice question has no skip, by the owner's decision
// (2026-10-20); a free-text question (FEATURE_SURVEY, 2026-10-27) has one, and
// skipping counts as its answer.
//
// Authored here rather than in a DB table, like lib/patch-notes.ts: the copy
// ships in the same deploy as the modal that shows it.
//
// Storage (.claude/plans/survey.sql):
//   survey_answers          one row per (user, survey, question), the option's
//                           KEY, never its label. Write-once: a retry or a stale
//                           tab can't change an answer already given. A
//                           free-text question stores TEXT_ANSWERED or
//                           TEXT_SKIPPED as the key, and the words beside it in
//                           text_answer (.claude/plans/survey-text.sql).
//   profiles.survey_done    the id of the last survey this member finished,
//                           stamped by answerSurvey once every question has a
//                           row. It is what makes the gate free on every load.
//
// To run a NEW survey, define it under a new `id` and point SURVEY at it:
// everyone whose survey_done isn't that id is asked again. Once a survey has
// shipped, its `id`, question ids and option ids are FROZEN, because they are
// the keys the dashboard groups by. Labels can be reworded freely.
//
// SURVEY is what's being ASKED; null asks nobody. SURVEYS is every survey
// that has shipped, newest first, kept after it stops being asked so the
// dashboard can still label its results; LATEST_SURVEY is its first entry.
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
  // A text box and a Skip instead of the options, which are then
  // TEXT_OPTIONS: the keys the dashboard counts. Build it with textQuestion().
  freeText?: { placeholder: string };
};

// The two keys a free-text question stores, so its bars read "wrote / skipped".
export const TEXT_ANSWERED = "answered";
export const TEXT_SKIPPED = "skipped";
// survey-text.sql's CHECK caps the words at this many characters.
export const TEXT_MAX = 1000;

const TEXT_OPTIONS: readonly SurveyOption[] = [
  { id: TEXT_ANSWERED, label: "Wrote an answer", short: "Answered" },
  { id: TEXT_SKIPPED, label: "Skipped", short: "Skipped" },
];

export function textQuestion(id: string, prompt: string, placeholder: string): SurveyQuestion {
  return { id, prompt, options: TEXT_OPTIONS, freeText: { placeholder } };
}

export type Survey = {
  id: string;
  title: string;
  intro: string;
  questions: readonly SurveyQuestion[];
};

// Asked 2026-10-20 to 2026-10-22.
export const PRICING_SURVEY: Survey = {
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

// Live from 2026-10-24: what Progra is worth to the people using it. A new id,
// so everyone is asked, including those who finished the pricing survey.
export const VALUE_SURVEY: Survey = {
  id: "2026-10-value",
  title: "Help shape Progra",
  intro: "Four quick questions. Pick the answer that fits you best.",
  questions: [
    {
      id: "most_valued",
      prompt: "Which part of Progra matters most to you?",
      options: [
        { id: "clock_in", label: "Clocking in to track my sessions", short: "Clocking in" },
        { id: "friends_feed", label: "Seeing what my friends are working on", short: "Friends' feed" },
        { id: "nudges", label: "Nudges and encouragement from friends", short: "Nudges" },
        { id: "streaks_recap", label: "The streaks and weekly recap", short: "Streaks & recap" },
      ],
    },
    {
      id: "time_impact",
      prompt: "How much has Progra changed the time you put toward your goals?",
      options: [
        {
          id: "more_time",
          label: "It’s the reason I’ve put in more meaningful time than I would have otherwise",
          short: "Reason I do more",
        },
        {
          id: "helped",
          label: "It’s helped me consistently, but I’d have made progress without it",
          short: "Helped, not key",
        },
        {
          id: "tracking_only",
          label: "It’s useful for tracking, but it hasn’t changed how much time I put in",
          short: "Tracking only",
        },
        { id: "not_sure", label: "I’m not sure yet", short: "Not sure yet" },
      ],
    },
    {
      id: "noticed",
      prompt:
        "Have you ever felt more motivated to show up because someone else on Progra noticed?",
      options: [
        { id: "often", label: "Yes, often", short: "Often" },
        { id: "a_few_times", label: "Yes, a few times", short: "A few times" },
        { id: "rarely", label: "Rarely", short: "Rarely" },
        { id: "never", label: "Never", short: "Never" },
      ],
    },
    {
      id: "disappointment",
      prompt: "If Progra disappeared tomorrow, how would you feel?",
      options: [
        { id: "very", label: "Very disappointed", short: "Very disappointed" },
        { id: "somewhat", label: "Somewhat disappointed", short: "Somewhat" },
        { id: "not", label: "Not disappointed", short: "Not disappointed" },
        { id: "not_sure", label: "Not sure", short: "Not sure" },
      ],
    },
  ],
};

// Live from 2026-10-27: one open question, with a Skip. A new id, so everyone
// is asked, including those who finished the value survey.
export const FEATURE_SURVEY: Survey = {
  id: "2026-10-feature-request",
  title: "Help shape Progra",
  intro: "One quick question. Write as much or as little as you like, or skip it.",
  questions: [
    textQuestion(
      "feature_request",
      "What feature would you like to be added to Progra?",
      "I'd love it if Progra could…"
    ),
  ],
};

// Every survey that has shipped, newest first. Their ids, question ids and
// option ids are frozen; the dashboard can show any of them.
export const SURVEYS: readonly Survey[] = [FEATURE_SURVEY, VALUE_SURVEY, PRICING_SURVEY];
export const LATEST_SURVEY: Survey = SURVEYS[0];

export function surveyById(id: string | null | undefined): Survey | null {
  return SURVEYS.find((s) => s.id === id) ?? null;
}

// The pricing survey was switched off 2026-10-22; the value survey ran
// 2026-10-24 to 2026-10-27, then this one. null asks nobody.
export const SURVEY: Survey | null = FEATURE_SURVEY;

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
// option is one of its own. Words go only with TEXT_ANSWERED on a free-text
// question, trimmed (cleanText), non-empty and at most TEXT_MAX; a skip or a
// choice carries none. Anything else never reaches the database.
export function isValidAnswer(
  surveyId: string,
  questionId: string,
  optionId: string,
  text: string | null = null,
  survey: Survey | null = SURVEY,
): boolean {
  if (!survey || survey.id !== surveyId) return false;
  const q = survey.questions.find((x) => x.id === questionId);
  if (!q?.options.some((o) => o.id === optionId)) return false;
  if (q.freeText && optionId === TEXT_ANSWERED) {
    return text !== null && text.length > 0 && text.length <= TEXT_MAX;
  }
  return text === null;
}

// What a free-text answer stores: trimmed, and null when nothing is left.
export function cleanText(text: string | null | undefined): string | null {
  const t = text?.trim() ?? "";
  return t === "" ? null : t;
}

// Whether a set of answered question ids covers the whole survey.
export function isComplete(answered: readonly string[], survey: Survey): boolean {
  return firstUnanswered(answered, survey) === null;
}
