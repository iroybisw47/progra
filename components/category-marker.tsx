import { StarIcon } from "lucide-react";

// The little row marker in category breakdowns (home week card, /clock week,
// /history, recap). Goal rows get a small filled star; category rows keep
// their color dot; colorless categories/Uncategorized render nothing — same
// as before. `fill-foreground` reads as black on the light theme and stays
// visible on the clock screen's dark mode.
export function CategoryMarker({
  isGoal,
  color,
}: {
  isGoal: boolean;
  color: string | null;
}) {
  if (isGoal) {
    return (
      <StarIcon
        aria-hidden
        className="fill-foreground text-foreground size-2.5 shrink-0"
      />
    );
  }
  if (!color) return null;
  return (
    <span
      aria-hidden
      className="size-2 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}
