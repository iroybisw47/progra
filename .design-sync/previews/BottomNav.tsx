import { BottomNav } from "progra";

// The nav is `position: fixed` to the viewport bottom. A transformed
// ancestor becomes the containing block for fixed descendants, so this
// wrapper pins it inside the card instead of escaping the capture.
// Five tabs: Progress · Feed · [Clock] · Friends · You — Clock is the raised
// center button.
export function Default() {
  return (
    <div
      style={{ transform: "translate(0)", position: "relative", height: 120 }}
      className="w-full"
    >
      <BottomNav activePath="/" />
    </div>
  );
}

// Read once at load, not during render: live timers count up from here.
const now = Date.now();

// While a session runs, the center button ticks the worked time.
export function Running() {
  return (
    <div
      style={{ transform: "translate(0)", position: "relative", height: 120 }}
      className="w-full"
    >
      <BottomNav
        activePath="/feed"
        activeSession={{ startedAt: now - 47 * 60_000, endedAt: null, pausedMs: 0, pausedSince: null }}
        initialFriendsBadge
      />
    </div>
  );
}
