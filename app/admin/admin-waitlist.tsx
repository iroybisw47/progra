"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { grantBetaSeat, setBetaSeatCap } from "@/app/actions/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type WaitlistEntry = {
  userId: string;
  position: number;
  email: string | null;
  displayName: string | null;
  username: string | null;
  joinedAt: string;
};

export type BetaOverview = {
  seatCap: number;
  seated: number;
  waiting: number;
};

export function AdminWaitlist({
  overview,
  entries,
}: {
  overview: BetaOverview | null;
  entries: WaitlistEntry[];
}) {
  const [pending, startTransition] = useTransition();
  const [capDraft, setCapDraft] = useState(
    overview ? String(overview.seatCap) : ""
  );

  // The RPCs aren't installed — say so instead of rendering an empty panel
  // that looks like "nobody is waiting".
  if (!overview) {
    return (
      <div className="flex w-full flex-col items-center px-5 pt-8">
        <div className="w-full max-w-md">
          <p className="text-caption text-sm">
            Beta capacity unavailable — the admin RPCs aren&apos;t installed.
          </p>
        </div>
      </div>
    );
  }

  const full = overview.seated >= overview.seatCap;

  function grant(entry: WaitlistEntry) {
    startTransition(async () => {
      const r = await grantBetaSeat(entry.userId);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(`Seat ${r.seat} granted to ${entry.email ?? "them"}.`);
    });
  }

  function saveCap() {
    const next = Number(capDraft);
    if (!Number.isInteger(next) || next < 0) {
      toast.error("Cap must be a whole number.");
      return;
    }
    startTransition(async () => {
      const r = await setBetaSeatCap(next);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(`Cap set to ${next}.`);
    });
  }

  return (
    <div className="flex w-full flex-col items-center px-5 pt-8">
      <main className="flex w-full max-w-md flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h1 className="text-[26px] font-bold tracking-tight">Beta capacity</h1>
          <p className="text-caption text-sm">
            {overview.seated} of {overview.seatCap} seats taken
            {overview.waiting > 0
              ? ` · ${overview.waiting} waiting`
              : " · nobody waiting"}
            .
          </p>
        </header>

        {/* The cap. Lowering it never evicts anyone — it gates new claims only. */}
        <Card>
          <CardContent className="flex items-end gap-3 py-4">
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-caption text-xs font-semibold">Seat cap</span>
              <input
                type="number"
                min={0}
                value={capDraft}
                onChange={(e) => setCapDraft(e.target.value)}
                className="border-control-border h-10 w-full rounded-[11px] border-[1.5px] px-3 text-sm"
              />
            </label>
            <Button
              onClick={saveCap}
              disabled={pending || capDraft === String(overview.seatCap)}
            >
              Save
            </Button>
          </CardContent>
        </Card>

        {full && overview.waiting > 0 && (
          <p className="text-caption text-xs">
            Every seat is taken, so granting will fail. Raise the cap first, or
            wait for a seat to free up — a deleted account releases its number
            and the next claim reuses it.
          </p>
        )}

        {entries.length === 0 ? (
          <p className="text-caption text-sm">Nobody is on the waitlist.</p>
        ) : (
          entries.map((entry) => (
            <Card key={entry.userId}>
              <CardContent className="flex flex-col gap-3 py-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="bg-brand/10 text-brand rounded-full px-2.5 py-0.5 text-xs font-bold">
                    #{entry.position}
                  </span>
                  <span className="text-caption text-xs">
                    {new Date(entry.joinedAt).toLocaleDateString()}
                  </span>
                </div>

                {/* Email is the only reliable identifier: a waitlisted user
                    never reaches onboarding, so they rarely have a handle. */}
                <p className="text-sm break-words">
                  {entry.email ?? "no email on file"}
                </p>
                {(entry.displayName || entry.username) && (
                  <p className="text-caption text-xs">
                    {entry.displayName}
                    {entry.username ? ` · @${entry.username}` : ""}
                  </p>
                )}

                <Button
                  onClick={() => grant(entry)}
                  disabled={pending}
                  className="w-full"
                >
                  Grant a seat
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </main>
    </div>
  );
}
