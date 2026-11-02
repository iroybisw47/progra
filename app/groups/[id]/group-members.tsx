"use client";

import dynamic from "next/dynamic";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";

import { PersonRow, type PersonAction } from "@/components/v2/person-row";
import { acceptFriendRequest, sendFriendRequest, unfriendUser } from "@/app/actions/friends";
import { track } from "@/lib/analytics";
import type { GroupMember, GroupMemberRelation } from "@/lib/db/groups";
import type { PublicUser } from "@/lib/db/friends";
import { GROUP_COPY } from "@/lib/groups";

// Lazy, per the repo's dialog rule: most visits never unfriend anyone.
const UnfriendDialog = dynamic(() => import("./unfriend-dialog").then((m) => m.UnfriendDialog), {
  ssr: false,
});

type Op = { userId: string; relation: GroupMemberRelation };

// A group's members, in the order they joined, each with what you can do:
// Unfriend a friend (after a confirm — it's for good, as far as groups go),
// Add friend to anyone else, Requested while yours is out, Accept theirs.
// Unfriending leaves them in the list with Add friend, which is the spec's
// "you can unfriend individual members without leaving the group". A tap
// shows at once (useOptimistic) and lasts while the action is out; the
// action's revalidation brings the real relation back, and a failure reverts
// it with the action's own message.
export function GroupMembers({ members }: { members: GroupMember[] }) {
  const [, startTransition] = useTransition();
  const [overlay, apply] = useOptimistic<Record<string, GroupMemberRelation>, Op>(
    {},
    (state, op) => ({ ...state, [op.userId]: op.relation })
  );
  const [confirming, setConfirming] = useState<PublicUser | null>(null);
  const [dialogLoaded, setDialogLoaded] = useState(false);

  function run(op: Op, call: () => Promise<{ ok: true } | { error: string }>, failed: string, onOk?: () => void) {
    startTransition(async () => {
      apply(op);
      let result: { ok: true } | { error: string };
      try {
        result = await call();
      } catch {
        result = { error: failed };
      }
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      onOk?.();
    });
  }

  function actionFor(user: PublicUser, relation: GroupMemberRelation): PersonAction {
    switch (relation.kind) {
      case "self":
        return { kind: "meta", text: GROUP_COPY.you };
      case "friends":
        return {
          kind: "button",
          label: GROUP_COPY.unfriend,
          onPress: () => {
            setDialogLoaded(true);
            setConfirming(user);
          },
        };
      case "outgoing":
        return { kind: "requested" };
      case "incoming":
        return {
          kind: "accept",
          onAccept: () =>
            run(
              { userId: user.userId, relation: { kind: "friends" } },
              () => acceptFriendRequest(relation.requestId),
              "Couldn't accept request."
            ),
        };
      case "none":
        return {
          kind: "button",
          label: GROUP_COPY.addFriend,
          onPress: () =>
            run(
              { userId: user.userId, relation: { kind: "outgoing", requestId: "" } },
              () => sendFriendRequest(user.userId),
              "Couldn't send request.",
              () => track("friend_request_sent", { target_id: user.userId })
            ),
        };
    }
  }

  return (
    <>
      <ul role="list" className="pt-3">
        {members.map((m) => (
          <li key={m.user.userId}>
            <PersonRow
              name={m.user.displayName}
              username={m.user.username}
              avatarUrl={m.user.avatarUrl}
              subline={m.user.displayName ? `@${m.user.username}` : null}
              href={`/profile/${m.user.username}`}
              action={actionFor(m.user, overlay[m.user.userId] ?? m.relation)}
            />
          </li>
        ))}
      </ul>
      {dialogLoaded && (
        <UnfriendDialog
          person={confirming}
          onOpenChange={(open) => {
            if (!open) setConfirming(null);
          }}
          onConfirm={(user) => {
            setConfirming(null);
            run(
              { userId: user.userId, relation: { kind: "none" } },
              () => unfriendUser(user.userId),
              "Couldn't update that friendship."
            );
          }}
        />
      )}
    </>
  );
}
