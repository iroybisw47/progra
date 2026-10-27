import { BackButton } from "progra";

export function Default() {
  return <BackButton />;
}

// Overlay screens (Settings, a friend's profile) open with it beside the
// eyebrow title.
export function InHeader() {
  return (
    <div className="flex w-full items-center gap-3 px-5" style={{ maxWidth: 390 }}>
      <BackButton />
      <span className="section-label">Settings</span>
    </div>
  );
}
