import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth/require-admin";
import { getAdminRoster, getAdminUserTimeline } from "@/lib/db/admin-analytics";
import { isUuid } from "@/lib/validate";

import { STATE_LABEL, Tag, fmtAgo, fmtHours } from "../../ui";

// One person's internal timeline: every event and logged action, newest
// first, as kinds and ids — never content. Admin-only like its parent.
export default async function AdminUserTimelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const [timeline, roster] = await Promise.all([
    getAdminUserTimeline(id, 300),
    getAdminRoster(true, null, null, null),
  ]);
  const user = roster?.users.find((u) => u.id === id) ?? null;
  // The RPC's clock, not Date.now(): one consistent "now" and no impure call
  // in a server component. Null only when the RPCs are not installed.
  const nowMs = roster ? Date.parse(roster.generatedAt) : null;
  const name = user?.displayName || (user?.username ? `@${user.username}` : user?.email) || id.slice(0, 8);

  return (
    <div className="flex w-full flex-col items-center px-5 pt-8 pb-16">
      <main className="flex w-full max-w-md flex-col gap-5">
        <header className="flex flex-col gap-1">
          <Link href="/admin/analytics?tab=onboarding" className="text-caption text-xs">
            ← Roster
          </Link>
          <h1 className="text-[22px] font-bold tracking-tight">{name}</h1>
          {user && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Tag tone="state">{STATE_LABEL[user.state]}</Tag>
              {user.isGhost && <Tag tone="ghost">ghost</Tag>}
              {user.isActivated && <Tag>activated</Tag>}
              {user.isInternal && <Tag>internal · {user.excludedReason ?? "?"}</Tag>}
              <span className="text-caption text-[11px]">
                {user.friendCount} friends · {fmtHours(user.hoursThisWeek)} this week · opened {fmtAgo(user.lastOpenedAt, nowMs)} · logged {fmtAgo(user.lastLoggedAt, nowMs)}
              </span>
            </div>
          )}
        </header>

        {timeline === null ? (
          <p className="text-caption text-sm">Timeline unavailable — the phase-4 RPCs aren&apos;t installed.</p>
        ) : timeline.length === 0 ? (
          <p className="text-caption text-sm">Nothing recorded yet.</p>
        ) : (
          <ol className="flex flex-col">
            {timeline.map((e, i) => (
              <li key={`${e.at}-${e.kind}-${i}`} className="border-hairline flex gap-3 border-t py-2 text-xs">
                <span className="text-caption w-[92px] shrink-0 tabular-nums">{e.at.replace("T", " ").slice(5, 16)}</span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-semibold">{e.kind.replace(/_/g, " ")}</span>
                  <span className="text-caption truncate">
                    {Object.entries(e.meta)
                      .filter(([, v]) => v !== null && v !== undefined && typeof v !== "object")
                      .map(([k, v]) => `${k}=${typeof v === "string" && isUuid(v) ? v.slice(0, 8) : String(v)}`)
                      .join(" · ")}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </main>
    </div>
  );
}
