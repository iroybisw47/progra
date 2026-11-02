"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { PublicUser } from "@/lib/db/friends";
import { GROUP_COPY } from "@/lib/groups";

// "Unfriend Priya?" before it happens: an unfriend inside a group is
// recorded, so no group friends the pair again (unfriend_user). Loaded with
// next/dynamic from group-members.tsx; open while `person` is set.
export function UnfriendDialog({
  person,
  onOpenChange,
  onConfirm,
}: {
  person: PublicUser | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (person: PublicUser) => void;
}) {
  const name = person ? person.displayName?.split(" ")[0] || `@${person.username}` : "";
  return (
    <AlertDialog open={person !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unfriend {name}?</AlertDialogTitle>
          <AlertDialogDescription>{GROUP_COPY.unfriendBody}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => person && onConfirm(person)}>{GROUP_COPY.unfriend}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
