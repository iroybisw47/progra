"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { PersonRow, type PersonAction } from "@/components/v2/person-row";
import type { GroupMember, GroupMemberRelation } from "@/lib/db/groups";
import type { PublicUser } from "@/lib/db/friends";
import { GROUP_COPY } from "@/lib/groups";

import { useGroupRelations } from "./use-group-relations";

// Lazy, per the repo's dialog rule: most visits never unfriend anyone.
const UnfriendDialog = dynamic(
  () => import("./unfriend-dialog").then((m) => m.UnfriendDialog),
  {
    ssr: false,
  },
);

// A group's members, in the order they joined, each with what you can do:
// Unfriend a friend (after a confirm — it's for good, as far as groups go),
// Add friend to anyone else, Requested while yours is out, Accept theirs.
// Unfriending leaves them in the list with Add friend, which is the spec's
// "you can unfriend individual members without leaving the group". The
// writes, and how a tap shows before the server answers, are
// useGroupRelations', which an open group's feed cards share.
export function GroupMembers({ members }: { members: GroupMember[] }) {
  const relations = useGroupRelations();
  const [confirming, setConfirming] = useState<PublicUser | null>(null);
  const [dialogLoaded, setDialogLoaded] = useState(false);

  function actionFor(
    user: PublicUser,
    relation: GroupMemberRelation,
  ): PersonAction {
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
          onAccept: () => relations.accept(user, relation.requestId),
        };
      case "none":
        return {
          kind: "button",
          label: GROUP_COPY.addFriend,
          onPress: () => relations.add(user),
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
              action={actionFor(
                m.user,
                relations.relationOf(m.user.userId, m.relation),
              )}
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
            relations.unfriend(user);
          }}
        />
      )}
    </>
  );
}
