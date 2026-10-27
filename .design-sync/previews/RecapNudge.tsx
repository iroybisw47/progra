import { RecapNudge } from "progra";

// Progress banner on Sunday evening once the week's recap unlocks.
export function Default() {
  return (
    <div className="w-full px-5" style={{ maxWidth: 390 }}>
      <RecapNudge weekStart="2026-10-05" />
    </div>
  );
}
