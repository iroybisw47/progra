"use server";

import { revalidatePath } from "next/cache";

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

export async function deleteCategory(id: string): Promise<Result> {
  const supabase = await createClient();
  // FK on sessions.category_id is ON DELETE SET NULL — sessions stay,
  // just become uncategorized.
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/clock");
  return { ok: true };
}
