// The little row marker in category breakdowns (Progress, /clock, /history,
// recap, feed posts). Every entity — goal or category — now owns a palette
// color, so both render the same small square in it; only Uncategorized (no
// color at all) renders nothing.
export function CategoryMarker({
  isGoal,
  color,
}: {
  isGoal: boolean;
  color: string | null;
}) {
  void isGoal;
  if (!color) return null;
  return (
    <span
      aria-hidden
      className="size-2 shrink-0 rounded-[2px]"
      style={{ backgroundColor: color }}
    />
  );
}
