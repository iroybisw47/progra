import { Card, CardContent } from "@/components/ui/card";
import { goalColorOf } from "@/lib/colors";

export type AdminGoal = {
  id: string;
  userId: string;
  username: string | null;
  displayName: string | null;
  title: string;
  weeklyQuotaHours: number;
  isPrivate: boolean;
  color: string | null;
};

type Person = {
  userId: string;
  username: string | null;
  displayName: string | null;
  goals: AdminGoal[];
};

// The RPC returns one flat row per goal, ordered by username then created_at.
// Grouping here (rather than in SQL) keeps the RPC a plain projection and lets
// the insertion order of the Map carry that ordering through unchanged.
function groupByPerson(goals: AdminGoal[]): Person[] {
  const byUser = new Map<string, Person>();
  for (const goal of goals) {
    const existing = byUser.get(goal.userId);
    if (existing) {
      existing.goals.push(goal);
      continue;
    }
    byUser.set(goal.userId, {
      userId: goal.userId,
      username: goal.username,
      displayName: goal.displayName,
      goals: [goal],
    });
  }
  return [...byUser.values()];
}

// Read-only, so this stays a server component — no "use client" like its
// siblings, which are client only because they own buttons.
export function AdminGoals({
  goals,
  installed,
}: {
  goals: AdminGoal[];
  installed: boolean;
}) {
  // An empty list and a missing RPC look identical, and only one of them means
  // "nobody has set a goal" — so say which.
  if (!installed) {
    return (
      <div className="flex w-full flex-col items-center px-5 pt-8">
        <div className="w-full max-w-md">
          <p className="text-caption text-sm">
            Goals unavailable — `admin_list_all_goals` isn&apos;t installed.
          </p>
        </div>
      </div>
    );
  }

  const people = groupByPerson(goals);

  return (
    <div className="flex w-full flex-col items-center px-5 pt-8">
      <main className="flex w-full max-w-md flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h1 className="text-[26px] font-bold tracking-tight">Everyone&apos;s goals</h1>
          <p className="text-caption text-sm">
            {people.length === 0
              ? "Nobody has an active goal yet."
              : `${goals.length} active ${goals.length === 1 ? "goal" : "goals"} across ${people.length} ${people.length === 1 ? "person" : "people"}.`}
          </p>
        </header>

        {people.map((person) => (
          <Card key={person.userId}>
            <CardContent className="flex flex-col gap-2 py-3.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {person.displayName ?? person.username ?? "no name set"}
                </span>
                <span className="text-caption shrink-0 text-xs">
                  {person.username ? `@${person.username}` : "no username"}
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                {person.goals.map((goal) => (
                  <div key={goal.id} className="flex items-center gap-2">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: goalColorOf(goal) }}
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px]">
                      {goal.title}
                    </span>
                    {goal.isPrivate && (
                      <span className="text-caption shrink-0 text-[10px] font-semibold tracking-[0.06em] uppercase">
                        private
                      </span>
                    )}
                    <span className="text-caption shrink-0 text-xs tabular-nums">
                      {goal.weeklyQuotaHours}h/wk
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
}
