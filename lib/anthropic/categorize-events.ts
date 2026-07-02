import "server-only";

import Anthropic from "@anthropic-ai/sdk";

// Haiku is well-suited to short-title classification and is the cheap choice for
// a personal app. Titles are sent to Anthropic's API (server-side only).
const MODEL = "claude-haiku-4-5";
// Keep each request small; chunk large windows so output stays well under the cap.
const BATCH_SIZE = 80;

export type ClassifyCategory = { id: string; name: string; keywords?: string[] };
export type ClassifyEvent = { id: string; title: string };

// JSON-schema for structured output: an array of {eventId, categoryId}.
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    assignments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          eventId: { type: "string" },
          categoryId: { type: "string" },
        },
        required: ["eventId", "categoryId"],
      },
    },
  },
  required: ["assignments"],
};

const SYSTEM =
  "You sort calendar event titles into a fixed list of the user's categories. " +
  'Assign a category only when the title clearly belongs to it; if nothing fits, use "none". ' +
  'Never invent a category. Return each category\'s id exactly as given, or the literal "none".';

// Classifies event titles into the given categories. Returns eventId → categoryId
// for confident matches only; events with no clear fit are omitted ("none").
// Requires ANTHROPIC_API_KEY in the environment. A failed batch is skipped rather
// than failing the whole run.
export async function classifyEventTitles(
  categories: ClassifyCategory[],
  events: ClassifyEvent[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (categories.length === 0 || events.length === 0) return result;

  const client = new Anthropic();
  const validIds = new Set(categories.map((c) => c.id));
  const catLines = categories
    .map(
      (c) =>
        `- ${c.id} = ${c.name}` +
        (c.keywords && c.keywords.length
          ? ` (examples: ${c.keywords.join(", ")})`
          : "")
    )
    .join("\n");

  let succeededBatches = 0;
  let firstError: unknown = null;

  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const batch = events.slice(i, i + BATCH_SIZE);
    const eventLines = batch
      .map((e) => `${e.id}\t${e.title.replace(/\s+/g, " ").trim()}`)
      .join("\n");
    const userText =
      `Categories (id = name):\n${catLines}\n\n` +
      `Events (id<TAB>title), one per line:\n${eventLines}\n\n` +
      `Return an assignment for every event id: the best-fitting category id, or "none".`;

    try {
      const resp = await client.messages.create({
        model: MODEL,
        max_tokens: 8192,
        output_config: { format: { type: "json_schema", schema: SCHEMA } },
        system: SYSTEM,
        messages: [{ role: "user", content: userText }],
      });
      let text = "";
      for (const block of resp.content) {
        if (block.type === "text") text += block.text;
      }
      const parsed = JSON.parse(text) as {
        assignments?: { eventId: string; categoryId: string }[];
      };
      for (const a of parsed.assignments ?? []) {
        if (
          a.categoryId &&
          a.categoryId !== "none" &&
          validIds.has(a.categoryId)
        ) {
          result.set(a.eventId, a.categoryId);
        }
      }
      succeededBatches++;
    } catch (err) {
      // Tolerate a transient single-batch failure as long as some batch
      // succeeds — partial results are fine. But remember the first error so a
      // total wipeout (e.g. missing/invalid ANTHROPIC_API_KEY, rejected param)
      // can be surfaced below instead of masquerading as "nothing to
      // categorize".
      if (firstError === null) firstError = err;
      continue;
    }
  }

  // Every batch failed — this isn't "found nothing", it's broken. Surface the
  // real error so the caller can show it instead of a false success.
  if (succeededBatches === 0 && firstError !== null) throw firstError;

  return result;
}
