"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { archiveGroup, createGroup, setGroupCap } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AdminGroup } from "@/lib/db/groups";
import {
  GROUP_CAP_DEFAULT,
  GROUP_CAP_MAX,
  GROUP_CAP_MIN,
  GROUP_DESCRIPTION_MAX,
  GROUP_NAME_MAX,
  capChangeNote,
  validateGroupCap,
  validateGroupInput,
} from "@/lib/groups";

// Groups (.claude/plans/groups.sql), admin-made for now: a create form (name,
// optional description, cap — default 50) and every group with its count.
// A live group's cap can be changed afterwards (STEP 3); lowering it below the
// count removes nobody, and the row says so before it's saved.
// Archive takes a second tap to confirm, because it's for good: the group
// leaves browse, everyone in it leaves, and the friendships only it backed
// end. The row itself is kept. Null `groups` means the admin RPCs aren't
// installed (groups.sql STEP 1 hasn't run), and the panel says so.
export function AdminGroups({ groups }: { groups: AdminGroup[] | null }) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cap, setCap] = useState(String(GROUP_CAP_DEFAULT));
  const [confirming, setConfirming] = useState<string | null>(null);
  // Typed caps not yet saved, by group id. A saved one is dropped, so the
  // field falls back to the group's cap as the refreshed list reads it.
  const [capDrafts, setCapDrafts] = useState<Record<string, string>>({});

  if (groups === null) {
    return (
      <div className="flex w-full flex-col items-center px-5 pt-8">
        <p className="text-caption w-full max-w-md text-sm">
          Groups unavailable — groups.sql STEP 1 hasn&apos;t run.
        </p>
      </div>
    );
  }

  function create() {
    const input = { name, description, cap: Number(cap) };
    const valid = validateGroupInput(input);
    if ("error" in valid) {
      toast.error(valid.error);
      return;
    }
    startTransition(async () => {
      const r = await createGroup(input);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(`${valid.name} created.`);
      setName("");
      setDescription("");
      setCap(String(GROUP_CAP_DEFAULT));
    });
  }

  function archive(group: AdminGroup) {
    if (confirming !== group.groupId) {
      setConfirming(group.groupId);
      return;
    }
    setConfirming(null);
    startTransition(async () => {
      const r = await archiveGroup(group.groupId);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(`${group.name} archived.`);
    });
  }

  function saveCap(group: AdminGroup) {
    const next = Number(capDrafts[group.groupId]);
    const valid = validateGroupCap(next);
    if ("error" in valid) {
      toast.error(valid.error);
      return;
    }
    startTransition(async () => {
      const r = await setGroupCap(group.groupId, next);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(`${group.name} now takes ${next}.`);
      setCapDrafts((d) => {
        const rest = { ...d };
        delete rest[group.groupId];
        return rest;
      });
    });
  }

  const live = groups.filter((g) => g.archivedAt === null);
  const archived = groups.filter((g) => g.archivedAt !== null);
  const field =
    "border-control-border w-full rounded-[11px] border-[1.5px] px-3 text-sm";

  return (
    <div className="flex w-full flex-col items-center px-5 pt-8">
      <main className="flex w-full max-w-md flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h1 className="text-[26px] font-bold tracking-tight">Groups</h1>
          <p className="text-caption text-sm">
            {live.length} live
            {archived.length > 0 ? ` · ${archived.length} archived` : ""}.
            Joining a group friends you with everyone in it.
          </p>
        </header>

        <Card>
          <CardContent className="flex flex-col gap-3 py-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-caption text-xs font-semibold">Name</span>
              <input
                value={name}
                maxLength={GROUP_NAME_MAX}
                onChange={(e) => setName(e.target.value)}
                className={`${field} h-10`}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-caption text-xs font-semibold">
                Description (optional)
              </span>
              <textarea
                value={description}
                maxLength={GROUP_DESCRIPTION_MAX}
                rows={2}
                onChange={(e) => setDescription(e.target.value)}
                className={`${field} py-2`}
              />
            </label>
            <div className="flex items-end gap-3">
              <label className="flex flex-1 flex-col gap-1.5">
                <span className="text-caption text-xs font-semibold">
                  Member cap
                </span>
                <input
                  type="number"
                  min={GROUP_CAP_MIN}
                  max={GROUP_CAP_MAX}
                  value={cap}
                  onChange={(e) => setCap(e.target.value)}
                  className={`${field} h-10`}
                />
              </label>
              <Button onClick={create} disabled={pending || name.trim() === ""}>
                Create group
              </Button>
            </div>
          </CardContent>
        </Card>

        {groups.length > 0 && (
          <Card>
            <CardContent className="flex flex-col py-1">
              {[...live, ...archived].map((g) => {
                const draft = capDrafts[g.groupId] ?? String(g.memberCap);
                const changed = draft !== String(g.memberCap);
                const note = changed
                  ? capChangeNote(g.memberCount, Number(draft))
                  : null;
                return (
                  <div
                    key={g.groupId}
                    className="border-divider flex flex-col gap-2 border-t py-3 first:border-t-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex min-w-0 flex-1 flex-col">
                        {g.archivedAt === null ? (
                          <Link
                            href={`/groups/${g.groupId}`}
                            className="truncate text-sm font-semibold"
                          >
                            {g.name}
                          </Link>
                        ) : (
                          <span className="text-caption truncate text-sm font-semibold">
                            {g.name}
                          </span>
                        )}
                        <span className="text-caption text-xs tabular-nums">
                          {g.archivedAt === null
                            ? `${g.memberCount}/${g.memberCap} members`
                            : `Archived ${new Date(g.archivedAt).toLocaleDateString()}`}
                        </span>
                      </div>
                      {g.archivedAt === null && (
                        <Button
                          variant={
                            confirming === g.groupId ? "destructive" : "outline"
                          }
                          size="sm"
                          disabled={pending}
                          onClick={() => archive(g)}
                          onBlur={() =>
                            setConfirming((c) => (c === g.groupId ? null : c))
                          }
                        >
                          {confirming === g.groupId
                            ? "Archive for good?"
                            : "Archive"}
                        </Button>
                      )}
                    </div>
                    {g.archivedAt === null && (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <label className="text-caption flex items-center gap-2 text-xs font-semibold">
                            Member cap
                            <input
                              type="number"
                              min={GROUP_CAP_MIN}
                              max={GROUP_CAP_MAX}
                              value={draft}
                              onChange={(e) =>
                                setCapDrafts((d) => ({
                                  ...d,
                                  [g.groupId]: e.target.value,
                                }))
                              }
                              className={`${field} h-8 w-20`}
                            />
                          </label>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pending || !changed}
                            onClick={() => saveCap(g)}
                          >
                            Save cap
                          </Button>
                        </div>
                        {note && (
                          <p className="text-caption text-xs text-pretty">
                            {note}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
