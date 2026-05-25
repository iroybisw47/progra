import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/storage";

type CategoryRow = {
  id: string;
  name: string;
  color: string | null;
  rules: unknown;
  created_at: string;
};

function rowToCategory(row: CategoryRow): Category {
  const raw = (row.rules ?? {}) as { titleContains?: unknown };
  const titleContains = Array.isArray(raw.titleContains)
    ? raw.titleContains.filter((x): x is string => typeof x === "string")
    : undefined;
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    rules: { titleContains },
    createdAt: new Date(row.created_at).getTime(),
  };
}

export async function listCategories(): Promise<Category[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("id, name, color, rules, created_at")
    .order("created_at", { ascending: true });
  if (!data) return [];
  return (data as CategoryRow[]).map(rowToCategory);
}
