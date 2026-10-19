import { requireUser } from "@/lib/auth/require-user";
import { getProfile } from "@/lib/auth/profile";
import { avatarPublicUrl } from "@/lib/images/avatar-url";
import {
  aggregateWeek,
  aggregateWeekByGoal,
  buildCategoryBreakdown,
} from "@/lib/aggregate";
import { listCategories } from "@/lib/db/categories";
import { listEventsInRange } from "@/lib/db/calendar-events";
import { getFriendRelations } from "@/lib/db/friends";
import { listActiveGoals } from "@/lib/db/goals";
import { listActiveHabits, listCompletionsInRange } from "@/lib/db/habits";
import { listRecentSessions } from "@/lib/db/sessions";
import { ONBOARDING_V3, REDESIGN, UW } from "@/lib/flags";
import { accountGoalsFrom, accountHabitsFrom } from "@/lib/onboarding-v3-goals-habits";
import { savedUwFrom } from "@/lib/onboarding-v3-uw";
import {
  endOfWeek,
  formatRange,
  startOfWeek,
  todayInTimeZone,
  weekRangeInTimeZone,
} from "@/lib/dates";

import { OnboardingClient } from "./onboarding-client";
import { OnboardingClientV2 } from "./onboarding-client-v2";
import { OnboardingClientV3 } from "./onboarding-client-v3";
import { STEPS, type Step } from "@/lib/onboarding";

const DAY_MS = 24 * 60 * 60 * 1000;

// First-run wizard. The legacy (pre-redesign) tour fetches the week snapshot
// Home renders so its steps show the user's REAL data. The redesign wizard just
// claims a handle and creates a goal — no session, no snapshot needed.
// `?step=<name>` jumps the redesign wizard straight to one step, so a step in
// the middle of the run can be looked at without walking the whole thing (and
// creating a real goal on the way). NEVER in production: it would let someone
// land on a later step having skipped the writes the earlier ones do.
function previewStep(raw: string | string[] | undefined): Step | undefined {
  if (process.env.NODE_ENV === "production") return undefined;
  const name = Array.isArray(raw) ? raw[0] : raw;
  return STEPS.includes(name as Step) ? (name as Step) : undefined;
}

export default async function OnboardingPage({
  searchParams,
}: {
  // Next 16: searchParams is a Promise and must be awaited.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();
  const initialStep = previewStep((await searchParams).step);

  const profile = await getProfile();
  const tz = profile?.timezone ?? "UTC";

  // The redesign wizard runs welcome → how Progra works → goal → practice
  // clock-in → notifications (shell only) → practice post → habits → friends →
  // invite → go. Calendar connect lives in History/Settings, not here.
  if (REDESIGN) {
    // Onboarding v3 (ONBOARDING_V3, which implies REDESIGN). This route is
    // Replay's, so onboarded_at is normally set: the wizard then starts from
    // the saved handle and offers its close control (plan D6). Off, v2 below
    // is unchanged, `?step=` previews included.
    //
    // Screens 2 and 3 open on the replayer's own active goals and habits, and
    // Continue writes only what they change, so a replay never adds a second
    // copy of something they already have (lib/onboarding-v3-goals-habits.ts).
    //
    // Screen 4's practice run previews the Progress tab with illustrative
    // data for everyone, so it reads nothing.
    //
    // Screen 5 reads the viewer's friendships, so its search results show a
    // replayer's friends as "Friends", their requests as "✓ Added" (and
    // undoable), and requests waiting on them as Accept.
    //
    // With UW on, the welcome's Continue raises the "Are you a UW student?"
    // sheet (P9c, OWNER-FIX-3), and a replayer already in the cohort finds it
    // open on the Yes bar with their majors, interests and listing as stored.
    // The columns come off the profile already read, and only with UW on:
    // before STEP 5 they don't exist.
    if (ONBOARDING_V3) {
      const replay = profile?.onboarded_at != null;
      const [goals, habits, relations] = await Promise.all([
        listActiveGoals(),
        listActiveHabits(),
        getFriendRelations(),
      ]);
      return (
        <OnboardingClientV3
          initialUsername={profile?.username ?? ""}
          initialDisplayName={profile?.display_name ?? null}
          avatarUrl={avatarPublicUrl(profile?.avatar_path ?? null)}
          replay={replay}
          existingGoals={accountGoalsFrom(goals)}
          existingHabits={accountHabitsFrom(habits)}
          relations={relations}
          uw={UW}
          savedUw={UW ? savedUwFrom(profile) : undefined}
        />
      );
    }
    return (
      <OnboardingClientV2
        initialUsername={profile?.username ?? ""}
        initialDisplayName={profile?.display_name ?? null}
        avatarUrl={avatarPublicUrl(profile?.avatar_path ?? null)}
        initialStep={initialStep}
      />
    );
  }

  const { startDate, endDate } = weekRangeInTimeZone(tz);
  const today = todayInTimeZone(tz);

  const now = new Date();
  const weekStartMs = startOfWeek(now).getTime();
  const weekEndMs = endOfWeek(now).getTime();

  const [categories, sessions, habits, completions, goals] = await Promise.all([
    listCategories(),
    listRecentSessions(),
    listActiveHabits(),
    listCompletionsInRange(startDate, endDate),
    listActiveGoals(),
  ]);
  const events = await listEventsInRange(
    weekStartMs - DAY_MS,
    weekEndMs + DAY_MS,
    categories
  );

  const weekly = aggregateWeek(sessions, events, now.getTime());
  const categoryBreakdown = buildCategoryBreakdown(
    weekly.perCategory,
    categories,
    goals
  );
  const goalWeekly = aggregateWeekByGoal(sessions, now.getTime());
  const goalBreakdown = goals
    .map((g) => ({
      id: g.id,
      title: g.title,
      quotaHours: g.weeklyQuotaHours,
      actualMs: goalWeekly.perGoal.get(g.id) ?? 0,
    }))
    .sort((a, b) => b.actualMs - a.actualMs);

  // A replay can start while a real session is still running — the practice
  // step adopts it instead of failing the one-active-session constraint.
  const active = sessions.find((s) => s.endedAt === null) ?? null;

  return (
    <OnboardingClient
      goals={goals}
      weeklyTotalMs={weekly.total}
      categoryBreakdown={categoryBreakdown}
      goalBreakdown={goalBreakdown}
      habits={habits}
      completions={completions}
      weekStart={startDate}
      today={today}
      weekRangeLabel={formatRange(startOfWeek(now), endOfWeek(now))}
      activeSession={
        active
          ? {
              taskName: active.taskName,
              startedAt: active.startedAt,
            }
          : null
      }
      initialUsername={profile?.username ?? ""}
    />
  );
}
