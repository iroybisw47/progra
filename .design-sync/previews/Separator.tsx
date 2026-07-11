import { Separator } from "progra";

export function BetweenSections() {
  return (
    <div className="flex flex-col gap-3 w-full max-w-sm">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">This week</span>
        <span className="text-sm text-muted-foreground">
          12h 40m across 9 sessions
        </span>
      </div>
      <Separator />
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">Last week</span>
        <span className="text-sm text-muted-foreground">
          15h 05m across 11 sessions
        </span>
      </div>
    </div>
  );
}

export function Vertical() {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span>Deep work 6h 20m</span>
      <Separator orientation="vertical" className="h-4" />
      <span>Uni 4h 10m</span>
      <Separator orientation="vertical" className="h-4" />
      <span>Gym 2h 10m</span>
    </div>
  );
}
