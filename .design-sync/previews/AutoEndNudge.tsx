import { AutoEndNudge } from "progra";

// Progress banner after a session hit the 10h cap and was ended for you.
export function Default() {
  return (
    <div className="w-full px-5" style={{ maxWidth: 390 }}>
      <AutoEndNudge sessionId="s1" />
    </div>
  );
}
