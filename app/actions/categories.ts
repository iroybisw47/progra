"use server";

import { revalidatePath } from "next/cache";

import { isCategoryColor } from "@/lib/category-colors";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { error: string; code?: "duplicate" };

export async function createCategory(name: string): Promise<Result> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name required" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("categories")
    .insert({ user_id: user.id, name: trimmed });

  if (error) {
    // 23505 = unique_violation (postgres). Surface as a typed duplicate so UI
    // can silently dedupe instead of showing an error toast.
    if (error.code === "23505") return { error: "Category already exists", code: "duplicate" };
    return { error: error.message };
  }

  revalidatePath("/clock");
  return { ok: true };
}

type UpdateCategoryPatch = {
  name?: string;
  // A palette hex value, or null to clear. Omit to leave untouched.
  color?: string | null;
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

  // Category names/colors render on every aggregation surface.
  revalidatePath("/");
  revalidatePath("/clock");
  revalidatePath("/history");
  revalidatePath("/recap");
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<Result> {
  const supabase = await createClient();
  // FK on sessions.category_id is ON DELETE SET NULL — sessions stay,
  // just become uncategorized.
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/clock");
  return { ok: true };
}
