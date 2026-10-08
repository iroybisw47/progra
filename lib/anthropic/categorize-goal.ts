import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import {
  GOAL_CATEGORIES,
  isGoalCategory,
  type GoalCategory,
} from "@/lib/goal-categories";

// Labels ONE goal title with one of the eight categories. Server-only: the
// title goes to Anthropic's API and nowhere else, and /privacy says so.
//
// Haiku 4.5 by decision (2026-10-07): a one-line, eight-way classification is
// exactly its job and the cheap choice for ~60 users' goals. Structured output
// pins the answer to the enum, so the only way this returns something is a
// label the CHECK constraint will accept.
//
// Never throws. A failure — no key, kill switch, timeout, refusal, bad JSON —
// is null, which leaves the goal unlabelled for the admin backfill to retry.
// The SDK's own retries are off and the timeout is short because this runs
// inside after() on a goal save, where a hung request would hold the function
// open for nothing.

const MODEL = "claude-haiku-4-5";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    category: { type: "string", enum: [...GOAL_CATEGORIES] },
  },
  required: ["category"],
} as const;

const SYSTEM =
  "You label a personal goal with exactly one category from a fixed list. " +
  "The goal is something a person wants to spend hours on each week.\n" +
  "- fitness: exercise, sport, training, running, lifting, yoga\n" +
  "- study_school: coursework, exams, homework, a thesis, studying for a class\n" +
  "- work_career: a job, a business, a side project, job hunting, professional skills\n" +
  "- reading: reading books or articles\n" +
  "- creative: writing for pleasure, music, art, drawing, making videos, crafts\n" +
  "- language: learning or practising a language\n" +
  "- wellbeing: meditation, journaling, sleep, therapy, mental health, chores and routines\n" +
  "- not_time_based: the goal is not something hours are spent on (an outcome, a number, " +
  "a one-off purchase, or too vague to tell)\n" +
  "Pick the single best fit. When in doubt between a specific category and not_time_based, " +
  "prefer the specific one if the goal names an activity.";

export function aiCategorizationDisabled(): boolean {
  const v = process.env.DISABLE_AI_CATEGORIZATION;
  return v === "1" || v === "true";
}

let client: Anthropic | null = null;

export async function classifyGoalTitle(title: string): Promise<GoalCategory | null> {
  if (aiCategorizationDisabled() || !process.env.ANTHROPIC_API_KEY) return null;
  const clean = title.replace(/\s+/g, " ").trim().slice(0, 200);
  if (!clean) return null;

  client ??= new Anthropic({ maxRetries: 0, timeout: 15_000 });
  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 256,
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: "user", content: `Goal: ${clean}` }],
    });
    if (resp.stop_reason === "refusal") return null;
    let text = "";
    for (const block of resp.content) {
      if (block.type === "text") text += block.text;
    }
    const parsed = JSON.parse(text) as { category?: unknown };
    return isGoalCategory(parsed.category) ? parsed.category : null;
  } catch {
    return null;
  }
}
