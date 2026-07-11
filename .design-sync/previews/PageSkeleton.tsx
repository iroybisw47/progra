import { PageSkeleton } from "progra";

// Loading states for app routes (app/loading.tsx, app/habits/loading.tsx).
export function Home() {
  return (
    <div className="w-full">
      <PageSkeleton
        title="Progra"
        subtitle="Where your week is going."
        blocks={2}
      />
    </div>
  );
}

export function WithDayStrip() {
  return (
    <div className="w-full">
      <PageSkeleton
        title="Habits"
        subtitle="Today's check-list."
        blocks={1}
        showDayStrip
      />
    </div>
  );
}
