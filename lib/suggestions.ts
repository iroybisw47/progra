// Shared suggestion constants/types. Kept out of the "use server" action file
// (which may only export async functions) so the action, the sheet and the admin
// panel all agree on the allowed values. The DB CHECK constraint enforces the
// same status set.
//
// Deliberately NOT part of lib/bug-reports.ts, and `suggestions` is its own
// table rather than a `kind` column on `bug_reports`. A bug needs reproduction
// context — route, platform, user agent, viewport, build sha — and a suggestion
// needs none of it, so sharing the table would mean five permanently-null
// columns and a kind filter on every read. The triage verbs differ too: a bug is
// resolved or dismissed, an idea is accepted or declined.

export const SUGGESTION_BODY_MAX = 1000;

export const SUGGESTION_STATUSES = ["open", "accepted", "declined"] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

export const SUGGESTION_STATUS_LABELS: Record<SuggestionStatus, string> = {
  open: "Open",
  accepted: "Accepted",
  declined: "Declined",
};

export function isSuggestionStatus(v: string): v is SuggestionStatus {
  return (SUGGESTION_STATUSES as readonly string[]).includes(v);
}
