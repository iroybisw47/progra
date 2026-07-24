"use server";

import { classifyEventTitles } from "@/lib/anthropic/categorize-events";
import { revalidateEventSurfaces } from "@/lib/revalidate";
import { listCategories } from "@/lib/db/categories";
import { listEventsInRange } from "@/lib/db/calendar-events";
import { getCurrentUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

// One AI decision, surfaced to the History review popup so the user can see
// (and correct) which event landed in which category.
export type AiAssignment = {
  eventId: string;
  title: string;
  categoryId: string;
};

type Result =
  | {
      ok: true;
      categorized: number;
      scanned: number;
      assignments: AiAssignment[];
      // Uncategorized events left unsent because this run hit the per-run cap;
      // callers surface a "tap again" hint. 0/undefined = fully processed.
      remaining?: number;
    }
  | { error: string };

const PAST_DAYS = 30;
const FUTURE_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

// Beta cost cap: the most events a single press sends to the model. With
// BATCH_SIZE 80 (lib/anthropic/categorize-events.ts) that's ~4 Haiku calls —
// cents. A calendar with more uncategorized events finishes over repeated
// presses (idempotent). Tune freely; nothing else depends on the value.
const MAX_EVENTS_PER_RUN = 300;

// Classifies uncategorized calendar events overlapping [startMs, endMs] with
// Claude and persists the results as `source: "ai"` rows in
// event_categorizations. Idempotent: only events with no manual override, no
// keyword-rule match, and no prior AI assignment are sent to the model.
//
// Used by the /clock button (rolling window, via autoCategorizeEvents) and by
// the /history month/year views (the period currently on screen).
export async function categorizeEventsInRange(
  startMs: number,
  endMs: number
): Promise<Result> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  // Global kill-switch: flip this env var (Vercel / .env.local) to stop all
  // Anthropic spend instantly. Keyword-rule categorization still works — rules
  // apply at read time in listEventsInRange — so untouched events simply stay
  // in the Uncategorized bucket.
  const off = process.env.DISABLE_AI_CATEGORIZATION;
  if (off === "1" || off === "true") {
    return { error: "Auto-categorization is paused right now." };
  }

  const categories = await listCategories();
  if (categories.length === 0) {
    return { error: "Add a category first, then auto-categorize." };
  }

  const events = await listEventsInRange(startMs, endMs, categories);

  // Targets: genuinely uncategorized events with a title to classify.
  const allTargets = events.filter(
    (e) => e.source === "uncategorized" && e.title && e.title.trim().length > 0
  );
  if (allTargets.length === 0) {
    return { ok: true, categorized: 0, scanned: events.length, assignments: [] };
  }

  // Per-run cap: send at most MAX_EVENTS_PER_RUN this press; the rest wait for
  // the next tap. Bounds the cost of a single action on a huge calendar.
  const targets = allTargets.slice(0, MAX_EVENTS_PER_RUN);
  const remaining = allTargets.length - targets.length;

  let assignments: Map<string, string>;
  try {
    assignments = await classifyEventTitles(
      categories.map((c) => ({
        id: c.id,
        name: c.name,
        keywords: c.rules?.titleContains,
      })),
      targets.map((e) => ({ id: e.id, title: e.title as string }))
    );
  } catch (e) {
    // Surfaced from classifyEventTitles when every batch failed — most likely a
    // missing/invalid ANTHROPIC_API_KEY.
    return {
      error:
        e instanceof Error ? e.message : "Auto-categorization request failed",
    };
  }

  if (assignments.size === 0) {
    return {
      ok: true,
      categorized: 0,
      scanned: events.length,
      assignments: [],
      remaining,
    };
  }

  // Only persist assignments whose event_id was actually in this batch — the
  // model returns ids, and a crafted event title could try to make it emit an
  // assignment for a different event. (RLS would reject a cross-user event_id
  // anyway, but this stops a title from mislabeling another of the user's own
  // events, and avoids failing the whole batch on a stray id.)
  const targetIds = new Set(targets.map((e) => e.id));
  const rows = [...assignments.entries()]
    .filter(([event_id]) => targetIds.has(event_id))
    .map(([event_id, category_id]) => ({
      event_id,
      category_id,
      source: "ai",
    }));
  if (rows.length === 0) {
    return {
      ok: true,
      categorized: 0,
      scanned: events.length,
      assignments: [],
      remaining,
    };
  }
  const { error } = await supabase
    .from("event_categorizations")
    .upsert(rows, { onConflict: "event_id" });
  if (error) return { error: error.message };

  // Surface the decisions (title + assigned category) so the caller can show a
  // review popup. Titles come from the targets we just classified.
  const titleById = new Map(targets.map((e) => [e.id, e.title as string]));
  const decided: AiAssignment[] = [...assignments.entries()].map(
    ([eventId, categoryId]) => ({
      eventId,
      title: titleById.get(eventId) ?? "",
      categoryId,
    })
  );

  revalidateEventSurfaces();
  return {
    ok: true,
    categorized: assignments.size,
    scanned: events.length,
    assignments: decided,
    remaining,
  };
}

// The AI decisions already stored in the window, for the History "Review"
// popup when there's nothing new to categorize. Read-only; reuses the same
// reads as the rollup, so it reflects any manual corrections (those are no
// longer source "ai" and drop out).
export async function listAiCategorizedInRange(
  startMs: number,
  endMs: number
): Promise<AiAssignment[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const categories = await listCategories();
  const events = await listEventsInRange(startMs, endMs, categories);
  return events
    .filter(
      (e) =>
        e.source === "ai" &&
        e.category != null &&
        e.title != null &&
        e.title.trim().length > 0
    )
    .map((e) => ({
      eventId: e.id,
      title: e.title as string,
      categoryId: e.category!.id,
    }));
}

// Rolling-window wrapper for the /clock button: recent past + near future.
export async function autoCategorizeEvents(): Promise<Result> {
  const now = Date.now();
  return categorizeEventsInRange(
    now - PAST_DAYS * DAY_MS,
    now + FUTURE_DAYS * DAY_MS
  );
}
