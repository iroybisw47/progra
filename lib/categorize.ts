import type { CategoryRules } from "@/lib/storage";

// Returns the first category whose rules.titleContains has a substring match
// (case-insensitive) against `title`. Order matters — sort categories by
// priority before calling. Returns null if no rule matches.
export function categorizeTitle<C extends { rules: CategoryRules }>(
  title: string | null,
  categories: C[]
): C | null {
  if (!title) return null;
  const lowered = title.toLowerCase();
  for (const cat of categories) {
    const keywords = cat.rules?.titleContains;
    if (!keywords || keywords.length === 0) continue;
    for (const kw of keywords) {
      if (kw && lowered.includes(kw.toLowerCase())) return cat;
    }
  }
  return null;
}
