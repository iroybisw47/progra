import { Input, Label } from "progra";

export function Default() {
  return <Label>Weekly quota (hours)</Label>;
}

export function PairedWithInput() {
  return (
    <div className="flex flex-col gap-2 w-full max-w-sm">
      <Label htmlFor="habit-name">Habit name</Label>
      <Input
        id="habit-name"
        className="h-10"
        placeholder="Drink water, read 30m, …"
      />
    </div>
  );
}

export function DisabledGroup() {
  return (
    <div data-disabled="true" className="group flex flex-col gap-2 w-full max-w-sm">
      <Label htmlFor="cal-id">Calendar</Label>
      <Input id="cal-id" disabled defaultValue="tapa@quantluxdigital.io" />
    </div>
  );
}
