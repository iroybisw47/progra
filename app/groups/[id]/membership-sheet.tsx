"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { BottomSheet, BottomSheetContent } from "@/components/v2/bottom-sheet";
import { joinGroup, leaveGroup } from "@/app/actions/groups";
import { track } from "@/lib/analytics";
import { GROUP_COPY, joinCopy, joinedToast, type GroupSummary } from "@/lib/groups";

// The Join / Leave sheet (loaded with next/dynamic from membership-button.tsx).
// Join says who you'll be friends with before you are — "You'll be friends
// with all N members, and they'll see your sessions." — where N leaves out
// anyone blocked or unfriended, since joining won't friend them. Leave says
// what goes and what stays. Either revalidates the page, which then reads as
// the member's or the non-member's view.
export function MembershipSheet({
  open,
  onOpenChange,
  group,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: GroupSummary;
}) {
  const [pending, startTransition] = useTransition();
  const leaving = group.isMember;

  function confirm() {
    startTransition(async () => {
      if (leaving) {
        const result = await leaveGroup(group.groupId).catch(() => ({ error: GROUP_COPY.leaveFailed }));
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
        track("group_left", { group_id: group.groupId, from: "group_page" });
      } else {
        const result = await joinGroup(group.groupId).catch(() => ({ error: GROUP_COPY.joinFailed }));
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
        track("group_joined", { group_id: group.groupId, new_friends: result.newFriends, from: "group_page" });
        toast.success(joinedToast(result.newFriends));
      }
      onOpenChange(false);
    });
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent title={leaving ? `Leave ${group.name}?` : `Join ${group.name}?`}>
        <p className="text-body pt-1 text-[14px] leading-[1.5] text-pretty">
          {leaving ? GROUP_COPY.leaveBody : joinCopy(group)}
        </p>
        <button
          type="button"
          onClick={confirm}
          disabled={pending}
          className="bg-brand text-primary-foreground mt-5 h-12 w-full rounded-[15px] text-sm font-semibold shadow-[0_10px_22px_-10px_var(--glow)] transition-transform active:scale-[.97] disabled:opacity-60"
        >
          {leaving ? GROUP_COPY.leaveGroup : GROUP_COPY.joinGroup}
        </button>
      </BottomSheetContent>
    </BottomSheet>
  );
}
