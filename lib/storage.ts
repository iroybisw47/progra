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
  // A session is attributed to EITHER a category OR a goal (mutually
  // exclusive; enforced at clock-in and in updateSession).
  categoryId: string | null;
  goalId: string | null;
  taskName: string;
  description?: string;
  startedAt: number;
  endedAt: number | null;
  // Pause tracking. `startedAt`/`endedAt` stay real wall-clock times; worked
  // time = (end - start) - pausedMs - (current pause). `pausedMs` is banked
  // paused time from resumed pauses; `pausedSince` is set (ms) only while the
  // session is currently paused, null otherwise. See lib/session.ts.
  pausedMs: number;
  pausedSince: number | null;
  // Social v2: false = visible to accepted friends (once Aspect 4 lands), true
  // = owner-only. Inert until then.
  isPrivate: boolean;
  // Phase 3 photos: storage paths ({user_id}/{session_id}/before|after.jpg) into
  // the private `session-photos` bucket, or null when not captured. A session
  // surfaces on a profile only when BOTH are set (visibility is derived from
  // this pair, never stored as a boolean).
  beforePhotoPath: string | null;
  afterPhotoPath: string | null;
};
