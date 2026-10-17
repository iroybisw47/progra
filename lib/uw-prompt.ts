// The UW info prompt: who is asked for their majors and interests, and how.
//
// Members who onboarded before the UW question existed were never asked, and
// the only way in, Settings → Edit profile, is somewhere nobody looks. So they
// are asked once, in a sheet on Progress (components/v2/uw-prompt-sheet.tsx),
// and a card on the Friends tab keeps the way back in until they answer.
// profiles.uw_prompt remembers it across devices (.claude/plans/uw-prompt.sql):
//
//   null    never asked — the sheet opens on the next Progress load
//   'later' put away unanswered — no sheet, the Friends card stays
//   'done'  answered (Yes and saved, or No), or the card's ✕ — nothing
//
// Only members OUTSIDE the cohort are asked: anyone already registered as a
// UW student (is_uw) has found the UW block already, filled in or not, and is
// never shown either.
//
// Pure, so lib/uw-prompt.test.ts pins every case.

export const UW_PROMPT_STAMPS = ["later", "done"] as const;
export type UwPromptStamp = (typeof UW_PROMPT_STAMPS)[number];

export function isUwPromptStamp(value: unknown): value is UwPromptStamp {
  return value === "later" || value === "done";
}

// What the gate reads off the profile. Every key is optional for the reason
// they are on Profile: before the SQL runs PostgREST leaves uw_prompt out.
export type UwPromptProfile = {
  onboarded_at?: string | null;
  uw_prompt?: string | null;
  is_uw?: boolean | null;
};

export type UwPromptShow = { sheet: boolean; card: boolean };

const NONE: UwPromptShow = { sheet: false, card: false };

// Whether to open the sheet on Progress, and whether to show the Friends card.
//
// FAILS CLOSED like patch_notes_seen_version: an absent uw_prompt key means the
// column doesn't exist yet, and in that world the stamp fails too, so treating
// it as "never asked" would open an undismissable sheet on every load. Strict
// `=== undefined` shows nothing.
//
// A UW student is never asked, whatever the column says, so joining from
// Settings or onboarding v3 is honoured even before it was stamped.
export function uwPromptFor(
  profile: UwPromptProfile | null | undefined,
  uwOn: boolean,
): UwPromptShow {
  if (!uwOn || !profile) return NONE;
  if (profile.onboarded_at == null) return NONE;
  if (profile.is_uw === true) return NONE;
  const stamp = profile.uw_prompt;
  if (stamp === undefined) return NONE;
  if (stamp === null) return { sheet: true, card: true };
  if (stamp === "later") return { sheet: false, card: true };
  return NONE;
}

export const UW_PROMPT_COPY = {
  askTitle: "Are you a UW student?",
  askBody:
    "You can now connect with other UW students on Progra. Fill out your major and interests to find people in your major and people into the same things.",
  yes: "Yes, I'm at UW",
  no: "No",
  later: "Not now",
  fieldsTitle: "Your UW info",
  // Above the fields, once Yes is tapped.
  fieldsIntro:
    "You can now connect with other UW students. Fill out your info to find people in your major and with your interests.",
  fieldsBody: "You can change these anytime in Settings → Edit profile.",
  save: "Save",
  saving: "Saving…",
  saved: "Saved. Your UW groups are on the Friends tab.",
  savedNoGroups: "Saved your UW info.",
  cardTitle: "Connect with UW students",
  cardBody: "At UW? Fill out your major and interests to connect.",
  cardDismiss: "Don't ask again",
} as const;
