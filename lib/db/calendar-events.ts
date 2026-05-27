import "server-only";

import { createClient } from "@/lib/supabase/server";
import { categorizeTitle } from "@/lib/categorize";
import type { Category } from "@/lib/storage";

export type DayEvent = {
  id: string;
  title: string | null;
  startMs: number;
  endMs: number;
  // null = uncategorized
  category: { id: string; name: string; color: string | null } | null;
  // "manual" = explicit override set by user; "rule" = matched a category rule;
  // "uncategorized" = neither.
  source: "manual" | "rule" | "uncategorized";
};

type Row = {
  id: string;
  title: string | null;
  start_time: string;
  end_time: string;
};

type OverrideRow = {
  event_id: string;
  category_id: string;
};

// Returns events overlapping [startMs, endMs), categorized. Manual overrides
// from event_categorizations win over rule matches.
export async function listEventsInRange(
  startMs: number,
  endMs: number,
  categories: Category[]
): Promise<DayEvent[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("calendar_events")
    .select("id, title, start_time, end_time")
    .lt("start_time", new Date(endMs).toISOString())
    .gt("end_time", new Date(startMs).toISOString())
    .order("start_time", { ascending: true });

  if (!data || data.length === 0) return [];

  const allRows = data as Row[];
  const allEventIds = allRows.map((r) => r.id);

  // Drop events the user has explicitly hidden from Progra.
  const { data: exclusionData } = await supabase
    .from("event_exclusions")
    .select("event_id")
    .in("event_id", allEventIds);
  const excludedIds = new Set(
    (exclusionData ?? []).map(
      (r) => (r as { event_id: string }).event_id
    )
  );
  const rows = allRows.filter((r) => !excludedIds.has(r.id));
  if (rows.length === 0) return [];
  const eventIds = rows.map((r) => r.id);

  // Pull manual overrides for just these events.
  const overrides = new Map<string, string>();
  const { data: overrideData } = await supabase
    .from("event_categorizations")
    .select("event_id, category_id")
    .in("event_id", eventIds);
  if (overrideData) {
    for (const r of overrideData as OverrideRow[]) {
      overrides.set(r.event_id, r.category_id);
    }
  }

  const categoryById = new Map(categories.map((c) => [c.id, c]));

  return rows.map((row) => {
    const overrideCategoryId = overrides.get(row.id);

    let category: DayEvent["category"];
    let source: DayEvent["source"];

    if (overrideCategoryId) {
      const cat = categoryById.get(overrideCategoryId);
      category = cat ? { id: cat.id, name: cat.name, color: cat.color } : null;
      source = category ? "manual" : "uncategorized";
    } else {
      const matched = categorizeTitle(row.title, categories);
      category = matched
        ? { id: matched.id, name: matched.name, color: matched.color }
        : null;
      source = matched ? "rule" : "uncategorized";
    }

    return {
      id: row.id,
      title: row.title,
      startMs: new Date(row.start_time).getTime(),
      endMs: new Date(row.end_time).getTime(),
      category,
      source,
    };
  });
}
