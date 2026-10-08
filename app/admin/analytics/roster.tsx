"use client";

import Link from "next/link";
import { useState } from "react";

import type { RosterUser } from "@/lib/admin-dashboard";

import { STATE_LABEL, Tag, fmtAgo, fmtHours } from "./ui";

type Filter = "all" | "active" | "ghosts" | "lapsed" | "stuck";
type Sort = "opened" | "logged" | "hours" | "friends" | "signup";

const FILTERS: [Filter, string][] = [
  ["all", "All"],
  ["active", "Active"],
  ["ghosts", "Ghosts"],
  ["lapsed", "Lapsed"],
  ["stuck", "Stuck"],
];

function matches(u: RosterUser, f: Filter): boolean {
  switch (f) {
    case "active": return u.state === "active";
    case "ghosts": return u.isGhost;
    case "lapsed": return u.state === "lapsed";
    case "stuck": return u.state === "not_onboarded";
    default: return true;
  }
}

function keyOf(u: RosterUser, s: Sort): number {
  const t = (iso: string | null) => (iso === null ? -1 : Date.parse(iso));
  switch (s) {
    case "opened": return t(u.lastOpenedAt);
    case "logged": return t(u.lastLoggedAt);
    case "hours": return u.hoursThisWeek;
    case "friends": return u.friendCount;
    default: return t(u.signedUpAt);
  }
}

// The full roster: a filter chip row, a sort, one card per person. Every card
// links to that person's internal timeline. Client-side only for the chips
// and the sort — the data is whatever the page fetched.
export function Roster({ users, nowMs }: { users: RosterUser[]; nowMs: number }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("opened");
  const shown = users.filter((u) => matches(u, filter)).sort((a, b) => keyOf(b, sort) - keyOf(a, sort));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {FILTERS.map(([f, label]) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={
              "rounded-full border px-2.5 py-0.5 font-semibold " +
              (filter === f ? "border-brand bg-brand text-primary-foreground" : "border-hairline text-caption")
            }
          >
            {label} <span className="tabular-nums opacity-70">{users.filter((u) => matches(u, f)).length}</span>
          </button>
        ))}
        <label className="ml-auto flex items-center gap-1">
          <span className="text-caption">Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="border-hairline rounded border px-1.5 py-0.5">
            <option value="opened">Last opened</option>
            <option value="logged">Last logged</option>
            <option value="hours">Hours this week</option>
            <option value="friends">Friends</option>
            <option value="signup">Signed up</option>
          </select>
        </label>
      </div>

      <ul className="flex flex-col gap-2">
        {shown.map((u) => {
          const name = u.displayName || (u.username ? `@${u.username}` : u.email) || "no name";
          return (
            <li key={u.id}>
              <Link
                href={`/admin/analytics/user/${u.id}`}
                className="border-hairline flex flex-col gap-2 rounded-lg border px-3 py-2.5 transition-transform active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold">{name}</span>
                    <span className="text-caption truncate text-[11px]">
                      {u.username ? `@${u.username}` : "no handle"} · {u.provider} · {u.segment === "uw" ? "UW" : "non-UW"}
                      {u.isInternal ? ` · internal (${u.excludedReason ?? "?"})` : ""}
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    <Tag tone="state">{STATE_LABEL[u.state]}</Tag>
                    {u.isGhost && <Tag tone="ghost">ghost</Tag>}
                    {u.isActivated && <Tag>activated</Tag>}
                    {u.seatNo === null && <Tag>waitlisted</Tag>}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-x-2 gap-y-1 text-[11px] tabular-nums">
                  <Cell k="Friends" v={String(u.friendCount)} />
                  <Cell k="Hours 7d" v={fmtHours(u.hoursThisWeek)} />
                  <Cell k="Clock-ins · habits 7d" v={`${u.clockIns7d} · ${u.habitChecks7d}`} />
                  <Cell k="Opened 7d" v={`${u.daysOpened7d}d · ${u.opens7d}×`} />
                  <Cell k="Interactions 7d" v={`${u.interactionsGiven7d} → · ← ${u.interactionsReceived7d}`} />
                  <Cell k="Notifications 7d" v={`${u.notificationsOpened7d} / ${u.notificationsReceived7d} opened`} />
                  <Cell k="Last opened" v={fmtAgo(u.lastOpenedAt, nowMs)} />
                  <Cell k="Last logged" v={fmtAgo(u.lastLoggedAt, nowMs)} />
                  <Cell
                    k={u.state === "not_onboarded" ? "Onboarding step" : "Permission"}
                    v={u.state === "not_onboarded" ? `${u.onboardingStep ?? "?"}${u.onboardingStepInferred ? " (inferred)" : ""}` : u.notificationPermission ?? "unknown"}
                  />
                </div>
              </Link>
            </li>
          );
        })}
        {shown.length === 0 && <li className="text-caption text-sm">Nobody matches.</li>}
      </ul>
    </div>
  );
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="text-caption truncate">{k}</span>
      <span className="truncate font-semibold">{v}</span>
    </div>
  );
}
