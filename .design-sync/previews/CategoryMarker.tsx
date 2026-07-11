import { CategoryMarker } from "progra";

export function Markers() {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex items-center gap-2">
        <CategoryMarker isGoal color={null} />
        <span>Read 5h / week (goal)</span>
      </div>
      <div className="flex items-center gap-2">
        <CategoryMarker isGoal={false} color="#4f9b8c" />
        <span>Deep work</span>
      </div>
      <div className="flex items-center gap-2">
        <CategoryMarker isGoal={false} color="#5f87c0" />
        <span>Uni</span>
      </div>
      <div className="flex items-center gap-2">
        <CategoryMarker isGoal={false} color="#c96f5e" />
        <span>Gym</span>
      </div>
    </div>
  );
}

export function BreakdownRows() {
  return (
    <div className="flex flex-col gap-2 w-full max-w-sm text-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CategoryMarker isGoal={false} color="#4f9b8c" />
          <span>Deep work</span>
        </div>
        <span className="text-muted-foreground tabular-nums">6h 20m</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CategoryMarker isGoal color={null} />
          <span>Read 5h / week</span>
        </div>
        <span className="text-muted-foreground tabular-nums">3h 45m</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CategoryMarker isGoal={false} color={null} />
          <span>Uncategorized</span>
        </div>
        <span className="text-muted-foreground tabular-nums">0h 50m</span>
      </div>
    </div>
  );
}
