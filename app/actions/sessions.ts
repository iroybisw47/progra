"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { error: string };

type ClockInInput = {
  categoryId: string;
  taskName: string;
  description?: string;
};

export async function clockIn(input: ClockInInput): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("sessions").insert({
    user_id: user.id,
    category_id: input.categoryId,
    task_name: input.taskName.trim(),
    description: input.description?.trim() || null,
    started_at: new Date().toISOString(),
    ended_at: null,
  });

  if (error) {
    // Partial unique index enforces one active session per user.
    if (error.code === "23505") {
      return { error: "Already clocked in to another task" };
    }
    return { error: error.message };
  }

  revalidatePath("/clock");
  return { ok: true };
}

export async function clockOut(): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("ended_at", null);

  if (error) return { error: error.message };
  revalidatePath("/clock");
  return { ok: true };
}

type CreateSessionInput = {
  categoryId: string;
  taskName: string;
  description?: string;
  startedAt: number; // ms
  endedAt: number; // ms
};

export async function createSession(input: CreateSessionInput): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("sessions").insert({
    user_id: user.id,
    category_id: input.categoryId,
    task_name: input.taskName.trim(),
    description: input.description?.trim() || null,
    started_at: new Date(input.startedAt).toISOString(),
    ended_at: new Date(input.endedAt).toISOString(),
  });

  if (error) return { error: error.message };
  revalidatePath("/clock");
  return { ok: true };
}

type UpdateSessionPatch = {
  categoryId?: string;
  taskName?: string;
  description?: string;
  startedAt?: number;
  endedAt?: number | null;
};

export async function updateSession(
  id: string,
  patch: UpdateSessionPatch
): Promise<Result> {
  const supabase = await createClient();
  const update: Record<string, unknown> = {};
  if (patch.categoryId !== undefined) update.category_id = patch.categoryId;
  if (patch.taskName !== undefined) update.task_name = patch.taskName.trim();
  if (patch.description !== undefined) {
    update.description = patch.description.trim() || null;
  }
  if (patch.startedAt !== undefined) {
    update.started_at = new Date(patch.startedAt).toISOString();
  }
  if (patch.endedAt !== undefined) {
    update.ended_at = patch.endedAt === null ? null : new Date(patch.endedAt).toISOString();
  }

  const { error } = await supabase.from("sessions").update(update).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/clock");
  return { ok: true };
}

export async function deleteSession(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("sessions").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/clock");
  return { ok: true };
}
