import { WeekStrip } from "progra";

// Week of Mon 6 – Sun 12 Jul 2026 (today in-app is Fri 10 Jul).
const noop = () => {};

export function MidWeekSelected() {
  return (
    <div className="w-full max-w-sm">
      <WeekStrip
        selectedDate={new Date(2026, 6, 8)}
        today={new Date(2026, 6, 10)}
        onSelect={noop}
        markedDates={
          new Set(["2026-07-06", "2026-07-07", "2026-07-08", "2026-07-10"])
        }
      />
    </div>
  );
}

export function TodaySelected() {
  return (
    <div className="w-full max-w-sm">
      <WeekStrip
        selectedDate={new Date(2026, 6, 10)}
        today={new Date(2026, 6, 10)}
        onSelect={noop}
        markedDates={new Set(["2026-07-06", "2026-07-09", "2026-07-10"])}
      />
    </div>
  );
}

export function QuietWeek() {
  return (
    <div className="w-full max-w-sm">
      <WeekStrip
        selectedDate={new Date(2026, 6, 6)}
        today={new Date(2026, 6, 10)}
        onSelect={noop}
        markedDates={new Set<string>()}
      />
    </div>
  );
}
