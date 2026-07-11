import { Input, Label } from "progra";

export function Default() {
  return (
    <div className="flex flex-col gap-3 w-full max-w-sm">
      <Input placeholder="What were you working on?" />
      <Input defaultValue="Thesis — results chapter" />
    </div>
  );
}

export function WithLabel() {
  return (
    <div className="flex flex-col gap-2 w-full max-w-sm">
      <Label htmlFor="goal-title">Goal title</Label>
      <Input
        id="goal-title"
        className="h-10"
        placeholder="Reading, deep work, …"
      />
    </div>
  );
}

export function DateAndTime() {
  return (
    <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
      <Input
        type="date"
        aria-label="Start date"
        className="h-10 font-mono"
        defaultValue="2026-07-10"
      />
      <Input
        type="time"
        aria-label="Start time"
        className="h-10 font-mono"
        defaultValue="09:30"
      />
    </div>
  );
}

export function States() {
  return (
    <div className="flex flex-col gap-3 w-full max-w-sm">
      <Input disabled defaultValue="Synced from Google Calendar" />
      <Input
        aria-invalid="true"
        defaultValue="-3"
        aria-label="Weekly quota (hours)"
      />
    </div>
  );
}
