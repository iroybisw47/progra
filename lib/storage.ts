// Shared data types. App data lives in Supabase — see app/actions/* for
// mutations and lib/db/* for reads. This file is types-only now; the previous
// localStorage helpers were removed when /clock and /calendar moved to the DB.

export type CategoryRules = {
  titleContains?: string[];
};

export type Category = {
  id: string;
  name: string;
  color: string | null;
  rules: CategoryRules;
  createdAt: number;
};

export type Session = {
  id: string;
  categoryId: string | null;
  sessionPlanId: string | null;
  taskName: string;
  description?: string;
  startedAt: number;
  endedAt: number | null;
};
