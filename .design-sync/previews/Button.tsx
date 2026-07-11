import { Button } from "progra";

export function Variants() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button>Clock in</Button>
      <Button variant="outline">Add goal</Button>
      <Button variant="secondary">Sync calendar</Button>
      <Button variant="ghost">Skip</Button>
      <Button variant="destructive">Delete</Button>
      <Button variant="link">View recap</Button>
    </div>
  );
}

export function Sizes() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="xs">Mark done</Button>
      <Button size="sm">Mark done</Button>
      <Button size="default">Mark done</Button>
      <Button size="lg">Mark done</Button>
    </div>
  );
}

export function Disabled() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button disabled>Clock in</Button>
      <Button variant="outline" disabled>
        Add goal
      </Button>
    </div>
  );
}
