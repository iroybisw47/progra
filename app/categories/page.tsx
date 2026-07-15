import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/require-user";
import { REDESIGN } from "@/lib/flags";
import { listCategories } from "@/lib/db/categories";

import { CategoriesClient } from "./categories-client";

// Standalone Categories management (V2). Previously categories were editable
// only inline on the clock screen; this surfaces them under Settings → Your data
// with color + keyword auto-categorization rules. Flag-gated.
export default async function CategoriesPage() {
  if (!REDESIGN) notFound();
  await requireUser();
  const categories = await listCategories();
  return <CategoriesClient categories={categories} />;
}
