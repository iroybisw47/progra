import { Badge } from "progra";

export function Variants() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge>Deep work</Badge>
      <Badge variant="secondary">Uni</Badge>
      <Badge variant="outline">Calendar</Badge>
      <Badge variant="destructive">Overdue</Badge>
      <Badge variant="ghost">Skipped</Badge>
      <Badge variant="link">View recap</Badge>
    </div>
  );
}

export function SessionTags() {
  return (
    <div className="flex flex-col gap-3 max-w-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm">Thesis writing</span>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="h-5">
            Deep work
          </Badge>
          <Badge variant="outline" className="h-5">
            Calendar
          </Badge>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm">Leg day</span>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="h-5">
            Gym
          </Badge>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm">Inbox triage</span>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="h-5">
            Uncategorized
          </Badge>
        </div>
      </div>
    </div>
  );
}

export function WithIcon() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline" className="gap-1">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="14" y="4" width="4" height="16" rx="1" />
          <rect x="6" y="4" width="4" height="16" rx="1" />
        </svg>
        Paused
      </Badge>
      <Badge variant="secondary">Deep work — 1h 45m</Badge>
    </div>
  );
}
