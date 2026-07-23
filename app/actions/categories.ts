"use server";

import { isCategoryColor } from "@/lib/category-colors";
import { revalidateCategorySurfaces } from "@/lib/revalidate";
import { getCurrentUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { error: string; code?: "duplicate" };

// Keyword auto-categorization rules live in the JSON `rules` column
// ({ titleContains: string[] }); lib/categorize.ts reads it to classify imported
// calendar events. The column already exists — this just adds a write path.
// Sanitize: trim, drop empties, dedupe (case-insensitive), cap count/length.
const MAX_KEYWORDS = 20;
const MAX_KEYWORD_LEN = 50;

function sanitizeKeywords(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const v = item.trim().slice(0, MAX_KEYWORD_LEN);
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length >= MAX_KEYWORDS) break;
  }
  return out;
}

export async function createCategory(
  name: string,
  opts?: { color?: string | null; keywords?: string[] }
): Promise<Result> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name required" };

  const insert: Record<string, unknown> = { name: trimmed };
  if (opts?.color !== undefined && opts.color !== null) {
    if (!isCategoryColor(opts.color)) {
      return { error: "Pick a color from the palette" };
    }
    insert.color = opts.color;
  }
  if (opts?.keywords !== undefined) {
    insert.rules = { titleContains: sanitizeKeywords(opts.keywords) };
  }

  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("categories")
    .insert({ user_id: user.id, ...insert });

  if (error) {
    // 23505 = unique_violation (postgres). Surface as a typed duplicate so UI
    // can silently dedupe instead of showing an error toast.
    if (error.code === "23505") return { error: "Category already exists", code: "duplicate" };
    return { error: error.message };
  }

  revalidateCategorySurfaces();
  return { ok: true };
}

type UpdateCategoryPatch = {
  name?: string;
  // A palette hex value, or null to clear. Omit to leave untouched.
  color?: string | null;
  // Keyword auto-categorization rules; omit to leave untouched, [] to clear.
  keywords?: string[];
};

export async function updateCategory(
  id: string,
  patch: UpdateCategoryPatch
): Promise<Result> {
  const update: Record<string, unknown> = {};

  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (!trimmed) return { error: "Name required" };
    update.name = trimmed;
  }
  if (patch.color !== undefined) {
    if (patch.color !== null && !isCategoryColor(patch.color)) {
      return { error: "Pick a color from the palette" };
    }
    update.color = patch.color;
  }
  if (patch.keywords !== undefined) {
    update.rules = { titleContains: sanitizeKeywords(patch.keywords) };
  }
  if (Object.keys(update).length === 0) return { ok: true };

  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update(update)
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { error: "Category already exists", code: "duplicate" };
    }
    return { error: error.message };
  }

  revalidateCategorySurfaces();
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<Result> {
  const supabase = await createClient();
  // FK on sessions.category_id is ON DELETE SET NULL — sessions stay,
  // just become uncategorized.
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidateCategorySurfaces();
  return { ok: true };
}
