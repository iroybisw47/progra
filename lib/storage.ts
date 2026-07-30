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
  // The session's one photo: a storage path ({user_id}/{session_id}/photo.jpg)
  // into the private `session-photos` bucket, or null when not captured. It's
  // taken while the session runs and is just an attachment — it carries no
  // visibility of its own. Who can see it follows `isPrivate`, same as the
  // session itself.
  photoPath: string | null;
  // 10-hour cap provenance. `autoEndedAt` is set (ms) only when autoClockOut
  // ended this session at SESSION_CAP_MS — permanent proof that the duration
  // was machine-decided, not user-chosen. `isPrivate` alone can't express this:
  // an auto-ended session is private, but so is a deliberate draft.
  // `autoEndReviewedAt` is stamped once the user has seen and dealt with it,
  // which is what dismisses the review nudge. See lib/session.ts.
  autoEndedAt: number | null;
  autoEndReviewedAt: number | null;
};
