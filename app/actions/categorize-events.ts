"use server";

import { revalidatePath } from "next/cache";

import { classifyEventTitles } from "@/lib/anthropic/categorize-events";
import { listCategories } from "@/lib/db/categories";
import { listEventsInRange } from "@/lib/db/calendar-events";
import { createClient } from "@/lib/supabase/server";

// One AI decision, surfaced to the History review popup so the user can see
// (and correct) which event landed in which category.
export type AiAssignment = {
  eventId: string;
  title: string;
  categoryId: string;
};

type Result =
  | { ok: true; categorized: number; scanned: number; assignments: AiAssignment[] }
  | { error: string };

const PAST_DAYS = 30;
const FUTURE_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const categories = await listCategories();
  if (categories.length === 0) {
    return { error: "Add a category first, then auto-categorize." };
  }

  const events = await listEventsInRange(startMs, endMs, categories);

  // Targets: genuinely uncategorized events with a title to classify.
  const targets = events.filter(
    (e) => e.source === "uncategorized" && e.title && e.title.trim().length > 0
  );
  if (targets.length === 0) {
    return { ok: true, categorized: 0, scanned: events.length, assignments: [] };
  }

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
    return { ok: true, categorized: 0, scanned: events.length, assignments: [] };
  }

  // Mirror the manual-override upsert shape (event_id is the PK / conflict key).
  const rows = [...assignments.entries()].map(([event_id, category_id]) => ({
    event_id,
    category_id,
    source: "ai",
  }));
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

  revalidatePath("/clock");
  revalidatePath("/history");
  revalidatePath("/recap");
  revalidatePath("/");
  return {
    ok: true,
    categorized: assignments.size,
    scanned: events.length,
    assignments: decided,
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
