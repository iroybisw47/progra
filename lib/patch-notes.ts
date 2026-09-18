// Release notes for the in-app "What's new" modal, authored here rather than in
// a DB table: they ship in the same deploy as the thing they announce, so a
// separate editor would only be a second place to forget.
//
// NEWEST FIRST — index 0 is the only entry anyone is ever shown. Appending to
// the bottom is the mistake this file invites; the test asserts the order.
//
// `version` is the DB key, written to profiles.patch_notes_seen_version. Once an
// entry has shipped its version string is FROZEN: editing it re-shows that note
// to everyone who already dismissed it. (Which is also the only way to
// deliberately re-show one.) The format is a patch number, `major.minor` — it's
// how the notes talk about themselves ("This is patch 1.1"), so the key and the
// copy can't drift apart.
//
// Deliberately no `date` field: nothing renders one, and two hand-authored
// fields can disagree. Add it alongside whatever first displays it.

export type PatchNote = {
  version: string;
  title: string;
  // Optional prose above the bullets. Used for the welcome note that explains
  // what this window IS; most releases won't need one and go straight to items.
  intro?: string;
  items: string[];
};

export const PATCH_NOTES: readonly PatchNote[] = [
  {
    version: "1.1",
    title: "Welcome to Progra patch notes!",
    intro:
      "Every time a huge bundle of features is available I'll have a window explaining what they are. This patch includes:",
    items: [
      "History tab: look at your stats for the month or year",
      "A new color palette, courtesy of Head of Design at Progra, Jillian Growney",
      "Revamped settings",
      "Edit your goals and habits on the You page",
      "Share Progra with your friends — go to Settings and press Share",
    ],
  },
];

// Null when there is nothing to announce — which is also this feature's off
// switch: an empty PATCH_NOTES shows nobody anything and stamps nobody. There is
// no NEXT_PUBLIC_ flag on purpose; flipping one would need the same redeploy
// this array does, so it would buy no agility and add a fourth "don't show"
// branch to reason about.
export const LATEST_PATCH_VERSION: string | null =
  PATCH_NOTES[0]?.version ?? null;

// Which note, if any, this user should be shown.
//
// READ THE `undefined` CASE BEFORE CHANGING THE FIRST LINE. `seen` is
// profiles.patch_notes_seen_version, which is OPTIONAL on the Profile type:
// before the column SQL is run PostgREST omits the key entirely and it reads
// back `undefined`. That must mean DON'T SHOW, because in that same world the
// dismiss write also fails (PGRST204, no such column) — so showing it would
// reopen this modal on every page load for every user, permanently, with no way
// out but a deploy. `null` is the opposite case: the column exists and this user
// has never been stamped, so they get the note.
//
// Hence `=== undefined`, never `== null`, which collapses the two states that
// have to differ. It looks like a typo. It is the whole safety of the feature.
//
// Anything else that isn't the newest version — an older entry, or a string this
// build doesn't recognise — gets the newest note. Only ever the newest, never a
// queue of everything missed: a queue would need ordering semantics on the
// version string, and this needs none.
//
// `notes` is a parameter so the tests can cover the empty and multi-entry cases
// without editing the real list.
export function patchNoteToShow(
  seen: string | null | undefined,
  notes: readonly PatchNote[] = PATCH_NOTES
): PatchNote | null {
  if (seen === undefined) return null;
  const latest = notes[0];
  if (!latest) return null;
  return seen === latest.version ? null : latest;
}

// Guards the stamp: a client can only ever write back a version this build
// actually authored, so a stale bundle or a hand-rolled PostgREST request can't
// park arbitrary text in the column.
export function isKnownPatchVersion(
  version: string,
  notes: readonly PatchNote[] = PATCH_NOTES
): boolean {
  return notes.some((n) => n.version === version);
}
