import { WhatsNewModal } from "progra";

// One release note, shown once at login after a release.
export function Release() {
  return (
    <WhatsNewModal
      version="2026.10.06"
      title="Reply to comments"
      intro="Conversations on your sessions can finally go back and forth."
      items={[
        "Tap Reply under any comment to answer it directly.",
        "You'll get a push when someone replies to you.",
        "Your week's recap now unlocks at 6pm Sunday, your time.",
      ]}
    />
  );
}
