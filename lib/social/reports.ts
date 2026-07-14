// Shared report constants/types. Kept out of the "use server" action file
// (which may only export async functions) so the action, dialog, and admin page
// all agree on the allowed values. The DB CHECK constraints enforce the same set.
export const REPORT_REASONS = [
  "spam",
  "inappropriate",
  "harassment",
  "other",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: "Spam",
  inappropriate: "Inappropriate / NSFW",
  harassment: "Harassment",
  other: "Other",
};

export type ReportTargetType = "story" | "comment" | "profile";

export const REPORT_NOTE_MAX = 500;

export function isReportReason(v: string): v is ReportReason {
  return (REPORT_REASONS as readonly string[]).includes(v);
}
