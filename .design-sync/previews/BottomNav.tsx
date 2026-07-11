import { BottomNav } from "progra";

// The nav is `position: fixed` to the viewport bottom. A transformed
// ancestor becomes the containing block for fixed descendants, so this
// wrapper pins it inside the card instead of escaping the capture.
export function Default() {
  return (
    <div
      style={{ transform: "translate(0)", position: "relative", height: 120 }}
      className="w-full"
    >
      <BottomNav />
    </div>
  );
}
