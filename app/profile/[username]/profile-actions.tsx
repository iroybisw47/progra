"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  acceptFriendRequest,
  blockUser,
  removeFriendship,
  sendFriendRequest,
} from "@/app/actions/friends";
import { setProfileIdentity } from "@/app/actions/profile";
import { ReportButton } from "@/components/report-button";
import type { PublicUser } from "@/lib/db/friends";
import type { Relationship } from "@/lib/db/profiles";

type Result = { ok: true } | { error: string };

export function ProfileActions({
  target,
  relationship,
}: {
  target: PublicUser;
  relationship: Relationship;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(target.displayName ?? "");
  const [bio, setBio] = useState(target.bio ?? "");

  function run(
    action: () => Promise<Result>,
    opts?: { okMsg?: string; then?: () => void }
  ) {
    startTransition(async () => {
      const r = await action();
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      if (opts?.okMsg) toast.success(opts.okMsg);
      if (opts?.then) opts.then();
    });
  }

  const k = relationship.kind;

  // The header sits these beside the name, so they're 32px chips rather than
  // full buttons — navy when the action is the primary one, hairline otherwise.
  const chip =
    "h-8 rounded-[11px] px-3.5 text-xs font-semibold whitespace-nowrap transition-transform active:scale-95 disabled:opacity-50";
  const solid = `bg-brand text-primary-foreground ${chip}`;
  const outline = `border-hairline text-caption border-[1.5px] ${chip}`;

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
      {k === "none" && (
        <button
          type="button"
          className={solid}
          disabled={pending}
          onClick={() =>
            run(() => sendFriendRequest(target.userId), { okMsg: "Request sent" })
          }
        >
          Add friend
        </button>
      )}

      {k === "outgoing" && (
        <button
          type="button"
          className={outline}
          disabled={pending}
          onClick={() => run(() => removeFriendship(relationship.requestId!))}
        >
          Requested
        </button>
      )}

      {k === "incoming" && (
        <>
          <button
            type="button"
            className={solid}
            disabled={pending}
            onClick={() =>
              run(() => acceptFriendRequest(relationship.requestId!), {
                okMsg: "Friend added",
              })
            }
          >
            Accept
          </button>
          <button
            type="button"
            className={outline}
            disabled={pending}
            onClick={() => run(() => removeFriendship(relationship.requestId!))}
          >
            Decline
          </button>
        </>
      )}

      {k === "friends" && (
        <>
          <button
            type="button"
            className={outline}
            disabled={pending}
            onClick={() =>
              run(() => removeFriendship(relationship.friendshipId!))
            }
          >
            Friends
          </button>
          <button
            type="button"
            className={`text-destructive ${chip}`}
            disabled={pending}
            onClick={() =>
              run(() => blockUser(target.userId), {
                okMsg: "User blocked",
                then: () => router.push("/friends"),
              })
            }
          >
            Block
          </button>
        </>
      )}

      {k === "self" && (
        <button
          type="button"
          className={outline}
          onClick={() => setEditing(true)}
        >
          Edit
        </button>
      )}

      {k !== "self" && (
        <ReportButton
          targetType="profile"
          targetId={target.userId}
          label="Report"
          className="self-center"
        />
      )}

      {k === "self" && (
        <Dialog open={editing} onOpenChange={setEditing}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit profile</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" htmlFor="pf-name">
                  Display name
                </label>
                <Input
                  id="pf-name"
                  className="h-10"
                  placeholder="Your name"
                  maxLength={50}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" htmlFor="pf-bio">
                  Bio
                </label>
                <Textarea
                  id="pf-bio"
                  placeholder="A line about you"
                  maxLength={300}
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Cancel
              </DialogClose>
              <Button
                disabled={pending}
                onClick={() =>
                  run(() => setProfileIdentity({ displayName, bio }), {
                    okMsg: "Saved",
                    then: () => setEditing(false),
                  })
                }
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
