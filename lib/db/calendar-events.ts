import "server-only";

import { createClient } from "@/lib/supabase/server";
import { categorizeTitle } from "@/lib/categorize";
import type { Category } from "@/lib/storage";

// Raw busy interval used for scheduling/placement and the /plan grid's
// "fixed" overlay. Unlike `listEventsInRange`, this returns *every* synced
// non-cancelled event in the window — including ones the user excluded
// from time-spent totals — because an excluded class is still a real
// commitment that blocks scheduling.
export type BusyInterval = {
  id: string;
  title: string | null;
  startMs: number;
  endMs: number;
};

export async function listBusyTimes(
  startMs: number,
  endMs: number
): Promise<BusyInterval[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("calendar_events")
    .select("id, title, start_time, end_time")
    .lt("start_time", new Date(endMs).toISOString())
    .gt("end_time", new Date(startMs).toISOString())
    .order("start_time", { ascending: true });
  if (!data) return [];
  return (
    data as { id: string; title: string | null; start_time: string; end_time: string }[]
  ).map((r) => ({
    id: r.id,
    title: r.title,
    startMs: new Date(r.start_time).getTime(),
    endMs: new Date(r.end_time).getTime(),
  }));
}

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

type ExclusionRow = {
  event_id: string;
};

// Returns events overlapping [startMs, endMs), categorized. Manual overrides
// win over rule matches. Excluded events are filtered out entirely.
//
// All three Supabase queries fire in parallel — exclusions and overrides
// don't depend on the event-id list because RLS already scopes them to the
// current user. We filter in JS against the events that are in this window.
export async function listEventsInRange(
  startMs: number,
  endMs: number,
  categories: Category[]
): Promise<DayEvent[]> {
  const supabase = await createClient();

  const [eventsResult, exclusionsResult, overridesResult] = await Promise.all([
    supabase
      .from("calendar_events")
      .select("id, title, start_time, end_time")
      .lt("start_time", new Date(endMs).toISOString())
      .gt("end_time", new Date(startMs).toISOString())
      .order("start_time", { ascending: true }),
    supabase.from("event_exclusions").select("event_id"),
    supabase.from("event_categorizations").select("event_id, category_id"),
  ]);

  const eventRows = eventsResult.data as Row[] | null;
  if (!eventRows || eventRows.length === 0) return [];

  const excludedIds = new Set(
    ((exclusionsResult.data ?? []) as ExclusionRow[]).map((r) => r.event_id)
  );
  const overrides = new Map<string, string>();
  for (const r of (overridesResult.data ?? []) as OverrideRow[]) {
    overrides.set(r.event_id, r.category_id);
  }

  const rows = eventRows.filter((r) => !excludedIds.has(r.id));
  if (rows.length === 0) return [];

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
