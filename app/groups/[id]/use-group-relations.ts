"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import {
  acceptFriendRequest,
  sendFriendRequest,
  unfriendUser,
} from "@/app/actions/friends";
import { track } from "@/lib/analytics";
import type { PublicUser } from "@/lib/db/friends";
import type { GroupMemberRelation } from "@/lib/db/groups";

type Op = { userId: string; relation: GroupMemberRelation };
type Result = { ok: true } | { error: string };

// What you are to each member, and the three things you can change about it,
// shared by the group page's member list and an open group's feed cards so
// the two can't disagree about a tap. Each write shows at once
// (useOptimistic) and lasts while the action is out; the action revalidates
// the page (revalidateFriendSurfaces includes /groups/[id]), which brings the
// real relation back to both. A failure reverts it and toasts the action's
// own message.
export function useGroupRelations() {
  const [, startTransition] = useTransition();
  const [overlay, apply] = useOptimistic<
    Record<string, GroupMemberRelation>,
    Op
  >({}, (state, op) => ({ ...state, [op.userId]: op.relation }));

  function run(
    op: Op,
    call: () => Promise<Result>,
    failed: string,
    onOk?: () => void,
  ) {
    startTransition(async () => {
      apply(op);
      let result: Result;
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

  return {
    // The relation as it shows now: a tap's, until the page's reads catch up.
    relationOf: (
      userId: string,
      read: GroupMemberRelation,
    ): GroupMemberRelation => overlay[userId] ?? read,
    add: (user: PublicUser) =>
      run(
        { userId: user.userId, relation: { kind: "outgoing", requestId: "" } },
        () => sendFriendRequest(user.userId),
        "Couldn't send request.",
        () => track("friend_request_sent", { target_id: user.userId }),
      ),
    accept: (user: PublicUser, requestId: string) =>
      run(
        { userId: user.userId, relation: { kind: "friends" } },
        () => acceptFriendRequest(requestId),
        "Couldn't accept request.",
      ),
    unfriend: (user: PublicUser) =>
      run(
        { userId: user.userId, relation: { kind: "none" } },
        () => unfriendUser(user.userId),
        "Couldn't update that friendship.",
      ),
  };
}
